import mongoose, { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";
import { SERVER_EVENTS } from "../../socket/socket.events";
import { User } from "../user/user.model";
import { Conversation } from "../conversation/conversation.model";
import { FriendRequest, Friendship, getPairKey } from "./relationship.model";

const validId = (id: string) => Types.ObjectId.isValid(id);

const emitToPair = (
  firstId: string,
  secondId: string,
  event: string,
  data: any,
) => {
  const io = getIO();
  io.to(`user:${firstId}`).emit(event, data);
  io.to(`user:${secondId}`).emit(event, data);
};

export const areFriends = async (firstId: string, secondId: string) =>
  Friendship.exists({ pairKey: getPairKey(firstId, secondId) });

export const sendFriendRequest = async (
  senderId: string,
  recipientId: string,
) => {
  if (!validId(recipientId)) throw new ApiError(400, "Invalid user ID");
  if (senderId.toLowerCase() === recipientId.toLowerCase()) {
    throw new ApiError(400, "Cannot request yourself");
  }
  if (!(await User.exists({ _id: recipientId }))) {
    throw new ApiError(404, "User not found");
  }

  const pairKey = getPairKey(senderId, recipientId);
  if (await Friendship.exists({ pairKey })) {
    throw new ApiError(409, "Users are already friends");
  }

  let request;
  try {
    request = await FriendRequest.findOneAndUpdate(
      { pairKey, status: { $ne: "pending" } },
      { $set: { senderId, recipientId, status: "pending" } },
      { new: true, upsert: true, runValidators: true },
    );
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ApiError(
        409,
        "A request between these users is already pending",
      );
    }
    throw error;
  }

  if (!request)
    throw new ApiError(409, "A request between these users is already pending");

  const populated = await request.populate("senderId", "name avatar");
  getIO()
    .to(`user:${recipientId}`)
    .emit(SERVER_EVENTS.FRIEND_REQUEST_NEW, populated);
  return populated;
};

export const getFriendRequests = (
  userId: string,
  direction: "received" | "sent",
) =>
  FriendRequest.find({
    status: "pending",
    [direction === "received" ? "recipientId" : "senderId"]: userId,
  })
    .sort({ createdAt: -1 })
    .populate("senderId recipientId", "name avatar");

export const acceptFriendRequest = async (
  requestId: string,
  userId: string,
) => {
  if (!validId(requestId)) throw new ApiError(400, "Invalid request ID");
  const session = await mongoose.startSession();
  let request: any;

  try {
    await session.withTransaction(async () => {
      request = await FriendRequest.findOne({
        _id: requestId,
        recipientId: userId,
        status: "pending",
      }).session(session);
      if (!request) throw new ApiError(404, "Pending friend request not found");

      const pairKey = getPairKey(request.senderId.toString(), userId);
      await Friendship.create(
        [{ pairKey, userA: request.senderId, userB: userId }],
        { session },
      );
      await Conversation.updateOne(
        {
          type: "dm",
          participants: { $all: [request.senderId, userId], $size: 2 },
          requestStatus: "pending",
        },
        { $set: { requestStatus: "normal", requestedBy: null } },
        { session },
      );
      request.status = "accepted";
      await request.save({ session });
    });
  } finally {
    await session.endSession();
  }

  const result = await request.populate("senderId recipientId", "name avatar");
  emitToPair(
    request.senderId.toString(),
    userId,
    SERVER_EVENTS.FRIEND_REQUEST_ACCEPTED,
    result,
  );
  return result;
};

export const rejectFriendRequest = async (
  requestId: string,
  userId: string,
) => {
  if (!validId(requestId)) throw new ApiError(400, "Invalid request ID");
  const request = await FriendRequest.findOneAndUpdate(
    { _id: requestId, recipientId: userId, status: "pending" },
    { $set: { status: "rejected" } },
    { new: true },
  );
  if (!request) throw new ApiError(404, "Pending friend request not found");
  emitToPair(
    request.senderId.toString(),
    userId,
    SERVER_EVENTS.FRIEND_REQUEST_REJECTED,
    request,
  );
  return request;
};

export const cancelFriendRequest = async (
  requestId: string,
  userId: string,
) => {
  if (!validId(requestId)) throw new ApiError(400, "Invalid request ID");
  const request = await FriendRequest.findOneAndUpdate(
    { _id: requestId, senderId: userId, status: "pending" },
    { $set: { status: "cancelled" } },
    { new: true },
  );
  if (!request) throw new ApiError(404, "Pending sent request not found");
  return request;
};

export const getFriends = async (userId: string) => {
  const friendships = await Friendship.find({
    $or: [{ userA: userId }, { userB: userId }],
  }).populate("userA userB", "name avatar status");

  return friendships.map((friendship: any) =>
    friendship.userA._id.toString() === userId
      ? friendship.userB
      : friendship.userA,
  );
};

export const removeFriend = async (userId: string, otherId: string) => {
  if (!validId(otherId)) throw new ApiError(400, "Invalid user ID");
  const result = await Friendship.findOneAndDelete({
    pairKey: getPairKey(userId, otherId),
  });
  if (!result) throw new ApiError(404, "Friendship not found");
  emitToPair(userId, otherId, SERVER_EVENTS.FRIEND_REMOVED, {
    userId,
    friendId: otherId,
  });
  return { userId, friendId: otherId };
};

export const getFriendStatus = async (userId: string, otherId: string) => {
  if (!validId(otherId)) throw new ApiError(400, "Invalid user ID");
  const pairKey = getPairKey(userId, otherId);
  if (await Friendship.exists({ pairKey }))
    return { status: "friends", areFriends: true };
  const request = await FriendRequest.findOne({ pairKey, status: "pending" });
  if (!request) return { status: "none", areFriends: false };
  return {
    status: request.senderId.toString() === userId ? "sent" : "received",
    areFriends: false,
  };
};
