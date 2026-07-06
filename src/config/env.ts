import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT!,
  DATABASE_URL: process.env.DATABASE_URL!,

  NODE_ENV: process.env.NODE_ENV || "development",

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
};
