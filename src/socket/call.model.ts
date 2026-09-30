import { Schema, model } from "mongoose";

const callSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    callerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participantIds: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    type: { type: String, enum: ["audio", "video"], required: true },
    status: {
      type: String,
      enum: ["ringing", "accepted", "rejected", "ended", "missed"],
      required: true,
    },
    active: { type: Boolean, default: true, required: true },
    expiresAt: { type: Date, required: true },
    endedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

callSchema.index(
  { participantIds: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export const Call = model("Call", callSchema);
