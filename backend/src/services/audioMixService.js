const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const {
  getFinalRecording,
  isValidSessionId,
} = require("./recordingService");

const TTS_ROOT = path.resolve(
  __dirname,
  "../../outputs/tts"
);

const FINAL_PODCASTS_ROOT = path.resolve(
  __dirname,
  "../../outputs/final-podcasts"
);

const VALID_TTS_FILE_NAME =
  /^tts-\d+\.wav$/i;

function createMixError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function ensureOutputDirectory() {
  fs.mkdirSync(FINAL_PODCASTS_ROOT, {
    recursive: true,
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            createMixError(
              stderr || error.message || `${command} failed`,
              command === "ffprobe"
                ? "FFPROBE_FAILED"
                : "FFMPEG_FAILED"
            )
          );
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
}

async function probeAudio(filePath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size,format_name",
    "-show_entries",
    "stream=codec_name,codec_type,sample_rate,channels",
    "-of",
    "json",
    filePath,
  ]);

  let metadata;

  try {
    metadata = JSON.parse(stdout);
  } catch (error) {
    throw createMixError(
      "ffprobe returned invalid audio metadata",
      "INVALID_AUDIO_METADATA"
    );
  }

  const audioStream = metadata.streams?.find(
    (stream) => stream.codec_type === "audio"
  );

  const durationSeconds = Number(metadata.format?.duration || 0);

  if (!audioStream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw createMixError(
      "Audio file has no valid audio stream or duration",
      "INVALID_AUDIO_FILE"
    );
  }

  return {
    durationSeconds,
    codec: audioStream.codec_name || null,
    sampleRate: Number(audioStream.sample_rate || 0) || null,
    channels: Number(audioStream.channels || 0) || null,
    size: Number(metadata.format?.size || 0),
  };
}

function getTimelineEvents(payload) {
  if (Array.isArray(payload?.timeline?.events)) {
    return payload.timeline.events;
  }

  if (Array.isArray(payload?.events)) {
    return payload.events;
  }

  if (Array.isArray(payload?.cues)) {
    return payload.cues;
  }

  throw createMixError(
    "A timeline.events, events, or cues array is required",
    "INVALID_TIMELINE"
  );
}

async function validateCueEvents(events) {
  const playableEvents = events.filter(
    (event) => event?.status !== "failed"
  );

  const cues = [];

  for (const event of playableEvents) {
    if (event?.status !== "completed") {
      throw createMixError(
        "Every AI cue must be completed before mixing",
        "INCOMPLETE_CUE"
      );
    }

    if (!VALID_TTS_FILE_NAME.test(event.audioFile || "")) {
      throw createMixError(
        "AI cue has an invalid audio file name",
        "INVALID_CUE_AUDIO_FILE"
      );
    }

    if (!Number.isFinite(event.startOffsetMs) || event.startOffsetMs < 0) {
      throw createMixError(
        "AI cue has an invalid start offset",
        "INVALID_CUE_OFFSET"
      );
    }

    const audioPath = path.resolve(TTS_ROOT, event.audioFile);

    if (!audioPath.startsWith(TTS_ROOT + path.sep)) {
      throw createMixError(
        "AI cue audio path is invalid",
        "INVALID_CUE_AUDIO_FILE"
      );
    }

    if (!fs.existsSync(audioPath) || !fs.statSync(audioPath).isFile()) {
      throw createMixError(
        `AI cue audio file does not exist: ${event.audioFile}`,
        "CUE_AUDIO_NOT_FOUND"
      );
    }

    const metadata = await probeAudio(audioPath);

    cues.push({
      eventId: event.eventId || null,
      cueIndex: Number.isInteger(event.cueIndex) ? event.cueIndex : null,
      order: Number.isInteger(event.order) ? event.order : null,
      audioFile: event.audioFile,
      audioPath,
      startOffsetMs: Math.round(event.startOffsetMs),
      actualDurationMs: Math.round(metadata.durationSeconds * 1000),
    });
  }

  cues.sort((left, right) => left.startOffsetMs - right.startOffsetMs);

  for (let index = 1; index < cues.length; index += 1) {
    const previousCue = cues[index - 1];
    const cue = cues[index];
    const previousCueEndMs =
      previousCue.startOffsetMs + previousCue.actualDurationMs;

    if (cue.startOffsetMs < previousCueEndMs) {
      throw createMixError(
        "AI cue offsets overlap. Resolve the timeline before mixing.",
        "OVERLAPPING_CUES"
      );
    }
  }

  return cues;
}

