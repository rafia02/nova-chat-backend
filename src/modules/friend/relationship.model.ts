import { Schema, model } from "mongoose";

const friendRequestSchema = new Schema(
  {
    pairKey: { type: String, required: true, unique: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true },
);

const friendshipSchema = new Schema(
  {
    pairKey: { type: String, required: true, unique: true },
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const FriendRequest = model("FriendRequest", friendRequestSchema);
export const Friendship = model("Friendship", friendshipSchema);

export const getPairKey = (firstId: string, secondId: string) =>
  [firstId.toString().toLowerCase(), secondId.toString().toLowerCase()]
    .sort()
    .join(":");
