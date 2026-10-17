import { User } from "./user.model";
import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";

export const getAllUsers = async () => {
  return User.find().select("name avatar bio status lastSeen createdAt");
};

export const getUserById = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid user ID");
  const user = await User.findById(id).select(
    "name avatar bio status lastSeen createdAt",
  );
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

export const updateUser = async (id: string, payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "Profile fields are required");
  }
  const input = payload as Record<string, unknown>;
  const updates: { name?: string; avatar?: string; bio?: string } = {};
  if (input.name !== undefined) {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.trim().length > 80
    ) {
      throw new ApiError(400, "Name must contain 1 to 80 characters");
    }
    updates.name = input.name.trim();
  }
  if (input.avatar !== undefined) {
    if (typeof input.avatar !== "string" || input.avatar.length > 2048) {
      throw new ApiError(400, "Invalid avatar URL");
    }
    updates.avatar = input.avatar;
  }
  if (input.bio !== undefined) {
    if (typeof input.bio !== "string" || input.bio.length > 500) {
      throw new ApiError(400, "Bio must be 500 characters or fewer");
    }
    updates.bio = input.bio.trim();
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No supported profile fields provided");
  }
  const user = await User.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).select("name avatar bio status lastSeen createdAt");
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

export const searchUsers = async (query: string) => {
  if (typeof query !== "string" || !query.trim() || query.trim().length > 100) {
    throw new ApiError(400, "Search query must contain 1 to 100 characters");
  }
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.find({
    name: { $regex: escaped, $options: "i" },
  })
    .select("name avatar bio status lastSeen createdAt")
    .limit(25);
};
