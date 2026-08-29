// Two-step Google sign-in for the Code Assist backend.
//
// Google's authorization page ends on a Google-hosted page that shows a code.
// The user copies it back here. That paste is the whole setup: no API key, no
// Cloud project, nothing to understand.

import { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { beginSignIn, completeSignIn, signOut, getAccountEmail } from '../utils/codeAssistAuth';

const CodeAssistSignIn = ({ signedIn, onSignedInChange }) => {
  const [stage, setStage] = useState('idle');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const openGoogle = async () => {
    setError(null);
    try {
      const url = await beginSignIn();
      window.open(url, '_blank', 'noopener,noreferrer');
      setStage('awaiting-code');
    } catch (e) {
      setError(e.message);
    }
  };

  const submitCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await completeSignIn(pasted);
      setPasted('');
      setStage('idle');
      onSignedInChange(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (signedIn) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <Check size={16} className="text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-900 truncate">
            {getAccountEmail() ?? 'Signed in to Google'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => { signOut(); onSignedInChange(false); }}
          className="text-xs text-emerald-700 hover:text-emerald-900 underline flex-shrink-0"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={openGoogle}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
      >
        <ExternalLink size={15} />
        Sign in to Gemini CLI
      </button>

      <p className="text-xs text-slate-500">
        Uses your own Google account&apos;s Gemini allowance. Google&apos;s page will
        name <span className="font-medium">Gemini CLI</span> &mdash; that is the
        application you are granting access to.
      </p>

      {stage === 'awaiting-code' && (
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-medium text-slate-600">
            Paste the code Google shows you
            <input
              type="text"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && pasted.trim()) submitCode();
              }}
              placeholder="4/0AVMBsJ…"
              autoFocus
              className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={submitCode}
            disabled={busy || !pasted.trim()}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Signing in…' : 'Finish sign-in'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};

export default CodeAssistSignIn;
