"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Upload, AlertCircle, Loader2, Sparkles, Copy, CheckCircle2, Shield } from "lucide-react";
import { publicApi } from "@/lib/api";

export default function WhistleblowerReportPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [category, setCategory] = useState("PAPER_LEAK");
  const [examId, setExamId] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadPublicExams() {
      setLoadingExams(true);
      try {
        const data = await publicApi.getExams();
        setExams(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingExams(false);
      }
    }
    loadPublicExams();
  }, []);

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
    if (!captchaChecked) {
      setError("Please check the security captcha checkbox.");
      return;
    }
    if (description.length < 10) {
      setError("Please write at least 10 characters describing the incident.");
      return;
    }
    
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("description", description);
      if (examId) {
        formData.append("exam_id", examId);
      }
      if (locationText) {
        formData.append("location_text", locationText);
      }
      files.forEach((file) => {
        formData.append("evidence_files", file);
      });

      const data = await publicApi.submitWhistleblowerReport(formData);
      setTrackingCode(data.tracking_code);
    } catch (err: any) {
      setError(err.message || "Failed to submit anonymous report.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyTrackingCode = () => {
    if (trackingCode) {
      navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (trackingCode) {
    return (
      <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col justify-center items-center p-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
        <div className="w-full max-w-md bg-white border border-gray-200 p-8 rounded-2xl shadow-sm text-center space-y-6">
          <div className="inline-flex bg-green-50 p-4 rounded-full border border-green-200 text-green-600">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-lg font-mono font-bold uppercase tracking-wider text-gray-900">Report Safely Ingested</h1>
            <p className="text-xs font-mono text-gray-500 leading-relaxed uppercase">
              Your anonymous report has been logged. Save the code below to check your routing status.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl relative group">
            <span className="block text-[8px] font-mono text-gray-400 uppercase tracking-widest mb-1.5">Secure Tracking Code</span>
            <span className="font-mono text-xs font-bold text-[#F26522] select-all block break-all">{trackingCode}</span>
            <button
              onClick={copyTrackingCode}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-700 transition-all duration-150 cursor-pointer"
              title="Copy to Clipboard"
            >
              {copied ? (
                <span className="text-[8px] uppercase tracking-wider text-green-600 font-bold">[Copied]</span>
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="text-[10px] font-mono text-gray-500 text-left bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-200">
            <p className="text-gray-900 font-bold flex items-center space-x-1.5 uppercase">
              <Shield className="h-3.5 w-3.5 text-green-600" />
              <span>Anonymity Shield Active</span>
            </p>
            <p className="uppercase leading-normal">
              Your IP address, browser fingerprint, and network identity have NOT been recorded. The tracking code cannot be linked back to you.
            </p>
          </div>

          <div className="pt-2 flex flex-col space-y-2">
            <Link
              href="/report/status"
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-mono text-xs uppercase tracking-wider py-2.5 rounded-full font-bold transition-all text-center"
            >
              <span>[Check Routing Status]</span>
            </Link>
            <Link
              href="/"
              className="text-xs font-mono text-gray-500 hover:text-gray-800 uppercase tracking-wider text-center"
            >
              [Return to home]
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col justify-center items-center py-12 px-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      <div className="w-full max-w-xl bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-[#F26522] p-2.5 rounded-xl shadow-md">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-widest text-gray-900">
            Anonymous Misconduct Reporting
          </h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider max-w-md mx-auto">
            Report paper leaks, bribery, invigilator fraud, or cheating directly to the security audit network.
          </p>
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
            <label className="text-gray-500 block">Report Category</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "PAPER_LEAK", label: "Paper Leak" },
                { key: "BRIBERY", label: "Bribery / Corruption" },
                { key: "IMPERSONATION", label: "Impersonation" },
                { key: "INVIGILATOR_MISCONDUCT", label: "Invigilator Fraud" },
                { key: "OTHER", label: "Other Misconduct" }
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={`border font-bold p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                    category === cat.key
                      ? "bg-[#F26522] text-white border-[#F26522] shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-55"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exam (Optional) */}
          <div className="space-y-1.5">
            <label className="text-gray-500 block">Related Examination (Optional)</label>
            {loadingExams ? (
              <div className="h-10 bg-gray-50 rounded-lg animate-pulse border border-gray-200" />
            ) : (
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522]"
              >
                <option value="" className="bg-white text-gray-900">-- No Exam / Unknown Exam --</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id} className="bg-white text-gray-900">{e.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-gray-500 block">Incident Location (Optional)</label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="E.G. DELHI CENTRAL CENTER, INVIGILATOR OFFICE, ETC."
              className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]/50 placeholder:text-gray-300"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-gray-500">Detailed Description</label>
              <span className="text-[10px] text-gray-400">{description.length}/2000</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={2000}
              rows={4}
              placeholder="PROVIDE CLEAR AND CONCRETE DATES, TIMES, AND SPECIFIC INVOLVED PARTIES FOR BETTER ROUTING SPEED..."
              className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]/50 placeholder:text-gray-300 normal-case"
            />
          </div>

          {/* Evidence Upload */}
          <div className="space-y-1.5">
            <label className="text-gray-500 block">Evidence Attachments (Max 5 files)</label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                <div className="flex flex-col items-center justify-center pt-2 pb-2">
                  <Upload className="h-5 w-5 text-gray-400 mb-1" />
                  <p className="text-[10px] text-gray-500 text-center">SELECT PHOTOS / DOCUMENTS (MAX 10MB EACH)</p>
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
                    <span className="truncate max-w-[300px]">{file.name}</span>
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

          {/* Captcha checkbox */}
          <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl flex items-center space-x-3">
            <input
              type="checkbox"
              id="captcha"
              checked={captchaChecked}
              onChange={(e) => setCaptchaChecked(e.target.checked)}
              className="h-4 w-4 bg-white border border-gray-300 rounded text-[#F26522] focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="captcha" className="text-[9px] text-gray-600 cursor-pointer font-bold leading-snug">
              I CONFIRM I AM REPORTING MISCONDUCT IN GOOD FAITH UNDER WHISTLEBLOWER RIGHTS. I UNDERSTAND MY NETWORK IDENTITY REMAINS ENTIRELY PROTECTED.
            </label>
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-between items-center">
            <Link
              href="/report/status"
              className="text-[10px] font-bold text-[#F26522] hover:underline"
            >
              [Check Status of Existing Report]
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-6 rounded-full flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-[#F26522]/10 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Protecting tunnel...</span>
                </>
              ) : (
                <span>[Submit anonymously]</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
