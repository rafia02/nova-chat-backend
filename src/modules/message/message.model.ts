import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    media: {
      url: String,
      name: String,
      type: {
        type: String,
        enum: ["image", "video", "audio", "file"],
      },
    },

    replyTo: {
      messageId: String,
      content: String,
      senderId: String,
    },

    reactions: [
      {
        emoji: String,
        userId: String,
      },
    ],

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    editedAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Message = mongoose.model("Message", messageSchema);
