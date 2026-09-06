const DB_NAME = "ai-podcast-studio";
const DB_VERSION = 1;
const STORE_NAME = "recordingChunks";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });

        store.createIndex("sessionId", "sessionId", {
          unique: false,
        });

        store.createIndex("status", "status", {
          unique: false,
        });

        store.createIndex("sessionStatus", [
          "sessionId",
          "status",
        ], {
          unique: false,
        });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
      };

      resolve(db);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error("Failed to open IndexedDB")
      );
    };
  });
}

// ============================================================
// SAVE CHUNK
// ============================================================

export async function saveChunk({
  sessionId,
  chunkIndex,
  blob,
}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  if (
    !Number.isInteger(chunkIndex) ||
    chunkIndex < 0
  ) {
    throw new Error(
      "chunkIndex must be a non-negative integer"
    );
  }

  if (!(blob instanceof Blob)) {
    throw new Error("chunk must be a Blob");
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const id =
      `${sessionId}:${chunkIndex}`;

    const now = Date.now();

    const record = {
      id,
      sessionId,
      chunkIndex,
      blob,
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    const request = store.put(record);

    request.onsuccess = () => {
      resolve(record);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error("Failed to save chunk")
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      reject(
        transaction.error ||
          new Error("IndexedDB transaction failed")
      );

      db.close();
    };
  });
}

// ============================================================
// GET SINGLE CHUNK
// ============================================================

