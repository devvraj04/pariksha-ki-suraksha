'use client';

import React from 'react';

export default function SupervisorDashboard() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-between">
      <header className="border-b border-slate-800 pb-4 mb-6">
        <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
          Supervisor App
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Exam Center Portal
        </h1>
      </header>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[300px] flex items-center justify-center relative mb-6">
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2">Entry QR Scanner</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Scan candidate admit card QR codes to verify cryptographic JWT signatures and display identity details.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all active:scale-98">
          Verify Admit Card
        </button>
        <button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md active:scale-98">
          Receive Paper Box
        </button>
      </div>
    </main>
  );
}
