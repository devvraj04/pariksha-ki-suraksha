import React from 'react';
import Link from 'next/link';

export default function ForensicStatusPage({ params }: { params: { job_id: string } }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-md">
        <header className="border-b border-slate-800 pb-6 mb-8 text-center">
          <span className="text-rose-400 text-xs font-semibold uppercase tracking-widest">
            Forensic Investigation Status
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Analysis Job Status
          </h1>
          <p className="text-[10px] text-slate-500 mt-2 font-mono">Job ID: {params.job_id}</p>
        </header>

        <section className="space-y-6">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-rose-500 animate-spin mb-4"></div>
            <h3 className="font-bold text-sm">Processing Leak Image</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-sm">
              The ForensicWorker OpenCV & EasyOCR pipeline is deskewing, enhancing, and scanning for Tracking Matrix Codes (TMC).
            </p>
          </div>
        </section>

        <footer className="mt-8 pt-6 border-t border-slate-800 text-center">
          <Link
            href="/report"
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
          >
            ← Submit Another Image
          </Link>
        </footer>
      </div>
    </main>
  );
}
