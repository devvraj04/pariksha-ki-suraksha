"use client";

import React, { useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { UserCheck, ShieldAlert, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { agencyApi } from "@/lib/api";

function InviteAcceptForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const slug = params.slug as string;
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!token) {
      setError("Invitation token is missing in URL parameters.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      await agencyApi.acceptInvite({
        invite_token: token,
        new_password: password
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation. The token may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white py-8 px-6 shadow-sm rounded-2xl sm:px-10 border border-gray-200 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-green-500 to-emerald-600 p-3 rounded-full shadow-xl shadow-green-500/10">
            <CheckCircle className="h-12 w-12 text-white stroke-[2.5]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-mono uppercase mb-4">
          Account Activated
        </h2>
        <p className="text-sm font-sans text-gray-600 mb-6">
          Your credentials have been securely registered under ParikshaSetu security vaults. You can now log into your agency console.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full font-mono bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-[#F26522]/15 transition-all duration-200 uppercase text-sm tracking-wider"
        >
          Proceed to Login
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-4 shadow-sm rounded-2xl sm:px-10 border border-gray-200">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-start space-x-2.5 bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-mono text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {!token && (
          <div className="flex items-start space-x-2.5 bg-yellow-50 border border-yellow-250 p-3 rounded-xl text-xs font-mono text-yellow-800 mb-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-yellow-600" />
            <span>Warning: No invitation token detected. Please use the complete link provided in your invite mail.</span>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wider text-gray-500">
            Set Security Password
          </label>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-mono uppercase tracking-wider text-gray-500">
            Confirm Password
          </label>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full font-mono bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-[#F26522]/15 transition-all duration-200 uppercase text-sm tracking-wider hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "Registering Credentials..." : "Activate Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="min-h-screen bg-[#EFEFEF] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative selection:bg-[#F26522]/30 selection:text-[#F26522]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#F26522]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-[#F26522] p-3 rounded-2xl shadow-xl shadow-[#F26522]/10">
            <UserCheck className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 font-mono uppercase">
          ACCEPT INVITATION
        </h2>
        <p className="mt-2 text-xs font-mono uppercase tracking-widest text-[#F26522] font-bold">
          Agency Portal: {slug}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Suspense fallback={
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-8 px-6 text-center text-gray-500 font-mono text-xs">
            Loading invitation parameter resolver...
          </div>
        }>
          <InviteAcceptForm />
        </Suspense>
      </div>
    </div>
  );
}
