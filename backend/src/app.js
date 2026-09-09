const express = require("express");
const cors = require("cors");
const multer = require("multer");

const llmRoutes = require("./routes/llmRoutes");

const ttsRoutes = require("./routes/ttsRoutes");

const coHostRoutes = require("./routes/coHostRoutes");

const recordingRoutes = require("./routes/recordingRoutes");

const sessionRoutes = require("./routes/sessionRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Podcast Backend is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
  });
});

app.use("/api/llm", llmRoutes);

app.use("/api/tts", ttsRoutes);

app.use("/api/cohost", coHostRoutes);

app.use("/api/recording", recordingRoutes);

app.use("/api/sessions", sessionRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

module.exports = app;
