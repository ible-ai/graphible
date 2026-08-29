// A non-blocking failure notice.
//
// Generation failures used to go through window.alert, which freezes the page
// behind a native dialog and discards the detail. This says what happened,
// stays out of the way, and can be dismissed.

import { AlertTriangle, X } from 'lucide-react';
import { Z } from '../constants/zLayers';

const Notice = ({ notice, onDismiss }) => {
  if (!notice) return null;

  return (
    <div
      className="fixed bottom-6 left-6 max-w-md bg-white rounded-2xl border border-rose-200 shadow-xl p-4"
      style={{ zIndex: Z.MODAL }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="text-rose-600" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{notice.title}</p>
          {notice.detail && (
            <p className="text-xs text-slate-600 mt-1 break-words">{notice.detail}</p>
          )}
          {notice.hint && (
            <p className="text-xs text-slate-500 mt-2">{notice.hint}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notice"
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Notice;
