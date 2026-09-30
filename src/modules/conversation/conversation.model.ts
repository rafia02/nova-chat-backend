import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["dm", "group"],
      required: true,
    },

    dmKey: {
      type: String,
      select: false,
    },

    requestStatus: {
      type: String,
      enum: ["normal", "pending", "rejected"],
      default: "normal",
      required: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    name: {
      type: String,
      default: null, // group name
    },

    avatar: {
      type: String,
      default: null,
    },

    lastMessage: {
      type: String,
      default: "",
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ dmKey: 1 }, { unique: true, sparse: true });

export const Conversation = mongoose.model("Conversation", conversationSchema);
