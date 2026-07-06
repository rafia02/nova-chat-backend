import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { notFound } from "./modules/notFound";
import { errorHandler } from "./modules/error";
import router from "./routes";

const app = express();

app.use(cors());

app.use(helmet());

app.use(morgan("dev"));

app.use(cookieParser());

app.use(express.json());
app.use("/api", router);

app.use(express.urlencoded({ extended: true }));

app.use(notFound);

app.use(errorHandler);

console.log("Routes loaded");

app.get("/", (req, res) => {
  res.json({
    success: true,

    message: "NovaChat API Running",
  });
});

export default app;
