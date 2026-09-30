import { NextFunction, Request, Response } from "express";

export const errorHandler = (
  err: any,

  req: Request,

  res: Response,

  next: NextFunction,
) => {
  const statusCode =
    err.statusCode ||
    (err.code === "LIMIT_FILE_SIZE"
      ? 413
      : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
        ? 400
        : 500);

  res.status(statusCode).json({
    success: false,

    message: err.message || "Internal Server Error",
  });
};
