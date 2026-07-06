import { User } from "./user.model";

export const getAllUsers = async () => {
  return await User.find().select("-password");
};

export const getUserById = async (id: string) => {
  return await User.findById(id).select("-password");
};

export const updateUser = async (id: string, payload: any) => {
  return await User.findByIdAndUpdate(id, payload, {
    new: true,
  }).select("-password");
};

export const searchUsers = async (query: string) => {
  return await User.find({
    name: { $regex: query, $options: "i" },
  }).select("-password");
};
