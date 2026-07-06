import bcrypt from "bcrypt";
import { generateToken } from "../../utils/jwt";
import { User } from "../user/user.model";
import { MESSAGE } from "../../constants/messages";

export const registerUser = async (payload: any) => {
  const existing = await User.findOne({
    email: payload.email,
  });

  if (existing) {
    throw new Error(MESSAGE.USER_EXISTS);
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const user = await User.create({
    ...payload,
    password: hashedPassword,
  });

  // password response থেকে remove করার জন্য আবার fetch করছি
  const createdUser = await User.findById(user._id);

  const token = generateToken(user._id.toString());

  return {
    user: createdUser,
    token,
  };
};

export const loginUser = async (payload: any) => {
  // password hidden থাকায় select("+password") ব্যবহার করছি
  const user = await User.findOne({
    email: payload.email,
  }).select("+password");

  if (!user) {
    throw new Error(MESSAGE.USER_NOT_FOUND);
  }

  const isMatch = await bcrypt.compare(payload.password, user.password);

  if (!isMatch) {
    throw new Error(MESSAGE.INVALID_CREDENTIALS);
  }

  const token = generateToken(user._id.toString());

  // password ছাড়া user ফেরত দিচ্ছি
  const loggedInUser = await User.findById(user._id);

  return {
    user: loggedInUser,
    token,
  };
};

export const getMe = async (userId: string) => {
  return await User.findById(userId);
};
