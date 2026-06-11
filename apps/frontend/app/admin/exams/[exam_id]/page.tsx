import React from 'react';
import Link from 'next/link';

export default function ExamDetailPage({ params }: { params: { exam_id: string } }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-widest">
            <Link href="/admin" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/exams" className="hover:underline">Exams</Link>
            <span>/</span>
            <span>Detail</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Exam Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">ID: {params.exam_id}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Paper Upload</h2>
            <p className="text-sm text-slate-400 mb-6">
              Upload the question paper PDF. It will be encrypted with AES-256-GCM, and key shares will be split using Shamir's Secret Sharing.
            </p>
            <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:border-indigo-500 transition-colors cursor-pointer">
              <span className="text-sm">Click to select PDF or drag and drop</span>
            </div>
          </section>

          <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Print Authorization</h2>
            <p className="text-sm text-slate-400 mb-6">
              Submit key shares from both authorities to assemble keys in RAM and authorize a print window.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
                <h4 className="font-bold text-xs text-slate-300 uppercase tracking-widest mb-3">Authority A</h4>
                <input
                  type="text"
                  placeholder="Paste Key Share A (Hex)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
                <h4 className="font-bold text-xs text-slate-300 uppercase tracking-widest mb-3">Authority B</h4>
                <input
                  type="text"
                  placeholder="Paste Key Share B (Hex)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
            </div>
            <button className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md active:scale-98">
              Assemble Key & Authorize Print Session
            </button>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Admit Cards</h2>
            <p className="text-sm text-slate-400 mb-6">
              Bulk-generate cryptographic QR code admit cards signed with the server's RS256 key for enrolled candidates.
            </p>
            <button className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all border border-slate-700 active:scale-98">
              Generate Admit Cards (JWT-QR)
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
