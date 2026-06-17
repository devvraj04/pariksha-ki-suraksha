"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Save, ShieldAlert, CheckCircle2, FileText, ChevronRight, Eye } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function EvaluationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const assignmentId = params.assignmentId as string;

  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);

  // Active paper index
  const [activePaperIndex, setActivePaperIndex] = useState(0);
  const activePaper = papers[activePaperIndex];

  // Marks state per paper id
  const [marksState, setMarksState] = useState<Record<string, {
    sectionA: number;
    sectionB: number;
    sectionC: number;
    remarks: string;
    submitted: boolean;
  }>>({});

  // Confirmation string for locking
  const [lockConfirmText, setLockConfirmText] = useState("");
  const [showLockDialog, setShowLockDialog] = useState(false);

  useEffect(() => {
    async function loadPapers() {
      try {
        const list = await agencyApi.getAssignmentPapers(assignmentId);
        setPapers(list);
        
        // Initialize marks state
        const initial: typeof marksState = {};
        list.forEach((p: any) => {
          initial[p.upload_id] = {
            sectionA: 0,
            sectionB: 0,
            sectionC: 0,
            remarks: "",
            submitted: false
          };
        });
        setMarksState(initial);
      } catch (err: any) {
        setError(err.message || "Failed to load evaluation papers. Access may be revoked.");
      } finally {
        setLoading(false);
      }
    }
    loadPapers();
  }, [assignmentId]);

  const handleSaveDraft = (uploadId: string) => {
    // Saves to component state
    alert("Draft marks saved locally. Click 'Submit Marks for Paper' to submit to server.");
  };

  const handleSubmitPaperMarks = async (uploadId: string) => {
    setSubmitting(true);
    try {
      const state = marksState[uploadId];
      const total = Number(state.sectionA) + Number(state.sectionB) + Number(state.sectionC);
      
      const payload = {
        assignment_id: assignmentId,
        upload_id: uploadId,
        marks_awarded: total,
        max_marks: 100, // standard max marks
        subject_breakdown: {
          "Section A (General)": Number(state.sectionA),
          "Section B (Core)": Number(state.sectionB),
          "Section C (Aptitude)": Number(state.sectionC)
        },
        remarks: state.remarks
      };

      await agencyApi.submitMarks(payload);
      
      setMarksState(prev => ({
        ...prev,
        [uploadId]: {
          ...prev[uploadId],
          submitted: true
        }
      }));
      
      alert(`Marks successfully submitted for paper ${getAnonymizedLabel(uploadId)}.`);
    } catch (err: any) {
      alert(err.message || "Failed to submit marks.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockBatch = async () => {
    if (lockConfirmText !== "I confirm evaluation is complete") {
      alert("Please enter the confirmation text exactly.");
      return;
    }
    setLocking(true);
    try {
      await agencyApi.completeAssignment(assignmentId);
      alert("Batch locked successfully. Access is now revoked.");
      router.push(`/agency/${slug}/eval`);
    } catch (err: any) {
      alert(err.message || "Failed to finalize assignment.");
    } finally {
      setLocking(false);
    }
  };

  const getAnonymizedLabel = (uploadId: string) => {
    const paper = papers.find(p => p.upload_id === uploadId);
    return paper ? paper.anonymized_code : "PAPER";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#F26522]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-6 border border-red-200 rounded-2xl shadow-sm text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-red-600 mx-auto" />
        <h2 className="text-gray-900 font-mono font-bold uppercase">Workspace Access Denied</h2>
        <p className="text-xs text-gray-500 font-mono">{error}</p>
        <button onClick={() => router.push(`/agency/${slug}/eval`)} className="bg-gray-900 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all shadow-sm">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const activeState = marksState[activePaper?.upload_id] || { sectionA: 0, sectionB: 0, sectionC: 0, remarks: "", submitted: false };
  const allSubmitted = Object.values(marksState).every(s => s.submitted);

  return (
    <div className="h-screen flex flex-col bg-[#EFEFEF] text-gray-700 select-none">
      
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-gray-200 px-4 flex items-center justify-between shrink-0 bg-white shadow-sm">
        <div className="flex items-center space-x-3">
          <button onClick={() => router.push(`/agency/${slug}/eval`)} className="text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-4 w-[1px] bg-gray-200" />
          <span className="font-mono text-xs font-bold text-gray-900 uppercase tracking-widest">
            EVALUATION WORKSPACE // BATCH {assignmentId.substring(0, 8).toUpperCase()}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          {allSubmitted && (
            <button
              onClick={() => setShowLockDialog(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs uppercase px-4 py-2 rounded-full transition-all shadow-sm"
            >
              🔒 Submit &amp; Lock Batch
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Leftmost Mini Navigation Sidebar */}
        <aside className="w-64 border-r border-gray-200 overflow-y-auto bg-white divide-y divide-gray-100 shrink-0">
          <div className="p-4 bg-gray-50 font-mono text-[10px] text-gray-500 uppercase tracking-wider">
            Papers in Batch ({papers.length})
          </div>
          {papers.map((p, index) => {
            const paperState = marksState[p.upload_id] || { sectionA: 0, sectionB: 0, remarks: "", submitted: false };
            const isSelected = index === activePaperIndex;
            return (
              <button
                key={p.upload_id}
                onClick={() => setActivePaperIndex(index)}
                className={`w-full p-4 text-left font-mono flex items-center justify-between transition-all border-l-2 ${
                  isSelected ? "bg-gray-50 border-[#F26522] text-gray-900 font-semibold" : "border-transparent text-gray-500 hover:bg-gray-50/50"
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">{p.anonymized_code}</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{p.total_pages} pages</span>
                </div>
                {paperState.submitted ? (
                  <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-bold">Graded</span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-[#F26522] border border-[#F26522]/20 px-1.5 py-0.5 rounded font-bold">Pending</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Center Pane: PDF Viewer (60%) */}
        <main className="flex-1 flex flex-col border-r border-gray-200 bg-gray-100">
          {activePaper?.signed_url ? (
            <iframe
              src={`${activePaper.signed_url}#toolbar=0`}
              className="w-full h-full border-none"
              title="Answer Sheet Document"
            />
          ) : (
            <div className="flex-grow flex items-center justify-center font-mono text-xs text-gray-400">
              No signed PDF URL loaded for this paper.
            </div>
          )}
        </main>

        {/* Right Pane: Scoring Form (40%) */}
        <aside className="w-96 overflow-y-auto p-6 space-y-6 shrink-0 bg-white">
          <div>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Active Paper</span>
            <h2 className="text-lg font-mono font-bold text-gray-900 uppercase mt-0.5">{activePaper?.anonymized_code}</h2>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-4 shadow-sm">
            <h3 className="text-xs font-mono font-bold uppercase text-[#F26522] border-b border-gray-100 pb-2">Marks Matrix (Max 100)</h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase">Section A (General - Max 30)</label>
                <input
                  type="number"
                  max={30}
                  min={0}
                  disabled={activeState.submitted}
                  value={activeState.sectionA}
                  onChange={e => setMarksState(prev => ({
                    ...prev,
                    [activePaper.upload_id]: {
                      ...prev[activePaper.upload_id],
                      sectionA: Math.min(30, Math.max(0, Number(e.target.value)))
                    }
                  }))}
                  className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2.5 rounded-xl focus:border-[#F26522] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase">Section B (Core - Max 45)</label>
                <input
                  type="number"
                  max={45}
                  min={0}
                  disabled={activeState.submitted}
                  value={activeState.sectionB}
                  onChange={e => setMarksState(prev => ({
                    ...prev,
                    [activePaper.upload_id]: {
                      ...prev[activePaper.upload_id],
                      sectionB: Math.min(45, Math.max(0, Number(e.target.value)))
                    }
                  }))}
                  className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2.5 rounded-xl focus:border-[#F26522] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase">Section C (Aptitude - Max 25)</label>
                <input
                  type="number"
                  max={25}
                  min={0}
                  disabled={activeState.submitted}
                  value={activeState.sectionC}
                  onChange={e => setMarksState(prev => ({
                    ...prev,
                    [activePaper.upload_id]: {
                      ...prev[activePaper.upload_id],
                      sectionC: Math.min(25, Math.max(0, Number(e.target.value)))
                    }
                  }))}
                  className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2.5 rounded-xl focus:border-[#F26522] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase">Evaluator Comments / Remarks</label>
                <textarea
                  placeholder="Enter legibility/rubric assessment notes..."
                  disabled={activeState.submitted}
                  value={activeState.remarks}
                  onChange={e => setMarksState(prev => ({
                    ...prev,
                    [activePaper.upload_id]: {
                      ...prev[activePaper.upload_id],
                      remarks: e.target.value
                    }
                  }))}
                  className="w-full mt-1 h-20 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-xl focus:border-[#F26522] focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-150 flex justify-between items-center text-xs font-mono">
              <span className="text-gray-500">GRAND TOTAL:</span>
              <span className="text-gray-900 font-bold text-lg">
                {Number(activeState.sectionA) + Number(activeState.sectionB) + Number(activeState.sectionC)} / 100
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {!activeState.submitted && (
              <>
                <button
                  onClick={() => handleSaveDraft(activePaper.upload_id)}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-mono text-xs px-3 py-2.5 rounded-full transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Save className="h-4 w-4" /><span>Save Draft</span>
                </button>
                <button
                  onClick={() => handleSubmitPaperMarks(activePaper.upload_id)}
                  disabled={submitting}
                  className="flex-1 bg-[#F26522] hover:bg-[#e05a1a] text-white font-mono font-bold text-xs uppercase px-3 py-2.5 rounded-full transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <span>Submit Marks</span>}
                </button>
              </>
            )}
            {activeState.submitted && (
              <div className="w-full bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs font-mono flex items-center justify-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Marks locked on registry</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Lock Confirmation Dialog */}
      {showLockDialog && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl animate-fade-in">
            <h3 className="text-sm font-mono font-bold uppercase text-gray-900 flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-red-655 text-red-650 text-red-600" />
              <span>Cryptographic Batch Lock</span>
            </h3>
            <p className="text-xs text-gray-500 font-mono">
              You are about to lock this evaluation batch. **This action is permanent and your access to these papers will be immediately and irrevocably revoked.**
            </p>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-gray-400 uppercase">Type: "I confirm evaluation is complete"</label>
              <input
                type="text"
                value={lockConfirmText}
                onChange={e => setLockConfirmText(e.target.value)}
                placeholder="Type confirmation sentence"
                className="w-full bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2.5 rounded-xl focus:outline-none"
              />
            </div>
            <div className="flex space-x-2 justify-end pt-2 text-xs font-mono">
              <button onClick={() => { setShowLockDialog(false); setLockConfirmText(""); }} className="text-gray-500 hover:text-gray-900 px-3 py-2">
                Cancel
              </button>
              <button
                onClick={handleLockBatch}
                disabled={locking}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full font-bold uppercase disabled:opacity-50"
              >
                {locking ? "Locking..." : "Finalize & Lock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