export async function getChunk(id) {
  if (!id) {
    return null;
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error("Failed to get chunk")
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// GET ALL SESSION CHUNKS
// ============================================================

export async function getSessionChunks(
  sessionId
) {
  if (!sessionId) {
    return [];
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const index =
      store.index("sessionId");

    const request =
      index.getAll(sessionId);

    request.onsuccess = () => {
      const chunks =
        request.result || [];

      chunks.sort(
        (a, b) =>
          a.chunkIndex - b.chunkIndex
      );

      resolve(chunks);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            "Failed to read session chunks"
          )
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// GET PENDING / FAILED CHUNKS
// ============================================================

export async function getPendingChunks(
  sessionId
) {
  const chunks =
    await getSessionChunks(sessionId);

  return chunks
    .filter(
      (chunk) =>
        chunk.status === "pending" ||
        chunk.status === "failed"
    )
    .sort(
      (a, b) =>
        a.chunkIndex - b.chunkIndex
    );
}

// ============================================================
// GET FAILED CHUNKS ONLY
// ============================================================

export async function getFailedChunks(
  sessionId
) {
  const chunks =
    await getSessionChunks(sessionId);

  return chunks
    .filter(
      (chunk) =>
        chunk.status === "failed"
    )
    .sort(
      (a, b) =>
        a.chunkIndex - b.chunkIndex
    );
}

// ============================================================
// UPDATE CHUNK STATUS
// ============================================================

export async function updateChunkStatus(
  sessionId,
  chunkIndex,
  status,
  attempts
) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  if (
    !Number.isInteger(chunkIndex) ||
    chunkIndex < 0
  ) {
    throw new Error(
      "chunkIndex must be a non-negative integer"
    );
  }

  const validStatuses = [
    "pending",
    "uploading",
    "uploaded",
    "failed",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid chunk status: ${status}`
    );
  }

  const id =
    `${sessionId}:${chunkIndex}`;

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const getRequest =
      store.get(id);

    getRequest.onsuccess = () => {
      const existing =
        getRequest.result;

      if (!existing) {
        resolve(null);
        return;
      }

      existing.status = status;

      if (
        typeof attempts === "number" &&
        Number.isFinite(attempts)
      ) {
        existing.attempts =
          attempts;
      }

      existing.updatedAt =
        Date.now();

      const putRequest =
        store.put(existing);

      putRequest.onsuccess = () => {
        resolve(existing);
      };

      putRequest.onerror = () => {
        reject(
          putRequest.error ||
            new Error(
              "Failed to update chunk"
            )
        );
      };
    };

    getRequest.onerror = () => {
      reject(
        getRequest.error ||
          new Error(
            "Failed to find chunk for update"
          )
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// MARK CHUNK UPLOADING
// ============================================================

export async function markChunkUploading(
  sessionId,
  chunkIndex
) {
  const chunk = await getChunk(
    `${sessionId}:${chunkIndex}`
  );

  if (!chunk) {
    return null;
  }

  return updateChunkStatus(
    sessionId,
    chunkIndex,
    "uploading",
    chunk.attempts
  );
}

// ============================================================
// MARK CHUNK UPLOADED
// ============================================================

export async function markChunkUploaded(
  sessionId,
  chunkIndex,
  attempts
) {
  return updateChunkStatus(
    sessionId,
    chunkIndex,
    "uploaded",
    attempts
  );
}

// ============================================================
// MARK CHUNK FAILED
// ============================================================

export async function markChunkFailed(
  sessionId,
  chunkIndex,
  attempts
) {
  return updateChunkStatus(
    sessionId,
    chunkIndex,
    "failed",
    attempts
  );
}

// ============================================================
// DELETE SINGLE CHUNK
// ============================================================

export async function deleteChunk(
  sessionId,
  chunkIndex
) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const id =
    `${sessionId}:${chunkIndex}`;

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const request =
      store.delete(id);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            "Failed to delete chunk"
          )
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// DELETE SESSION CHUNKS
// ============================================================

export async function deleteSessionChunks(
  sessionId
) {
  const chunks =
    await getSessionChunks(sessionId);

  for (const chunk of chunks) {
    await deleteChunk(
      sessionId,
      chunk.chunkIndex
    );
  }

  return true;
}

// ============================================================
// DELETE UPLOADED CHUNKS
// ============================================================

export async function deleteUploadedChunks(
  sessionId
) {
  const chunks =
    await getSessionChunks(sessionId);

  const uploaded =
    chunks.filter(
      (chunk) =>
        chunk.status === "uploaded"
    );

  for (const chunk of uploaded) {
    await deleteChunk(
      sessionId,
      chunk.chunkIndex
    );
  }

  return true;
}

// ============================================================
// GET ALL PENDING CHUNKS
// ============================================================

export async function getAllPendingChunks() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const request =
      store.getAll();

    request.onsuccess = () => {
      const allChunks =
        request.result || [];

      const pendingChunks =
        allChunks
          .filter(
            (chunk) =>
              chunk.status ===
                "pending" ||
              chunk.status ===
                "failed"
          )
          .sort((a, b) => {
            if (
              a.sessionId !==
              b.sessionId
            ) {
              return a.sessionId.localeCompare(
                b.sessionId
              );
            }

            return (
              a.chunkIndex -
              b.chunkIndex
            );
          });

      resolve(pendingChunks);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            "Failed to read pending chunks"
          )
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// GET ALL CHUNKS
// ============================================================

export async function getAllChunks() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const request =
      store.getAll();

    request.onsuccess = () => {
      const chunks =
        request.result || [];

      chunks.sort((a, b) => {
        if (
          a.sessionId !==
          b.sessionId
        ) {
          return a.sessionId.localeCompare(
            b.sessionId
          );
        }

        return (
          a.chunkIndex -
          b.chunkIndex
        );
      });

      resolve(chunks);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            "Failed to read chunks"
          )
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// CLEAR EVERYTHING
// ============================================================

export async function clearAllChunks() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store =
      transaction.objectStore(STORE_NAME);

    const request =
      store.clear();

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            "Failed to clear recording chunks"
          )
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================
// SESSION SUMMARY
// ============================================================

export async function getSessionChunkSummary(
  sessionId
) {
  const chunks =
    await getSessionChunks(sessionId);

  const summary = {
    total: chunks.length,
    pending: 0,
    uploading: 0,
    uploaded: 0,
    failed: 0,
    totalBytes: 0,
  };

  for (const chunk of chunks) {
    if (
      Object.prototype.hasOwnProperty.call(
        summary,
        chunk.status
      )
    ) {
      summary[chunk.status]++;
    }

    if (
      chunk.blob &&
      typeof chunk.blob.size ===
        "number"
    ) {
      summary.totalBytes +=
        chunk.blob.size;
    }
  }

  return summary;
}
