"use client";

import React, { useState, useEffect } from "react";
import { useCenter } from "../layout";
import { Users, Activity, Loader2, RefreshCw, Camera } from "lucide-react";
import { centerApi } from "@/lib/api";

export default function CenterLiveRoomsPage() {
  const { exam, center } = useCenter();
  const examId = exam?.id;
  const centerId = center?.id;

  const [rooms, setRooms] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    if (!examId || !centerId) return;
    setLoading(true);
    try {
      const [roomData, progressData] = await Promise.all([
        centerApi.getLiveRooms(examId, centerId),
        centerApi.getCheckinProgress(examId, centerId),
      ]);
      setRooms(roomData);
      setProgress(progressData);
    } catch (err) {
      console.error("Failed to load live rooms data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [examId, centerId]);

  useEffect(() => {
    if (!autoRefresh || !examId || !centerId) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [examId, centerId, autoRefresh]);

  const totalCapacity = rooms.reduce((sum, r) => sum + r.seating_capacity, 0);
  const totalOccupied = rooms.reduce((sum, r) => sum + r.current_occupancy, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto selection:bg-[#F26522]/30 selection:text-[#F26522]">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2">
            <Activity className="h-5 w-5 text-[#F26522]" />
            <span>Live Room Occupancy Monitor</span>
          </h1>
          <p className="text-xs font-mono text-gray-500 mt-1">{center?.name} // {exam?.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs font-mono text-gray-500 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-[#F26522]" />
            <span>Auto-refresh (10s)</span>
          </label>
          <button onClick={fetchData} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center shadow-sm">
            <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {progress && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Registered", value: progress.total_registered, color: "text-gray-900" },
            { label: "Checked In", value: progress.checked_in, color: "text-green-650" },
            { label: "Absent / Pending", value: progress.absent_so_far, color: "text-red-655" },
            { label: "Check-in %", value: `${progress.percent}%`, color: "text-[#F26522]" },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 p-4 rounded-xl text-center shadow-sm">
              <div className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] font-mono text-gray-400 uppercase mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Overall progress bar */}
      {progress && (
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-gray-500">Center-wide Seating Occupancy</span>
            <span className="text-[#F26522] font-bold">{totalOccupied}/{totalCapacity} seats</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-[#F26522] h-3 rounded-full transition-all duration-700"
              style={{ width: totalCapacity > 0 ? `${(totalOccupied / totalCapacity) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {/* Room Grid */}
      {loading && rooms.length === 0 ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#F26522] mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map(room => {
            const pct = room.occupancy_percent;
            const isFull = pct >= 100;
            const isAlmostFull = pct >= 80;
            return (
              <div
                key={room.id}
                className={`bg-white border p-5 rounded-2xl space-y-3 transition-all shadow-sm ${
                  isFull ? "border-red-200 bg-red-50" :
                  isAlmostFull ? "border-[#F26522]/30 bg-[#F26522]/5" :
                  "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-mono font-bold text-gray-900">{room.room_code}</h3>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">Capacity: {room.seating_capacity}</p>
                  </div>
                  {room.camera_stream_url && (
                    <Camera className="h-4 w-4 text-blue-600 animate-pulse" />
                  )}
                </div>

                {/* Occupancy meter */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className={isFull ? "text-red-655 font-bold" : isAlmostFull ? "text-[#F26522] font-bold" : "text-gray-650"}>
                      {room.current_occupancy} seated
                    </span>
                    <span className="text-gray-450">{room.available_seats} free</span>
                  </div>
                  <div className="w-full bg-gray-150 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isFull ? "bg-red-500" : isAlmostFull ? "bg-[#F26522]" : "bg-green-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={`text-right text-[10px] font-mono font-bold ${
                    isFull ? "text-red-650" : isAlmostFull ? "text-[#F26522]" : "text-green-600"
                  }`}>
                    {pct}% {isFull ? "FULL" : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {rooms.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400 font-mono text-xs">
              No testing rooms are registered under this exam center node.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
