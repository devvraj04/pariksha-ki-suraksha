"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, AlertTriangle, Eye, Loader2, FileText, CheckCircle, XCircle } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function WhistleblowerInboxPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await agencyApi.getWhistleblowerReports();
      setReports(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch whistleblower reports. Make sure you are logged in.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRowClick = async (reportId: string) => {
    setLoadingDetail(true);
    try {
      const data = await agencyApi.getWhistleblowerReportDetail(reportId);
      setSelectedReport(data);
    } catch (err: any) {
      alert("Error loading report details: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseReport = async () => {
    if (!selectedReport) return;
    setClosing(true);
    try {
      await agencyApi.closeWhistleblowerReport(selectedReport.id);
      setSelectedReport({ ...selectedReport, routing_status: "CLOSED" });
      fetchReports();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-3 font-bold">
          <ShieldAlert className="h-6 w-6 text-[#F26522]" />
          <span>Anonymous Whistleblower Inbox</span>
        </h1>
        <p className="text-xs font-mono text-gray-500 mt-1 uppercase tracking-wider">
          AI-screened reports of misconduct, leaks, and exam fraud
        </p>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col justify-center items-center text-gray-500 font-mono text-xs uppercase tracking-widest space-y-3">
          <Loader2 className="h-6 w-6 text-[#F26522] animate-spin" />
          <span>Syncing anonymous reports database...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-655 font-mono text-xs uppercase text-center">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Table */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-150 flex justify-between items-center">
              <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 font-bold">Reports log ({reports.length})</h2>
              <span className="text-[10px] bg-red-50 text-red-650 border border-red-200 font-bold px-2 py-0.5 rounded font-mono uppercase">
                {reports.filter(r => r.ai_risk_score >= 70).length} HIGH RISK CASES
              </span>
            </div>
            
            {reports.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-mono text-xs uppercase tracking-widest">
                <span>No whistleblower filings recorded.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs uppercase tracking-wider border-collapse">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-bold">Tracking ID</th>
                      <th className="px-6 py-4 font-bold">Category</th>
                      <th className="px-6 py-4 text-center font-bold">AI Risk</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {reports.map((report) => (
                      <tr
                        key={report.id}
                        onClick={() => handleRowClick(report.id)}
                        className={`cursor-pointer hover:bg-gray-50 transition-all ${
                          selectedReport?.id === report.id ? "bg-gray-50/80 border-l-2 border-l-[#F26522]" : ""
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-gray-900 truncate max-w-[100px]">{report.id}</td>
                        <td className="px-6 py-4 text-gray-700">{report.category.replace("_", " ")}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            report.ai_risk_score >= 70
                              ? "bg-red-50 text-red-655 border-red-200"
                              : report.ai_risk_score >= 40
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : "bg-green-50 text-green-600 border-green-200"
                          }`}>
                            {report.ai_risk_score ?? "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            report.routing_status === "ROUTED_TO_AUDIT"
                              ? "bg-red-50 text-red-650 border-red-200"
                              : report.routing_status === "AI_SCORED"
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : report.routing_status === "CLOSED"
                              ? "bg-gray-150 text-gray-550 border-gray-250"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}>
                            {report.routing_status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{new Date(report.submitted_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar Detail Panel */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-fit">
            {loadingDetail ? (
              <div className="h-48 flex justify-center items-center text-gray-500 font-mono text-xs uppercase tracking-widest space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#F26522]" />
                <span>Fetching decrypted report...</span>
              </div>
            ) : selectedReport ? (
              <div className="space-y-5 font-mono text-xs uppercase">
                <div className="border-b border-gray-150 pb-3 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 tracking-wider">Report Case File</h3>
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{selectedReport.id}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 block">Exam Association</span>
                  <span className="text-gray-900 font-bold block">{selectedReport.exams?.name || "Global / General"}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 block">Category</span>
                  <span className="text-gray-900 font-bold block">{selectedReport.category.replace("_", " ")}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 block">Report Description</span>
                  <p className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-750 leading-relaxed normal-case text-[11px] max-h-[160px] overflow-y-auto">
                    {selectedReport.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 block">Reported Location</span>
                  <span className="text-gray-900 font-bold block">{selectedReport.location_text || "N/A"}</span>
                </div>

                {selectedReport.signed_evidence_urls && selectedReport.signed_evidence_urls.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-400 block">Attached Evidence ({selectedReport.signed_evidence_urls.length})</span>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedReport.signed_evidence_urls.map((url: string, index: number) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-gray-50 hover:bg-gray-100 border border-gray-200 p-2 rounded-lg flex items-center space-x-1.5 text-[9px] text-[#F26522] tracking-wider truncate cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span>[Evidence #{index+1}]</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-150 space-y-2">
                  {selectedReport.routing_status !== "CLOSED" ? (
                    <button
                      onClick={handleCloseReport}
                      disabled={closing}
                      className="w-full bg-red-655 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-full flex items-center justify-center space-x-2 transition-all duration-150 cursor-pointer"
                    >
                      {closing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span>[Close & Archive Case]</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="bg-gray-100 border border-gray-200 text-gray-500 text-center py-2 px-4 rounded-lg font-bold flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>CASE FILE CLOSED</span>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="h-64 flex flex-col justify-center items-center text-gray-400 font-mono text-[10px] text-center uppercase tracking-widest space-y-2">
                <AlertTriangle className="h-6 w-6 text-gray-300" />
                <span>Select a report from the log to view details.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
