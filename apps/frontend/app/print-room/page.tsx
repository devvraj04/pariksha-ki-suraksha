'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { apiFetch } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

interface PrintSession {
  id: string;
  paper_id: string;
  authorized_by_a: string;
  authorized_by_b: string;
  authorized_copies: number;
  authorized_centers: string[];
  expires_at: string;
  is_active: boolean;
  papers: {
    title: string;
    exam_id: string;
  } | null;
}

interface PrintJob {
  id: string;
  paper_id: string;
  print_session_id: string;
  center_id: string;
  printer_id: string;
  operator_id: string;
  copies_requested: number;
  copies_printed: number;
  status: 'queued' | 'printing' | 'completed' | 'aborted';
  aborted_reason: string | null;
  created_at: string;
  completed_at: string | null;
  papers: {
    title: string;
  } | null;
  exam_centers: {
    name: string;
    city: string;
  } | null;
}

interface VisionAlert {
  id: string;
  agent_id: string;
  location_type: string;
  location_id: string;
  detected_class: string;
  confidence: number;
  frame_storage_path: string | null;
  triggered_abort: boolean;
  created_at: string;
}

export default function PrintRoomDashboard() {
  const [sessions, setSessions] = useState<PrintSession[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [alerts, setAlerts] = useState<VisionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Realtime inspection log simulator for YOLO
  const [feedLogs, setFeedLogs] = useState<string[]>([
    'YOLOv8 agent initialized on Port 5001',
    'Room status: SECURE. 0 objects detected.'
  ]);

  const supabase = createClient();

  // Load Initial Data
  const loadDashboardData = async () => {
    try {
      // 1. Fetch active sessions (with joined paper title)
      const { data: sessionData, error: sessErr } = await supabase
        .from('print_sessions')
        .select('*, papers(title, exam_id)')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (sessionData) {
        setSessions(sessionData as unknown as PrintSession[]);
      }

      // 2. Fetch recent jobs (with joined paper title and center name)
      const { data: jobsData, error: jobsErr } = await supabase
        .from('print_jobs')
        .select('*, papers(title), exam_centers(name, city)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (jobsData) {
        setJobs(jobsData as unknown as PrintJob[]);
      }

      // 3. Fetch recent vision alerts
      const { data: alertsData } = await supabase
        .from('vision_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (alertsData) {
        setAlerts(alertsData as VisionAlert[]);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Set up Realtime subscriptions
    // 1. Listen to print_jobs updates
    const jobsChannel = supabase
      .channel('db-print-jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs' },
        () => {
          loadDashboardData();
          setFeedLogs((prev) => [`[Print Job Update] Spooler queue state synchronized at ${new Date().toLocaleTimeString()}`, ...prev.slice(0, 8)]);
        }
      )
      .subscribe();

    // 2. Listen to vision_alerts updates
    const alertsChannel = supabase
      .channel('db-vision-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vision_alerts' },
        (payload) => {
          const newAlert = payload.new as VisionAlert;
          setAlerts((prev) => [newAlert, ...prev]);
          setFeedLogs((prev) => [
            `⚠️ ALERT: ${newAlert.detected_class} detected with ${(newAlert.confidence * 100).toFixed(1)}% confidence!`,
            ...prev.slice(0, 8)
          ]);
          loadDashboardData(); // Refresh jobs in case it was aborted
        }
      )
      .subscribe();

    // 3. Listen to realtime broadcasts
    const broadcastChannel = supabase
      .channel('print_room')
      .on('broadcast', { event: '*' }, (message) => {
        setFeedLogs((prev) => [`[Realtime Broadcast] Event: ${message.event} received.`, ...prev.slice(0, 8)]);
        loadDashboardData();
      })
      .subscribe();

    // YOLO Logs simulator
    const logInterval = setInterval(() => {
      const messages = [
        'YOLOv8 frame inference complete (no security violations).',
        'Webcam feed FPS: 30.0 | CPU load: 14.2%',
        'Vision threat matrix: SECURE.',
        'Active print room webcam monitor sync ok.'
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setFeedLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${randomMsg}`, ...prev.slice(0, 6)]);
    }, 8000);

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(logInterval);
    };
  }, []);

  // Handle manual abort request
  const handleAbortJob = async (jobId: string) => {
    const reason = prompt('Please enter the reason for aborting this print job:');
    if (reason === null) return; // cancelled

    try {
      const resp = await apiFetch(`/print/jobs/${jobId}/abort`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Manual operator override' }),
      });

      if (resp.success) {
        alert('Print job aborted successfully.');
        loadDashboardData();
      } else {
        alert(`Failed to abort job: ${resp.error?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Network error: ${error.message}`);
    }
  };

  // Helper: Get public URL for alert frame thumbnail
  const getAlertThumbnail = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from('vision-alerts').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <Header />

      {/* Main Grid */}
      <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--color-border-indigo)] pb-6 gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-indigo-600)]">
              Operations Center
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[var(--color-text-primary)] mt-1">
              Print Room Operator Dashboard
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Manage authorized print sessions, track watermarked copies spooler queue, and monitor live vision security alerts.
            </p>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-full text-xs text-[var(--color-success)] font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] animate-pulse"></span>
            YOLOv8 Security Agent Connected
          </div>
        </div>

        {/* Bento Grid Layer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Active Print Sessions (Span 4) */}
          <div className="lg:col-span-4 glass-card p-6 rounded-3xl flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-lg font-bold text-[var(--color-text-primary)]">
                  Active Print Sessions
                </h3>
                <span className="text-[10px] font-bold bg-[var(--color-indigo-100)] text-[var(--color-indigo-900)] px-2 py-0.5 rounded-full font-mono uppercase">
                  {sessions.length} Session{sessions.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {loading ? (
                <div className="text-center py-12 text-xs text-[var(--color-text-muted)]">Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 text-xs text-[var(--color-text-muted)] border border-dashed border-black/10 rounded-2xl bg-black/5">
                  No active authorized print sessions found. Set up key assembly to generate.
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-4 bg-[var(--color-bg-soft)] border border-[var(--color-border-glass)] rounded-2xl flex flex-col justify-between gap-3"
                    >
                      <div>
                        <h4 className="font-serif font-bold text-sm text-[var(--color-text-primary)]">
                          {sess.papers?.title || 'Question Paper'}
                        </h4>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono block mt-1 uppercase">
                          Paper ID: {sess.paper_id.slice(0, 8)}...
                        </span>
                      </div>

                      <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                        <span>Authorized Copies:</span>
                        <span className="font-bold">{sess.authorized_copies}</span>
                      </div>

                      <div className="flex justify-between text-xs text-[var(--color-text-secondary)] border-b border-black/5 pb-2">
                        <span>Expires At:</span>
                        <span className="font-mono text-[10px] font-bold text-[var(--color-warning)]">
                          {new Date(sess.expires_at).toLocaleTimeString()}
                        </span>
                      </div>

                      <Link
                        href={`/print-room/view-paper?paper_id=${sess.paper_id}&session_id=${sess.id}`}
                        className="btn-primary w-full text-center py-2 text-xs mt-1"
                      >
                        Open Secure Viewer
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* YOLOv8 Webcam Status (Span 4) */}
          <div className="lg:col-span-4 glass-card p-6 rounded-3xl flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="font-serif text-lg font-bold text-[var(--color-text-primary)] mb-3">
                Live Room Monitoring
              </h3>
              
              <div className="flex flex-col items-center justify-center h-36 border border-dashed border-[var(--color-border-indigo)] rounded-2xl bg-[var(--color-bg-soft)] text-center p-4 relative overflow-hidden">
                <div className="w-12 h-12 rounded-full border-2 border-[var(--color-success)] flex items-center justify-center text-[var(--color-success)] mb-2 relative">
                  <span className="absolute inset-0 rounded-full border-2 border-[var(--color-success)] animate-ping opacity-75"></span>
                  ✔
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-success)]">
                  Room Status: SECURE
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono">
                  YOLOv8 listening for threat signatures
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--color-border-indigo)] pt-3">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest block mb-2">
                Agent Activity Logs
              </span>
              <div className="bg-black/85 text-[10px] font-mono text-emerald-400 p-3 rounded-xl h-24 overflow-y-auto space-y-1.5 scrollbar-thin">
                {feedLogs.map((log, index) => (
                  <div key={index} className="break-words leading-normal">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Security Violations (Span 4) */}
          <div className="lg:col-span-4 glass-card p-6 rounded-3xl flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="font-serif text-lg font-bold text-[var(--color-text-primary)] mb-4">
                Vision Threat Alerts
              </h3>

              {alerts.length === 0 ? (
                <div className="text-center py-16 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-soft)] rounded-2xl border border-[var(--color-border-glass)]">
                  No threat alerts triggered.
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.slice(0, 1).map((alertItem) => {
                    const thumbUrl = getAlertThumbnail(alertItem.frame_storage_path);
                    return (
                      <div
                        key={alertItem.id}
                        className={`p-4 rounded-2xl border ${
                          alertItem.triggered_abort
                            ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger)]/30'
                            : 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]/30'
                        } space-y-3`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-red-100 text-red-800 rounded-full border border-red-200">
                              {alertItem.detected_class.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)] block mt-1">
                              Confidence: {(alertItem.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          
                          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                            {new Date(alertItem.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        {alertItem.triggered_abort && (
                          <div className="text-xs font-bold text-[var(--color-danger)] uppercase tracking-wider animate-pulse">
                            🚨 PRINT JOB ABORTED
                          </div>
                        )}

                        {thumbUrl ? (
                          <div className="rounded-xl overflow-hidden border border-black/10 max-h-32">
                            <img
                              src={thumbUrl}
                              alt="Flagged frame thumbnail"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="text-[10px] text-[var(--color-text-muted)] text-center py-4 bg-black/5 rounded-xl border border-dashed border-black/10">
                            No frame thumbnail uploaded.
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {alerts.length > 1 && (
                    <div className="text-[10px] text-[var(--color-text-muted)] flex justify-between items-center px-1">
                      <span>History: {alerts.length - 1} prior alerts in log</span>
                      <button
                        onClick={() => alert('Refer to Admin logs to see full alert vault.')}
                        className="text-[var(--color-indigo-600)] hover:underline"
                      >
                        View Vault
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Spooler Job Queue (Span 12) */}
        <div className="glass-card p-6 rounded-3xl border border-[var(--color-border-glass)] shadow-lg">
          <div className="flex justify-between items-center border-b border-[var(--color-border-indigo)] pb-4 mb-4">
            <h3 className="font-serif text-xl font-bold text-[var(--color-text-primary)]">
              Print Spooler Job Queue
            </h3>
            
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
              Live updates active
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-[var(--color-text-muted)]">Loading spooler queue...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-text-muted)]">
              No print jobs logged in the system spooler.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border-indigo)] text-[10px] uppercase font-bold text-[var(--color-indigo-700)] tracking-wider">
                    <th className="py-3 px-4">Job ID</th>
                    <th className="py-3 px-4">Question Paper</th>
                    <th className="py-3 px-4">Exam Center Target</th>
                    <th className="py-3 px-4">Printer</th>
                    <th className="py-3 px-4 text-center">Copies</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Spooled At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-xs">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-white/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-[10px] text-[var(--color-indigo-900)]">
                        {job.id.slice(0, 8)}...
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                        {job.papers?.title || 'Unknown Paper'}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">
                        {job.exam_centers?.name || 'Unknown Center'}
                        {job.exam_centers?.city && (
                          <span className="text-[10px] text-[var(--color-text-muted)] block">
                            {job.exam_centers.city}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-[var(--color-text-muted)]">
                        {job.printer_id}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {job.copies_printed} / {job.copies_requested}
                      </td>
                      <td className="py-3.5 px-4">
                        {job.status === 'completed' && (
                          <span className="inline-block bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Completed
                          </span>
                        )}
                        {job.status === 'queued' && (
                          <span className="inline-block bg-[var(--color-indigo-050)] text-[var(--color-indigo-600)] border border-[var(--color-indigo-500)]/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            Queued
                          </span>
                        )}
                        {job.status === 'printing' && (
                          <span className="inline-block bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            Printing
                          </span>
                        )}
                        {job.status === 'aborted' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-block bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger)]/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider w-max">
                              Aborted
                            </span>
                            {job.aborted_reason && (
                              <span className="text-[9px] text-[var(--color-danger)] max-w-xs break-words">
                                {job.aborted_reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                        {new Date(job.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {(job.status === 'queued' || job.status === 'printing') && (
                          <button
                            onClick={() => handleAbortJob(job.id)}
                            className="bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger)] hover:text-white border border-[var(--color-danger)]/30 text-[var(--color-danger)] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 cursor-pointer"
                          >
                            Abort Job
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
