// Asks before downloading a browser model.
//
// This replaces a window.confirm that fired during startup, before the user had
// read anything or chosen to use a browser model at all. It is now raised only
// when a download is genuinely about to happen.

import { Download, Shield, HardDrive, WifiOff, X } from 'lucide-react';

const ModelDownloadConsent = ({ request, onDecide }) => {
  if (!request) return null;

  const { modelId, info } = request;
  const size = info?.size ?? 'a few hundred MB';
  const name = info?.name ?? modelId;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="model-consent-title"
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="text-blue-600" size={22} />
            </div>
            <div>
              <h3 id="model-consent-title" className="text-lg font-semibold text-slate-800">
                Download {name}?
              </h3>
              <p className="text-sm text-slate-600">{size}, once</p>
            </div>
          </div>
          <button
            onClick={() => onDecide(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            aria-label="Cancel download"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-sm text-slate-700">
            This model runs entirely in your browser. Downloading it takes a few
            minutes on a typical connection, and only happens once.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm text-green-800">
            <div className="flex items-center gap-2">
              <Shield size={14} className="flex-shrink-0" />
              <span>Your prompts never leave this device</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="flex-shrink-0" />
              <span>Stored in this browser, and reused next time</span>
            </div>
            <div className="flex items-center gap-2">
              <WifiOff size={14} className="flex-shrink-0" />
              <span>Works offline afterwards</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Prefer not to? Cancel and pick Demo mode, a cloud model, or a local
            Ollama server from the model menu instead.
          </p>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={() => onDecide(true)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Download and continue
          </button>
          <button
            onClick={() => onDecide(false)}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelDownloadConsent;
