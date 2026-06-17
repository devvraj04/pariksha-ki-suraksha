"use client";

import React, { useState, useEffect } from "react";
import { Building2, BookOpen, MessageSquare, ListTodo, RefreshCw, AlertTriangle } from "lucide-react";

interface Stats {
  agencies_pending: number;
  agencies_active: number;
  exams_active: number;
  grievances_open: number;
}

interface AuditLog {
  id: string;
  event_type: string;
  event_description: string;
  occurred_at: string;
  actor_role: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    agencies_pending: 0,
    agencies_active: 0,
    exams_active: 0,
    grievances_open: 0,
  });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = sessionStorage.getItem("admin_token");
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch stats
      const statsRes = await fetch("http://localhost:8000/api/v1/admin/stats", { headers });
      if (!statsRes.ok) throw new Error("Failed to load platform stats");
      const statsData = await statsRes.json();
      setStats(statsData);
      
      // Fetch recent audit logs
      const logsRes = await fetch("http://localhost:8000/api/v1/admin/audit-logs?limit=10", { headers });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch administrative data from the platform services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Administrative Dashboard</h1>
          <p className="text-xs text-gray-500">Manage onboarding agencies, monitor platform audits, and configure global variables.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 px-3.5 py-2 rounded-full font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>[Reload Stats]</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start space-x-3 bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-655">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div>
            <span className="font-bold block mb-1">DATA SYNC FAILED</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending approvals */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-[#F26522]" />
          <div className="flex items-center justify-between mb-4">
            <Building2 className="h-5 w-5 text-[#F26522]" />
            <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
              Pending Action
            </span>
          </div>
          <p className="font-mono text-4xl font-bold text-gray-900 mb-1">
            {loading ? "..." : stats.agencies_pending}
          </p>
          <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Onboarding Requests</p>
        </div>

        {/* Active agencies */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
          <div className="flex items-center justify-between mb-4">
            <Building2 className="h-5 w-5 text-blue-500" />
            <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
              Vetted
            </span>
          </div>
          <p className="font-mono text-4xl font-bold text-gray-900 mb-1">
            {loading ? "..." : stats.agencies_active}
          </p>
          <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Vetted Agencies</p>
        </div>

        {/* Active exams */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-green-500" />
          <div className="flex items-center justify-between mb-4">
            <BookOpen className="h-5 w-5 text-green-500" />
            <span className="bg-green-50 text-green-600 border border-green-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
              Ongoing
            </span>
          </div>
          <p className="font-mono text-4xl font-bold text-gray-900 mb-1">
            {loading ? "..." : stats.exams_active}
          </p>
          <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Ongoing Exams</p>
        </div>

        {/* Open grievances */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 left-0 h-1 w-full bg-red-500" />
          <div className="flex items-center justify-between mb-4">
            <MessageSquare className="h-5 w-5 text-red-550" />
            <span className="bg-red-50 text-red-655 border border-red-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
              Escalated
            </span>
          </div>
          <p className="font-mono text-4xl font-bold text-gray-900 mb-1">
            {loading ? "..." : stats.grievances_open}
          </p>
          <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Open Grievances</p>
        </div>
      </div>

      {/* Split Section: Audits & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Audit Events (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-150">
            <h2 className="font-mono text-xs uppercase tracking-wider text-gray-900 font-bold flex items-center space-x-2">
              <ListTodo className="h-4 w-4 text-[#F26522]" />
              <span>Realtime Audit Ledger</span>
            </h2>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Last 10 Events</span>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />
              ))
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-xs font-mono text-gray-400 uppercase">
                No ledger events logged on this cycle.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 relative group hover:border-[#F26522]/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <span className="bg-white text-[#F26522] border border-[#F26522]/20 text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold">
                      {log.event_type}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">
                      {new Date(log.occurred_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-mono">{log.event_description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Platform Status Panel (1/3 width) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <h2 className="font-mono text-xs uppercase tracking-wider text-gray-900 font-bold pb-4 border-b border-gray-150">
            Platform Guard Telemetry
          </h2>

          <div className="space-y-4">
            {/* HSM Status */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="block text-xs text-gray-900 font-mono uppercase font-bold">AWS CloudHSM Vault</span>
                <span className="block text-[9px] font-mono text-gray-400 uppercase">Keys Share 2 storage</span>
              </div>
              <span className="bg-green-50 text-green-600 border border-green-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                Connected
              </span>
            </div>

            {/* MQTT Broker */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="block text-xs text-gray-900 font-mono uppercase font-bold">MQTT IoT Telemetry</span>
                <span className="block text-[9px] font-mono text-gray-400 uppercase">Smart trunk channels</span>
              </div>
              <span className="bg-green-50 text-green-600 border border-green-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                Active
              </span>
            </div>

            {/* Edge Node Stream */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs text-gray-900 font-mono uppercase font-bold">Edge proctor nodes</span>
                <span className="block text-[9px] font-mono text-gray-400 uppercase">Room camera stream triggers</span>
              </div>
              <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase animate-pulse">
                Monitoring
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
