export interface StorageLike {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const createMemoryStorage = (): StorageLike => {
  const data = new Map<string, unknown>();
  return {
    async get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
      if (!keys) {
        const all: Record<string, unknown> = {};
        for (const [key, value] of data.entries()) {
          all[key] = value;
        }
        return all;
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          result[key] = data.get(key);
        }
        return result;
      }
      return { [keys]: data.get(keys) };
    },
    async set(items: Record<string, unknown>): Promise<void> {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    }
  };
};

const createChromeStorage = (): StorageLike => {
  return {
    async get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys ?? null, (items) => resolve(items));
      });
    },
    async set(items: Record<string, unknown>): Promise<void> {
      return new Promise((resolve) => {
        chrome.storage.local.set(items, () => resolve());
      });
    }
  };
};

export const storage: StorageLike =
  typeof chrome !== "undefined" && chrome.storage?.local
    ? createChromeStorage()
    : createMemoryStorage();

export async function appendArrayItem<T>(key: string, item: T): Promise<T[]> {
  const existing = await storage.get(key);
  const current = Array.isArray(existing[key]) ? (existing[key] as T[]) : [];
  const next = [...current, item];
  await storage.set({ [key]: next });
  return next;
}
