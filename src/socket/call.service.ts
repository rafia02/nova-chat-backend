import { Server } from "socket.io";
import { Types } from "mongoose";
import { ApiError } from "../utils/ApiError";
import { Conversation } from "../modules/conversation/conversation.model";
import { Call } from "./call.model";
import { SERVER_EVENTS } from "./socket.events";

const CALL_TIMEOUT_MS = 45_000;
const callTimers = new Map<string, NodeJS.Timeout>();

const emitToCallParticipants = (
  io: Server,
  call: any,
  event: string,
  payload: Record<string, unknown>,
) => {
  io.to(`user:${call.callerId}`)
    .to(`user:${call.recipientId}`)
    .emit(event, payload);
};

const scheduleTimeout = (io: Server, callId: string) => {
  const timeout = setTimeout(async () => {
    callTimers.delete(callId);
    const call = await Call.findOneAndUpdate(
      { _id: callId, active: true, status: "ringing" },
      { $set: { active: false, status: "missed" } },
      { new: true },
    );
    if (call) {
      emitToCallParticipants(io, call, SERVER_EVENTS.CALL_ENDED, {
        callId,
        status: "missed",
      });
    }
  }, CALL_TIMEOUT_MS);
  timeout.unref();
  callTimers.set(callId, timeout);
};

const clearTimeoutForCall = (callId: string) => {
  const timeout = callTimers.get(callId);
  if (timeout) clearTimeout(timeout);
  callTimers.delete(callId);
};

const callLookup = (identifier: string, userId: string) => ({
  $or: [{ _id: identifier }, { conversationId: identifier }],
  participantIds: userId,
});

export const initiateCall = async (io: Server, callerId: string, data: any) => {
  const { conversationId, type } = data || {};
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }
  if (type !== "audio" && type !== "video") {
    throw new ApiError(400, "Call type must be audio or video");
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "dm",
    participants: callerId,
    requestStatus: "normal",
  });
  if (!conversation || conversation.participants.length !== 2) {
    throw new ApiError(403, "Calls require an authorized direct conversation");
  }

  const recipientId = conversation.participants
    .find((participant) => participant.toString() !== callerId)
    ?.toString();
  if (!recipientId) throw new ApiError(400, "Invalid call recipient");

  const [callerBusy, recipientBusy, recipientSockets] = await Promise.all([
    Call.exists({ participantIds: callerId, active: true }),
    Call.exists({ participantIds: recipientId, active: true }),
    io.in(`user:${recipientId}`).fetchSockets(),
  ]);
  if (callerBusy || recipientBusy || recipientSockets.length === 0) {
    const reason = callerBusy
      ? "caller-busy"
      : recipientBusy
        ? "busy"
        : "offline";
    let missedCallId: string | undefined;
    if (!callerBusy) {
      const missedCall = await Call.create({
        conversationId,
        callerId,
        recipientId,
        participantIds: [callerId, recipientId],
        type,
        status: "missed",
        active: false,
        expiresAt: new Date(),
      });
      missedCallId = missedCall._id.toString();
    }
    io.to(`user:${callerId}`).emit(SERVER_EVENTS.CALL_BUSY, {
      conversationId,
      recipientId,
      reason,
      callId: missedCallId,
      status: missedCallId ? "missed" : undefined,
    });
    return null;
  }

  let call;
  try {
    call = await Call.create({
      conversationId,
      callerId,
      recipientId,
      participantIds: [callerId, recipientId],
      type,
      status: "ringing",
      active: true,
      expiresAt: new Date(Date.now() + CALL_TIMEOUT_MS),
    });
  } catch (error: any) {
    if (error.code === 11000) {
      const missedCall = await Call.create({
        conversationId,
        callerId,
        recipientId,
        participantIds: [callerId, recipientId],
        type,
        status: "missed",
        active: false,
        expiresAt: new Date(),
      });
      io.to(`user:${callerId}`).emit(SERVER_EVENTS.CALL_BUSY, {
        conversationId,
        recipientId,
        reason: "busy",
        callId: missedCall._id,
        status: "missed",
      });
      return null;
    }
    throw error;
  }

  scheduleTimeout(io, call._id.toString());
  io.to(`user:${recipientId}`).emit(SERVER_EVENTS.CALL_INCOMING, {
    callId: call._id,
    conversationId,
    callerId,
    from: callerId,
    type,
    status: call.status,
  });
  return call;
};

