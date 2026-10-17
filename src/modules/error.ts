import { NextFunction, Request, Response } from "express";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode =
    err.statusCode ||
    err.status ||
    (err.name === "ValidationError" ? 400 : undefined) ||
    (err.name === "CastError" ? 400 : undefined) ||
    (err.code === 11000 ? 409 : undefined) ||
    (err.code === "LIMIT_FILE_SIZE"
      ? 413
      : [
            "LIMIT_FILE_COUNT",
            "LIMIT_UNEXPECTED_FILE",
            "LIMIT_FIELD_KEY",
            "LIMIT_FIELD_VALUE",
            "LIMIT_PART_COUNT",
            "LIMIT_FIELD_COUNT",
          ].includes(err.code)
        ? 400
        : 500);

  if (statusCode >= 500) {
    console.error("Request failed:", {
      method: req.method,
      path: req.originalUrl,
      error: err,
    });
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Internal Server Error"
        : err.message || "Request failed",
  });
};
