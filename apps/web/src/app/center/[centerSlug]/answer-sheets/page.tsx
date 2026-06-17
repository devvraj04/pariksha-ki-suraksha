"use client";

import React, { useState, useRef, useEffect } from "react";
import { useCenter } from "../layout";
import { ScanLine, Upload, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { centerApi } from "@/lib/api";

export default function CenterAnswerSheetsPage() {
  const { exam, center } = useCenter();
  const examId = exam?.id;
  const centerId = center?.id;

  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null);
  const [studentId, setStudentId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const fetchSheets = async () => {
    if (!examId || !centerId) return;
    setLoading(true);
    try {
      const data = await centerApi.getAnswerSheets(examId, { center_id: centerId });
      setSheets(data);
    } catch (err) {
      console.error("Failed to load answer sheets:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSheets();
  }, [examId, centerId]);

  const handleFileChange = () => {
    setSelectedFileName(fileRef.current?.files?.[0]?.name || "");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileRef.current?.files?.[0] || !studentId.trim() || !examId || !centerId) {
      setUploadError("Please select a file and enter a Student ID.");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const fd = new FormData();
      fd.append("file", fileRef.current.files[0]);
      fd.append("student_id", studentId.trim());
      fd.append("center_id", centerId);
      await centerApi.uploadAnswerSheet(examId, fd);
      setUploadSuccess("Answer sheet uploaded successfully. AI scoring in progress…");
      setStudentId("");
      setSelectedFileName("");
      if (fileRef.current) fileRef.current.value = "";
      await fetchSheets();
    } catch (err: any) {
      setUploadError(err.message || "Upload failed.");
    }
    setUploading(false);
  };

  const handleSealAll = async () => {
    if (!examId || !centerId) return;
    if (!confirm("Seal all APPROVED answer sheets? This cannot be undone.")) return;
    try {
      const res = await centerApi.sealAllAnswerSheets(examId, centerId);
      alert(res.message);
      await fetchSheets();
    } catch (err: any) { 
      alert(err.message || "Failed to seal answer sheets."); 
    }
  };

  const counts = {
    total: sheets.length,
    approved: sheets.filter(s => s.upload_status === "APPROVED").length,
    rescan: sheets.filter(s => s.upload_status === "RESCAN_REQUIRED").length,
    sealed: sheets.filter(s => s.upload_status === "SEALED").length,
    scoring: sheets.filter(s => s.upload_status === "SCORING").length,
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto selection:bg-[#F26522]/30 selection:text-[#F26522]">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2">
            <ScanLine className="h-5 w-5 text-[#F26522]" />
            <span>OMR Answer Sheets Upload Node</span>
          </h1>
          <p className="text-xs font-mono text-gray-500 mt-1">{center?.name} // {exam?.name}</p>
        </div>
        <button onClick={fetchSheets} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center shadow-sm">
          <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-gray-900" },
          { label: "Scoring", value: counts.scoring, color: "text-blue-600" },
          { label: "Approved", value: counts.approved, color: "text-green-600" },
          { label: "Rescan Req.", value: counts.rescan, color: "text-red-600" },
          { label: "Sealed", value: counts.sealed, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 p-4 rounded-xl text-center shadow-sm">
            <div className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upload Form */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl space-y-4 shadow-sm">
        <h3 className="text-sm font-mono font-bold uppercase text-[#F26522]">Scan &amp; Upload Answer Sheet</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-gray-500 uppercase">Student UUID</label>
              <input
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="Paste student ID from check-in system"
                className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2.5 rounded-xl focus:border-[#F26522] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-gray-500 uppercase">PDF Scan File</label>
              <div className="flex items-center space-x-2 mt-1">
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl text-xs font-mono transition-all shadow-sm"
                >
                  Choose File
                </button>
                <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]">
                  {selectedFileName || "No file selected"}
                </span>
              </div>
            </div>
          </div>

          {uploadError && (
            <div className="flex items-center space-x-2 bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-mono text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" /><span>{uploadError}</span>
            </div>
          )}
          {uploadSuccess && (
            <div className="flex items-center space-x-2 bg-green-50 border border-green-200 p-3 rounded-xl text-xs font-mono text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /><span>{uploadSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-6 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-[#F26522]/15"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <><Upload className="h-4 w-4 text-white" /><span>Upload &amp; Grade Sheet</span></>}
          </button>
        </form>
      </div>

      {/* Seal All */}
      {counts.approved > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSealAll}
            className="text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-6 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-sm"
          >
            Seal All {counts.approved} Approved Sheets
          </button>
        </div>
      )}

      {/* Sheets Table */}
      {loading ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#F26522] mx-auto" /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase font-bold">
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-left px-5 py-3">Pages</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Uploaded</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map(s => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <span className="text-gray-900 font-bold">{s.students?.full_name || "—"}</span>
                    <span className="block text-[10px] text-gray-400">{s.students?.email}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{s.total_pages}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.upload_status === "APPROVED"        ? "bg-green-50 text-green-700 border border-green-200" :
                      s.upload_status === "RESCAN_REQUIRED" ? "bg-red-50 text-red-700 border border-red-200 animate-pulse font-bold" :
                      s.upload_status === "SEALED"          ? "bg-purple-50 text-purple-700 border border-purple-200" :
                      s.upload_status === "SCORING"         ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse" :
                      "bg-yellow-50 text-yellow-700 border border-yellow-200"
                    }`}>{s.upload_status}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(s.uploaded_at).toLocaleString()}</td>
                  <td className="px-5 py-3 space-x-2">
                    {s.upload_status === "RESCAN_REQUIRED" && (
                      <label className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-1 rounded text-[10px] font-mono cursor-pointer hover:bg-yellow-100 transition-all font-bold">
                        Rescan
                        <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                          if (!e.target.files?.[0]) return;
                          const fd = new FormData();
                          fd.append("file", e.target.files[0]);
                          try {
                            await centerApi.rescanAnswerSheet(s.id, fd);
                            alert("Rescan uploaded. AI scoring in progress.");
                            await fetchSheets();
                          } catch (err: any) { 
                            alert(err.message || "Rescan failed."); 
                          }
                        }} />
                      </label>
                    )}
                    {s.upload_status === "APPROVED" && (
                      <button 
                        onClick={async () => {
                          try {
                            await centerApi.sealAnswerSheet(s.id);
                            await fetchSheets();
                          } catch (err: any) {
                            alert(err.message || "Failed to seal sheet.");
                          }
                        }} 
                        className="bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-2 py-1 rounded text-[10px] font-mono transition-all font-bold shadow-sm"
                      >
                        Seal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sheets.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No answer sheets uploaded yet for this center node.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
