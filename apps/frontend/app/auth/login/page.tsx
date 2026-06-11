'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        const redirectedFrom = searchParams.get('redirectedFrom') || '/print-room';
        router.push(redirectedFrom);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5 relative z-10">
      {errorMsg && (
        <div className="p-3.5 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 rounded-xl text-xs text-[var(--color-danger)] font-medium">
          {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-2">
          Email Address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field w-full text-sm"
          placeholder="operator@leakguard.ai"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-2">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field w-full text-sm"
          placeholder="••••••••"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-3 disabled:opacity-50"
      >
        {loading ? 'Authenticating...' : 'Authenticate Credentials'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[var(--color-bg-base)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(30,58,138,0.08)_0%,transparent_70%)] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card p-8 rounded-3xl relative overflow-hidden border border-[var(--color-border-glass)] shadow-2xl">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[var(--color-gold-500)]/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="flex justify-center mb-4">
            <Link href="/">
              <img src="/logo.png" alt="Pariksha Ki Suraksha Logo" className="w-16 h-16 object-contain" />
            </Link>
          </div>
          <span className="inline-block bg-[var(--color-indigo-100)] text-[var(--color-indigo-900)] text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-[var(--color-border-indigo)] mb-3">
            Institutional Trust
          </span>
          <h1 className="font-serif text-3xl font-bold text-[var(--color-text-primary)] mt-1">
            परीक्षा की सुरक्षा
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            LeakGuard AI Security Suite
          </p>
        </div>

        <Suspense fallback={<div className="text-center py-8 text-sm text-[var(--color-text-muted)]">Loading Form...</div>}>
          <LoginForm />
        </Suspense>

        <div className="mt-8 pt-6 border-t border-[var(--color-border-indigo)] text-center text-xs text-[var(--color-text-muted)] relative z-10">
          Pariksha Ki Suraksha (परीक्षा की सुरक्षा) — © 2026.
        </div>
      </div>
    </main>
  );
}
