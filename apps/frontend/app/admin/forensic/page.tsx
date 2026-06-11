import React from 'react';
import Link from 'next/link';

export default function AdminForensicReports() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-widest">
            <Link href="/admin" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span>Forensics</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Forensic Reports
          </h1>
        </div>
      </header>

      <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6 font-sans">Attribution Logs</h2>
        <div className="border border-slate-800 rounded-xl overflow-hidden text-center p-12 text-slate-500 text-sm">
          <span>No forensic reports have been generated yet.</span>
        </div>
      </section>
    </main>
  );
}
