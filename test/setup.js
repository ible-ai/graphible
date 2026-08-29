import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// coordinateUtils reads window.innerWidth/innerHeight directly. jsdom's default
// is 1024x768; pin it so coordinate assertions do not depend on jsdom's version.
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

// This Vitest/jsdom combination exposes `localStorage` as a bare object with no
// methods, so anything calling getItem throws. The app reads both storages at
// module scope, so give them a real implementation.
const makeStorage = () => {
  let store = new Map();
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => void store.set(String(k), String(v)),
    removeItem: (k) => void store.delete(String(k)),
    clear: () => void (store = new Map()),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
};

for (const name of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(window, name, { value: makeStorage(), writable: true, configurable: true });
  Object.defineProperty(globalThis, name, { value: window[name], writable: true, configurable: true });
}

// Storage persists across tests in a real browser session, but leaking saved
// configs between tests makes failures order-dependent.
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
