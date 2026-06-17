"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ShieldAlert, Eye, ShieldQuestion } from "lucide-react";
import { studentApi } from "@/lib/api";

export default function StudentGrievancesDashboard() {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGrievance, setSelectedGrievance] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchGrievances = async () => {
    setLoading(true);
    try {
      const data = await studentApi.getMyGrievances();
      setGrievances(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load your grievances roster. Make sure you are logged in.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrievances();
  }, []);

  const handleOpenGrievance = async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await studentApi.getMyGrievanceDetail(id);
      setSelectedGrievance(data);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* List Section */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 border-b border-gray-150 pb-2 font-semibold">
              My Filed Grievance Tickets ({grievances.length})
            </h2>

            {loading ? (
              <div className="h-48 flex justify-center items-center text-gray-500 font-mono text-xs uppercase tracking-widest space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#F26522]" />
                <span>Decrypting credentials...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-650 text-center font-mono text-xs">
                {error}
              </div>
            ) : grievances.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-mono text-xs uppercase tracking-widest space-y-2">
                <ShieldQuestion className="h-8 w-8 text-gray-300 mx-auto" />
                <span>No filed grievance records found.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {grievances.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => handleOpenGrievance(g.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${
                      selectedGrievance?.id === g.id
                        ? "bg-gray-50 border-[#F26522]"
                        : "bg-white border-gray-200 hover:border-gray-350"
                    }`}
                  >
                    <div className="font-mono text-xs uppercase space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900">GRV-{g.id.substring(0, 8)}</span>
                        <span className="text-[10px] text-gray-500">({g.exams?.name || "Exam"})</span>
                      </div>
                      <span className="text-[10px] block text-gray-400">{g.category.replace("_", " ")}</span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                        g.status === "RESOLVED"
                          ? "bg-green-50 text-green-600 border-green-200"
                          : g.status === "REJECTED"
                          ? "bg-red-50 text-red-650 border-red-200"
                          : g.status === "UNDER_REVIEW"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-gray-50 text-gray-650 border-gray-200"
                      }`}>
                        {g.status}
                      </span>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-fit font-mono text-xs uppercase">
            {loadingDetail ? (
              <div className="h-48 flex justify-center items-center text-gray-500 uppercase tracking-widest space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#F26522]" />
                <span>Decrypting ticket payload...</span>
              </div>
            ) : selectedGrievance ? (
              <div className="space-y-4">
                <div className="border-b border-gray-150 pb-3">
                  <h3 className="font-bold text-gray-900 tracking-wider">Ticket Details</h3>
                  <span className="text-[9px] text-gray-400 break-all">{selectedGrievance.id}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] text-gray-400 block">Category</span>
                  <span className="text-gray-900 font-bold block">{selectedGrievance.category.replace("_", " ")}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] text-gray-400 block">Description</span>
                  <p className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-[10px] text-gray-600 leading-relaxed normal-case max-h-[140px] overflow-y-auto">
                    {selectedGrievance.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] text-gray-400 block">Surveillance Link Status</span>
                  <span className={`text-[10px] font-bold block ${selectedGrievance.auto_cctv_attached ? "text-green-600" : "text-amber-600"}`}>
                    {selectedGrievance.auto_cctv_attached ? "CCTV FEED ATTACHED SUCCESSFULLY" : "SURVEILLANCE ATTACHMENT IN PROGRESS"}
                  </span>
                </div>

                <div className="border-t border-gray-150 pt-4 space-y-3">
                  <h4 className="text-[9px] text-gray-400 tracking-wider">Manager Resolution Note</h4>
                  {selectedGrievance.resolution_notes ? (
                    <div className="bg-gray-50 border border-gray-250 p-4 rounded-lg space-y-2">
                      <span className="block text-[8px] text-gray-400">Outcome: {selectedGrievance.status}</span>
                      <p className="text-gray-900 normal-case text-[10px] leading-relaxed">
                        {selectedGrievance.resolution_notes}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-150 text-gray-400 text-[10px] text-center">
                      PENDING AUDIT INVESTIGATION REVIEW
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col justify-center items-center text-gray-400 text-[10px] text-center uppercase tracking-widest space-y-2">
                <ShieldAlert className="h-6 w-6 text-gray-300" />
                <span>Select a ticket to view resolution status.</span>
              </div>
            )}
          </div>

      </div>
    </div>
  );
}
