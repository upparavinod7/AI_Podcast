const express = require("express");
const cors = require("cors");
const multer = require("multer");

const llmRoutes =
  require("./routes/llmRoutes");

const ttsRoutes =
  require("./routes/ttsRoutes");

const coHostRoutes =
  require("./routes/coHostRoutes");

const recordingRoutes =
  require("./routes/recordingRoutes");

const app = express();

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin:
      "http://localhost:5173",

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ============================================================
// BODY PARSER
// ============================================================

app.use(
  express.json({
    limit: "1mb",
  })
);

// ============================================================
// ROOT
// ============================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      success: true,
      message:
        "AI Podcast Backend is running",
    });
  }
);

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      status: "ok",
    });
  }
);

// ============================================================
// API ROUTES
// ============================================================

app.use(
  "/api/llm",
  llmRoutes
);

app.use(
  "/api/tts",
  ttsRoutes
);

app.use(
  "/api/cohost",
  coHostRoutes
);

app.use(
  "/api/recording",
  recordingRoutes
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled error:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        error:
          error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "Internal server error",
    });
  }
);

module.exports = app;