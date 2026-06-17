"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, User, 
  Download, Calendar, Clock, CreditCard, Loader2, Sparkles
} from "lucide-react";
import { studentApi, publicApi } from "@/lib/api";

export default function StudentDashboardPage() {
  const router = useRouter();

  const [student, setStudent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      const profile = await studentApi.getMe();
      setStudent(profile);
      
      const regs = await studentApi.getRegistrations();
      setRegistrations(regs);

      const exams = await publicApi.getExams();
      // Filter out exams that student has already registered for
      const registeredExamIds = regs.map((r: any) => r.exam_id);
      const available = exams.filter((e: any) => !registeredExamIds.includes(e.id) && e.status === "REGISTRATION_OPEN");
      setAvailableExams(available);

      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load candidate dashboard.");
      // If unauthorized, go to login
      if (err.message?.includes("Unauthorized") || err.message?.includes("credentials")) {
        sessionStorage.removeItem("student_token");
        router.push("/student/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem("student_token");
    if (!token) {
      router.push("/student/login");
      return;
    }
    loadDashboardData();
  }, []);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case "PENDING_PAYMENT":
        return <span className="bg-red-50 text-red-650 border border-red-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold">PAYMENT PENDING</span>;
      case "REGISTERED":
        return <span className="bg-green-50 text-green-600 border border-green-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold">CONFIRMED ROLLED</span>;
      case "CHECKED_IN":
        return <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold">CHECKED IN AT CENTER</span>;
      case "APPEARED":
        return <span className="bg-purple-50 text-purple-650 border border-purple-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold">APPEARED</span>;
      default:
        return <span className="bg-gray-50 text-gray-600 border border-gray-200 text-[9px] font-mono px-2 py-0.5 rounded">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span className="text-gray-500 text-xs">Syncing student environment...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl w-full mx-auto space-y-8">
        
        {/* Biometrics Warning Banner */}
        {student && !student.biometric_hash_present && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold font-mono text-gray-900 uppercase tracking-wider">
                BIOMETRICS GENERATION IN QUEUE
              </h4>
              <p className="text-[11px] text-gray-500 font-mono">
                Your visual face checksum calculation is currently processing in our secure AI nodes. Some options may be restricted until signature updates complete.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-250 p-4 rounded-xl text-xs font-mono text-red-650">
            {error}
          </div>
        )}

        {/* Greeting block */}
        {student && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-4">
              <div className="bg-gray-50 h-12 w-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
                <User className="h-6 w-6 text-[#F26522]" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono text-gray-900 uppercase tracking-tight">
                  Welcome, <span className="text-[#F26522]">{student.full_name}</span>
                </h1>
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-0.5">
                  ID: {student.id} // DOB: {student.date_of_birth}
                </p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 text-green-600 text-xs font-mono px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>REGISTRY SECURE</span>
            </div>
          </div>
        )}

        {/* Registered Exams */}
        <div className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500 font-semibold">
            My Registered Examinations ({registrations.length})
          </h2>

          {registrations.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center space-y-2 text-gray-500 shadow-sm">
              <p className="text-xs font-mono">No active registrations mapped under your registry ID.</p>
              <p className="text-[10px] uppercase">Browse open exams below to register.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {registrations.map((reg) => {
                const exam = reg.exams;
                return (
                  <div key={reg.id} className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col justify-between space-y-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-[#F26522] uppercase font-bold">{exam?.agencies?.name}</span>
                        {getStatusBadge(reg.status)}
                      </div>
                      <h3 className="text-sm font-bold font-mono text-gray-900 uppercase">{exam?.name}</h3>
                      <div className="flex space-x-4 text-[10px] font-mono text-gray-500 pt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span>{exam?.exam_date}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span>{exam?.start_time}</span>
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-150 pt-3 flex justify-between items-center">
                      <span className="text-[10px] font-mono text-gray-400 uppercase">App No: {reg.application_number}</span>
                      
                      {exam?.status === "RESULT_DECLARED" ? (
                        <div className="flex items-center space-x-2">
                          {reg.admit_card_id && (
                            <Link
                              href={`/student/exams/${exam.slug}/admit-card?regId=${reg.id}`}
                              className="text-gray-500 hover:text-gray-900 text-[10px] font-mono font-bold uppercase transition-all px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                              title="Download Admit Card"
                            >
                              Admit Card
                            </Link>
                          )}
                          <Link
                            href={`/student/exams/${exam.slug}/result`}
                            className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-md shadow-[#F26522]/10"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>View Results</span>
                          </Link>
                        </div>
                      ) : reg.status === "PENDING_PAYMENT" ? (
                        <Link
                          href={`/student/exams/${exam.slug}/payment?regId=${reg.id}`}
                          className="bg-red-650 hover:bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all inline-flex items-center space-x-1 shadow-md shadow-red-500/10 cursor-pointer"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>[Pay Fee]</span>
                        </Link>
                      ) : reg.admit_card_id ? (
                        <Link
                          href={`/student/exams/${exam.slug}/admit-card?regId=${reg.id}`}
                          className="bg-gray-900 hover:bg-gray-800 text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all inline-flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download Admit Card</span>
                        </Link>
                      ) : (
                        <span className="text-[10px] font-mono text-gray-500 uppercase">Admit card pending allocation</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Available Exams */}
        <div className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500 font-semibold">
            Open Upcoming Examinations ({availableExams.length})
          </h2>

          {availableExams.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-xs text-gray-500 font-mono shadow-sm">
              No new open exams found. Please check back later.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableExams.map((e) => (
                <div key={e.id} className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col justify-between space-y-4 shadow-sm">
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-gray-500 uppercase block">{e.agencies?.name || "Partner Agency"}</span>
                    <h3 className="text-sm font-bold font-mono text-gray-900 uppercase">{e.name}</h3>
                    <p className="text-[10px] text-gray-500 font-mono">
                      Eligibility: Age {e.eligibility_criteria?.min_age || 18}-{e.eligibility_criteria?.max_age || 35} / {e.eligibility_criteria?.qualification || "Graduate"}
                    </p>
                  </div>

                  <div className="border-t border-gray-150 pt-3 flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-900 font-bold">{e.fee_inr} INR</span>
                    <Link
                      href={`/student/exams/${e.slug}/register`}
                      className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>[Register Now]</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

    </div>
  );
}
