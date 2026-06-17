"use client";

import React, { useState, useEffect } from "react";
import { useCenter } from "./layout";
import Link from "next/link";
import { 
  Building, GraduationCap, ShieldCheck, UserCheck, Activity, KeyRound, 
  ScanLine, ArrowRight, ClipboardCheck, Loader2 
} from "lucide-react";
import { centerApi } from "@/lib/api";

export default function CenterDashboardPage() {
  const { center, exam, officerName } = useCenter();
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      if (!exam || !center) return;
      try {
        const res = await centerApi.getCheckinProgress(exam.id, center.id);
        setProgress(res);
      } catch (err) {
        console.error("Failed to load check-in progress:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, [exam, center]);

  const cards = [
    {
      title: "Student Check-In",
      desc: "Perform QR admission ticket scanning and face biometric matches.",
      path: "/checkin",
      icon: UserCheck,
      color: "text-[#F26522]",
      bg: "bg-[#F26522]/10 border-[#F26522]/20"
    },
    {
      title: "Live Room Feeds",
      desc: "Monitor live CCTV surveillance streams and seating room occupancies.",
      path: "/rooms",
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-50 border-green-200"
    },
    {
      title: "Unlock Trunks",
      desc: "Trigger GPS verification, confirm transit OTP and unlock exam paper chests.",
      path: "/trunk-unlock",
      icon: KeyRound,
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200"
    },
    {
      title: "Scan Answer Sheets",
      desc: "Scan and upload candidate physical OMR sheets for live AI grading.",
      path: "/answer-sheets",
      icon: ScanLine,
      color: "text-purple-600",
      bg: "bg-purple-50 border-purple-200"
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto selection:bg-[#F26522]/30 selection:text-[#F26522]">
      
      {/* Welcome & Info */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-mono text-gray-900 uppercase tracking-tight">
            Terminal Status: <span className="text-[#F26522]">CONNECTED</span>
          </h2>
          <p className="text-xs text-gray-500 font-mono">
            Welcome back, <strong className="text-gray-900 font-bold">{officerName}</strong>. Operating as assigned Chief Center Superintendent.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl text-green-700 text-xs font-mono">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span>RLS MAPPED TO CENTER ID</span>
        </div>
      </div>

      {/* Grid of Center & Exam details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Center Details */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2 flex items-center space-x-2">
            <Building className="h-4.5 w-4.5 text-[#F26522]" />
            <span>Center Node Details</span>
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs font-mono text-gray-700">
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Center Name</span>
              <span className="text-gray-900 font-bold">{center?.name}</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Node Identifier</span>
              <span className="text-gray-900">{center?.slug}</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Registered Capacity</span>
              <span className="text-[#F26522] font-bold">{center?.capacity} Candidates</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Location Metadata</span>
              <span className="text-gray-900">{center?.city}, {center?.state}</span>
            </div>
          </div>
        </div>

        {/* Exam Details */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2 flex items-center space-x-2">
            <GraduationCap className="h-4.5 w-4.5 text-[#F26522]" />
            <span>Target Examination Status</span>
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs font-mono text-gray-700">
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Exam Name</span>
              <span className="text-gray-900 font-bold uppercase">{exam?.name}</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Exam Date</span>
              <span className="text-gray-900">{exam?.exam_date}</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Reporting Schedule</span>
              <span className="text-[#F26522] font-bold">{exam?.start_time} (Duration {exam?.duration_minutes}m)</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase">Registration Status</span>
              <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase w-fit">
                {exam?.status}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Check-In Progress Widget */}
      {loading ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center text-gray-500 text-xs font-mono flex items-center justify-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#F26522]" />
          <span>Syncing checked-in candidate ratios...</span>
        </div>
      ) : progress ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 flex items-center space-x-2">
              <ClipboardCheck className="h-4.5 w-4.5 text-green-600" />
              <span>Real-Time Check-In Progress</span>
            </h3>
            <span className="text-xs font-mono text-gray-900 font-bold bg-gray-50 border border-gray-200 px-2 py-1 rounded">
              {progress.checked_in} / {progress.total_registered} Arrived
            </span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-gray-100 rounded-full h-3.5 border border-gray-200 overflow-hidden p-[2px]">
              <div
                className="bg-[#F26522] h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-gray-400 uppercase">
              <span>{progress.absent_so_far} pending arrival</span>
              <span className="text-[#F26522] font-bold">{progress.percent}% checked in</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Operational Actions Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500">
          Terminal Operation Centers
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.path}
                href={card.path}
                className="bg-white border border-gray-200 p-6 rounded-2xl hover:border-[#F26522] hover:bg-gray-50/50 transition-all flex flex-col justify-between group space-y-4 text-left shadow-sm"
              >
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl w-fit border ${card.bg} ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold font-mono text-gray-900 uppercase group-hover:text-[#F26522] transition-colors">
                    {card.title}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#F26522] uppercase font-bold border-t border-gray-100 pt-3">
                  <span>Enter Terminal</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
