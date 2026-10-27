import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { aiStatus, config, isConfigured } from "./config.js";
import { AppError, isAppError, mapGeminiError } from "./errors.js";
import { aiRouter, cleanupUploadDir } from "./routes/ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");

const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use((request, response, next) => {
  const origin = request.get("Origin");
  const host = request.get("host");
  let sameOrigin = false;
  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }
  const allowed =
    !origin ||
    sameOrigin ||
    config.clientOrigins.includes(origin) ||
    (config.nodeEnv !== "production" && localOriginPattern.test(origin));

  cors({
    origin: allowed ? origin ?? false : false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 600,
  })(request, response, next);
});

app.use(express.json({ limit: "12mb" }));

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many AI requests from this browser. Please wait a few minutes and try again.",
    },
  },
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "echoledger-api",
    ai: aiStatus(),
  });
});

app.use("/api/ai", aiLimiter, aiRouter);

app.use("/api", (_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "API route not found." },
  });
});

if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: config.nodeEnv === "production" ? "1h" : 0,
    }),
  );
  app.use((request, response, next) => {
    // Never turn a missing static asset (for example demo audio) into the SPA shell.
    if (
      request.method !== "GET" ||
      request.path.startsWith("/api") ||
      path.extname(request.path) !== ""
    ) {
      next();
      return;
    }
    response.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    response.status(status).json({
      error: {
        code: error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? `The audio file exceeds the ${config.maxAudioMb} MB upload limit.`
            : `Upload failed: ${error.message}`,
      },
    });
    return;
  }

  const bodyError = error as { type?: string; status?: number; statusCode?: number };
  if (bodyError?.type === "entity.too.large") {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The transcript or comparison payload is too large. Try fewer recordings or shorter transcripts.",
      },
    });
    return;
  }
  if (bodyError?.type === "entity.parse.failed") {
    response.status(400).json({
      error: { code: "INVALID_JSON", message: "The request body was not valid JSON." },
    });
    return;
  }

  if (isAppError(error)) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  const mapped = mapGeminiError(error);
  if (mapped.status !== 502 || mapped.code !== "AI_ERROR") {
    response.status(mapped.status).json({
      error: { code: mapped.code, message: mapped.message },
    });
    return;
  }

  console.error("[server] unhandled error:", error instanceof Error ? error.stack ?? error.message : error);
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred. Check the server logs for details.",
    },
  });
});

// Clear any temporary uploads left behind by an interrupted previous process.
cleanupUploadDir();

const server = app.listen(config.port, () => {
  console.log(`EchoLedger API listening on http://localhost:${config.port}`);
  if (isConfigured()) {
    console.log(`Gemini configured · text: ${config.textModel} · transcription: ${config.transcribeModel}`);
  } else {
    console.log("Gemini not configured. Transcript-only and demo workflows remain available.");
  }
});

function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  server.close(() => {
    cleanupUploadDir();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