export const acceptCall = async (
  io: Server,
  userId: string,
  callId: string,
) => {
  if (!Types.ObjectId.isValid(callId))
    throw new ApiError(400, "Invalid call ID");
  const call = await Call.findOneAndUpdate(
    {
      ...callLookup(callId, userId),
      recipientId: userId,
      status: "ringing",
      active: true,
    },
    { $set: { status: "accepted" } },
    { new: true },
  );
  if (!call) throw new ApiError(404, "Ringing call not found");
  clearTimeoutForCall(call._id.toString());
  emitToCallParticipants(io, call, SERVER_EVENTS.CALL_ACCEPTED, {
    callId: call._id,
    conversationId: call.conversationId,
    userId,
    status: call.status,
  });
  return call;
};

export const rejectCall = async (
  io: Server,
  userId: string,
  callId: string,
) => {
  if (!Types.ObjectId.isValid(callId))
    throw new ApiError(400, "Invalid call ID");
  const call = await Call.findOneAndUpdate(
    {
      ...callLookup(callId, userId),
      recipientId: userId,
      status: "ringing",
      active: true,
    },
    { $set: { status: "rejected", active: false, endedBy: userId } },
    { new: true },
  );
  if (!call) throw new ApiError(404, "Ringing call not found");
  clearTimeoutForCall(call._id.toString());
  emitToCallParticipants(io, call, SERVER_EVENTS.CALL_REJECTED, {
    callId: call._id,
    conversationId: call.conversationId,
    userId,
    status: call.status,
  });
  return call;
};

export const endCall = async (io: Server, userId: string, callId: string) => {
  if (!Types.ObjectId.isValid(callId))
    throw new ApiError(400, "Invalid call ID");
  const call = await Call.findOneAndUpdate(
    { ...callLookup(callId, userId), active: true },
    { $set: { status: "ended", active: false, endedBy: userId } },
    { new: true },
  );
  if (!call) throw new ApiError(404, "Active call not found");
  clearTimeoutForCall(call._id.toString());
  emitToCallParticipants(io, call, SERVER_EVENTS.CALL_ENDED, {
    callId: call._id,
    conversationId: call.conversationId,
    userId,
    status: call.status,
  });
  return call;
};

export const relayCallSignal = async (
  io: Server,
  userId: string,
  data: any,
) => {
  const callId = data?.callId ?? data?.conversationId;
  if (!Types.ObjectId.isValid(callId))
    throw new ApiError(400, "Invalid call ID");
  const signal = data.signal ?? data.offer ?? data.answer ?? data.candidate;
  if (!signal || typeof signal !== "object") {
    throw new ApiError(400, "A WebRTC signal payload is required");
  }
  const call = await Call.findOne({
    ...callLookup(callId, userId),
    status: { $in: ["ringing", "accepted"] },
    active: true,
  });
  if (!call) throw new ApiError(403, "No active call for this user");
  const recipientId =
    call.callerId.toString() === userId
      ? call.recipientId.toString()
      : call.callerId.toString();
  io.to(`user:${recipientId}`).emit("call:signal", {
    callId: call._id,
    fromUserId: userId,
    signal,
  });
};

export const handleCallDisconnect = async (io: Server, userId: string) => {
  const calls = await Call.find({ participantIds: userId, active: true });
  for (const activeCall of calls) {
    const status = activeCall.status === "ringing" ? "missed" : "ended";
    const call = await Call.findOneAndUpdate(
      { _id: activeCall._id, active: true },
      { $set: { active: false, status, endedBy: userId } },
      { new: true },
    );
    if (call) {
      clearTimeoutForCall(call._id.toString());
      const otherId =
        call.callerId.toString() === userId
          ? call.recipientId.toString()
          : call.callerId.toString();
      io.to(`user:${otherId}`).emit(SERVER_EVENTS.CALL_ENDED, {
        callId: call._id,
        conversationId: call.conversationId,
        userId,
        status,
      });
    }
  }
};

export const cleanupCallsAfterRestart = async () => {
  await Call.updateMany(
    { active: true, status: "ringing" },
    { $set: { active: false, status: "missed" } },
  );
  await Call.updateMany(
    { active: true, status: "accepted" },
    { $set: { active: false, status: "ended" } },
  );
};
