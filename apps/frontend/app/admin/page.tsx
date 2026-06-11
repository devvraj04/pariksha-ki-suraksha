import React from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12 border-b border-slate-800 pb-6">
        <div>
          <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
            Control Panel
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auth/login"
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            Logout
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { title: 'Active Exams', val: '0', color: 'border-blue-500/20' },
          { title: 'Papers Encrypted', val: '0', color: 'border-purple-500/20' },
          { title: 'Transit Batches', val: '0', color: 'border-amber-500/20' },
          { title: 'Forensic Reports', val: '0', color: 'border-emerald-500/20' },
        ].map((stat, i) => (
          <div key={i} className={`bg-slate-900/40 border ${stat.color} rounded-2xl p-6 backdrop-blur-md`}>
            <p className="text-sm text-slate-400 font-medium">{stat.title}</p>
            <h3 className="text-3xl font-bold mt-2">{stat.val}</h3>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/exams"
              className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-indigo-500/50 transition-all group"
            >
              <div>
                <h4 className="font-bold text-sm">Exam Management</h4>
                <p className="text-xs text-slate-400 mt-1">Manage exam records and admit cards</p>
              </div>
              <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
            </Link>

            <Link
              href="/admin/transit"
              className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-indigo-500/50 transition-all group"
            >
              <div>
                <h4 className="font-bold text-sm">Live Transit Map</h4>
                <p className="text-xs text-slate-400 mt-1">Real-time GPS tracking status</p>
              </div>
              <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
            </Link>

            <Link
              href="/admin/forensic"
              className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-indigo-500/50 transition-all group"
            >
              <div>
                <h4 className="font-bold text-sm">Forensic Intelligence</h4>
                <p className="text-xs text-slate-400 mt-1">Analyze watermarks and attribution</p>
              </div>
              <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
            </Link>

            <Link
              href="/admin/audit"
              className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-indigo-500/50 transition-all group"
            >
              <div>
                <h4 className="font-bold text-sm">System Audit Logs</h4>
                <p className="text-xs text-slate-400 mt-1">Append-only security log history</p>
              </div>
              <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
            </Link>
          </div>
        </div>

        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Vision Alerts Feed</h2>
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
            <span>No security anomalies active</span>
          </div>
        </div>
      </section>
    </main>
  );
}
