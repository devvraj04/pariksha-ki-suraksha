"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, LogIn, Loader2 } from "lucide-react";

export default function StudentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/public/student-dev-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Invalid credentials. Please verify your entries.");
      }

      // Save token same as before — layout checks for this key
      sessionStorage.setItem("student_token", data.token);

      // Go to dashboard
      router.push("/student/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your entries.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col items-center justify-center p-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Brand logo header */}
      <div className="h-16 flex items-center space-x-3 mb-6">
        <div className="bg-[#F26522] p-2 rounded-xl shadow-md">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="font-mono font-bold text-lg tracking-wider text-gray-900">
            PARIKSHA<span className="text-[#F26522]">SETU</span>
          </span>
          <span className="block text-[9px] font-mono tracking-widest text-gray-500 uppercase">
            secured student registry
          </span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4 text-center">
            <h1 className="text-xl font-bold font-mono text-gray-900 uppercase flex items-center justify-center space-x-2">
              <LogIn className="h-5 w-5 text-[#F26522]" />
              <span>Student Authentication</span>
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Access your registrations, secure admit cards, and results.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
                Registered Email Address
              </label>
              <input
                type="email"
                required
                placeholder="student@provider.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
                Account Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting to secure session...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 text-[10px] font-mono text-gray-500 border-t border-gray-100">
            <span>New candidate? </span>
            <Link href="/student/register" className="text-[#F26522] hover:underline font-bold">
              Register now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
