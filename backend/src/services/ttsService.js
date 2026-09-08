const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const PIPER_URL =
  process.env.PIPER_URL || "http://localhost:5001";

async function getAudioMetadata(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);

  const durationSeconds = Number(stdout.trim());

  if (!Number.isFinite(durationSeconds)) {
    throw new Error("Unable to read audio duration");
  }

  return {
    durationMs: Math.round(durationSeconds * 1000)
  };
}

async function generateSpeech(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Text is required");
  }

  const response = await fetch(`${PIPER_URL}/synthesize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(
      `Piper request failed: ${response.status}`
    );
  }

  const audioBuffer = Buffer.from(
    await response.arrayBuffer()
  );

  const outputDir = path.join(
    process.cwd(),
    "outputs",
    "tts"
  );

  await fs.mkdir(outputDir, {
    recursive: true
  });

  const fileName = `tts-${Date.now()}.wav`;
  const filePath = path.join(outputDir, fileName);

  await fs.writeFile(filePath, audioBuffer);

  const metadata = await getAudioMetadata(filePath);

  return {
    fileName,
    filePath,
    format: "wav",
    sampleRate: 22050,
    channels: 1,
    durationMs: metadata.durationMs
  };
}

module.exports = {
  generateSpeech
};