import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { notFound } from "./modules/notFound";
import { errorHandler } from "./modules/error";
import router from "./routes";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      const error = new Error("Origin is not allowed by CORS") as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      callback(error);
    },
    credentials: true,
  }),
);

app.use(morgan("dev"));

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "NovaChat API Running",
  });
});

app.use("/api", router);

app.use(notFound);

app.use(errorHandler);

export default app;
