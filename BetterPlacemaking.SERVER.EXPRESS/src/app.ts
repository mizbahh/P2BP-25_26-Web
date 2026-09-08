import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { loginRouter } from "./routes/login.routes.js";
import { registerRouter } from "./routes/register.routes.js";
import { passwordRouter } from "./routes/password.routes.js";
import { emailRouter } from "./routes/email.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  // Cloud Run / reverse-proxy deployments sit behind a load balancer; needed for
  // req.secure / X-Forwarded-* to be trusted, mirroring UseForwardedHeaders.
  app.set("trust proxy", true);

  app.use(express.json());
  app.use(cookieParser());

  if (env.allowedOrigins.length > 0) {
    // credentials: true is required for the bp_refresh cookie to work cross-origin;
    // this is incompatible with a wildcard origin, matching the ASP.NET CORS policy.
    app.use(
      cors({
        origin: env.allowedOrigins,
        credentials: true,
      }),
    );
  }

  app.use("/api/auth", authRouter);
  app.use("/api/login", loginRouter);
  app.use("/api/register", registerRouter);
  app.use("/api/password", passwordRouter);
  app.use("/api/email", emailRouter);
  app.use("/api/user", userRouter);
  app.use("/api/admin", adminRouter);

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use(errorHandler);

  return app;
}
