"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, ShieldCheck, ShieldAlert, FileText, Calendar, Printer, User, Clock, AlertCircle } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function LeakReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const reportId = params.reportId as string;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await agencyApi.getLeakReportDetail(reportId);
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load leak report details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [reportId]);

  const handleCloseReport = async () => {
    setClosing(true);
    try {
      const token = sessionStorage.getItem("agency_token") || "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/leaks/reports/${reportId}/close`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to close report");
      fetchDetail();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col justify-center items-center text-gray-500 font-mono text-xs uppercase tracking-widest space-y-3">
        <Loader2 className="h-6 w-6 text-red-655 text-red-600 animate-spin" />
        <span>Decrypting Agent 7 evidence package...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4 font-mono text-xs uppercase text-center py-12">
        <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
        <p className="text-gray-500">{error || "Leak report not found."}</p>
        <Link href={`/agency/${slug}/leaks`} className="text-[#F26522] hover:underline inline-block mt-2 font-bold">
          [Go Back to Roster]
        </Link>
      </div>
    );
  }

  const probReport = report.probability_report || {};
  const suspects = probReport.suspects || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href={`/agency/${slug}/leaks`}
          className="text-gray-500 hover:text-gray-900 font-mono text-xs uppercase tracking-wider flex items-center space-x-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>[Back to Leak Roster]</span>
        </Link>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Uploaded Image and Decoded Watermark */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
              Leaked Media Evidence
            </h3>
            
            <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center p-2 min-h-[220px]">
              {report.signed_url ? (
                <img
                  src={report.signed_url}
                  alt="Leaked Exam Content"
                  className="max-h-[300px] object-contain rounded"
                />
              ) : (
                <div className="text-center p-6 text-[10px] text-gray-400 font-mono">
                  [No Image File Associated]
                </div>
              )}
            </div>

            <div className="space-y-3 font-mono text-xs uppercase">
              <h4 className="text-[10px] text-gray-500 tracking-wider">Extracted Steganographic Watermark</h4>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2">
                <div>
                  <span className="block text-[8px] text-gray-400">Tracking Code</span>
                  <span className="font-bold text-gray-900 break-all">{report.watermark_extracted || "EXTRACTING..."}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200">
                  <div>
                    <span className="block text-[8px] text-gray-400">Center Code</span>
                    <span className="text-gray-900 font-bold">{report.extracted_center_code || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-gray-400">Printer ID</span>
                    <span className="text-gray-900 font-bold">{report.extracted_printer_id || "N/A"}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-gray-200">
                    <span className="block text-[8px] text-gray-400">Printing Operator</span>
                    <span className="text-gray-900 font-bold truncate block">{report.extracted_operator?.full_name || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Probability Analysis & Evidence Accordions */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6 lg:col-span-1">
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
              Attribution Probabilities
            </h3>

            {suspects.length === 0 ? (
              <div className="text-center p-6 text-[10px] text-gray-400 font-mono">
                [Analysis Pending Watermark Extraction]
              </div>
            ) : (
              <div className="space-y-4">
                {suspects.map((suspect: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className="text-gray-900">{suspect.name}</span>
                      <span className="text-red-600">{(suspect.probability * 100).toFixed(1)}%</span>
                    </div>
                    {/* Visual bar */}
                    <div className="h-2 w-full bg-gray-100 rounded border border-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-[#F26522] transition-all duration-500"
                        style={{ width: `${suspect.probability * 100}%` }}
                      />
                    </div>
                    
                    {/* Suspect evidence */}
                    <div className="bg-gray-50 border border-gray-150 p-3 rounded text-[10px] font-mono text-gray-600 space-y-1">
                      <span className="block text-[8px] text-gray-400 font-bold uppercase">Evidence Log</span>
                      {suspect.evidence?.map((ev: string, idx: number) => (
                        <div key={idx} className="flex items-start space-x-1 border-b border-gray-200 py-1 last:border-0">
                          <span className="text-red-500 shrink-0">▪</span>
                          <span className="leading-relaxed">{ev}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Telemetry Log & Metadata Panel */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-2">
              Telemetry Verification Log
            </h3>
            
            <div className="space-y-3 font-mono text-[10px] text-gray-500 max-h-[300px] overflow-y-auto pr-1">
              <div>
                <span className="text-[#F26522] block font-bold">1. Digital Vault Logs</span>
                {probReport.vault_access_logs?.length > 0 ? (
                  probReport.vault_access_logs.map((log: string, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 mt-1">{log}</div>
                  ))
                ) : (
                  <div className="text-gray-400 italic mt-1">No vault logs parsed.</div>
                )}
              </div>
              
              <div>
                <span className="text-[#F26522] block font-bold">2. Print Surveillance Alerts</span>
                {probReport.print_surveillance_alerts?.length > 0 ? (
                  probReport.print_surveillance_alerts.map((log: string, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 mt-1">{log}</div>
                  ))
                ) : (
                  <div className="text-gray-400 italic mt-1">No printer alarms triggered.</div>
                )}
              </div>

              <div>
                <span className="text-[#F26522] block font-bold">3. Transit Violations</span>
                {probReport.transit_violations?.length > 0 ? (
                  probReport.transit_violations.map((log: string, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 mt-1">{log}</div>
                  ))
                ) : (
                  <div className="text-gray-400 italic mt-1">No GPS geofence triggers.</div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-150 pt-4 space-y-3 font-mono text-xs uppercase">
              <h3 className="text-[10px] text-gray-500 tracking-wider">Report Metadata</h3>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">REPORT ID:</span>
                  <span className="text-gray-900 truncate font-bold max-w-[120px]">{report.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">SUBMITTED:</span>
                  <span className="text-gray-900 font-bold">{new Date(report.reported_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">STATUS:</span>
                  <span className="text-red-600 font-bold">{report.investigation_status}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/leaks/reports/${reportId}/evidence?token=${sessionStorage.getItem("agency_token")}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-full flex items-center justify-center space-x-2 transition-all duration-150 shadow-sm"
              >
                <Download className="h-4 w-4" />
                <span>[Export Evidence Package]</span>
              </a>

              {report.investigation_status !== "CLOSED" && (
                <button
                  onClick={handleCloseReport}
                  disabled={closing}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-full flex items-center justify-center space-x-2 transition-all duration-150 shadow-sm"
                >
                  {closing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <span>[Archive/Close Case File]</span>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
