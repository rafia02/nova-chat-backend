import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

export const uploadToCloudinary = async (fileBuffer: Buffer) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new ApiError(
      503,
      "File uploads require CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET",
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "auto" }, (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result);
      })
      .end(fileBuffer);
  });
};
