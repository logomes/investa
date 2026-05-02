import "@testing-library/jest-dom/vitest";

// Provide a functional localStorage for tests running in Node (Zustand persist middleware).
// Node 22+ exposes a stub global `localStorage` that requires --localstorage-file to work;
// unconditionally replace it with an in-memory implementation so persist middleware works
// without file I/O side-effects and without triggering the Node webstorage warning.
const _localStorageStore = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => _localStorageStore.get(key) ?? null,
    setItem: (key: string, value: string) => { _localStorageStore.set(key, value); },
    removeItem: (key: string) => { _localStorageStore.delete(key); },
    clear: () => { _localStorageStore.clear(); },
    get length() { return _localStorageStore.size; },
    key: (index: number) => Array.from(_localStorageStore.keys())[index] ?? null,
  },
  writable: true,
  configurable: true,
});
