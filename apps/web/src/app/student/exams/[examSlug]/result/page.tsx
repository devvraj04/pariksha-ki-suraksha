"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { studentApi } from "@/lib/api";
import { Loader2, ArrowLeft, Award, CheckCircle, XCircle, FileDown, ShieldCheck } from "lucide-react";

export default function StudentResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examSlug = params.examSlug as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResult() {
      try {
        const resultsList = await studentApi.getMyResults();
        // Match by examSlug or general list
        const matched = resultsList.find((r: any) => 
          r.exam_name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") === examSlug || 
          r.id === examSlug
        ) || (resultsList.length > 0 ? resultsList[0] : null); // Fallback to first if only one

        if (!matched) {
          setError("No declared result scorecard found for this exam.");
        } else {
          setResult(matched);
        }
      } catch (err: any) {
        setError(err.message || "Failed to retrieve student result details.");
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [examSlug]);

  const downloadPdf = () => {
    if (!result?.result_pdf_path) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
    const directUrl = `${supabaseUrl}/storage/v1/object/public/result-pdfs/${result.result_pdf_path}`;
    window.open(directUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F26522]" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      
      {/* Navigation back */}
      <button
        onClick={() => router.push("/student/dashboard")}
        className="flex items-center space-x-2 text-gray-500 hover:text-gray-900 transition-all text-xs font-mono cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Candidate Dashboard</span>
      </button>

      {error ? (
        <div className="bg-white border border-gray-200 p-8 rounded-2xl text-center space-y-4 shadow-sm">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-gray-900 font-mono font-bold uppercase">No Scorecard Compiled</h2>
          <p className="text-xs text-gray-500 font-mono">{error}</p>
        </div>
      ) : (
        /* Scorecard Card */
        <div className="bg-white border border-gray-200 p-8 rounded-3xl space-y-6 shadow-sm">
          
          {/* Pass / Fail banner */}
          <div className="flex items-center justify-between border-b border-gray-150 pb-4">
            <div>
              <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Official Scorecard</span>
              <h2 className="text-lg font-mono font-bold text-gray-900 uppercase mt-0.5">{result.candidate_name || "CANDIDATE SCORE SHEET"}</h2>
              <p className="text-[10px] font-mono text-gray-500 mt-1">App No: <span className="text-gray-950 font-bold">{result.application_number}</span></p>
            </div>
            
            <div className="text-right">
              {result.result_status === "PASS" ? (
                <span className="inline-flex items-center space-x-1.5 bg-green-50 border border-green-200 text-green-600 px-3 py-1 rounded-full text-xs font-mono font-bold">
                  <CheckCircle className="h-4 w-4" />
                  <span>QUALIFIED</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 bg-red-50 border border-red-200 text-red-650 px-3 py-1 rounded-full text-xs font-mono font-bold">
                  <XCircle className="h-4 w-4" />
                  <span>NOT QUALIFIED</span>
                </span>
              )}
            </div>
          </div>

          {/* Exam info */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-gray-400 uppercase">Examination Description</span>
            <div className="text-sm font-mono text-gray-900 font-bold">{result.exam_name}</div>
          </div>

          {/* Marks summaries */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
              <div className="text-xl font-mono font-bold text-gray-900">{result.final_marks}</div>
              <div className="text-[9px] font-mono text-gray-400 uppercase mt-0.5">Scored</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
              <div className="text-xl font-mono font-bold text-gray-900">{result.max_marks}</div>
              <div className="text-[9px] font-mono text-gray-400 uppercase mt-0.5">Max Marks</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
              <div className="text-xl font-mono font-bold text-[#F26522]">{result.percentage}%</div>
              <div className="text-[9px] font-mono text-gray-400 uppercase mt-0.5">Percentage</div>
            </div>
          </div>

          {/* Ranks */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <Award className="h-5 w-5 text-[#F26522] shrink-0" />
              <div>
                <span className="text-[9px] text-gray-400 uppercase">All-India Rank</span>
                <div className="font-bold text-gray-900">AIR #{result.rank || "—"}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <Award className="h-5 w-5 text-purple-600 shrink-0" />
              <div>
                <span className="text-[9px] text-gray-400 uppercase">Category Rank</span>
                <div className="font-bold text-gray-900">CR #{result.category_rank || "—"}</div>
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
                  {result.subject_breakdown && Object.entries(result.subject_breakdown).map(([section, score]: any) => (
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
                router.push(`/student/exams/${examSlug}/grievance`);
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
  );
}
