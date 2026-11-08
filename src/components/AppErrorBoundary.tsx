import React from 'react';
import {claimChunkRecovery} from '../utils/chunkRecovery';

/** Recover from failed page chunks and render errors without exposing internals. */
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    try {
      if (navigator.onLine && claimChunkRecovery(error, sessionStorage)) window.location.reload();
    } catch { /* Keep the error screen if browser storage is blocked. */ }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen grid place-items-center bg-slate-50 px-5 text-slate-900">
      <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-600">Specialized Study</p>
        <h1 className="mt-3 text-2xl font-bold">Sahifani ochib bo‘lmadi</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Internet aloqasini tekshiring va sahifani qayta yuklang. Muammo davom etsa, administratorga murojaat qiling.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-11 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Qayta yuklash</button>
      </section>
    </main>;
  }
}
