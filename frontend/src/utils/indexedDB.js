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
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

export async function saveChunk({
  sessionId,
  chunkIndex,
  blob,
}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("chunkIndex must be a non-negative integer");
  }

  if (!(blob instanceof Blob)) {
    throw new Error("chunk must be a Blob");
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const id = `${sessionId}:${chunkIndex}`;

    const record = {
      id,
      sessionId,
      chunkIndex,
      blob,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const request = store.put(record);

    request.onsuccess = () => {
      resolve(record);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to save chunk"));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

export async function getChunk(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to get chunk"));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

export async function getSessionChunks(sessionId) {
  if (!sessionId) {
    return [];
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("sessionId");

    const request = index.getAll(sessionId);

    request.onsuccess = () => {
      const chunks = request.result || [];

      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      resolve(chunks);
    };

    request.onerror = () => {
      reject(
        request.error || new Error("Failed to read session chunks")
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

export async function getPendingChunks(sessionId) {
  const chunks = await getSessionChunks(sessionId);

  return chunks.filter(
    (chunk) =>
      chunk.status === "pending" ||
      chunk.status === "failed"
  );
}

export async function updateChunkStatus(
  sessionId,
  chunkIndex,
  status,
  attempts
) {
  const id = `${sessionId}:${chunkIndex}`;

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;

      if (!existing) {
        resolve(null);
        return;
      }

      existing.status = status;
      existing.attempts =
        typeof attempts === "number"
          ? attempts
          : existing.attempts;

      existing.updatedAt = Date.now();

      const putRequest = store.put(existing);

      putRequest.onsuccess = () => {
        resolve(existing);
      };

      putRequest.onerror = () => {
        reject(
          putRequest.error ||
            new Error("Failed to update chunk")
        );
      };
    };

    getRequest.onerror = () => {
      reject(
        getRequest.error ||
          new Error("Failed to find chunk for update")
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

export async function deleteChunk(sessionId, chunkIndex) {
  const id = `${sessionId}:${chunkIndex}`;

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(id);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(
        request.error || new Error("Failed to delete chunk")
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

export async function deleteSessionChunks(sessionId) {
  const chunks = await getSessionChunks(sessionId);

  for (const chunk of chunks) {
    await deleteChunk(sessionId, chunk.chunkIndex);
  }

  return true;
}

export async function getAllPendingChunks() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const allChunks = request.result || [];

      const pendingChunks = allChunks.filter(
        (chunk) =>
          chunk.status === "pending" ||
          chunk.status === "failed"
      );

      pendingChunks.sort((a, b) => {
        if (a.sessionId !== b.sessionId) {
          return a.sessionId.localeCompare(b.sessionId);
        }

        return a.chunkIndex - b.chunkIndex;
      });

      resolve(pendingChunks);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error("Failed to read pending chunks")
      );
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}