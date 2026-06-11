import React from 'react';
import Link from 'next/link';

export default function ExamsListPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-widest">
            <Link href="/admin" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span>Exams</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Exam Management
          </h1>
        </div>
        <button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all shadow-lg active:scale-98">
          + Create Exam
        </button>
      </header>

      <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6">Active Exams</h2>
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Scheduled Date</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="px-6 py-8 text-center text-slate-500" colSpan={6}>
                  No exams found. Click "+ Create Exam" to register one.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
