import mongoose from "mongoose";
import { Conversation } from "./conversation.model";
import { User } from "../user/user.model";
import { ApiError } from "../../utils/ApiError";
import { areFriends } from "../friend/friend.service";

const getDmKey = (firstId: string, secondId: string) =>
  [firstId.toString().toLowerCase(), secondId.toString().toLowerCase()]
    .sort()
    .join(":");

export const createDM = async (userId: string, otherId: string) => {
  if (!mongoose.Types.ObjectId.isValid(otherId)) {
    throw new ApiError(400, "Invalid user ID");
  }
  if (userId.toLowerCase() === otherId.toLowerCase()) {
    throw new ApiError(400, "Cannot create a conversation with yourself");
  }
  if (!(await User.exists({ _id: otherId })))
    throw new ApiError(404, "User not found");

  const dmKey = getDmKey(userId, otherId);
  let convo = await Conversation.findOne({
    dmKey,
  });

  if (!convo) {
    convo = await Conversation.findOne({
      type: "dm",
      participants: { $all: [userId, otherId], $size: 2 },
    });
    if (convo) {
      convo.dmKey = dmKey;
      await convo.save();
      return convo;
    }
  }

  if (convo) return convo;

  const isFriend = await areFriends(userId, otherId);
  try {
    convo = await Conversation.create({
      type: "dm",
      dmKey,
      participants: [userId, otherId],
      requestStatus: isFriend ? "normal" : "pending",
      requestedBy: isFriend ? null : userId,
    });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    convo = await Conversation.findOne({ dmKey });
  }

  return convo;
};

export const createGroup = async (
  creatorId: string,
  name: string,
  members: string[],
) => {
  return await Conversation.create({
    type: "group",
    name,
    participants: [creatorId, ...members],
  });
};

export const getUserConversations = async (userId: string) => {
  return await Conversation.find({
    participants: userId,
    $or: [
      { requestStatus: "normal" },
      { requestStatus: "pending", requestedBy: userId },
    ],
  })
    .sort({ updatedAt: -1 })
    .populate("participants", "name avatar status")
    .exec();
};

export const updateLastMessage = async (convoId: string, message: string) => {
  return await Conversation.findByIdAndUpdate(
    convoId,
    {
      lastMessage: message,
      lastMessageAt: new Date(),
    },
    { new: true },
  );
};
