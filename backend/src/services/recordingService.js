const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const RECORDINGS_ROOT = path.resolve(__dirname, "../../outputs/recordings");

const FINAL_RECORDINGS_ROOT = path.resolve(
  __dirname,
  "../../outputs/final-recordings",
);

function ensureDirectories() {
  fs.mkdirSync(RECORDINGS_ROOT, {
    recursive: true,
  });

  fs.mkdirSync(FINAL_RECORDINGS_ROOT, {
    recursive: true,
  });
}

function isValidSessionId(sessionId) {
  return (
    typeof sessionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessionId,
    )
  );
}

function createRecordingSession(sessionId) {
  ensureDirectories();

  const recordingSessionId = sessionId || crypto.randomUUID();

  if (!isValidSessionId(recordingSessionId)) {
    throw new Error("Invalid session ID");
  }

  const sessionDir = path.join(RECORDINGS_ROOT, recordingSessionId);

  fs.mkdirSync(sessionDir, {
    recursive: true,
  });

  return {
    sessionId: recordingSessionId,
    sessionDir,
  };
}

function getSessionDirectory(sessionId) {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }

  return path.join(RECORDINGS_ROOT, sessionId);
}

function saveRecordingChunk(sessionId, chunkIndex, uploadedFile) {
  const sessionDir = getSessionDirectory(sessionId);

  if (!fs.existsSync(sessionDir)) {
    throw new Error("Recording session not found");
  }

  if (!Number.isInteger(Number(chunkIndex)) || Number(chunkIndex) < 0) {
    throw new Error("Invalid chunk index");
  }

  if (!uploadedFile || !uploadedFile.path) {
    throw new Error("Uploaded audio file is required");
  }

  const numericChunkIndex = Number(chunkIndex);

  const destinationFileName = `chunk-${String(numericChunkIndex).padStart(
    4,
    "0",
  )}.webm`;

  const destinationPath = path.join(sessionDir, destinationFileName);

  if (fs.existsSync(destinationPath)) {
    fs.unlinkSync(destinationPath);
  }

  fs.renameSync(uploadedFile.path, destinationPath);

  return {
    sessionId,
    chunkIndex: numericChunkIndex,
    fileName: destinationFileName,
    filePath: destinationPath,
    size: fs.statSync(destinationPath).size,
  };
}

function getSessionChunks(sessionId) {
  const sessionDir = getSessionDirectory(sessionId);

  if (!fs.existsSync(sessionDir)) {
    throw new Error("Recording session not found");
  }

  const files = fs
    .readdirSync(sessionDir)
    .filter((fileName) => /^chunk-\d+\.webm$/i.test(fileName));

  const chunks = files
    .map((fileName) => {
      const match = fileName.match(/^chunk-(\d+)\.webm$/i);

      const chunkIndex = Number(match[1]);

      const filePath = path.join(sessionDir, fileName);

      const stats = fs.statSync(filePath);

      return {
        chunkIndex,
        fileName,
        filePath,
        size: stats.size,
      };
    })
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  return chunks;
}

function validateChunkSequence(chunks) {
  if (!chunks || chunks.length === 0) {
    return {
      complete: false,
      expectedChunkCount: 0,
      receivedChunkCount: 0,
      missingChunks: [],
    };
  }

  const indexes = chunks.map((chunk) => chunk.chunkIndex);

  const minIndex = indexes[0];
  const maxIndex = indexes[indexes.length - 1];

  const expectedChunkCount = maxIndex - minIndex + 1;

  const missingChunks = [];

  for (let index = minIndex; index <= maxIndex; index++) {
    if (!indexes.includes(index)) {
      missingChunks.push(index);
    }
  }

  const complete = minIndex === 0 && missingChunks.length === 0;

  return {
    complete,
    expectedChunkCount,
    receivedChunkCount: chunks.length,
    missingChunks,
  };
}

function getRecordingSessionStatus(sessionId) {
  const chunks = getSessionChunks(sessionId);

  const sequence = validateChunkSequence(chunks);

  return {
    sessionId,
    sequenceComplete: sequence.complete,
    expectedChunkCount: sequence.expectedChunkCount,
    receivedChunkCount: sequence.receivedChunkCount,
    missingChunks: sequence.missingChunks,
    chunks: chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      fileName: chunk.fileName,
      size: chunk.size,
    })),
  };
}

function getOrderedChunkPaths(sessionId) {
  const chunks = getSessionChunks(sessionId);

  const sequence = validateChunkSequence(chunks);

  if (!sequence.complete) {
    const error = new Error("Recording chunks are incomplete");

    error.code = "INCOMPLETE_CHUNK_SEQUENCE";

    error.details = sequence;

    throw error;
  }

  return chunks.map((chunk) => chunk.filePath);
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      args,
      {
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const ffmpegError = new Error(
            stderr || error.message || "FFmpeg failed",
          );

          ffmpegError.code = "FFMPEG_FAILED";

          reject(ffmpegError);
          return;
        }

        resolve({
          stdout,
          stderr,
        });
      },
    );
  });
}