function buildFilterGraph(cues) {
  const filters = [
    "[0:a]aformat=sample_rates=48000:channel_layouts=mono,volume=0.75[host]",
  ];

  const mixInputs = ["[host]"];

  cues.forEach((cue, index) => {
    const inputIndex = index + 1;
    filters.push(
      `[${inputIndex}:a]aformat=sample_rates=48000:channel_layouts=mono,adelay=${cue.startOffsetMs}:all=1,volume=0.85[cue${index}]`
    );
    mixInputs.push(`[cue${index}]`);
  });

  filters.push(
    `${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=1[mixed]`
  );

  return filters.join(";");
}

function getMixedFilePaths(sessionId) {
  if (!isValidSessionId(sessionId)) {
    throw createMixError("Invalid session ID", "INVALID_SESSION_ID");
  }

  return {
    wavFileName: `final-podcast-${sessionId}.wav`,
    mp3FileName: `final-podcast-${sessionId}.mp3`,
    wavFilePath: path.join(FINAL_PODCASTS_ROOT, `final-podcast-${sessionId}.wav`),
    mp3FilePath: path.join(FINAL_PODCASTS_ROOT, `final-podcast-${sessionId}.mp3`),
  };
}

async function mixSessionAudio(sessionId, payload) {
  ensureOutputDirectory();

  const hostRecording = getFinalRecording(sessionId);
  const hostMetadata = await probeAudio(hostRecording.filePath);
  const events = getTimelineEvents(payload);
  const cues = await validateCueEvents(events);
  const output = getMixedFilePaths(sessionId);
  const temporaryId = crypto.randomUUID();
  const temporaryWavPath = path.join(
    FINAL_PODCASTS_ROOT,
    `.${temporaryId}.wav`
  );
  const temporaryMp3Path = path.join(
    FINAL_PODCASTS_ROOT,
    `.${temporaryId}.mp3`
  );

  try {
    const inputArgs = ["-i", hostRecording.filePath];

    cues.forEach((cue) => {
      inputArgs.push("-i", cue.audioPath);
    });

    await runCommand("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex",
      buildFilterGraph(cues),
      "-map",
      "[mixed]",
      "-c:a",
      "pcm_s16le",
      "-ar",
      "48000",
      "-ac",
      "1",
      temporaryWavPath,
    ]);

    const wavMetadata = await probeAudio(temporaryWavPath);

    if (wavMetadata.codec !== "pcm_s16le" || wavMetadata.durationSeconds <= 0) {
      throw createMixError(
        "Mixed WAV failed validation",
        "INVALID_MIX_OUTPUT"
      );
    }

    await runCommand("ffmpeg", [
      "-y",
      "-i",
      temporaryWavPath,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      temporaryMp3Path,
    ]);

    const mp3Metadata = await probeAudio(temporaryMp3Path);

    if (mp3Metadata.codec !== "mp3" || mp3Metadata.durationSeconds <= 0) {
      throw createMixError(
        "Mixed MP3 failed validation",
        "INVALID_MIX_OUTPUT"
      );
    }

    fs.renameSync(temporaryWavPath, output.wavFilePath);
    fs.renameSync(temporaryMp3Path, output.mp3FilePath);

    return {
      sessionId,
      hostDurationSeconds: Number(hostMetadata.durationSeconds.toFixed(3)),
      mixedCueCount: cues.length,
      cues: cues.map(({ audioPath, ...cue }) => cue),
      wav: {
        fileName: output.wavFileName,
        durationSeconds: Number(wavMetadata.durationSeconds.toFixed(3)),
        codec: wavMetadata.codec,
        sampleRate: wavMetadata.sampleRate,
        channels: wavMetadata.channels,
        size: fs.statSync(output.wavFilePath).size,
      },
      mp3: {
        fileName: output.mp3FileName,
        durationSeconds: Number(mp3Metadata.durationSeconds.toFixed(3)),
        codec: mp3Metadata.codec,
        sampleRate: mp3Metadata.sampleRate,
        channels: mp3Metadata.channels,
        size: fs.statSync(output.mp3FilePath).size,
      },
    };
  } catch (error) {
    [temporaryWavPath, temporaryMp3Path].forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    throw error;
  }
}

function getMixedRecording(sessionId, format) {
  ensureOutputDirectory();

  if (!["wav", "mp3"].includes(format)) {
    throw createMixError("Invalid mixed audio format", "INVALID_MIX_FORMAT");
  }

  const output = getMixedFilePaths(sessionId);
  const filePath = format === "wav" ? output.wavFilePath : output.mp3FilePath;
  const fileName = format === "wav" ? output.wavFileName : output.mp3FileName;

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw createMixError(
      "Mixed podcast not found. Mix the session first.",
      "MIXED_RECORDING_NOT_FOUND"
    );
  }

  return {
    fileName,
    filePath,
    size: fs.statSync(filePath).size,
    contentType: format === "wav" ? "audio/wav" : "audio/mpeg",
  };
}

module.exports = {
  mixSessionAudio,
  getMixedRecording,
};
