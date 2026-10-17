import bcrypt from "bcrypt";
import { generateToken } from "../../utils/jwt";
import { User } from "../user/user.model";
import { MESSAGE } from "../../constants/messages";
import { ApiError } from "../../utils/ApiError";

type Credentials = { email: string; password: string };

const normalizeCredentials = (payload: unknown): Credentials => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Email and password are required");
  }
  const { email, password } = payload as Record<string, unknown>;
  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw new ApiError(400, "A valid email is required");
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new ApiError(400, "Password must contain 8 to 128 characters");
  }
  return { email: email.trim().toLowerCase(), password };
};

export const registerUser = async (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Name, email and password are required");
  }
  const { name } = payload as Record<string, unknown>;
  const credentials = normalizeCredentials(payload);
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
    throw new ApiError(400, "Name must contain 1 to 80 characters");
  }
  if (await User.exists({ email: credentials.email })) {
    throw new ApiError(409, MESSAGE.USER_EXISTS);
  }

  const hashedPassword = await bcrypt.hash(credentials.password, 12);

  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: credentials.email,
      password: hashedPassword,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ApiError(409, MESSAGE.USER_EXISTS);
    }
    throw error;
  }

  const token = generateToken(user._id.toString());
  const { password: _password, ...safeUser } = user.toObject();
  return {
    user: safeUser,
    token,
  };
};

export const loginUser = async (payload: unknown) => {
  const credentials = normalizeCredentials(payload);
  const user = await User.findOne({
    email: credentials.email,
  }).select("+password");

  if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
    throw new ApiError(401, MESSAGE.INVALID_CREDENTIALS);
  }

  const token = generateToken(user._id.toString());
  const { password: _password, ...safeUser } = user.toObject();

  return {
    user: safeUser,
    token,
  };
};

export const getMe = async (userId: string) => {
  return User.findById(userId).select("-password");
};
