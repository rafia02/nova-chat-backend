import dotenv from "dotenv";
dotenv.config();

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const port = Number(process.env.PORT ?? 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const defaultOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://localhost:5173"];
if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN?.trim()) {
  throw new Error("CORS_ORIGIN must be configured in production");
}
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : defaultOrigins;

export const env = {
  PORT: port,
  DATABASE_URL: required("DATABASE_URL"),
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  CORS_ORIGINS: corsOrigins,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUD_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUD_API_SECRET,
};
