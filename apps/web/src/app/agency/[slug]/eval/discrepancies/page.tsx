"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Shield, CheckCircle2, AlertTriangle, Eye, ChevronRight, X } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function DiscrepancyResolverPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingDisc, setLoadingDisc] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active resolution drawer state
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [finalMarks, setFinalMarks] = useState(0);
  const [remarks, setRemarks] = useState("");

  // Load exams
  useEffect(() => {
    async function loadExams() {
      try {
        const list = await agencyApi.getExams();
        setExams(list.filter(e => e.status === "EVALUATION_IN_PROGRESS"));
      } catch (err: any) {
        setError("Failed to load active exams roster.");
      } finally {
        setLoadingExams(false);
      }
    }
    loadExams();
  }, []);

  // Load discrepancies when exam is selected
  const fetchDiscrepancies = async (examId: string) => {
    if (!examId) return;
    setLoadingDisc(true);
    try {
      const data = await agencyApi.getEvaluationDiscrepancies(examId);
      setDiscrepancies(data);
    } catch (err: any) {
      alert("Failed to load discrepancies list.");
    }
    setLoadingDisc(false);
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchDiscrepancies(selectedExamId);
    } else {
      setDiscrepancies([]);
    }
    setSelectedDiscrepancy(null);
  }, [selectedExamId]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    setResolving(true);
    try {
      await agencyApi.resolveDiscrepancy(selectedDiscrepancy.id, {
        final_marks: Number(finalMarks),
        remarks: remarks || "Resolved by Chief Moderator"
      });
      alert("Discrepancy resolved successfully.");
      setSelectedDiscrepancy(null);
      setRemarks("");
      setFinalMarks(0);
      await fetchDiscrepancies(selectedExamId);
    } catch (err: any) {
      alert(err.message || "Failed to submit resolution.");
    } finally {
      setResolving(false);
    }
  };

  if (loadingExams) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F26522]" />
      </div>
    );
  }

  const openCount = discrepancies.filter(d => d.status === "OPEN").length;
  const resolvedCount = discrepancies.filter(d => d.status === "RESOLVED").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button onClick={() => router.push(`/agency/${slug}/eval`)} className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-950 transition-all shadow-sm">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-mono font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2">
            <Shield className="h-5 w-5 text-[#F26522]" />
            <span>Discrepancy Resolution Room</span>
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-0.5">CHIEF MODERATOR PLATFORM // LEVEL 3 ESCALATION</p>
        </div>
      </div>

      {/* Select Exam Dropdown */}
      <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Select Exam Lifecycle Window</label>
        <select
          value={selectedExamId}
          onChange={e => setSelectedExamId(e.target.value)}
          className="w-full mt-2 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-3 rounded-xl focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
        >
          <option value="">-- Choose Exam in Evaluation phase --</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.name} (Date: {e.exam_date})</option>)}
        </select>
      </div>

      {selectedExamId && (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-red-200 p-5 rounded-xl text-center shadow-sm">
              <div className="text-3xl font-mono font-bold text-red-600">{openCount}</div>
              <div className="text-[10px] font-mono text-gray-500 uppercase mt-1">Open Discrepancies</div>
            </div>
            <div className="bg-white border border-green-200 p-5 rounded-xl text-center shadow-sm">
              <div className="text-3xl font-mono font-bold text-green-700">{resolvedCount}</div>
              <div className="text-[10px] font-mono text-gray-500 uppercase mt-1">Resolved Discrepancies</div>
            </div>
          </div>

          {/* Main workspace splits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Discrepancies List (2/3 width) */}
            <div className="lg:col-span-2 bg-white border border-gray-200 p-6 rounded-2xl space-y-4 shadow-sm">
              <h3 className="text-xs font-mono font-bold uppercase text-gray-900 tracking-widest">Active Escalation Log</h3>
              
              {loadingDisc ? <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#F26522] mx-auto" /></div> : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                  <table className="w-full text-xs font-mono text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase">
                        <th className="px-4 py-3">Paper code</th>
                        <th className="px-4 py-3">Tier 1 Marks</th>
                        <th className="px-4 py-3">Tier 2 Marks</th>
                        <th className="px-4 py-3">Deviation</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {discrepancies.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-4 font-bold text-gray-900">{d.anonymized_code}</td>
                          <td className="px-4 py-4 text-gray-600">{d.tier1_marks?.marks_awarded} / 100</td>
                          <td className="px-4 py-4 text-gray-600">{d.tier2_marks?.marks_awarded} / 100</td>
                          <td className="px-4 py-4 text-red-600 font-bold">+{d.marks_difference}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.status === "RESOLVED" ? "bg-green-50 text-green-700 border border-green-150" : "bg-red-50 text-red-700 border border-red-150"
                            }`}>{d.status}</span>
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => {
                                setSelectedDiscrepancy(d);
                                setFinalMarks(d.tier2_marks?.marks_awarded || 0);
                              }}
                              className="bg-gray-900 hover:bg-gray-800 text-white text-[10px] px-3.5 py-1.5 rounded-full transition-all shadow-sm"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                      {discrepancies.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">No discrepancies detected for this exam. Ready for approval!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Resolution Drawer Panel (1/3 width) */}
            <div className="lg:col-span-1">
              {selectedDiscrepancy ? (
                <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-6 relative">
                  <button onClick={() => setSelectedDiscrepancy(null)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-900">
                    <X className="h-4 w-4" />
                  </button>

                  <div>
                    <span className="text-[9px] font-mono text-[#F26522] uppercase tracking-widest">Escalated Paper</span>
                    <h3 className="text-md font-mono font-bold text-gray-900 uppercase mt-0.5">{selectedDiscrepancy.anonymized_code}</h3>
                  </div>

                  {/* Side-by-Side breakdown */}
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <span className="text-[9px] text-gray-500 uppercase">Tier 1 Teacher</span>
                      <div className="text-sm font-bold text-gray-900 mt-1">{selectedDiscrepancy.tier1_marks?.marks_awarded} / 100</div>
                      <div className="text-[9px] text-gray-400 mt-1 italic font-sans">"{selectedDiscrepancy.tier1_marks?.remarks || "No comment"}"</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <span className="text-[9px] text-gray-500 uppercase">Tier 2 Moderator</span>
                      <div className="text-sm font-bold text-gray-900 mt-1">{selectedDiscrepancy.tier2_marks?.marks_awarded} / 100</div>
                      <div className="text-[9px] text-gray-400 mt-1 italic font-sans">"{selectedDiscrepancy.tier2_marks?.remarks || "No comment"}"</div>
                    </div>
                  </div>

                  {/* Resolve Form */}
                  {selectedDiscrepancy.status === "OPEN" ? (
                    <form onSubmit={handleResolve} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase">Chief Ruling Marks (Max 100)</label>
                        <input
                          type="number"
                          max={100}
                          min={0}
                          required
                          value={finalMarks}
                          onChange={e => setFinalMarks(Number(e.target.value))}
                          className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2.5 rounded-xl focus:outline-none focus:border-[#F26522]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase">Resolution rationale / audit comments</label>
                        <textarea
                          required
                          placeholder="Provide audit reasons for final rating override..."
                          value={remarks}
                          onChange={e => setRemarks(e.target.value)}
                          className="w-full mt-1 h-20 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-xl focus:outline-none focus:border-[#F26522] resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={resolving}
                        className="w-full bg-[#F26522] hover:bg-[#e05a1a] text-white font-mono font-bold text-xs uppercase py-2.5 rounded-full transition-all shadow-sm flex items-center justify-center space-x-1.5"
                      >
                        {resolving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <span>Resolve &amp; Overwrite Marks</span>}
                      </button>
                    </form>
                  ) : (
                    <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-xl text-xs font-mono space-y-1">
                      <div className="font-bold flex items-center space-x-1"><CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /><span>Resolved</span></div>
                      <div>Final Marks Awarded: {selectedDiscrepancy.final_marks?.marks_awarded ?? selectedDiscrepancy.tier2_marks?.marks_awarded} (Ruling tier 3)</div>
                      {selectedDiscrepancy.final_marks?.remarks && (
                        <div className="text-[10px] text-green-600 mt-1 italic">Reason: "{selectedDiscrepancy.final_marks.remarks}"</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-64 border border-dashed border-gray-300 rounded-2xl flex items-center justify-center font-mono text-xs text-gray-400 bg-white shadow-sm">
                  Select a paper from the log to resolve discrepancies.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
