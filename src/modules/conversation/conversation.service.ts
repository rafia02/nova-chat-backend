import { Conversation } from "./conversation.model";

export const createDM = async (userId: string, otherId: string) => {
  // check if already exists
  let convo = await Conversation.findOne({
    type: "dm",
    participants: { $all: [userId, otherId], $size: 2 },
  });

  if (convo) return convo;

  convo = await Conversation.create({
    type: "dm",
    participants: [userId, otherId],
  });

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
