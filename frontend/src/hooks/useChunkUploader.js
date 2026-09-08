import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  saveChunk,
  getSessionChunks,
  updateChunkStatus,
  deleteChunk,
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
  const [isUploading, setIsUploading] = useState(false);
  const [lastError, setLastError] = useState(null);

  const processingRef = useRef(false);


  const refreshStats = useCallback(async () => {
    if (!sessionId) {
      setPendingCount(0);
      setFailedCount(0);
      return;
    }

    try {
      const chunks = await getSessionChunks(sessionId);

      const pending = chunks.filter(
        (chunk) => chunk.status === "pending"
      ).length;

      const failed = chunks.filter(
        (chunk) => chunk.status === "failed"
      ).length;

      setPendingCount(pending);
      setFailedCount(failed);
    } catch (error) {
      console.error(
        "Failed to refresh IndexedDB stats:",
        error
      );
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
            "pending",
            attempts
          );

          await refreshStats();

          await uploadRecordingChunk(
            sessionId,
            chunk.chunkIndex,
            chunk.blob
          );

          await deleteChunk(
            sessionId,
            chunk.chunkIndex
          );

          setUploadedCount(
            (previous) => previous + 1
          );

          await refreshStats();

          return {
            success: true,
            chunkIndex: chunk.chunkIndex,
          };
        } catch (error) {
          console.error(
            `Chunk ${chunk.chunkIndex} upload attempt ${attempts} failed:`,
            error
          );

          if (attempts >= MAX_RETRIES) {
            await updateChunkStatus(
              sessionId,
              chunk.chunkIndex,
              "failed",
              attempts
            );

            setLastError(
              `Chunk ${chunk.chunkIndex} failed after ${MAX_RETRIES} attempts.`
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
    [sessionId, refreshStats]
  );


  async function uploadPendingChunks(
    includeFailed = false
  ) {
    if (!sessionId) {
      return;
    }

    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    setIsUploading(true);
    setLastError(null);

    try {
      let chunks = await getSessionChunks(
        sessionId
      );

      if (includeFailed) {
        chunks = chunks.filter(
          (chunk) =>
            chunk.status === "pending" ||
            chunk.status === "failed"
        );
      } else {
        chunks = chunks.filter(
          (chunk) => chunk.status === "pending"
        );
      }

      chunks.sort(
        (a, b) =>
          a.chunkIndex - b.chunkIndex
      );

      for (const chunk of chunks) {
        await uploadSingleChunk(chunk);
      }
    } catch (error) {
      console.error(
        "Pending chunk upload failed:",
        error
      );

      setLastError(
        error.message ||
          "Failed to upload pending chunks."
      );
    } finally {
      processingRef.current = false;
      setIsUploading(false);

      await refreshStats();
    }
  }


  const queueChunk = useCallback(
    async (chunkIndex, blob) => {
      if (!sessionId) {
        throw new Error(
          "Cannot queue chunk without sessionId"
        );
      }

      if (!Number.isInteger(chunkIndex)) {
        throw new Error(
          "chunkIndex must be an integer"
        );
      }

      if (!(blob instanceof Blob)) {
        throw new Error(
          "Chunk must be a Blob"
        );
      }

      await saveChunk({
        sessionId,
        chunkIndex,
        blob,
      });

      await refreshStats();

      await uploadPendingChunks(false);
    },
    [sessionId, refreshStats, uploadSingleChunk]
  );


  const retryFailedChunks = useCallback(
    async () => {
      await uploadPendingChunks(true);
    },
    [sessionId, refreshStats, uploadSingleChunk]
  );


  const waitForUploads = useCallback(
    async () => {
      while (processingRef.current) {
        await delay(100);
      }

      await refreshStats();
    },
    [refreshStats]
  );


  const clearQueue = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    const chunks = await getSessionChunks(
      sessionId
    );

    for (const chunk of chunks) {
      await deleteChunk(
        sessionId,
        chunk.chunkIndex
      );
    }

    setPendingCount(0);
    setFailedCount(0);
    setLastError(null);
  }, [sessionId]);


  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const timer = setTimeout(() => {
      void uploadPendingChunks(false);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionId]);


  return {
    queueChunk,
    retryFailedChunks,
    waitForUploads,
    clearQueue,

    pendingCount,
    failedCount,
    uploadedCount,

    isUploading,
    lastError,
  };
}