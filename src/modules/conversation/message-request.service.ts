import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { getIO, restrictConversationRoom } from "../../socket/socket";
import { SERVER_EVENTS } from "../../socket/socket.events";
import { Conversation } from "./conversation.model";

const populateParticipants = (query: any) =>
  query.populate("participants", "name avatar status");

const emitToParticipants = (conversation: any, event: string) => {
  const io = getIO();
  for (const participant of conversation.participants) {
    const participantId = participant._id
      ? participant._id.toString()
      : participant.toString();
    io.to(`user:${participantId}`).emit(event, conversation);
  }
};

export const getMessageRequests = (userId: string, sent = false) =>
  populateParticipants(
    Conversation.find({
      type: "dm",
      requestStatus: "pending",
      [sent ? "requestedBy" : "participants"]: userId,
      ...(sent ? {} : { requestedBy: { $ne: userId } }),
    }).sort({ updatedAt: -1 }),
  );

export const acceptMessageRequest = async (
  conversationId: string,
  userId: string,
) => {
  if (!Types.ObjectId.isValid(conversationId))
    throw new ApiError(400, "Invalid conversation ID");
  const conversation = await Conversation.findOneAndUpdate(
    {
      _id: conversationId,
      type: "dm",
      participants: userId,
      requestedBy: { $ne: userId },
      requestStatus: "pending",
    },
    { $set: { requestStatus: "normal", requestedBy: null } },
    { new: true },
  );
  if (!conversation)
    throw new ApiError(404, "Pending message request not found");
  await restrictConversationRoom(conversationId);
  const result = await populateParticipants(
    Conversation.findById(conversation._id),
  );
  emitToParticipants(result, SERVER_EVENTS.MESSAGE_REQUEST_ACCEPTED);
  return result;
};

export const rejectMessageRequest = async (
  conversationId: string,
  userId: string,
) => {
  if (!Types.ObjectId.isValid(conversationId))
    throw new ApiError(400, "Invalid conversation ID");
  const conversation = await Conversation.findOneAndUpdate(
    {
      _id: conversationId,
      type: "dm",
      participants: userId,
      requestedBy: { $ne: userId },
      requestStatus: "pending",
    },
    { $set: { requestStatus: "rejected" } },
    { new: true },
  );
  if (!conversation)
    throw new ApiError(404, "Pending message request not found");
  await restrictConversationRoom(conversationId);
  const result = await populateParticipants(
    Conversation.findById(conversation._id),
  );
  emitToParticipants(result, SERVER_EVENTS.MESSAGE_REQUEST_REJECTED);
  return result;
};
