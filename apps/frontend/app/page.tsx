import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500 selection:text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-indigo-400 font-semibold mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          FAR AWAY 2026 Hackathon Presentation
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8">
          LeakGuard <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">AI</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-3xl leading-relaxed mb-12">
          An autonomous, multi-layered question paper security and leak attribution system. Zero-trust digital vaulting, tracking watermarks, real-time geofenced transit, and forensic attribution.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
          <Link
            href="/auth/login"
            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-6 rounded-2xl text-sm transition-all shadow-xl shadow-indigo-600/20 text-center active:scale-98"
          >
            Operator Login
          </Link>
          <Link
            href="/report"
            className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-bold py-3.5 px-6 rounded-2xl text-sm transition-all text-center active:scale-98"
          >
            Submit Anonymous Leak
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-900">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-16">
          Architected Core Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: 'Secure Digital Vault',
              desc: 'AES-256-GCM encryption at rest. Keys split using Shamir’s Secret Sharing scheme (k=2, n=2) requiring dual-authority authentication to assemble keys in RAM.',
              badge: 'Module 1',
              color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10',
            },
            {
              title: 'Print Interceptor & Spooler',
              desc: 'PyMuPDF middleware embeds a unique tracking QR in the footer of each copy during the active print window. YOLOv8 models monitor the print room for cellphones.',
              badge: 'Module 1',
              color: 'text-blue-400 bg-blue-500/10 border-blue-500/10',
            },
            {
              title: 'Geofenced Transit',
              desc: 'Google Maps polyline routing generates pre-approved courses. High-frequency driver GPS pings are checked against route deviation (>500m) or stationary (>10m) limits.',
              badge: 'Module 2',
              color: 'text-amber-400 bg-amber-500/10 border-amber-500/10',
            },
            {
              title: 'Exam Center Entry Control',
              desc: 'Cryptographic admit card verification using RS256-signed JWTs containing student identities. Receptions verified using physical seal counting matches.',
              badge: 'Module 3',
              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10',
            },
            {
              title: 'OMR Ledger Ledgering',
              desc: 'Immediate post-exam binarized OMR scanning and hash computation stored in the immutable database ledger to detect physical tampering prior to grading.',
              badge: 'Module 4',
              color: 'text-purple-400 bg-purple-500/10 border-purple-500/10',
            },
            {
              title: 'Forensic Intelligence',
              desc: 'Anonymous portal for photo uploads. OpenCV enhancement, deskewing, and binarization decode tracking QR payloads to instantly attribute leak suspects.',
              badge: 'Module 5',
              color: 'text-rose-400 bg-rose-500/10 border-rose-500/10',
            },
          ].map((feat, i) => (
            <div
              key={i}
              className="bg-slate-900/30 border border-slate-900 rounded-3xl p-8 hover:border-slate-800 transition-colors flex flex-col justify-between"
            >
              <div>
                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${feat.color} mb-6`}>
                  {feat.badge}
                </span>
                <h3 className="text-xl font-bold mb-4">{feat.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-900 text-center text-xs text-slate-500">
        LeakGuard AI — Designed and Engineered for FAR AWAY 2026.
      </footer>
    </main>
  );
}
