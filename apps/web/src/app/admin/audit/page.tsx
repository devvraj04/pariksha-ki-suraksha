"use client";

import React, { useState, useEffect } from "react";
import { 
  RefreshCw, AlertTriangle, 
  Download, Calendar, Filter, User, Network
} from "lucide-react";

interface AuditLog {
  id: string;
  event_type: string;
  event_description: string;
  occurred_at: string;
  actor_id: string | null;
  agency_id: string | null;
  exam_id: string | null;
  ip_address: string | null;
  metadata: any;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [agencyIdFilter, setAgencyIdFilter] = useState("");
  const [hasMore, setHasMore] = useState(true);

  // Fetch logs
  const fetchLogs = async (currentPage = page) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = sessionStorage.getItem("admin_token");
      const headers = { Authorization: `Bearer ${token}` };
      
      let url = `http://localhost:8000/api/v1/admin/audit-logs?page=${currentPage}&limit=${limit}`;
      if (eventTypeFilter) url += `&event_type=${encodeURIComponent(eventTypeFilter.toUpperCase())}`;
      if (agencyIdFilter) url += `&agency_id=${encodeURIComponent(agencyIdFilter)}`;
      
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to load audit ledger records from the server.");
      
      const data = await res.json();
      setLogs(data);
      setHasMore(data.length === limit);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch audit log data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    setPage(1);
  }, [eventTypeFilter, agencyIdFilter]);

  const handleNextPage = () => {
    if (hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLogs(nextPage);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchLogs(prevPage);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    // CSV Header
    const headers = ["ID", "Timestamp", "Event Type", "Description", "Agency ID", "Actor ID", "Exam ID", "IP Address"];
    const rows = logs.map(log => [
      log.id,
      new Date(log.occurred_at).toISOString(),
      log.event_type,
      log.event_description.replace(/"/g, '""'),
      log.agency_id || "",
      log.actor_id || "",
      log.exam_id || "",
      log.ip_address || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `parikshasetu_audit_ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 font-mono tracking-tight">Audit Ledger Immutable Record</h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">View real-time, append-only records of security events and administrative actions.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 px-3.5 py-2 rounded-full font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>[Reload]</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center space-x-2 bg-[#F26522] hover:bg-[#e05a1a] text-white px-3.5 py-2 rounded-full font-mono text-xs uppercase tracking-wider font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-[#F26522]/10"
          >
            <Download className="h-3.5 w-3.5" />
            <span>[Export CSV]</span>
          </button>
        </div>
      </div>

      {/* Filters Form */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 border border-gray-200 rounded-2xl shadow-sm">
        {/* Event Type Filter */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-gray-500 tracking-wider flex items-center space-x-1 font-bold">
            <Filter className="h-3 w-3 text-[#F26522]" />
            <span>Event Type Match</span>
          </label>
          <input
            type="text"
            placeholder="e.g. AGENCY_APPROVED"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 font-mono text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#F26522]"
          />
        </div>

        {/* Agency ID Filter */}
        <div className="space-y-1.5 col-span-2">
          <label className="text-[10px] font-mono uppercase text-gray-500 tracking-wider flex items-center space-x-1 font-bold">
            <User className="h-3 w-3 text-[#F26522]" />
            <span>Agency UUID filter</span>
          </label>
          <input
            type="text"
            placeholder="Search by full UUID agency identifier..."
            value={agencyIdFilter}
            onChange={(e) => setAgencyIdFilter(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 font-mono text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#F26522]"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-3 bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-655">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div>
            <span className="font-bold block mb-1">LEDGER CONNECTION FAILURE</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                <th className="py-4 px-6 font-bold">Timestamp</th>
                <th className="py-4 px-6 font-bold">Event Type</th>
                <th className="py-4 px-6 font-bold">Log Description</th>
                <th className="py-4 px-6 font-bold">Actor / IP Address</th>
                <th className="py-4 px-6 font-bold">Resource Identifiers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 font-mono text-xs">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="py-5 px-6">
                      <div className="h-4 bg-gray-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center text-gray-400 uppercase tracking-wider text-[11px]">
                    No immutable ledger entries mapped to the search parameters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-gray-500 whitespace-nowrap">
                      <span className="block">{new Date(log.occurred_at).toLocaleDateString()}</span>
                      <span className="block text-[9px] text-gray-400">{new Date(log.occurred_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-gray-50 text-[#F26522] border border-[#F26522]/15 text-[10px] font-bold px-2 py-0.5 rounded uppercase block w-fit">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-800 leading-relaxed font-sans max-w-sm">
                      {log.event_description}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1.5 text-gray-700">
                        <Network className="h-3 w-3 text-gray-400" />
                        <span>IP: {log.ip_address || "System"}</span>
                      </div>
                      <span className="block text-[9px] text-gray-400 mt-0.5">Actor: {log.actor_id ? log.actor_id.substring(0, 8) + "..." : "System Process"}</span>
                    </td>
                    <td className="py-4 px-6 text-[9px] text-gray-400 space-y-0.5 uppercase">
                      {log.agency_id && <span className="block">Agency: {log.agency_id.substring(0,8)}...</span>}
                      {log.exam_id && <span className="block">Exam: {log.exam_id.substring(0,8)}...</span>}
                      {!log.agency_id && !log.exam_id && <span className="block text-gray-400">[None Linked]</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between font-mono text-[11px] uppercase text-gray-500">
          <span>Page {page}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || loading}
              className="px-3.5 py-1.5 border border-gray-200 rounded-full bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-950 transition-all disabled:opacity-30 disabled:hover:text-gray-700 cursor-pointer"
            >
              [Previous]
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="px-3.5 py-1.5 border border-gray-200 rounded-full bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-950 transition-all disabled:opacity-30 disabled:hover:text-gray-700 cursor-pointer"
            >
              [Next]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
