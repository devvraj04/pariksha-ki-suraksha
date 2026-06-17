"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditCard, CheckCircle2, Loader2, Sparkles, ShieldAlert, ArrowRight } from "lucide-react";
import { studentApi } from "@/lib/api";

export default function StudentPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const examSlug = params.examSlug as string;
  const regId = searchParams.get("regId") as string;

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regDetail, setRegDetail] = useState<any>(null);

  useEffect(() => {
    if (!regId) {
      setError("Missing registration identifier.");
      setLoading(false);
      return;
    }

    async function loadPaymentDetails() {
      try {
        const details = await studentApi.getRegistrationDetail(regId);
        setRegDetail(details);
        
        // Initiate payment session
        await studentApi.initiatePayment(regId);
      } catch (err: any) {
        setError(err.message || "Failed to load payment transaction details.");
      } finally {
        setLoading(false);
      }
    }

    loadPaymentDetails();
  }, [regId]);

  const handleSimulatePayment = async () => {
    setPaying(true);
    setError(null);
    try {
      // Direct call to dev confirm endpoint
      await studentApi.confirmPayment(regId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Simulated payment transaction failed.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span className="text-gray-500 text-xs">Initializing transaction gateway...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-md mx-auto space-y-8">
      
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 space-y-6">
          <div className="border-b border-gray-150 pb-4 text-center">
            <h1 className="text-xl font-bold font-mono text-gray-900 uppercase flex items-center justify-center space-x-2">
              <CreditCard className="h-5 w-5 text-[#F26522]" />
              <span>Exam Fee Payment Gateway</span>
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Secure payment gateway simulation via ParikshaSetu Core
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-650">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto animate-pulse" />
              
              <div className="space-y-2">
                <h3 className="text-md font-bold font-mono text-gray-900 uppercase">Payment Successful!</h3>
                <p className="text-xs text-gray-500 font-mono">
                  Your seat registration is verified. Monospace application reference number below:
                </p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-lg font-bold text-[#F26522] tracking-wider">
                  {regDetail?.application_number || "LG-2026-XXXXX"}
                </div>
              </div>

              <button
                onClick={() => router.push("/student/dashboard")}
                className="w-full bg-[#F26522] hover:bg-[#e05a1a] text-white py-2.5 rounded-full text-xs font-mono font-bold uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-[#F26522]/10"
              >
                <span>Back to Candidate Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3 font-mono text-xs text-gray-650">
                <div className="flex justify-between">
                  <span>Examination Name:</span>
                  <span className="font-bold text-gray-900 uppercase truncate max-w-[200px]">
                    {regDetail?.exams?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Candidate:</span>
                  <span className="font-bold text-gray-900 uppercase">
                    {regDetail?.students?.full_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>App Preview:</span>
                  <span className="font-bold text-gray-500">
                    {regDetail?.application_number}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm">
                  <span>Amount Due:</span>
                  <span className="font-bold text-[#F26522]">{regDetail?.exams?.fee_inr} INR</span>
                </div>
              </div>

              {/* Simulation check-box / instructions */}
              <div className="bg-amber-50 border border-amber-250 p-3 rounded-xl flex items-start space-x-2 text-[10px] font-mono text-gray-500">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Click the button below to simulate transaction confirmation. Under eager worker mode, this will sync status instantly.
                </p>
              </div>

              <button
                onClick={handleSimulatePayment}
                disabled={paying}
                className="w-full bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white py-3 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-md shadow-[#F26522]/10 cursor-pointer"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing transaction check...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Simulate payment (Dev Bypass)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
