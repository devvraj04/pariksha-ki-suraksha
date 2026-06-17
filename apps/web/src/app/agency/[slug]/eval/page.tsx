"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, BookOpen, Clock, CheckCircle2, Shield, AlertTriangle } from "lucide-react";
import { agencyApi } from "@/lib/api";
import Link from "next/link";

export default function EvaluatorDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const userProfile = await agencyApi.getMe().catch(() => null);
        setMe(userProfile);
        
        const list = await agencyApi.getEvaluatorAssignments();
        setAssignments(list);
      } catch (err: any) {
        setError(err.message || "Failed to load evaluator dashboard.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F26522]" />
      </div>
    );
  }

  const counts = {
    pending: assignments.filter(a => a.status === "PENDING" || a.status === "IN_PROGRESS").length,
    completed: assignments.filter(a => a.status === "COMPLETED" || a.status === "LOCKED").length
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header Banner */}
      <div className="relative bg-white border border-gray-200 p-8 rounded-2xl overflow-hidden shadow-sm">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#F26522]/5 rounded-full filter blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-mono uppercase bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 px-2 py-0.5 rounded font-bold tracking-widest">
            {me?.role?.replace(/_/g, " ")} NODE
          </span>
          <h1 className="text-2xl font-mono font-bold text-gray-900 uppercase tracking-wider">
            Evaluator Assessment &amp; Marks Registry
          </h1>
          <p className="text-gray-500 text-xs font-mono max-w-xl">
            Logged in as <span className="text-gray-900 font-semibold">{me?.full_name}</span> ({me?.email}). All marks submitted are cryptographically logged against your evaluator node key.
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active/Pending Batches", value: counts.pending, color: "text-[#F26522]" },
          { label: "Completed Batches", value: counts.completed, color: "text-green-700" },
          { label: "Total Assignments", value: assignments.length, color: "text-gray-900" }
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
            <div className={`text-3xl font-mono font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-mono text-gray-500 uppercase mt-1 tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Discrepancies resolver quick access for Chief Moderator */}
      {(me?.role === "chief_moderator" || me?.role === "agency_head") && (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-[#F26522] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-mono font-bold text-gray-900 uppercase">Discrepancy Escalation Center</h3>
              <p className="text-xs text-gray-600 font-mono mt-1">Review evaluations with high differences between Grading Teachers and Moderators.</p>
            </div>
          </div>
          <Link
            href={`/agency/${slug}/eval/discrepancies`}
            className="bg-[#F26522] hover:bg-[#e05a1a] text-white font-mono font-bold text-xs uppercase px-4 py-2.5 rounded-full transition-all shadow-sm shrink-0"
          >
            Open Discrepancies Room
          </Link>
        </div>
      )}

      {/* Roster of Assignments */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl space-y-4 shadow-sm">
        <h2 className="text-sm font-mono font-bold uppercase text-gray-900 border-b border-gray-150 pb-2 tracking-widest flex items-center space-x-2">
          <BookOpen className="h-4 w-4 text-[#F26522]" />
          <span>Assigned Answer Sheet Batches</span>
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-655" />
            <span>{error}</span>
          </div>
        )}

        {assignments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-mono text-xs">
            No batches assigned to your evaluator profile yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs font-mono text-left border-collapse bg-white">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Batch Code</th>
                  <th className="px-5 py-3">Role Scope</th>
                  <th className="px-5 py-3">Sheets Count</th>
                  <th className="px-5 py-3">Assigned Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                    <td className="px-5 py-4 font-bold text-gray-900">{a.batch_code}</td>
                    <td className="px-5 py-4 text-gray-600 capitalize">{a.role.replace(/_/g, " ")}</td>
                    <td className="px-5 py-4 text-gray-600">{a.upload_ids?.length || 0} sheets</td>
                    <td className="px-5 py-4 text-gray-400">{new Date(a.assigned_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.status === "COMPLETED" || a.status === "LOCKED" ? "bg-green-50 text-green-700 border border-green-150" :
                        a.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 border border-blue-150 animate-pulse" : "bg-amber-50 text-amber-700 border border-amber-150"
                      }`}>{a.status}</span>
                    </td>
                    <td className="px-5 py-4">
                      {a.status === "COMPLETED" || a.status === "LOCKED" ? (
                        <span className="text-gray-400 italic">Access Revoked</span>
                      ) : (
                        <Link
                          href={`/agency/${slug}/eval/${a.id}`}
                          className="bg-gray-900 hover:bg-gray-800 text-white font-mono text-[10px] px-3.5 py-1.5 rounded-full transition-all shadow-sm"
                        >
                          Start Grading
                        </Link>
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
  );
}
