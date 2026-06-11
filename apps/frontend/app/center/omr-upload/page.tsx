'use client';

import React from 'react';

export default function OMRUploadPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-between">
      <header className="border-b border-slate-800 pb-4 mb-6">
        <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
          OMR Ledger
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          OMR Sheet Hash Registration
        </h1>
      </header>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[300px] flex items-center justify-center relative mb-6">
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2">Scan & Upload OMR</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6">
            Upload student OMR sheet scans. The system computes their SHA-256 hash server-side and stores it in the append-only database ledger.
          </p>
          <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 hover:border-indigo-500 transition-colors cursor-pointer inline-block">
            <span className="text-xs">Select OMR Images</span>
          </div>
        </div>
      </div>

      <button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md active:scale-98">
        Register Scanned OMRs to Ledger
      </button>
    </main>
  );
}
