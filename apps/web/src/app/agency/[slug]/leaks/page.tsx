"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Plus, Eye, Loader2, AlertOctagon, Calendar, Upload, AlertCircle } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function LeakReportsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [reports, setReports] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [examId, setExamId] = useState("");
  const [sourceType, setSourceType] = useState("PUBLIC_MEDIA");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await agencyApi.getLeaksReports();
      setReports(data);
      const examList = await agencyApi.getExams();
      setExams(examList);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load leak reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image file.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (examId) {
        formData.append("exam_id", examId);
      }
      formData.append("source_type", sourceType);
      formData.append("description", description);

      // We call the API using a helper endpoint in public/agency
      const token = sessionStorage.getItem("agency_token") || "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/leaks/report`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "Upload failed");
      }

      setModalOpen(false);
      setExamId("");
      setDescription("");
      setFile(null);
      fetchReports();
    } catch (err: any) {
      setError(err.message || "Failed to submit leak report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-3">
            <ShieldAlert className="h-6 w-6 text-red-600 animate-pulse" />
            <span>Leak Investigation Portal</span>
          </h1>
          <p className="text-xs font-mono text-gray-500 mt-1 uppercase tracking-wider">
            Agent 7 Steganographic Detection & attribution panel
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-red-600 hover:bg-red-500 text-white text-xs font-mono uppercase tracking-wider py-2.5 px-4 rounded-full flex items-center space-x-2 shadow-sm transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          <span>[Report Suspected Leak]</span>
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col justify-center items-center text-gray-500 font-mono text-xs uppercase tracking-widest space-y-3">
          <Loader2 className="h-6 w-6 text-red-600 animate-spin" />
          <span>Loading investigation roster...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-150 bg-gray-50">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500">Suspected leak log ({reports.length})</h2>
          </div>
          
          {reports.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-mono text-xs uppercase tracking-widest space-y-2">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto" />
              <span>Zero leak alerts flagged on active exams.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs uppercase tracking-wider text-gray-700">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Report ID</th>
                    <th className="px-6 py-4">Exam Name</th>
                    <th className="px-6 py-4">Source Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Submitted Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50/50 transition-all">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900 truncate max-w-[120px]">{report.id}</td>
                      <td className="px-6 py-4 text-gray-700">{report.exams?.name || "Global / Unspecified"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${
                          report.source_type === "INTERNAL"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : report.source_type === "WHISTLEBLOWER"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {report.source_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          report.investigation_status === "REPORT_GENERATED"
                            ? "bg-green-55 bg-green-50 text-green-700 border border-green-200"
                            : report.investigation_status === "RECEIVED"
                            ? "bg-gray-100 text-gray-600 border border-gray-205 border-gray-200"
                            : report.investigation_status === "PROCESSING"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-gray-200 text-gray-700"
                        }`}>
                          {report.investigation_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{new Date(report.reported_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/agency/${slug}/leaks/${report.id}`}
                          className="bg-gray-900 hover:bg-gray-800 text-white text-[10px] font-mono font-bold uppercase tracking-wider py-1.5 px-3 rounded-full inline-flex items-center space-x-1.5 transition-all duration-150 shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>[Open]</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-gray-200 w-full max-w-lg rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-red-650 text-red-600 flex items-center space-x-2">
                <AlertOctagon className="h-5 w-5 animate-pulse text-red-600" />
                <span>File Suspected Leak Report</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-900 font-mono text-xs uppercase tracking-wider"
              >
                [Close]
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono text-xs uppercase tracking-wider">
              {error && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-700 flex items-center space-x-2 text-[10px]">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-gray-500 block">Select Examination (Optional)</label>
                <select
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  className="w-full bg-white border border-gray-205 border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                >
                  <option value="">-- No Exam / Global Leak --</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-500 block">Source of Leak Information</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full bg-white border border-gray-205 border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                >
                  <option value="PUBLIC_MEDIA">PUBLIC MEDIA / ONLINE FORUM</option>
                  <option value="WHISTLEBLOWER">ANONYMOUS WHISTLEBLOWER</option>
                  <option value="INTERNAL">INTERNAL TELEMETRY AUDIT</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-500 block">Description of Suspected Leak</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="PROVIDE SECURE DETAILS REGARDING THE PHOTO OR INCIDENT TIMESTAMPS..."
                  className="w-full bg-white border border-gray-205 border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] placeholder:text-gray-400 normal-case"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-500 block">Suspected Leak Photo/Screenshot</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
                    <div className="flex flex-col items-center justify-center pt-4 pb-4">
                      <Upload className="h-6 w-6 text-gray-400 mb-1" />
                      <p className="text-[10px] text-gray-500">
                        {file ? file.name : "SELECT IMAGE (JPEG / PNG, MAX 10MB)"}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-red-655 bg-red-600 hover:bg-red-500 text-white font-mono uppercase tracking-wider py-2.5 px-5 rounded-full flex items-center space-x-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Ingesting leak report...</span>
                    </>
                  ) : (
                    <span>[Submit for Agent 7 Audit]</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
