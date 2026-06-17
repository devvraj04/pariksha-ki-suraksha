"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { KeyRound, Mail, AlertTriangle, ShieldAlert } from "lucide-react";
import { publicApi } from "@/lib/api";

export default function AgencyLoginPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear any existing tokens on login load
  useEffect(() => {
    sessionStorage.removeItem("agency_token");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await publicApi.devLogin({ email, password, slug });
      
      sessionStorage.setItem("agency_token", res.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Verify email, password and agency status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFEFEF] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#F26522]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="bg-[#F26522] p-3 rounded-2xl shadow-xl shadow-[#F26522]/10">
            <KeyRound className="h-8 w-8 text-white stroke-[2.5]" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 font-mono uppercase">
          PARIKSHA<span className="text-[#F26522]">SETU</span> PORTAL
        </h2>
        <p className="mt-2 text-center text-xs font-mono uppercase tracking-widest text-[#F26522] font-bold">
          Agency Workspace: <span className="underline decoration-wavy decoration-[#F26522]">{slug}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-sm rounded-2xl sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="flex items-start space-x-2.5 bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-mono text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-mono uppercase tracking-wider text-gray-500">
                Staff Email Address
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="head@youragency.org"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wider text-gray-500">
                Workspace Password
              </label>
              <div className="mt-1 relative">
                <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full font-mono bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-[#F26522]/15 transition-all duration-200 uppercase text-sm tracking-wider hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Enter Workspace"}
              </button>
            </div>
          </form>
          
          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <span className="text-[10px] font-mono text-gray-450 uppercase block">
              Enter your registered staff email and password.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
