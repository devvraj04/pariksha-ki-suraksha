'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface CustodyEvent {
  event: string;
  actor: string;
  timestamp: string;
}

interface ForensicReport {
  report_id: string;
  upload_id: string;
  tmc_decoded: any;
  primary_suspect_operator_name: string | null;
  primary_suspect_operator_id: string | null;
  primary_suspect_printer_id: string | null;
  primary_suspect_center_name: string | null;
  primary_suspect_center_id: string | null;
  leaked_at: string;
  custody_chain: CustodyEvent[];
  confidence_score: number;
  processing_notes: string;
}

interface StatusData {
  job_id: string;
  status: 'processing' | 'completed' | 'failed' | 'no_watermark_found';
  report?: ForensicReport;
}

export default function ForensicStatusPage({ params }: { params: Promise<{ job_id: string }> }) {
  const resolvedParams = use(params);
  const job_id = resolvedParams.job_id;

  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${baseUrl}/api/v1/forensic/status/${job_id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || 'Failed to fetch status');
        }

        setData(result.data);

        // Continue polling if still processing
        if (result.data.status === 'processing') {
          timeoutId = setTimeout(fetchStatus, 3000);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to connect to the server');
      }
    };

    fetchStatus();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [job_id]);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-12 flex items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-slate-600/10 blur-[80px] rounded-full"></div>
      </div>

      <div className="w-full max-w-3xl bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10 transition-all duration-500">
        <header className="border-b border-slate-800 pb-6 mb-8 text-center flex flex-col items-center">
          <span className="text-rose-400 text-xs font-bold uppercase tracking-[0.2em] mb-2 px-3 py-1 bg-rose-500/10 rounded-full">
            Investigation Status
          </span>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Attribution Analysis
          </h1>
          <p className="text-[10px] text-slate-500 mt-3 font-mono bg-slate-950 px-3 py-1 rounded border border-slate-800 shadow-inner">
            JOB: {job_id}
          </p>
        </header>

        {error ? (
          <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-8 text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-red-200 font-bold mb-2">Error Retrieving Status</h3>
            <p className="text-red-400/80 text-sm">{error}</p>
          </div>
        ) : !data || data.status === 'processing' ? (
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-inner">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-rose-500 border-r-rose-500 animate-[spin_1.5s_linear_infinite]"></div>
              <div className="absolute inset-2 rounded-full border-4 border-slate-800"></div>
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-l-blue-500 border-b-blue-500 animate-[spin_2s_linear_infinite_reverse]"></div>
            </div>
            <h3 className="font-bold text-lg text-slate-200 mb-2">Analyzing Image Data</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              Our forensic engine is currently deskewing, enhancing contrast, and scanning for Tracking Matrix Codes (TMC) via OpenCV.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-rose-400/80 font-mono animate-pulse">
              <span>ESTABLISHING CUSTODY CHAIN</span>
              <span className="flex space-x-1">
                <span className="animate-[bounce_1s_infinite] delay-100">.</span>
                <span className="animate-[bounce_1s_infinite] delay-200">.</span>
                <span className="animate-[bounce_1s_infinite] delay-300">.</span>
              </span>
            </div>
          </div>
        ) : data.status === 'no_watermark_found' ? (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-10 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-700">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Watermark Detected</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              The forensic engine could not identify any valid Tracking Matrix Code in the provided image after multiple enhancement passes.
            </p>
            <div className="text-xs text-slate-500 bg-slate-950/50 p-4 rounded-xl font-mono inline-block text-left">
              <span className="block text-slate-400 mb-1 font-semibold">Diagnostic Notes:</span>
              {data.report?.processing_notes || 'Failed to extract payload.'}
            </div>
          </div>
        ) : data.status === 'failed' ? (
          <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-8 text-center">
             <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-800">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-red-200 font-bold mb-2">Analysis Failed</h3>
            <p className="text-red-400/80 text-sm max-w-md mx-auto">
              An error occurred during the forensic pipeline execution.
            </p>
             <div className="mt-4 text-xs text-red-300/60 bg-red-950/50 p-3 rounded-lg font-mono">
              {data.report?.processing_notes || 'Unknown error'}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Success Header */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/40 border border-emerald-900/30 rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-900/40 rounded-full flex items-center justify-center border border-emerald-700/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-emerald-400 font-bold text-lg">Attribution Successful</h2>
                  <p className="text-slate-400 text-xs mt-0.5">TMC payload extracted and verified</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Confidence</div>
                <div className="text-2xl font-black text-white flex items-baseline gap-1 justify-end">
                  {Math.round((data.report?.confidence_score || 0) * 100)}<span className="text-sm text-slate-400 font-medium">%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Suspect Information Card */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Primary Suspect
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Operator Name</div>
                    <div className="font-medium text-white bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-2 text-sm shadow-inner">
                      {data.report?.primary_suspect_operator_name || 'Unknown Operator'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Exam Center</div>
                    <div className="font-medium text-white bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-2 text-sm shadow-inner">
                      {data.report?.primary_suspect_center_name || 'Unknown Center'}
                    </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="flex-1">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Printer ID</div>
                      <div className="font-mono text-slate-300 bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-2 text-xs shadow-inner truncate">
                        {data.report?.primary_suspect_printer_id || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custody Chain Timeline */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 flex flex-col h-full">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Custody Chain
                </h3>
                
                <div className="relative pl-4 border-l border-slate-800 space-y-6 flex-1">
                  {data.report?.custody_chain?.map((event, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[21px] w-2 h-2 bg-blue-500 rounded-full mt-1.5 ring-4 ring-slate-950"></div>
                      <div className="text-xs font-bold text-slate-300 capitalize">{event.event.replace('_', ' ')}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{event.actor}</div>
                      <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  
                  {(!data.report?.custody_chain || data.report.custody_chain.length === 0) && (
                     <div className="text-sm text-slate-500 italic">No custody events recorded.</div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Raw JSON Data Dropdown (Optional/Debug) */}
            <details className="group bg-slate-950/30 border border-slate-800/60 rounded-xl overflow-hidden">
              <summary className="cursor-pointer px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between hover:bg-slate-900/50 transition-colors">
                View Raw Decoded Payload
                <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="p-5 border-t border-slate-800/60 bg-slate-950/80">
                <pre className="text-[10px] text-emerald-400/80 font-mono whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(data.report?.tmc_decoded, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        <footer className="mt-8 pt-6 border-t border-slate-800/50 text-center">
          <Link
            href="/report"
            className="inline-flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider transition-colors px-4 py-2 rounded-lg hover:bg-rose-500/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Submit Another Report
          </Link>
        </footer>
      </div>
    </main>
  );
}
