"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, ShieldAlert, Upload, CheckCircle2, Video } from "lucide-react";
import { studentApi, publicApi } from "@/lib/api";

export default function StudentGrievanceFilingPage() {
  const params = useParams();
  const router = useRouter();
  const examSlug = params.examSlug as string;

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [category, setCategory] = useState("UNFAIR_EVALUATION");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  useEffect(() => {
    async function loadExam() {
      try {
        const data = await publicApi.getPublicExamBySlug(examSlug);
        setExam(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load exam details.");
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [examSlug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (files.length + selected.length > 5) {
        setError("Maximum 5 evidence files are allowed.");
        return;
      }
      setFiles([...files, ...selected]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.length < 10) {
      setError("Please write at least 10 characters describing your grievance.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("description", description);
      files.forEach((file) => {
        formData.append("evidence_files", file);
      });

      const res = await studentApi.fileGrievance(exam.id, formData);
      setTicketId(res.grievance_id);
    } catch (err: any) {
      setError(err.message || "Failed to submit grievance. Ensure your checkin record is verified (you appeared for the exam).");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span className="text-gray-500 text-xs">Authenticating secure pipeline...</span>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-[400px] flex flex-col justify-center items-center text-center font-mono text-xs space-y-4">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <p className="text-gray-500">{error || "Exam details could not be verified."}</p>
        <button onClick={() => router.back()} className="text-[#F26522] hover:underline font-bold">
          [Go back]
        </button>
      </div>
    );
  }

  if (ticketId) {
    return (
      <div className="p-6 max-w-md mx-auto space-y-6 text-center">
        <div className="w-full max-w-md bg-white border border-gray-200 p-8 rounded-2xl shadow-sm text-center space-y-6 font-mono text-xs uppercase">
          <div className="inline-flex bg-green-50 p-4 rounded-full border border-green-200 text-green-600">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-lg font-bold uppercase tracking-wider text-gray-900">Grievance Ticket Created</h1>
            <p className="text-gray-500 leading-relaxed uppercase">
              Your grievance has been logged. Security surveillance (CCTV) has been attached to the case.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
            <span className="block text-[8px] text-gray-400 uppercase tracking-widest mb-1.5">Ticket reference</span>
            <span className="font-bold text-[#F26522] block break-all">GRV-{ticketId.substring(0, 8)}</span>
          </div>

          <p className="text-gray-500 text-[10px] leading-relaxed text-left bg-gray-50 p-4 rounded-xl border border-gray-150">
            A Chief Exam Manager has been assigned to investigate your report. You will receive an email notice when a final outcome has been submitted.
          </p>

          <div className="pt-2 flex flex-col space-y-2">
            <button
              onClick={() => router.push("/student/grievances")}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-full font-bold tracking-wider cursor-pointer"
            >
              <span>[View My Grievances]</span>
            </button>
            <button
              onClick={() => router.push("/student/dashboard")}
              className="text-gray-400 hover:text-gray-600 tracking-wider cursor-pointer"
            >
              [Go to Student Dashboard]
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="w-full max-w-2xl bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-6">
        
        {/* Header */}
        <div className="flex items-center space-x-4 border-b border-gray-150 pb-4">
          <div className="bg-[#F26522] p-2.5 rounded-xl shadow-md">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-mono font-bold uppercase tracking-widest text-gray-900">
              File Official Exam Grievance
            </h1>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mt-0.5">
              Exam: {exam.name}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs uppercase tracking-wider">
          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-650 flex items-center space-x-2 text-[10px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-gray-500 block">Select Grievance Category</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "UNFAIR_EVALUATION", label: "Unfair Evaluation Dispute" },
                { key: "ANSWER_KEY_DISPUTE", label: "Answer Key Discrepancy" },
                { key: "QUESTION_PAPER_ERROR", label: "Paper Printing Error" },
                { key: "CENTER_MISCONDUCT", label: "Center Officer Misconduct" },
                { key: "PEER_CHEATING", label: "Peer Cheating Attempt" },
                { key: "CBT_TECHNICAL_ISSUE", label: "CBT Software Failure" },
                { key: "OTHER", label: "General Incident Log" }
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={`border font-bold p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                    category === cat.key
                      ? "bg-[#F26522] text-white border-[#F26522] shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-gray-500 block">Detailed Description of Issue</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="PROVIDE CLEAR AND TRUTHFUL DETAILS SO THAT THE CHIEF EXAM AUDITOR CAN CORRELATE SECURITY FEEDS EFFICIENTLY..."
              className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522] placeholder:text-gray-400 normal-case"
            />
          </div>

          {/* Evidence Upload */}
          <div className="space-y-1.5">
            <label className="text-gray-500 block">Attach Supporting Evidence (Max 5 files)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                <div className="flex flex-col items-center justify-center pt-2 pb-2">
                  <Upload className="h-5 w-5 text-gray-400 mb-1" />
                  <p className="text-[10px] text-gray-500">SELECT PHOTOS / SCAN PDF (MAX 10MB EACH)</p>
                </div>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="space-y-1 bg-gray-50 border border-gray-200 p-3 rounded-lg mt-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] text-gray-600 font-mono">
                    <span className="truncate max-w-[400px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                    >
                      [Remove]
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automated CCTV Notice */}
          <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl flex items-center space-x-3 text-[10px] text-gray-600">
            <Video className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
            <p className="leading-relaxed leading-normal">
              <span className="text-gray-900 font-bold block mb-0.5">Automated CCTV Footage Retrieval Notice</span>
              YOUR SYSTEM ACCOUNT IS CRYPTOGRAPHICALLY ASSIGNED TO A SPECIFIC DESK AND HALL DURING THE BIOMETRIC CHECK-IN PROCESS. SUBMITTING THIS GIVES ACCESS TO AUTOMATICALLY CLIP AND LINK THE ROOM FEED DURING THE TIME WINDOW OF YOUR EXAMINATION FOR CRITICAL AUDITING.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-between items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-900 font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>[Go Back]</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-6 rounded-full flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-[#F26522]/10 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Linking video feed...</span>
                </>
              ) : (
                <span>[Submit & File Grievance]</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
