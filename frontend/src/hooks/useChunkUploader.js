import { useCallback, useEffect, useRef, useState } from "react";

import {
  saveChunk,
  getSessionChunks,
  updateChunkStatus,
  markChunkUploaded,
  markChunkFailed,
  deleteSessionChunks,
} from "../utils/indexedDB";

import { uploadRecordingChunk } from "../services/recordingApi";

const MAX_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function useChunkUploader(sessionId) {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState(null);

  const processingRef = useRef(false);
  const inFlightCountRef = useRef(0);

  const refreshStats = useCallback(async () => {
    if (!sessionId) {
      setPendingCount(0);
      setFailedCount(0);
      setUploadedCount(0);
      setTotalChunks(0);
      return;
    }

    try {
      const chunks = await getSessionChunks(sessionId);

      const pending = chunks.filter(
        (chunk) => chunk.status === "pending" || chunk.status === "uploading",
      ).length;

      const failed = chunks.filter((chunk) => chunk.status === "failed").length;
      const uploaded = chunks.filter(
        (chunk) => chunk.status === "uploaded",
      ).length;

      setPendingCount(pending);
      setFailedCount(failed);
      setUploadedCount(uploaded);
      setTotalChunks(chunks.length);
    } catch (error) {
      console.error("Failed to refresh IndexedDB stats:", error);
    }
  }, [sessionId]);

  const uploadSingleChunk = useCallback(
    async (chunk) => {
      let attempts = chunk.attempts || 0;

      while (attempts < MAX_RETRIES) {
        attempts += 1;

        try {
          await updateChunkStatus(
            sessionId,
            chunk.chunkIndex,
            "uploading",
            attempts,
          );

          await refreshStats();

          await uploadRecordingChunk(sessionId, chunk.chunkIndex, chunk.blob);

          await markChunkUploaded(sessionId, chunk.chunkIndex, attempts);

          await refreshStats();

          return {
            success: true,
            chunkIndex: chunk.chunkIndex,
          };
        } catch (error) {
          console.error(
            `Chunk ${chunk.chunkIndex} upload attempt ${attempts} failed:`,
            error,
          );

          if (attempts >= MAX_RETRIES) {
            await markChunkFailed(sessionId, chunk.chunkIndex, attempts);

            setLastError(
              `Chunk ${chunk.chunkIndex} failed after ${MAX_RETRIES} attempts.`,
            );

            await refreshStats();

            return {
              success: false,
              chunkIndex: chunk.chunkIndex,
              error,
            };
          }

          await delay(attempts * 1000);
        }
      }

      return {
        success: false,
        chunkIndex: chunk.chunkIndex,
      };
    },
    [sessionId, refreshStats],
  );

  const uploadPendingChunks = useCallback(
    async (includeFailed = false) => {
      if (!sessionId) {
        return;
      }

      if (processingRef.current) {
        return;
      }

      processingRef.current = true;
      setIsUploading(true);
      if (includeFailed) {
        setIsRetrying(true);
      }
      setLastError(null);

      try {
        let chunks = await getSessionChunks(sessionId);

        if (includeFailed) {
          chunks = chunks.filter(
            (chunk) => chunk.status === "pending" || chunk.status === "failed",
          );
        } else {
          chunks = chunks.filter((chunk) => chunk.status === "pending");
        }

        chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

        for (const chunk of chunks) {
          await uploadSingleChunk(chunk);
        }
      } catch (error) {
        console.error("Pending chunk upload failed:", error);

        setLastError(error.message || "Failed to upload pending chunks.");
      } finally {
        processingRef.current = false;
        setIsUploading(false);
        setIsRetrying(false);

        await refreshStats();
      }
    },
    [sessionId, uploadSingleChunk, refreshStats],
  );

  const queueChunk = useCallback(
    async (chunkIndex, blob) => {
      inFlightCountRef.current += 1;
      try {
        if (!sessionId) {
          throw new Error("Cannot queue chunk without sessionId");
        }

        if (!Number.isInteger(chunkIndex)) {
          throw new Error("chunkIndex must be an integer");
        }

        if (!(blob instanceof Blob)) {
          throw new Error("Chunk must be a Blob");
        }

        await saveChunk({
          sessionId,
          chunkIndex,
          blob,
        });

        await refreshStats();

        await uploadPendingChunks(false);
      } finally {
        inFlightCountRef.current -= 1;
      }
    },
    [sessionId, refreshStats, uploadPendingChunks],
  );

  const retryFailedChunks = useCallback(async () => {
    await uploadPendingChunks(true);
  }, [uploadPendingChunks]);

  const waitForUploads = useCallback(async () => {
    while (processingRef.current || inFlightCountRef.current > 0) {
      await delay(100);
    }

    await refreshStats();
  }, [refreshStats]);

  const clearQueue = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    await deleteSessionChunks(sessionId);

    setPendingCount(0);
    setFailedCount(0);
    setUploadedCount(0);
    setTotalChunks(0);
    setLastError(null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const timer = setTimeout(() => {
      void refreshStats();
      void uploadPendingChunks(false);
    }, 0);

    const handleOnline = () => {
      console.log("[useChunkUploader] Network restored, retrying chunks...");
      void uploadPendingChunks(true);
    };

    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [sessionId, refreshStats, uploadPendingChunks]);

  return {
    queueChunk,
    retryFailedChunks,
    waitForUploads,
    clearQueue,
    refreshStats,

    pendingCount,
    failedCount,
    uploadedCount,
    totalChunks,

    isUploading,
    isRetrying,
    lastError,
  };
}
