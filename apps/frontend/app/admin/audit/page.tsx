import React from 'react';
import Link from 'next/link';

export default function AuditLogPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-widest">
            <Link href="/admin" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span>Audit Logs</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Security Audit Trail
          </h1>
        </div>
      </header>

      <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by User ID..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
          />
          <select className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white">
            <option value="">All Action Types</option>
            <option value="paper_uploaded">paper_uploaded</option>
            <option value="key_share_retrieved">key_share_retrieved</option>
            <option value="print_authorized">print_authorized</option>
            <option value="print_job_created">print_job_created</option>
            <option value="batch_dispatched">batch_dispatched</option>
            <option value="batch_compromised">batch_compromised</option>
            <option value="vision_alert_fired">vision_alert_fired</option>
          </select>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden text-center p-12 text-slate-500 text-sm">
          <span>No audit events matching criteria.</span>
        </div>
      </section>
    </main>
  );
}
