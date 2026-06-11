'use client';

import React, { useState } from 'react';

export default function ForensicPortal() {
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Forensic upload will be fully functional in Phase 2.');
  };

  return (
    <main className="min-h-screen bg-radial from-slate-900 to-black text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl bg-slate-950/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-block bg-rose-600/20 text-rose-400 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3">
            Public Leak Portal
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent">
            See Something. Secure Something.
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Submit suspected examination paper leakage photos or documents anonymously.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Leaked Document Photo / Image
            </label>
            <div className="border-2 border-dashed border-slate-800 hover:border-rose-500 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-500 transition-colors cursor-pointer">
              <span className="text-sm">Click to select image file</span>
              <span className="text-[10px] text-slate-600 mt-1">Supports PNG, JPEG up to 10MB</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Additional Details (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 transition-colors text-white h-24 resize-none"
              placeholder="Provide any context about where or when this image was obtained..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-rose-500/10 active:scale-98"
          >
            Submit Secure Anonymous Report
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900 text-center text-[10px] text-slate-500">
          LeakGuard AI ensures fully anonymous submission. IP hashes are encrypted and no personal data is collected.
        </div>
      </div>
    </main>
  );
}
