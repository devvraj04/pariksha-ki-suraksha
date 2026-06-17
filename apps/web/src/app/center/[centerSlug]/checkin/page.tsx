"use client";

import React, { useState, useEffect } from "react";
import { useCenter } from "../layout";
import { ScanLine, UserCheck, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { centerApi } from "@/lib/api";

type CheckinStep = "scan" | "biometric" | "confirmed" | "error";

export default function CenterCheckinKioskPage() {
  const { exam, center } = useCenter();
  const examId = exam?.id;
  const centerId = center?.id;

  const [step, setStep] = useState<CheckinStep>("scan");
  const [qrInput, setQrInput] = useState("");
  const [studentData, setStudentData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [biometricResult, setBiometricResult] = useState("SKIPPED");
  const [centerProgress, setCenterProgress] = useState<any>(null);

  const fetchProgress = async () => {
    if (!examId || !centerId) return;
    try {
      const p = await centerApi.getCheckinProgress(examId, centerId);
      setCenterProgress(p);
    } catch (err) {
      console.error("Failed to load check-in progress:", err);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [examId, centerId]);

  const handleVerifyQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim() || !examId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await centerApi.checkinVerify(examId, { qr_payload_jwt: qrInput.trim() });
      setStudentData(data);
      setStep("biometric");
    } catch (err: any) {
      setErrorMsg(err.message || "QR verification failed.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckin = async () => {
    if (!studentData || !examId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await centerApi.checkinConfirm(examId, {
        student_id: studentData.student_id,
        biometric_match_result: biometricResult,
        biometric_match_score: biometricResult === "MATCHED" ? 0.93 : null,
        failed_attempts: 0,
      });
      setResult(res);
      setStep("confirmed");
      fetchProgress();
    } catch (err: any) {
      setErrorMsg(err.message || "Check-in confirmation failed.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const resetKiosk = () => {
    setStep("scan");
    setQrInput("");
    setStudentData(null);
    setResult(null);
    setErrorMsg("");
    setBiometricResult("SKIPPED");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center space-x-2 bg-[#F26522]/10 border border-[#F26522]/20 px-4 py-2 rounded-full">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-mono text-[#F26522] uppercase tracking-widest font-bold">Day-of-Exam Check-In Kiosk</span>
        </div>
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Exam Code: {exam?.name || "..."}</p>
      </div>

      {/* Progress Bar */}
      {centerProgress && (
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-gray-500">Check-in Progress</span>
            <span className="text-[#F26522] font-bold">{centerProgress.checked_in} / {centerProgress.total_registered}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-[#F26522] h-2 rounded-full transition-all duration-500"
              style={{ width: `${centerProgress.percent}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-450 font-mono mt-1">{centerProgress.absent_so_far} not yet arrived</p>
        </div>
      )}

      {/* Step: QR Scan */}
      {step === "scan" && (
        <div className="bg-white border border-gray-200 p-8 rounded-2xl space-y-6 shadow-sm">
          <div className="text-center space-y-2">
            <ScanLine className="h-12 w-12 text-[#F26522] mx-auto" />
            <h2 className="text-lg font-mono font-bold text-gray-900 uppercase tracking-wider">Scan Admit Card QR</h2>
            <p className="text-xs text-gray-550 font-mono">Scan the QR code from student&apos;s admit card or paste the JWT token below.</p>
          </div>
          <form onSubmit={handleVerifyQR} className="space-y-4">
            <textarea
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              rows={4}
              placeholder="Paste JWT token from QR code..."
              className="w-full bg-white border border-gray-200 text-gray-900 text-xs font-mono p-3 rounded-xl focus:border-[#F26522] focus:outline-none resize-none placeholder:text-gray-400 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !qrInput.trim()}
              className="w-full bg-[#F26522] hover:bg-[#e05a1a] text-white py-3 rounded-xl text-sm font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <><ScanLine className="h-4 w-4" /><span>Verify QR Code</span></>}
            </button>
          </form>
        </div>
      )}

      {/* Step: Biometric */}
      {step === "biometric" && studentData && (
        <div className="bg-white border border-[#F26522]/30 p-8 rounded-2xl space-y-6 shadow-sm">
          <div className="text-center space-y-1">
            <CheckCircle2 className="h-8 w-8 text-green-650 mx-auto" />
            <h2 className="text-lg font-mono font-bold text-gray-900">QR Verified</h2>
          </div>
          <div className="bg-gray-50 border border-gray-250 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Student Name</span>
                <p className="text-gray-900 font-bold font-mono">{studentData.full_name}</p>
              </div>
              <div>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Email</span>
                <p className="text-gray-700 font-mono text-sm">{studentData.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-mono text-gray-550 uppercase">Biometric Verification Result</p>
            <div className="grid grid-cols-3 gap-3">
              {["MATCHED", "FAILED", "SKIPPED"].map(opt => (
                <button
                  key={opt}
                  onClick={() => setBiometricResult(opt)}
                  className={`py-2 rounded-lg text-xs font-mono font-bold border transition-all ${
                    biometricResult === opt
                      ? opt === "MATCHED" ? "bg-green-50 text-green-700 border-green-200" :
                        opt === "FAILED" ? "bg-red-50 text-red-750 border-red-200" :
                        "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-3">
            <button onClick={resetKiosk} className="flex-1 bg-white text-gray-700 border border-gray-200 py-3 rounded-xl text-sm font-mono hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button
              onClick={handleConfirmCheckin}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-mono font-bold uppercase tracking-wider hover:bg-green-550 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <><UserCheck className="h-4 w-4" /><span>Confirm Check-In</span></>}
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirmed */}
      {step === "confirmed" && result && (
        <div className="bg-white border border-green-200 p-8 rounded-2xl text-center space-y-6 shadow-sm">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
          <div>
            <h2 className="text-2xl font-mono font-bold text-green-700">CHECK-IN COMPLETE</h2>
            {result.is_flagged && (
              <div className="mt-2 bg-red-50 border border-red-200 p-2 rounded-xl text-xs font-mono text-red-650 font-bold">
                ⚠ Student flagged for review
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase block">Room</span>
              <span className="text-2xl font-bold font-mono text-gray-900">{result.room_code}</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase block">Seat</span>
              <span className="text-2xl font-bold font-mono text-[#F26522]">{result.seat_number}</span>
            </div>
          </div>
          <button
            onClick={resetKiosk}
            className="w-full bg-[#F26522] hover:bg-[#e05a1a] text-white py-3 rounded-xl text-sm font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F26522]/15"
          >
            <ArrowRight className="h-4 w-4 text-white" /><span>Next Student</span>
          </button>
        </div>
      )}

      {/* Step: Error */}
      {step === "error" && (
        <div className="bg-white border border-red-200 p-8 rounded-2xl text-center space-y-4 shadow-sm">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-mono font-bold text-red-650">VERIFICATION FAILED</h2>
          <p className="text-sm font-mono text-gray-600">{errorMsg}</p>
          <button onClick={resetKiosk} className="bg-white text-gray-700 border border-gray-200 px-6 py-2 rounded-xl text-xs font-mono hover:bg-gray-50 transition-all">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
