'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function SecureViewerPage() {
  useEffect(() => {
    // Intercept copy/paste/keys
    const preventShortcuts = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        alert('Action Blocked: Secure document protections are active.');
      }
    };
    
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', preventShortcuts);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.removeEventListener('keydown', preventShortcuts);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-widest">
            <Link href="/print-room" className="hover:underline">Print Room</Link>
            <span>/</span>
            <span>Secure Viewer</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-red-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
            Secure Canvas Document Viewer
          </h1>
          <p className="text-xs text-rose-400 mt-1 font-semibold">
            ⚠️ Warning: Active monitoring is enabled. Screenshots, printing, and inspected elements are restricted.
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[500px] flex items-center justify-center relative select-none">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Secure PDF Canvas</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Decrypted question paper streams will render here directly on HTML5 Canvas via PDF.js.
            </p>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">Print Control</h3>
            <button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-md active:scale-98">
              Spool Print Copy Job
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
