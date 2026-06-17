"use client";

import React, { useState } from "react";
import { publicApi } from "@/lib/api";
import { Loader2, Shield, Calendar, Award, CheckCircle, XCircle, FileDown, ShieldCheck } from "lucide-react";

export default function PublicResultsPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [appNumber, setAppNumber] = useState("");
  const [otp, setOtp] = useState("");
  
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  
  // Mashed last 4 digits
  const [phoneLast4, setPhoneLast4] = useState("");
  // Dev OTP fallback displayed on dev
  const [devOtp, setDevOtp] = useState("");

  // Result card data
  const [resultData, setResultData] = useState<any>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appNumber.trim()) return;
    setSendingOtp(true);
    setError(null);
    setSuccessMsg("");
    try {
      const res = await publicApi.requestResultOtp({ application_number: appNumber.trim() });
      setPhoneLast4(res.phone_last4);
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
      }
      setSuccessMsg(res.message || "OTP sent successfully.");
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to trigger OTP verification.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await publicApi.verifyResult({
        application_number: appNumber.trim(),
        otp: otp.trim(),
        captcha_token: "mock-captcha-token"
      });
      setResultData(data);
    } catch (err: any) {
      setError(err.message || "Verification failed. Check OTP.");
    } finally {
      setVerifying(false);
    }
  };

  const downloadPdf = () => {
    if (!resultData?.result_pdf_path) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
    const directUrl = `${supabaseUrl}/storage/v1/object/public/result-pdfs/${resultData.result_pdf_path}`;
    window.open(directUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#EFEFEF] flex flex-col items-center justify-center p-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      
      {/* Brand logo */}
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-2xl font-mono font-bold text-gray-900 uppercase tracking-widest flex items-center justify-center space-x-2">
          <Shield className="h-6 w-6 text-[#F26522]" />
          <span>ParikshaSetu AI</span>
        </h1>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Public Results &amp; Merit Gateway</p>
      </div>

      <div className="w-full max-w-xl">
        
        {/* Verification forms */}
        {!resultData ? (
          <div className="bg-white border border-gray-200 p-8 rounded-3xl space-y-6 shadow-sm">
            
            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="text-center space-y-1">
                  <h2 className="text-sm font-mono font-bold text-gray-900 uppercase">Result Verification</h2>
                  <p className="text-[11px] text-gray-500 font-mono">Enter your unique candidate application number.</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs font-mono text-red-650">
                    {error}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Application Number</label>
                  <input
                    value={appNumber}
                    onChange={e => setAppNumber(e.target.value)}
                    placeholder="e.g., APP-XXXXXX"
                    required
                    className="w-full mt-1.5 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-3 rounded-xl focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingOtp}
                  className="w-full bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white font-mono font-bold text-xs uppercase py-3 rounded-full transition-all shadow-md shadow-[#F26522]/10 flex items-center justify-center cursor-pointer"
                >
                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Secure OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyResult} className="space-y-4">
                <div className="text-center space-y-1">
                  <h2 className="text-sm font-mono font-bold text-gray-900 uppercase">Enter Security Credentials</h2>
                  <p className="text-[11px] text-gray-500 font-mono">
                    OTP sent to registered phone ending in <span className="text-gray-900 font-bold">*******{phoneLast4}</span>.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs font-mono text-red-650">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-green-50 border border-green-200 p-3.5 rounded-xl text-xs font-mono text-green-600">
                    {successMsg}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">6-Digit Mobile OTP</label>
                  <input
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    placeholder="Enter verification code"
                    required
                    maxLength={6}
                    className="w-full mt-1.5 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-3 rounded-xl focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]/50"
                  />
                </div>

                {devOtp && (
                  <div className="bg-amber-50 border border-amber-250 p-3 rounded-xl text-xs font-mono text-amber-600">
                    Dev Testing OTP: <span className="font-bold text-gray-900 text-sm">{devOtp}</span>
                  </div>
                )}

                <div className="flex space-x-2 text-xs font-mono pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(null); }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 py-3 rounded-full cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="flex-1 bg-[#F26522] hover:bg-[#e05a1a] text-white font-mono font-bold uppercase py-3 rounded-full transition-all shadow-md shadow-[#F26522]/10 flex items-center justify-center cursor-pointer"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify &amp; Load Card"}
                  </button>
                </div>
              </form>
            )}

          </div>
        ) : (
          /* Scorecard Result Card */
          <div className="bg-white border border-gray-200 p-8 rounded-3xl space-y-6 shadow-sm">
            
            {/* Pass / Fail banner */}
            <div className="flex items-center justify-between border-b border-gray-150 pb-4">
              <div>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Candidate Scorecard</span>
                <h2 className="text-lg font-mono font-bold text-gray-900 uppercase mt-0.5">{resultData.candidate_name}</h2>
                <p className="text-[10px] font-mono text-gray-500 mt-1">App No: <span className="text-gray-950 font-bold">{resultData.application_number}</span></p>
              </div>
              
              <div className="text-right">
                {resultData.result_status === "PASS" ? (
                  <span className="inline-flex items-center space-x-1.5 bg-green-50 border border-green-200 text-green-600 px-3 py-1 rounded-full text-xs font-mono font-bold">
                    <CheckCircle className="h-4 w-4" />
                    <span>QUALIFIED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 bg-red-50 border border-red-200 text-red-655 px-3 py-1 rounded-full text-xs font-mono font-bold">
                    <XCircle className="h-4 w-4" />
                    <span>NOT QUALIFIED</span>
                  </span>
                )}
              </div>
            </div>

            {/* Exam info */}
            <div className="flex items-center space-x-2 text-xs font-mono text-gray-500">
              <Calendar className="h-4 w-4 text-[#F26522]" />
              <span>{resultData.exam_name}</span>
            </div>

            {/* Marks summaries */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
                <div className="text-xl font-mono font-bold text-gray-900">{resultData.final_marks}</div>
                <div className="text-[9px] font-mono text-gray-400 uppercase mt-0.5">Scored</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
                <div className="text-xl font-mono font-bold text-gray-900">{resultData.max_marks}</div>
                <div className="text-[9px] font-mono text-gray-400 uppercase mt-0.5">Max Marks</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
                <div className="text-xl font-mono font-bold text-[#F26522]">{resultData.percentage}%</div>
                <div className="text-[9px] font-mono text-gray-400 uppercase mt-0.5">Percentage</div>
              </div>
            </div>

            {/* Ranks */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex items-center space-x-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <Award className="h-5 w-5 text-[#F26522] shrink-0" />
                <div>
                  <span className="text-[9px] text-gray-400 uppercase">All-India Rank</span>
                  <div className="font-bold text-gray-900">AIR #{resultData.rank || "—"}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <Award className="h-5 w-5 text-purple-650 shrink-0" />
                <div>
                  <span className="text-[9px] text-gray-400 uppercase">Category Rank</span>
                  <div className="font-bold text-gray-900">CR #{resultData.category_rank || "—"}</div>
                </div>
              </div>
            </div>

            {/* Subject breakdown table */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono text-gray-400 uppercase tracking-widest font-bold">Sectional Breakdown</h4>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-xs font-mono">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase">
                      <th className="px-4 py-2">Section</th>
                      <th className="px-4 py-2 text-right">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultData.subject_breakdown && Object.entries(resultData.subject_breakdown).map(([section, score]: any) => (
                      <tr key={section} className="border-b border-gray-100">
                        <td className="px-4 py-2.5 text-gray-700">{section}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900">{score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PDF and Grievance actions */}
            <div className="pt-4 border-t border-gray-150 flex flex-col sm:flex-row gap-3 font-mono text-xs">
              <button
                onClick={downloadPdf}
                className="flex-1 bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold uppercase py-3 rounded-full transition-all flex items-center justify-center space-x-2 shadow-md shadow-[#F26522]/10 cursor-pointer"
              >
                <FileDown className="h-4 w-4" />
                <span>Download Signed Scorecard</span>
              </button>
              
              <button
                onClick={() => {
                  alert("Grievance center: Routing to Student Login. Please log in first to file evaluation grievances.");
                  window.location.href = "/student/login";
                }}
                className="flex-1 bg-gray-950 text-white hover:bg-gray-800 py-3 rounded-full cursor-pointer"
              >
                File an Evaluation Grievance
              </button>
            </div>

            {/* Secured validation note */}
            <div className="flex items-center space-x-2 text-[9px] font-mono text-gray-400 justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              <span>Cryptographically signed scorecard. Verifiable via HSM key gateway.</span>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}
