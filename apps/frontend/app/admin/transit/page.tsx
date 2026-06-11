import React from 'react';
import Link from 'next/link';

export default function AdminTransitMap() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-widest">
            <Link href="/admin" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span>Transit</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Live Transit Tracking
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/10 min-h-[500px] flex items-center justify-center relative">
          <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Google Maps Container</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Google Maps live tracking map with polylines and real-time pings will be rendered here.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 font-sans">Active Batches</h2>
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
            <span>No batches in transit</span>
          </div>
        </div>
      </div>
    </main>
  );
}
