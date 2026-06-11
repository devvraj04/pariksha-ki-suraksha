import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navigation Header */}
      <header className="w-full h-16 bg-[#0D1B3E] border-b border-[#C9A84C]/30 flex items-center justify-between px-6 md:px-12 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
          <span className="font-serif text-lg md:text-xl font-bold text-[#F9F9F7] tracking-wide">
            परीक्षा की सुरक्षा
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-xs md:text-sm font-semibold tracking-widest text-[#F9F9F7] opacity-80 hover:opacity-100 transition-opacity uppercase"
          >
            Operator Portal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-12 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 z-20">
        <div className="flex-1 text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/45 border border-white/60 text-xs text-[#0D1B3E] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#1A7A4A] animate-pulse"></span>
            LeakGuard AI Security Suite Active
          </div>

          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#0D1B3E] leading-tight">
            Pariksha Ki Suraksha
          </h1>

          <p className="text-base md:text-lg text-[#374151] leading-relaxed max-w-xl">
            An autonomous, multi-layered question paper security and leak attribution system. Zero-trust digital vaulting, tracking watermarks, real-time geofenced transit, and forensic attribution.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md pt-4">
            <Link
              href="/auth/login"
              className="btn-primary flex-1"
            >
              Operator Login
            </Link>
            <Link
              href="/report"
              className="btn-official flex-1"
            >
              Submit Anonymous Leak
            </Link>
          </div>
        </div>

        {/* Poster Display Cell */}
        <div className="flex-1 w-full max-w-xl lg:max-w-none">
          <div className="glass-card p-4 rounded-3xl shadow-xl">
            <div className="overflow-hidden rounded-2xl border border-white/40">
              <img
                src="/appPoster.png"
                alt="App Poster"
                className="w-full h-auto object-cover hover:scale-101 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16 w-full border-t border-[#0D1B3E]/10">
        <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2B4EBF]">
            Core Modules
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0D1B3E]">
            Architected Security Framework
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Secure Digital Vault',
              desc: 'AES-256-GCM encryption at rest. Keys split using Shamir’s Secret Sharing scheme (k=2, n=2) requiring dual-authority authentication to assemble keys in RAM.',
              badge: 'Module 1',
              style: 'border-[#2B4EBF]/20 bg-white/30',
              textStyle: 'text-[#2B4EBF]'
            },
            {
              title: 'Print Spooler & Spooler',
              desc: 'PyMuPDF middleware embeds a unique tracking QR in the footer of each copy during the active print window. YOLOv8 models monitor the print room for cellphones.',
              badge: 'Module 1',
              style: 'border-[#2B4EBF]/20 bg-white/30',
              textStyle: 'text-[#2B4EBF]'
            },
            {
              title: 'Geofenced Transit',
              desc: 'Google Maps polyline routing generates pre-approved courses. High-frequency driver GPS pings are checked against route deviation (>500m) or stationary (>10m) limits.',
              badge: 'Module 2',
              style: 'border-[#C9A84C]/40 bg-[#0D1B3E]/90 text-white',
              textStyle: 'text-[#D9BC6A]'
            },
            {
              title: 'Exam Center Entry Control',
              desc: 'Cryptographic admit card verification using RS256-signed JWTs containing student identities. Receptions verified using physical seal counting matches.',
              badge: 'Module 3',
              style: 'border-[#2B4EBF]/20 bg-white/30',
              textStyle: 'text-[#2B4EBF]'
            },
            {
              title: 'OMR Ledgering',
              desc: 'Immediate post-exam binarized OMR scanning and hash computation stored in the immutable database ledger to detect physical tampering prior to grading.',
              badge: 'Module 4',
              style: 'border-[#2B4EBF]/20 bg-white/30',
              textStyle: 'text-[#2B4EBF]'
            },
            {
              title: 'Forensic Intelligence',
              desc: 'Anonymous portal for photo uploads. OpenCV enhancement, deskewing, and binarization decode tracking QR payloads to instantly attribute leak suspects.',
              badge: 'Module 5',
              style: 'border-[#2B4EBF]/20 bg-white/30',
              textStyle: 'text-[#2B4EBF]'
            },
          ].map((feat, i) => (
            <div
              key={i}
              className={`glass-card p-8 flex flex-col justify-between hover:scale-102 transition-transform duration-300 ${feat.style}`}
            >
              <div className="space-y-4">
                <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-current ${feat.textStyle}`}>
                  {feat.badge}
                </span>
                <h3 className={`text-xl font-bold font-serif ${feat.style.includes('text-white') ? 'text-white' : 'text-[#0D1B3E]'}`}>
                  {feat.title}
                </h3>
                <p className={`text-sm leading-relaxed ${feat.style.includes('text-white') ? 'text-slate-300' : 'text-[#374151]'}`}>
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-[#0D1B3E] text-slate-400 py-8 px-6 text-center text-xs mt-auto border-t border-[#C9A84C]/20">
        Pariksha Ki Suraksha (परीक्षा की सुरक्षा) — LeakGuard AI © 2026.
      </footer>
    </main>
  );
}
