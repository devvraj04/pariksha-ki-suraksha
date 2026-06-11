import React from 'react';
import Link from 'next/link';

export default function PrintRoomDashboard() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
            Print Room Ops
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Print Spooler Interceptor
          </h1>
        </div>
        <div>
          <Link
            href="/print-room/view-paper"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-98"
          >
            Open Secure Viewer
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Print Queue</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden p-8 text-center text-slate-500 text-sm">
            <span>No jobs active in spooler queue</span>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Live Room Monitoring</h2>
            <p className="text-xs text-slate-400">YOLOv8 Object Detection status feed</p>
          </div>
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
            <span>Room security status: SECURE</span>
          </div>
        </div>
      </div>
    </main>
  );
}
