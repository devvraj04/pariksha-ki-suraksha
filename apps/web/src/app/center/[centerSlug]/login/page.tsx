"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Landmark, Mail, Lock, Loader2, ShieldAlert } from "lucide-react";
import { centerApi } from "@/lib/api";

export default function CenterLoginPage() {
  const params = useParams();
  const router = useRouter();
  const centerSlug = params.centerSlug as string;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await centerApi.login({
        email,
        password,
        center_slug: centerSlug
      });

      // Store in session storage
      sessionStorage.setItem("center_token", res.token);
      sessionStorage.setItem("center_officer_name", res.full_name || "Center Officer");
      
      // Redirect to main console dashboard
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials or unauthorized center staff mapping.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex items-center justify-center p-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm space-y-6 p-8 relative">
        <div className="absolute top-0 right-0 p-3">
          <span className="bg-red-50 border border-red-200 text-red-600 text-[8px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            RESTRICTED NETWORK
          </span>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-3 pt-4 border-b border-gray-100 pb-6">
          <div className="bg-[#F26522] p-3 rounded-2xl w-14 h-14 mx-auto flex items-center justify-center shadow-xl shadow-[#F26522]/20">
            <Landmark className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-gray-900 uppercase tracking-wider">
              CENTER<span className="text-[#F26522]">PORTAL</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-widest">
              Security Node: {centerSlug}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600 flex items-start space-x-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-500 animate-pulse" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
              Registered Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@domain.com"
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] placeholder:text-gray-400 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
              Private Security Key
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] placeholder:text-gray-400 transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/10"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Validating credentials...</span>
                </>
              ) : (
                <>
                  <Landmark className="h-4 w-4 text-white" />
                  <span>Initialize Console Login</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl text-[9px] font-mono text-gray-500 leading-relaxed">
          * This login session is restricted to authorized on-site officers mapped under the Supabase Role-Level-Security network. Access attempts are audited.
        </div>
      </div>
    </div>
  );
}
