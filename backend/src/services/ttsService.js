const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

/*
 * AI Podcast Voices
 *
 * Each voice has its own Piper server/model.
 *
 * Alex  -> Ryan -> 5001
 * Leo   -> Joe  -> 5002
 * Maaya -> Amy  -> 5003
 */

const VOICES = {
  alex: {
    id: "alex",
    name: "Alex",
    gender: "male",
    description: "Male · Ryan",
    piperVoice: "en_US-ryan-medium",
    piperUrl: process.env.PIPER_ALEX_URL || "http://localhost:5001",
  },

  leo: {
    id: "leo",
    name: "Leo",
    gender: "male",
    description: "Male · Joe",
    piperVoice: "en_US-joe-medium",
    piperUrl: process.env.PIPER_LEO_URL || "http://localhost:5002",
  },

  maaya: {
    id: "maaya",
    name: "Maaya",
    gender: "female",
    description: "Female · Amy",
    piperVoice: "en_US-amy-medium",
    piperUrl: process.env.PIPER_MAAYA_URL || "http://localhost:5003",
  },
};

async function getAudioMetadata(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const durationSeconds = Number(stdout.trim());

  if (!Number.isFinite(durationSeconds)) {
    throw new Error("Unable to read audio duration");
  }

  return {
    durationMs: Math.round(durationSeconds * 1000),
  };
}

function getAvailableVoices() {
  return Object.values(VOICES).map((voice) => ({
    id: voice.id,
    name: voice.name,
    gender: voice.gender,
    description: voice.description,
    piperVoice: voice.piperVoice,
  }));
}

function getVoice(voiceId) {
  if (!voiceId) {
    return VOICES.alex;
  }

  const normalized = String(voiceId).trim().toLowerCase();
  const key =
    normalized === "ryan"
      ? "alex"
      : normalized === "joe"
        ? "leo"
        : normalized === "amy"
          ? "maaya"
          : normalized;

  const voice = VOICES[key];

  if (!voice) {
    const error = new Error(`Unsupported voice: ${voiceId}`);

    error.code = "INVALID_VOICE";

    throw error;
  }

  return voice;
}

async function generateSpeech(text, voiceId = "alex") {
  if (!text || typeof text !== "string") {
    throw new Error("Text is required");
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Text cannot be empty");
  }

  const voice = getVoice(voiceId);

  console.log(
    `[TTS] Generating ${voice.name} using ${voice.piperVoice} at ${voice.piperUrl}`,
  );

  /*
   * Each Piper server already has its own model loaded.
   *
   * Therefore we only send the text here.
   */
  const response = await fetch(`${voice.piperUrl}/synthesize`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      text: trimmedText,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    throw new Error(
      `Piper request failed for ${voice.name}: ${response.status}${
        errorText ? ` - ${errorText}` : ""
      }`,
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  if (!audioBuffer.length) {
    throw new Error(`Piper returned empty audio for ${voice.name}`);
  }

  const outputDir = path.join(process.cwd(), "outputs", "tts");

  await fs.mkdir(outputDir, {
    recursive: true,
  });

  const fileName = `tts-${Date.now()}-${voice.id}.wav`;

  const filePath = path.join(outputDir, fileName);

  await fs.writeFile(filePath, audioBuffer);

  const metadata = await getAudioMetadata(filePath);

  return {
    fileName,
    filePath,

    format: "wav",

    sampleRate: 22050,

    channels: 1,

    durationMs: metadata.durationMs,

    voice: {
      id: voice.id,
      name: voice.name,
      gender: voice.gender,
      description: voice.description,
      piperVoice: voice.piperVoice,
    },
  };
}

module.exports = {
  VOICES,
  generateSpeech,
  getAvailableVoices,
  getVoice,
};
