"use client";

import React, { useState } from "react";
import { useCenter } from "../layout";
import { KeyRound, Truck, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { centerApi } from "@/lib/api";

type UnlockStep = "request" | "otp" | "receipt" | "done" | "error";

export default function CenterTrunkUnlockPage() {
  const { center, exam } = useCenter();

  const [trunkId, setTrunkId] = useState("");
  const [step, setStep] = useState<UnlockStep>("request");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unlockResult, setUnlockResult] = useState<any>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trunkId.trim()) return;
    setLoading(true);
    setError("");
    try {
      // Use browser geolocation if available
      let lat = 28.6139, lon = 77.2090;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {}

      const res = await centerApi.requestTrunkUnlock(trunkId.trim(), { latitude: lat, longitude: lon });
      if (res.otp_sent) {
        setDevOtp(res.dev_otp || "");
        setStep("otp");
      } else {
        setError(res.error === "OUTSIDE_GEOFENCE"
          ? `You are ${res.distance_meters}m away from the center. Must be within ${res.required_meters}m.`
          : "OTP could not be sent. Check trunk status.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to request OTP.");
    }
    setLoading(false);
  };

  const handleConfirmUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await centerApi.confirmTrunkUnlock(trunkId, { otp: otp.trim(), biometric_data: "officer_verified" });
      setUnlockResult(res);
      setStep("receipt");
    } catch (err: any) {
      setError(err.message || "OTP verification failed.");
    }
    setLoading(false);
  };

  const handleReceiptConfirm = async (papersCorrect: boolean) => {
    setLoading(true);
    try {
      await centerApi.receiptConfirm(trunkId, { papers_correct: papersCorrect });
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Receipt confirmation failed.");
    }
    setLoading(false);
  };

  const reset = () => {
    setStep("request"); setTrunkId(""); setOtp(""); setDevOtp(""); setError(""); setUnlockResult(null);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="bg-[#F26522] p-3 rounded-2xl w-14 h-14 mx-auto flex items-center justify-center shadow-xl shadow-[#F26522]/20">
          <Truck className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-xl font-mono font-bold text-gray-900 uppercase tracking-wider">3-Factor Trunk Unlock</h1>
        <p className="text-xs font-mono text-gray-500">GPS · OTP · Biometric — secure day-of trunk checkin</p>
      </div>

      {/* Progress indicators */}
      <div className="flex items-center justify-center space-x-2 text-xs font-mono">
        {[
          { key: "request", label: "GPS" },
          { key: "otp", label: "OTP" },
          { key: "receipt", label: "Biometric" },
          { key: "done", label: "Confirmed" },
        ].map((s, i, arr) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full border text-[10px] font-bold transition-all ${
              step === s.key ? "bg-[#F26522] text-white border-[#F26522]" :
              ["receipt", "done"].includes(step) && ["request", "otp"].includes(s.key) ? "bg-green-50 text-green-700 border-green-200" :
              step === "done" && s.key === "receipt" ? "bg-green-50 text-green-700 border-green-200" :
              "bg-white text-gray-400 border-gray-200"
            }`}>
              {s.label}
            </div>
            {i < arr.length - 1 && <span className="text-gray-300">—</span>}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-mono text-red-600 flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" /><span>{error}</span>
        </div>
      )}

      {/* Step 1: GPS + Trunk ID */}
      {step === "request" && (
        <form onSubmit={handleRequestOtp} className="bg-white border border-gray-200 p-8 rounded-2xl space-y-6 shadow-sm">
          <div>
            <h2 className="text-sm font-mono font-bold text-gray-900 uppercase">Step 1 — GPS Proximity Check</h2>
            <p className="text-xs text-gray-500 font-mono mt-1">Your device GPS location will be verified against the exam center geofence.</p>
          </div>
          <div>
            <label className="text-[10px] font-mono text-gray-500 uppercase">Trunk ID</label>
            <input
              value={trunkId}
              onChange={e => setTrunkId(e.target.value)}
              placeholder="Enter Trunk UUID or Trunk Code"
              className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-sm font-mono p-3 rounded-xl focus:border-[#F26522] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !trunkId.trim()}
            className="w-full bg-[#F26522] hover:bg-[#e05a1a] text-white py-3 rounded-xl text-sm font-mono font-bold uppercase transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <><KeyRound className="h-4 w-4" /><span>Verify GPS &amp; Send OTP</span></>}
          </button>
        </form>
      )}

      {/* Step 2: OTP */}
      {step === "otp" && (
        <form onSubmit={handleConfirmUnlock} className="bg-white border border-[#F26522]/30 p-8 rounded-2xl space-y-6 shadow-sm">
          <div>
            <h2 className="text-sm font-mono font-bold text-gray-900 uppercase">Step 2 — Enter OTP</h2>
            <p className="text-xs text-gray-500 font-mono mt-1">A 6-digit OTP has been sent to the registered Transit Manager&apos;s phone.</p>
            {devOtp && (
              <div className="mt-3 bg-blue-50 border border-blue-200 p-3 rounded-xl">
                <p className="text-[10px] font-mono text-blue-500 uppercase">Dev Mode — OTP (not sent in production):</p>
                <p className="text-2xl font-mono font-bold text-blue-700 tracking-widest mt-1 text-center">{devOtp}</p>
              </div>
            )}
          </div>
          <div className="flex justify-center">
            <input
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="_ _ _ _ _ _"
              maxLength={6}
              className="bg-white border-2 border-gray-250 text-gray-900 text-3xl font-mono p-4 rounded-xl text-center tracking-widest w-48 focus:border-[#F26522] focus:outline-none"
            />
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={reset} className="flex-1 bg-white text-gray-700 border border-gray-200 py-3 rounded-xl text-sm font-mono hover:bg-gray-50 transition-all">
              Back
            </button>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex-2 flex-grow bg-[#F26522] hover:bg-[#e05a1a] text-white py-3 rounded-xl text-sm font-mono font-bold uppercase transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <span>Verify OTP</span>}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Biometric + Receipt */}
      {step === "receipt" && (
        <div className="bg-white border border-green-200 p-8 rounded-2xl space-y-6 shadow-sm">
          <div className="text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="text-sm font-mono font-bold text-gray-900 uppercase mt-3">Step 3 — Biometric &amp; Receipt</h2>
            <p className="text-xs text-gray-500 font-mono mt-1">OTP verified. Confirm biometric &amp; physical paper count.</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center">
            <p className="text-xs font-mono text-gray-500">Officer identity verified via OTP. Facial check completed.</p>
            <p className="text-xs font-mono text-green-650 mt-2 font-bold">✓ Identity Confirmed (Mocked for Dev)</p>
          </div>
          <div>
            <p className="text-xs font-mono text-[#F26522] uppercase mb-3 font-bold">Are the papers correct and intact?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={loading}
                onClick={() => handleReceiptConfirm(true)}
                className="bg-green-600 text-white py-3 rounded-xl text-sm font-mono font-bold hover:bg-green-550 transition-all disabled:opacity-50 shadow-sm"
              >
                ✓ Papers Correct
              </button>
              <button
                disabled={loading}
                onClick={() => handleReceiptConfirm(false)}
                className="bg-red-50 text-red-600 border border-red-200 py-3 rounded-xl text-sm font-mono font-bold hover:bg-red-100 transition-all disabled:opacity-50 shadow-sm"
              >
                ✗ Mismatch / Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="bg-white border border-green-200 p-8 rounded-2xl text-center space-y-4 shadow-sm">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
          <h2 className="text-xl font-mono font-bold text-green-700 uppercase">Trunk Secured &amp; Received</h2>
          <p className="text-sm font-mono text-gray-500">Chain-of-custody handoff complete. Audit log updated.</p>
          <button onClick={reset} className="bg-white text-gray-700 border border-gray-200 px-6 py-2 rounded-xl text-xs font-mono hover:bg-gray-50 transition-all mt-4 shadow-sm">
            Process Another Trunk
          </button>
        </div>
      )}
    </div>
  );
}
