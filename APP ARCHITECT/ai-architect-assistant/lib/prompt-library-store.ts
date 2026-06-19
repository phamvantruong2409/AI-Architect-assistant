// Kho lưu Prompt — dùng IndexedDB để lưu vĩnh viễn (kèm ảnh) thay vì localStorage
// (localStorage ~5MB không đủ cho nhiều ảnh). Hoạt động cả trên Electron.

export interface PromptLibraryItem {
  id: string;
  title: string;
  text: string;
  /** dataURL các ảnh (tối đa 5). */
  images: string[];
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "ai-architect";
const STORE = "promptLibrary";
const VERSION = 1;

export const MAX_IMAGES_PER_ITEM = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không mở được IndexedDB."));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Thao tác IndexedDB thất bại."));
        t.oncomplete = () => db.close();
      })
  );
}

export async function getAllItems(): Promise<PromptLibraryItem[]> {
  const items = await tx<PromptLibraryItem[]>("readonly", (s) => s.getAll());
  return (items ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putItem(item: PromptLibraryItem): Promise<void> {
  await tx("readwrite", (s) => s.put(item));
}

export async function deleteItem(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Tạo một mục mới (tự sinh id + mốc thời gian). */
export function makeItem(data: { title: string; text: string; images: string[] }): PromptLibraryItem {
  const now = Date.now();
  return {
    id: newId(),
    title: data.title,
    text: data.text,
    images: data.images,
    createdAt: now,
    updatedAt: now,
  };
}
