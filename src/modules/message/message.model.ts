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
      default: "",
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

    attachments: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        type: {
          type: String,
          enum: ["image", "video", "audio", "file"],
          required: true,
        },
        publicId: String,
      },
    ],

    clientMessageId: {
      type: String,
      maxlength: 128,
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

messageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  },
);

export const Message = mongoose.model("Message", messageSchema);
