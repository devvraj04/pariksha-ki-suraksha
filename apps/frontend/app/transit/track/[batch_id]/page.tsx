'use client';

import React from 'react';
import Link from 'next/link';

export default function TransitPWA({ params }: { params: { batch_id: string } }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-between">
      <header className="border-b border-slate-800 pb-4 mb-6">
        <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
          Driver Transit Console
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Tracking Batch
        </h1>
        <p className="text-[10px] text-slate-500 mt-1 truncate">ID: {params.batch_id}</p>
      </header>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[300px] flex items-center justify-center relative mb-6">
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2">GPS Tracking Map</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Live route guidance and checkpoint scanner will be displayed here.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md active:scale-98">
          Scan Checkpoint QR Seal
        </button>
      </div>
    </main>
  );
}
