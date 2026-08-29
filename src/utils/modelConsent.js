// Consent to download a browser model, recorded per model.
//
// This used to be one global 'granted' | 'denied' string. A grant for an older
// model silently counted as a grant for a newly chosen one, and a stale denial
// could never be revisited, so the app believed consent had been settled while
// the user was never asked about the model they had actually picked.

const STORAGE_KEY = 'graphible-webllm-consent-v2';

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getModelConsent = (modelId) => {
  if (!modelId) return null;
  const entry = readAll()[modelId];
  return entry ? entry.granted === true : null;
};

export const setModelConsent = (modelId, granted) => {
  if (!modelId) return;
  try {
    const all = readAll();
    all[modelId] = { granted: granted === true, at: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private windows can refuse storage; the decision still applies to this
    // session, it just will not be remembered.
  }
};

export const clearModelConsent = (modelId) => {
  try {
    const all = readAll();
    delete all[modelId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
};

// If the weights are already in the browser's cache there is nothing to
// download, so asking again is just friction. Transformers.js and WebLLM both
// keep model files in Cache Storage keyed by their source URL.
export const isModelCached = async (modelId) => {
  if (!modelId || typeof caches === 'undefined') return false;

  const needle = modelId.split('/').pop();
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      if (requests.some((r) => r.url.includes(needle) && /\.(onnx|onnx_data|bin|wasm)/.test(r.url))) {
        return true;
      }
    }
  } catch {
    // Cache Storage is unavailable in some contexts; fall back to asking.
  }
  return false;
};
