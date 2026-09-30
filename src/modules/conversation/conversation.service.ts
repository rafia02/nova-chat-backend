import mongoose from "mongoose";
import { Conversation } from "./conversation.model";
import { User } from "../user/user.model";
import { ApiError } from "../../utils/ApiError";
import { areFriends } from "../friend/friend.service";
import { getIO } from "../../socket/socket";
import { SERVER_EVENTS } from "../../socket/socket.events";
import { removeUserFromConversationRoom } from "../../socket/socket";

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
      convo.requestStatus = "normal";
      convo.requestedBy = null;
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
  avatar?: string,
) => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName || normalizedName.length > 80) {
    throw new ApiError(400, "Group name must contain 1 to 80 characters");
  }
  if (!Array.isArray(members) || members.length > 49) {
    throw new ApiError(400, "A group can include up to 50 participants");
  }
  const participantIds = [
    ...new Set(
      [creatorId, ...members.map(String)].map((id) => id.toLowerCase()),
    ),
  ];
  if (participantIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(400, "Invalid member ID");
  }
  const usersExist = await User.countDocuments({
    _id: { $in: participantIds },
  });
  if (usersExist !== participantIds.length)
    throw new ApiError(404, "One or more users were not found");
  const conversation = await Conversation.create({
    type: "group",
    name: normalizedName,
    avatar: avatar || null,
    participants: participantIds,
    admins: [creatorId],
    createdBy: creatorId,
  });
  const io = getIO();
  let recipients = io.to(`user:${participantIds[0]}`);
  for (const participantId of participantIds.slice(1))
    recipients = recipients.to(`user:${participantId}`);
  recipients.emit(SERVER_EVENTS.GROUP_CREATED, conversation);
  return conversation;
};

const getGroupForMember = async (conversationId: string, userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId))
    throw new ApiError(400, "Invalid conversation ID");
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "group",
    participants: userId,
  });
  if (!conversation) throw new ApiError(404, "Group not found");
  return conversation;
};

const assertGroupAdmin = async (conversation: any, userId: string) => {
  const admins = conversation.admins ?? [];
  const legacyOwner =
    conversation.createdBy?.toString() ??
    conversation.participants[0]?.toString();
  if (admins.some((admin: any) => admin.toString() === userId)) return;
  if (admins.length === 0 && legacyOwner === userId) {
    conversation.admins = [userId];
    await conversation.save();
    return;
  }
  if (!admins.some((admin: any) => admin.toString() === userId)) {
    throw new ApiError(403, "Group administrator permission required");
  }
};

const emitGroupUpdate = (
  conversation: any,
  event: string,
  payload: any = conversation,
  extraIds: string[] = [],
) => {
  const participantIds = new Set<string>([
    ...conversation.participants.map((participant: any) =>
      participant.toString(),
    ),
    ...extraIds,
  ]);
  if (participantIds.size === 0) return;
  const ids = [...participantIds];
  let target = getIO().to(`user:${ids[0]}`);
  for (const id of ids.slice(1)) target = target.to(`user:${id}`);
  target.emit(event, payload);
};

export const getConversation = async (
  conversationId: string,
  userId: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId))
    throw new ApiError(400, "Invalid conversation ID");
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  })
    .populate("participants", "name avatar status")
    .populate("admins", "name avatar");
  if (!conversation) throw new ApiError(404, "Conversation not found");
  return conversation;
};

export const updateGroup = async (
  conversationId: string,
  userId: string,
  updates: { name?: string; avatar?: string },
) => {
  const conversation = await getGroupForMember(conversationId, userId);
  await assertGroupAdmin(conversation, userId);
  if (updates.name !== undefined) {
    if (
      typeof updates.name !== "string" ||
      !updates.name.trim() ||
      updates.name.trim().length > 80
    ) {
      throw new ApiError(400, "Group name must contain 1 to 80 characters");
    }
    conversation.name = updates.name.trim();
  }
  if (updates.avatar !== undefined) conversation.avatar = updates.avatar;
  await conversation.save();
  emitGroupUpdate(conversation, SERVER_EVENTS.GROUP_UPDATED);
  return conversation;
};

export const addGroupMembers = async (
  conversationId: string,
  userId: string,
  memberIds: string[],
) => {
  const conversation = await getGroupForMember(conversationId, userId);
  await assertGroupAdmin(conversation, userId);
  if (
    !Array.isArray(memberIds) ||
    memberIds.length === 0 ||
    memberIds.length > 49
  ) {
    throw new ApiError(400, "Provide between 1 and 49 member IDs");
  }
  const ids = [...new Set(memberIds.map(String))];
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id)))
    throw new ApiError(400, "Invalid member ID");
  const newIds = ids.filter(
    (id) =>
      !conversation.participants.some(
        (participant) => participant.toString() === id,
      ),
  );
  if (conversation.participants.length + newIds.length > 50)
    throw new ApiError(400, "Group participant limit is 50");
  if (newIds.length === 0)
    throw new ApiError(409, "All users are already group members");
  const count = await User.countDocuments({ _id: { $in: newIds } });
  if (count !== newIds.length)
    throw new ApiError(404, "One or more users were not found");
  const updated = await Conversation.findOneAndUpdate(
    {
      _id: conversationId,
      type: "group",
      admins: userId,
      participants: { $nin: newIds },
      $expr: { $lte: [{ $size: "$participants" }, 50 - newIds.length] },
    },
    { $addToSet: { participants: { $each: newIds } } },
    { new: true },
  );
  if (!updated)
    throw new ApiError(409, "Group membership changed; retry the request");
  emitGroupUpdate(
    updated,
    SERVER_EVENTS.GROUP_MEMBER_ADDED,
    { conversation: updated, memberIds: newIds },
    newIds,
  );
  return updated;
};

export const removeGroupMember = async (
  conversationId: string,
  actorId: string,
  memberId: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(memberId))
    throw new ApiError(400, "Invalid user ID");
  const conversation = await getGroupForMember(conversationId, actorId);
  const isSelf = actorId === memberId;
  if (!isSelf) await assertGroupAdmin(conversation, actorId);
  if (
    !conversation.participants.some(
      (participant) => participant.toString() === memberId,
    )
  ) {
    throw new ApiError(404, "Group member not found");
  }
  const remainingIds = conversation.participants
    .map((participant) => participant.toString())
    .filter((participantId) => participantId !== memberId);
  const remainingAdmins = conversation.admins
    .map((admin) => admin.toString())
    .filter((adminId) => adminId !== memberId);
  if (
    isSelf &&
    conversation.admins.some((admin) => admin.toString() === memberId) &&
    remainingIds.length > 0 &&
    remainingAdmins.length === 0
  ) {
    remainingAdmins.push(remainingIds[0]);
  }
  const updated = await Conversation.findOneAndUpdate(
    { _id: conversationId, type: "group", participants: actorId },
    { $pull: { participants: memberId, admins: memberId } },
    { new: true },
  );
  if (!updated)
    throw new ApiError(409, "Group membership changed; retry the request");
  if (
    remainingAdmins.length > 0 &&
    remainingAdmins.some(
      (id) => !updated.admins.some((admin) => admin.toString() === id),
    )
  ) {
    updated.admins = remainingAdmins as any;
    await updated.save();
  }
  await removeUserFromConversationRoom(conversationId, memberId);
  emitGroupUpdate(
    updated,
    SERVER_EVENTS.GROUP_MEMBER_REMOVED,
    { conversation: updated, memberId },
    [memberId],
  );
  return updated;
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
    .populate("admins", "name avatar")
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
