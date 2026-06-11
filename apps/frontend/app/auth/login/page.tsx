'use client';

import React, { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Login functionality will be fully implemented in Phase 1.');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 to-black text-white p-4">
      <div className="w-full max-w-md bg-slate-950/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-block bg-indigo-600 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3">
            System Security
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            LeakGuard AI
          </h1>
          <p className="text-sm text-slate-400 mt-2">Sign in to access secure modules</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="operator@leakguard.ai"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-98"
          >
            Authenticate Credentials
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900 text-center text-xs text-slate-500">
          LeakGuard AI © 2026. All rights reserved.
        </div>
      </div>
    </main>
  );
}
