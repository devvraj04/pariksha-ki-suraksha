"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, Download, ShieldAlert, CheckCircle2 } from "lucide-react";
import { studentApi } from "@/lib/api";

export default function StudentAdmitCardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const examSlug = params.examSlug as string;
  const regId = searchParams.get("regId") as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admitCardData, setAdmitCardData] = useState<any>(null);

  useEffect(() => {
    if (!regId) {
      setError("Missing registration identifier.");
      setLoading(false);
      return;
    }

    async function loadAdmitCard() {
      try {
        const res = await studentApi.getAdmitCard(regId);
        setAdmitCardData(res);
      } catch (err: any) {
        setError(err.message || "Your admit card is not issued or is currently unavailable.");
      } finally {
        setLoading(false);
      }
    }

    loadAdmitCard();
  }, [regId]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span className="text-gray-500 text-xs">Fetching cryptographically signed admit card...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/student/dashboard"
              className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold font-mono text-gray-900 uppercase flex items-center space-x-2">
                <FileText className="h-5 w-5 text-[#F26522]" />
                <span>Secured Admit Card</span>
              </h1>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mt-0.5">
                Registration Reference: {regId}
              </p>
            </div>
          </div>
          
          {admitCardData?.pdf_signed_url && (
            <a
              href={admitCardData.pdf_signed_url}
              download="AdmitCard.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md shadow-[#F26522]/10 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </a>
          )}
        </div>

        {error ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-4 shadow-sm">
            <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
            <div>
              <h3 className="text-sm font-bold font-mono text-gray-900 uppercase">Card Not Issued</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">
                {error}
              </p>
            </div>
            <Link
              href="/student/dashboard"
              className="inline-flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all"
            >
              <span>Back to Console Dashboard</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Warning instructions panel */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-gray-900 border-b border-gray-150 pb-2 flex items-center space-x-2 font-bold">
                  <ShieldAlert className="h-4 w-4 text-[#F26522] animate-pulse" />
                  <span>Important Instructions</span>
                </h3>
                
                <div className="text-[11px] font-mono text-gray-600 space-y-3 leading-relaxed">
                  <p className="border-l-2 border-[#F26522] pl-2 font-semibold">
                    1. Print this admit card in high resolution. The biometric QR code must be clearly readable.
                  </p>
                  <p>
                    2. Carry a valid original government photo ID proof (Aadhaar/PAN/Passport) matching the registration info.
                  </p>
                  <p>
                    3. Report to the allocated test center at least 1 hour prior to the reporting time.
                  </p>
                  <p className="border-l-2 border-red-500 pl-2 text-red-655 font-bold">
                    4. No cellphones, smartwatches, or mathematical tables are permitted in the testing room.
                  </p>
                </div>
              </div>

              <div className="bg-green-50 text-green-600 border border-green-200 p-4 rounded-xl text-xs font-mono flex items-start space-x-2 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  RS256 asymmetric cryptographic signature is verified on this document. Edge AI terminals will perform live biometric match checks at the gate.
                </p>
              </div>
            </div>

            {/* PDF Embed / display */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden h-[600px] flex flex-col shadow-sm">
              <div className="bg-gray-50 px-4 py-2 text-[10px] font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200 flex justify-between items-center shrink-0">
                <span>Cryptographic Document PDF Viewer</span>
                <span className="text-[#F26522] font-bold">SECURE CHANNEL ACTIVE</span>
              </div>
              <iframe
                src={`${admitCardData.pdf_signed_url}#toolbar=0`}
                className="w-full flex-grow bg-white border-0"
                title="Signed Admit Card PDF"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