async function probeAudio(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size",
        "-show_entries",
        "stream=codec_name,codec_type,sample_rate,channels",
        "-of",
        "json",
        filePath,
      ],
      {
        maxBuffer: 5 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const probeError = new Error(
            stderr || error.message || "ffprobe failed",
          );

          probeError.code = "FFPROBE_FAILED";

          reject(probeError);
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

async function finalizeRecording(sessionId) {
  ensureDirectories();

  const sessionDir = getSessionDirectory(sessionId);

  if (!fs.existsSync(sessionDir)) {
    throw new Error("Recording session not found");
  }

  const chunkPaths = getOrderedChunkPaths(sessionId);

  if (chunkPaths.length === 0) {
    throw new Error("No recording chunks found");
  }

  const finalFileName = `final-host-${sessionId}.webm`;

  const finalFilePath = path.join(FINAL_RECORDINGS_ROOT, finalFileName);

  const concatListPath = path.join(sessionDir, "concat-list.txt");

  const temporaryOutputPath = path.join(
    FINAL_RECORDINGS_ROOT,
    `.${finalFileName}.tmp.webm`,
  );

  try {
    // Generate concat demuxer file for FFmpeg to safely concatenate WebM chunks
    const concatContent = chunkPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(concatListPath, concatContent, "utf8");

    // Use FFmpeg concat demuxer with libopus re-encode for seamless timestamps and valid headers
    let ffmpegSucceeded = false;
    try {
      await runFFmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c:a",
        "libopus",
        temporaryOutputPath,
      ]);
      ffmpegSucceeded =
        fs.existsSync(temporaryOutputPath) &&
        fs.statSync(temporaryOutputPath).size > 0;
    } catch (encodeErr) {
      console.warn(
        "FFmpeg libopus concat failed, attempting copy mode:",
        encodeErr.message,
      );
    }

    if (!ffmpegSucceeded) {
      await runFFmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        temporaryOutputPath,
      ]);
    }

    if (!fs.existsSync(temporaryOutputPath)) {
      throw new Error("FFmpeg did not create the final recording");
    }

    const finalStats = fs.statSync(temporaryOutputPath);

    if (finalStats.size === 0) {
      throw new Error("Final recording is empty");
    }

    const probe = await probeAudio(temporaryOutputPath);

    const duration = Number(probe?.format?.duration || 0);

    if (duration <= 0) {
      throw new Error("Final recording has invalid duration");
    }

    if (fs.existsSync(finalFilePath)) {
      fs.unlinkSync(finalFilePath);
    }

    fs.renameSync(temporaryOutputPath, finalFilePath);

    if (fs.existsSync(concatListPath)) {
      try {
        fs.unlinkSync(concatListPath);
      } catch (_) {}
    }

    const audioStream = probe?.streams?.find(
      (stream) => stream.codec_type === "audio",
    );

    return {
      success: true,
      sessionId,
      fileName: finalFileName,
      filePath: finalFilePath,
      size: finalStats.size,
      durationSeconds: duration,
      codec: audioStream?.codec_name || null,
      sampleRate: audioStream?.sample_rate || null,
      channels: audioStream?.channels || null,
      chunkCount: chunkPaths.length,
    };
  } catch (error) {
    if (fs.existsSync(temporaryOutputPath)) {
      try {
        fs.unlinkSync(temporaryOutputPath);
      } catch (_) {}
    }
    if (fs.existsSync(concatListPath)) {
      try {
        fs.unlinkSync(concatListPath);
      } catch (_) {}
    }

    throw error;
  }
}

function getFinalRecording(sessionId) {
  ensureDirectories();

  if (!isValidSessionId(sessionId)) {
    const error = new Error("Invalid session ID");

    error.code = "INVALID_SESSION_ID";

    throw error;
  }

  const primaryFileName = `final-host-${sessionId}.webm`;
  const legacyFileName = `${sessionId}.webm`;

  let fileName = primaryFileName;
  let filePath = path.join(FINAL_RECORDINGS_ROOT, fileName);

  if (!fs.existsSync(filePath)) {
    const legacyPath = path.join(FINAL_RECORDINGS_ROOT, legacyFileName);
    if (fs.existsSync(legacyPath)) {
      fileName = legacyFileName;
      filePath = legacyPath;
    } else {
      const error = new Error(
        "Final recording not found. Finalize the recording first.",
      );

      error.code = "FINAL_RECORDING_NOT_FOUND";

      throw error;
    }
  }

  const stats = fs.statSync(filePath);

  if (stats.size === 0) {
    try {
      fs.unlinkSync(filePath);
    } catch (_) {}

    const error = new Error(
      "Final recording file is empty. Please re-finalize the recording.",
    );

    error.code = "EMPTY_FINAL_RECORDING";

    throw error;
  }

  return {
    sessionId,
    fileName,
    filePath,
    size: stats.size,
  };
}

module.exports = {
  createRecordingSession,
  saveRecordingChunk,
  getSessionChunks,
  validateChunkSequence,
  getRecordingSessionStatus,
  getOrderedChunkPaths,
  finalizeRecording,
  getFinalRecording,
  isValidSessionId,
};
