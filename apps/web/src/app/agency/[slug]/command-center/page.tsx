"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { 
  Shield, AlertTriangle, Zap, RefreshCw, Loader2, CheckCircle2, AlertOctagon, Radio
} from "lucide-react";
import { agencyApi } from "@/lib/api";

const ALERT_TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  MOBILE_PHONE_DETECTED:  { label: "Mobile Phone",       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  EARPIECE_DETECTED:      { label: "Earpiece",           color: "text-orange-750", bg: "bg-orange-50", border: "border-orange-200" },
  MASS_HEAD_TURNING:      { label: "Mass Head-Turning",  color: "text-yellow-800", bg: "bg-yellow-50", border: "border-yellow-250" },
  UNAUTHORIZED_PERSON:    { label: "Unauthorized Person",color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  SUSPICIOUS_OBJECT:      { label: "Suspicious Object",  color: "text-orange-750", bg: "bg-orange-50", border: "border-orange-200" },
  ANOMALOUS_BEHAVIOR:     { label: "Anomalous Behavior", color: "text-yellow-800", bg: "bg-yellow-50", border: "border-yellow-250" },
};

export default function CommandCenterPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [stats, setStats] = useState({ total: 0, open: 0, escalated: 0 });
  const [filterType, setFilterType] = useState<string>("ALL");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load active exams
  useEffect(() => {
    agencyApi.getExams({ status: "ONGOING" }).then((list: any[]) => {
      setExams(list);
      if (list.length > 0) setSelectedExamId(list[0].id);
    }).catch(() => {
      // fallback: load any non-draft exam
      agencyApi.getExams().then((all: any[]) => {
        const active = all.filter(e => !["DRAFT", "PUBLISHED"].includes(e.status));
        setExams(active);
        if (active.length > 0) setSelectedExamId(active[0].id);
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    fetchAlerts();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAlerts, 8000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedExamId, autoRefresh]);

  const fetchAlerts = async () => {
    if (!selectedExamId) return;
    setLoading(true);
    try {
      const data = await agencyApi.getSurveillanceAlerts(selectedExamId);
      setAlerts(data);
      setStats({
        total: data.length,
        open: data.filter((a: any) => !a.review_outcome).length,
        escalated: data.filter((a: any) => a.review_outcome === "ESCALATED").length,
      });
    } catch {}
    setLoading(false);
  };

  const handleReview = async (alertId: string, outcome: string) => {
    try {
      await agencyApi.reviewSurveillanceAlert(alertId, { review_outcome: outcome });
      await fetchAlerts();
    } catch {}
  };

  const filtered = filterType === "ALL" ? alerts : alerts.filter(a => a.alert_type === filterType);
  const alertTypes = Object.keys(ALERT_TYPE_META);

  return (
    <div className="space-y-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-[#F26522] p-2 rounded-2xl shadow-lg shadow-[#F26522]/10">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-gray-900 uppercase tracking-wider">Agency Command Center</h1>
            <p className="text-xs font-mono text-gray-500">Real-time AI surveillance monitoring &amp; alert management</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-mono shadow-sm">
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            <span className="text-gray-500 font-bold">{autoRefresh ? "LIVE" : "PAUSED"}</span>
          </div>
          <label className="flex items-center space-x-2 text-xs font-mono text-gray-550 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-[#F26522]" />
            <span>Auto-refresh (8s)</span>
          </label>
          <button onClick={fetchAlerts} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center shadow-sm">
            <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>

      {/* Exam selector */}
      <div className="flex space-x-2 overflow-x-auto pb-1">
        {exams.map(e => (
          <button
            key={e.id}
            onClick={() => setSelectedExamId(e.id)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all whitespace-nowrap shadow-sm ${
              selectedExamId === e.id
                ? "bg-[#F26522] text-white border-[#F26522]"
                : "bg-white text-gray-500 border-gray-200 hover:text-gray-900"
            }`}
          >
            {e.name}
          </button>
        ))}
        {exams.length === 0 && (
          <span className="text-xs font-mono text-gray-400 py-2">No active exams. Alerts visible once exam is ONGOING.</span>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase">Total Alerts</p>
              <p className="text-3xl font-mono font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <AlertOctagon className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white border border-red-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-red-655 uppercase font-bold">Unreviewed</p>
              <p className="text-3xl font-mono font-bold text-red-700 mt-1">{stats.open}</p>
            </div>
            <Radio className="h-8 w-8 text-red-600 animate-pulse" />
          </div>
        </div>
        <div className="bg-white border border-orange-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-orange-700 uppercase font-bold">Escalated</p>
              <p className="text-3xl font-mono font-bold text-[#F26522] mt-1">{stats.escalated}</p>
            </div>
            <Zap className="h-8 w-8 text-[#F26522]" />
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("ALL")}
          className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border transition-all shadow-sm ${
            filterType === "ALL" ? "bg-[#F26522] text-white border-[#F26522]" : "bg-white text-gray-500 border-gray-200 hover:text-gray-900"
          }`}
        >
          ALL ({alerts.length})
        </button>
        {alertTypes.map(type => {
          const count = alerts.filter(a => a.alert_type === type).length;
          if (count === 0) return null;
          const meta = ALERT_TYPE_META[type];
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border transition-all shadow-sm ${
                filterType === type ? `${meta.bg} ${meta.color} ${meta.border}` : "bg-white text-gray-500 border-gray-200 hover:text-gray-900"
              }`}
            >
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Alert Feed */}
      {loading && alerts.length === 0 ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#F26522] mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-2xl text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-green-650 mx-auto mb-4 opacity-70" />
          <p className="text-sm font-mono text-gray-600">No surveillance alerts detected.</p>
          <p className="text-xs font-mono text-gray-400 mt-1">AI monitoring is active.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const meta = ALERT_TYPE_META[alert.alert_type] || { label: alert.alert_type, color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };
            return (
              <div
                key={alert.id}
                className={`${meta.bg} border ${meta.border} p-5 rounded-2xl flex items-start justify-between gap-4 shadow-sm`}
              >
                <div className="flex items-start space-x-4 min-w-0">
                  <div className={`p-2 rounded-xl ${meta.bg} border ${meta.border} shrink-0`}>
                    <AlertTriangle className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                      <span className={`text-sm font-mono font-bold ${meta.color}`}>{meta.label}</span>
                      <span className="text-[10px] font-mono bg-white border border-gray-200 px-2 py-0.5 rounded-lg text-gray-600">
                        CAM: {alert.camera_id}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        Confidence: <span className="text-gray-900 font-bold">{(alert.confidence_score * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 mt-1 flex-wrap gap-y-1">
                      <span className="text-[10px] font-mono text-gray-500">{new Date(alert.detected_at).toLocaleString()}</span>
                      {alert.exam_centers && <span className="text-[10px] font-mono text-gray-500">· {alert.exam_centers.name}</span>}
                      {alert.exam_rooms && <span className="text-[10px] font-mono text-gray-500">· Room: {alert.exam_rooms.room_code}</span>}
                    </div>
                    {alert.review_outcome && (
                      <span className={`inline-block mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        alert.review_outcome === "DISMISSED" ? "bg-gray-150 text-gray-550 border border-gray-250" :
                        alert.review_outcome === "ESCALATED" ? "bg-orange-50 text-orange-700 border border-orange-150" :
                        "bg-green-50 text-green-700 border border-green-150"
                      }`}>
                        {alert.review_outcome}
                      </span>
                    )}
                  </div>
                </div>

                {!alert.review_outcome && (
                  <div className="flex space-x-2 shrink-0">
                    <button
                      onClick={() => handleReview(alert.id, "DISMISSED")}
                      className="bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl text-[10px] font-mono hover:bg-gray-50 transition-all shadow-sm"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleReview(alert.id, "ESCALATED")}
                      className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-xl text-[10px] font-mono hover:bg-orange-100 transition-all shadow-sm"
                    >
                      Escalate
                    </button>
                    <button
                      onClick={() => handleReview(alert.id, "ACTION_TAKEN")}
                      className="bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl text-[10px] font-mono hover:bg-green-100 transition-all shadow-sm"
                    >
                      Action Taken
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
