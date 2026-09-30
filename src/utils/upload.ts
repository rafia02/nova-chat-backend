import multer from "multer";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
  "audio/3gpp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Unsupported attachment MIME type");
      (error as any).statusCode = 415;
      return callback(error);
    }
    callback(null, true);
  },
});
