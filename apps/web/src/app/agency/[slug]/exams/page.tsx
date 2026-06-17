"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Calendar, Clock, HelpCircle, Loader2 } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function AgencyExamsListPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExams() {
      try {
        const data = await agencyApi.getExams();
        setExams(data);
      } catch (err: any) {
        setError(err.message || "Failed to load examinations.");
      } finally {
        setLoading(false);
      }
    }
    loadExams();
  }, []);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    let classes = "";
    switch (s) {
      case "DRAFT":
        classes = "bg-gray-100 text-gray-500 border-gray-200";
        break;
      case "PUBLISHED":
        classes = "bg-blue-50 text-blue-700 border-blue-200";
        break;
      case "REGISTRATION_OPEN":
        return (
          <span className="inline-flex items-center space-x-1.5 bg-green-50 text-green-700 border border-green-200 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
            <span>REGISTRATION OPEN</span>
          </span>
        );
      case "REGISTRATION_CLOSED":
        classes = "bg-yellow-50 text-yellow-800 border-yellow-250";
        break;
      case "ADMIT_CARDS_ISSUED":
        classes = "bg-teal-50 text-teal-700 border-teal-200";
        break;
      case "ONGOING":
        return (
          <span className="inline-flex items-center space-x-1.5 bg-orange-50 text-[#F26522] border border-orange-200 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F26522] animate-pulse" />
            <span>ONGOING</span>
          </span>
        );
      case "PAPER_UPLOAD_PENDING":
        classes = "bg-red-50 text-red-700 border-red-200";
        break;
      case "EVALUATION_IN_PROGRESS":
        classes = "bg-purple-50 text-purple-700 border-purple-200";
        break;
      case "RESULT_DECLARED":
        classes = "bg-green-50 text-green-700 border-green-200";
        break;
      default:
        classes = "bg-gray-100 text-gray-500 border-gray-200";
    }

    return (
      <span className={`inline-flex items-center border text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${classes}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="space-y-8 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-gray-900 uppercase">
            Examinations Registry
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider">
            Manage test lifecycles, configuration, center mapping, and logistics
          </p>
        </div>
        <Link
          href={`/agency/${slug}/exams/new`}
          className="inline-flex items-center space-x-2 bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-md shadow-[#F26522]/10 w-fit"
        >
          <Plus className="h-4 w-4 text-white" />
          <span>[New Examination]</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-655 font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 font-mono text-gray-500 text-xs uppercase space-y-4">
          <Loader2 className="h-6 w-6 animate-spin text-[#F26522]" />
          <span>Syncing exam rosters...</span>
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-4 shadow-sm">
          <HelpCircle className="h-12 w-12 text-gray-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold font-mono text-gray-900 uppercase">No Exams Vaulted</h3>
            <p className="text-xs text-gray-500 font-mono">
              Begin by creating a new examination definition profile.
            </p>
          </div>
          <Link
            href={`/agency/${slug}/exams/new`}
            className="inline-flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Exam</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Exam Details</th>
                  <th className="px-6 py-4">Mode</th>
                  <th className="px-6 py-4">Schedule</th>
                  <th className="px-6 py-4">Capacity / Fill</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-750">
                {exams.map((exam) => (
                  <tr
                    key={exam.id}
                    className="hover:bg-gray-50/50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 uppercase text-sm font-mono">
                        {exam.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        ID: {exam.id} // SLUG: {exam.slug}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-50 border border-gray-200 text-gray-700">
                        {exam.mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center space-x-1.5 text-xs font-mono text-gray-700">
                        <Calendar className="h-3.5 w-3.5 text-[#F26522]/70" />
                        <span>{exam.exam_date}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] font-mono text-gray-500">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{exam.start_time} ({exam.duration_minutes} min)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-mono text-gray-700 max-w-[150px]">
                        <span>Seats Filled:</span>
                        <span className="font-bold text-gray-900">
                          {exam.registration_count || 0} / {exam.total_seats}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 max-w-[150px] overflow-hidden">
                        <div
                          className="bg-[#F26522] h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              ((exam.registration_count || 0) / exam.total_seats) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-[9px] font-mono text-gray-400 uppercase">
                        {exam.center_count || 0} Centers Configured
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(exam.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/agency/${slug}/exams/${exam.slug}`}
                        className="inline-flex items-center space-x-1 bg-white hover:bg-gray-50 border border-gray-200 text-[#F26522] hover:text-[#e05a1a] px-3 py-1.5 rounded-xl text-xs font-mono uppercase transition-all font-bold shadow-sm"
                      >
                        <span>[Manage]</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
