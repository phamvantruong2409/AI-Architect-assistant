// Lưu trữ ảnh đã render bằng IndexedDB (ảnh là data-URL lớn — không vừa localStorage).
// Cùng khuôn với lib/upscale-history.ts.

export interface RenderHistoryItem {
  id: string;
  sourceThumb: string | null; // thumbnail ảnh SketchUp gốc
  image: string; // data-URL / URL ảnh render
  prompt: string; // prompt đã dùng (để sao chép lại)
  modelLabel: string;
  angleLabel: string;
  createdAt: number; // epoch ms
}

const DB_NAME = "render-history";
const STORE = "items";
const MAX_ITEMS = 30;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadHistory(): Promise<RenderHistoryItem[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as RenderHistoryItem[]).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function addHistory(item: RenderHistoryItem): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  const all = await loadHistory();
  if (all.length > MAX_ITEMS) {
    await Promise.all(all.slice(MAX_ITEMS).map((it) => deleteHistory(it.id)));
  }
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
