"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Search, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { publicApi } from "@/lib/api";

export default function WhistleblowerStatusPage() {
  const [trackingCode, setTrackingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCode.trim()) {
      setError("Please enter a valid tracking code.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data = await publicApi.getWhistleblowerStatus(trackingCode.trim());
      setStatus(data.routing_status);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid or expired tracking code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col justify-center items-center py-12 px-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      <div className="w-full max-w-md bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-[#F26522] p-2.5 rounded-xl shadow-md">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-widest text-gray-900">
            Report Status Tracker
          </h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Monitor the progress of your anonymous report without logging in.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4 font-mono text-xs uppercase tracking-wider">
          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-655 flex items-center space-x-2 text-[10px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-gray-500 block">Enter Tracking Code</label>
            <div className="relative">
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                required
                placeholder="PASTE THE 36-CHARACTER UUID HERE..."
                className="w-full bg-white border border-gray-200 rounded-lg p-3 pr-10 text-gray-900 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]/50 placeholder:text-gray-300 font-bold"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#F26522]" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </form>

        {status && (
          <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl space-y-4 text-center animate-fade-in font-mono text-xs uppercase">
            <div className="space-y-1.5">
              <span className="block text-[8px] text-gray-400 tracking-widest">Routing Status</span>
              <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${
                status === "ROUTED_TO_AUDIT"
                  ? "bg-red-50 text-red-650 border-red-250"
                  : status === "AI_SCORED"
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : status === "CLOSED"
                  ? "bg-gray-200 text-gray-500 border-gray-300"
                  : "bg-gray-50 text-gray-550 border-gray-200"
              }`}>
                {status.replace("_", " ")}
              </span>
            </div>

            <div className="text-[10px] text-gray-500 leading-normal border-t border-gray-200 pt-3 text-left">
              {status === "RECEIVED" && (
                <span>Your report has been received by the security pipeline. AI risk assessment is queueing.</span>
              )}
              {status === "AI_SCORED" && (
                <span>AI risk screening complete. Scheduled for routing analysis.</span>
              )}
              {status === "ROUTED_TO_AUDIT" && (
                <span className="text-red-650 font-bold">HIGH RISK FLAG TRIGGERED. Escalated to the central audit committee for immediate manual investigation.</span>
              )}
              {status === "CLOSED" && (
                <span>Case closed. Resolution has been saved to the secure ledger.</span>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col space-y-2 text-center">
          <Link
            href="/report"
            className="text-xs font-mono text-[#F26522] hover:underline uppercase tracking-wider flex items-center justify-center space-x-1.5 font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>[File a New Report]</span>
          </Link>
          <Link
            href="/"
            className="text-[10px] font-mono text-gray-400 hover:text-gray-600 uppercase tracking-wider"
          >
            [Go back to landing page]
          </Link>
        </div>

      </div>
    </div>
  );
}
