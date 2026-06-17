"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Shield, ArrowLeft, Calendar, Award, FileText, CheckCircle, AlertTriangle, Users, MapPin } from "lucide-react";

interface ExamDetail {
  id: string;
  slug: string;
  name: string;
  mode: string;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  fee_inr: number;
  total_seats: number;
  status: string;
  syllabus?: string;
  brochure_signed_url?: string;
  agencies?: {
    name: string;
    slug: string;
  };
  centers?: Array<{
    name: string;
    city: string;
    state: string;
  }>;
}

export default function PublicExamDetailPage() {
  const { examSlug } = useParams();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExamDetail() {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:8000/api/v1/public/exams/by-slug/${examSlug}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Exam not found");
          if (res.status === 403) throw new Error("Access to this exam detail is restricted");
          throw new Error("Failed to load exam details");
        }
        const data = await res.json();
        setExam(data);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An unexpected error occurred while fetching details.");
      } finally {
        setLoading(false);
      }
    }
    if (examSlug) {
      fetchExamDetail();
    }
  }, [examSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26522] mb-4" />
        <p className="font-mono text-sm text-gray-500 uppercase tracking-widest">LOADING ENCRYPTED EXAM BROCHURE...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col justify-between">
        <header className="border-b border-gray-200 bg-white sticky top-0 z-50 h-16 flex items-center px-4 shadow-sm">
          <Link href="/" className="inline-flex items-center space-x-2 text-gray-500 hover:text-gray-950 font-mono text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span>[Back to Listings]</span>
          </Link>
        </header>
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md shadow-sm">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-red-650 font-mono text-xs mb-6">{error}</p>
            <Link 
              href="/"
              className="inline-flex items-center space-x-2 bg-gray-900 text-white px-4 py-2 rounded-full font-mono text-xs hover:bg-gray-805 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Listings</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center space-x-2 text-gray-500 hover:text-gray-900 font-mono text-sm transition-colors duration-200 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            <span>[Back to Listings]</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-[#F26522]" />
            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">Secured Audit Segment</span>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-white border-b border-gray-150 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="font-mono text-xs text-[#F26522] uppercase tracking-wider font-bold">
            {exam.agencies?.name || "Official Vetted Agency"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{exam.name}</h1>
        </div>
      </div>

      {/* Main Grid */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (2/3 width) - PDF brochure or details */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2 font-mono uppercase tracking-wider">
              <FileText className="h-5 w-5 text-[#F26522]" />
              <span>Official Information Brochure</span>
            </h2>
            
            {exam.brochure_signed_url ? (
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white h-[650px] shadow-sm relative">
                {/* Embed PDF Viewer */}
                <iframe 
                  src={`${exam.brochure_signed_url}#toolbar=0`} 
                  className="w-full h-full border-0" 
                  title="Brochure PDF"
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-3 text-[#F26522] bg-amber-50 border border-amber-250 p-4 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-[#F26522] shrink-0" />
                  <p className="text-sm font-mono text-amber-600">Brochure document is currently generating via AI. Showing syllabus overview instead.</p>
                </div>
                <div>
                  <h3 className="text-md font-bold text-gray-900 mb-2">Syllabus Overview</h3>
                  <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                    {exam.syllabus || "No syllabus has been uploaded yet by the examination controller."}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (1/3 width) - Key Facts Sticky Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm sticky top-24 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-mono uppercase tracking-wider mb-4 pb-2 border-b border-gray-150">
                  Key Facts
                </h3>
                
                <div className="space-y-4">
                  {/* Date/Time */}
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-[#F26522] shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-mono text-gray-400 uppercase font-bold">Exam Date & Time</span>
                      <span className="text-sm font-bold text-gray-900">{exam.exam_date}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{exam.start_time} ({exam.duration_minutes} Mins)</span>
                    </div>
                  </div>
                  
                  {/* Fee */}
                  <div className="flex items-start space-x-3">
                    <Award className="h-5 w-5 text-[#F26522] shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-mono text-gray-400 uppercase font-bold">Registration Cost</span>
                      <span className="text-sm font-bold text-gray-900">INR {Number(exam.fee_inr).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Mode */}
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-[#F26522] shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-mono text-gray-400 uppercase font-bold">Operational Mode</span>
                      <span className="inline-flex text-xs font-mono px-2 py-0.5 bg-gray-50 border border-gray-200 text-[#F26522] rounded uppercase font-bold mt-1">
                        {exam.mode}
                      </span>
                    </div>
                  </div>

                  {/* Total Seats */}
                  <div className="flex items-start space-x-3">
                    <Users className="h-5 w-5 text-[#F26522] shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-mono text-gray-400 uppercase font-bold">System Capacity</span>
                      <span className="text-sm font-bold text-gray-900">{exam.total_seats.toLocaleString()} Seats Max</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & CTA */}
              <div className="pt-4 border-t border-gray-150">
                <span className="block text-[10px] font-mono text-gray-400 uppercase mb-2">Registration Status</span>
                <div className="mb-4">
                  {exam.status === "REGISTRATION_OPEN" ? (
                    <div className="inline-flex items-center space-x-2 text-xs font-mono text-green-600 font-bold bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                      <CheckCircle className="h-4 w-4" />
                      <span>REGISTRATION ACTIVE</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center space-x-2 text-xs font-mono text-red-650 font-bold bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{exam.status.replace("_", " ")}</span>
                    </div>
                  )}
                </div>

                {exam.status === "REGISTRATION_OPEN" ? (
                  <Link 
                    href={`/student/login?redirect=/exams/${exam.slug}/register`}
                    className="w-full block text-center font-mono bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-3 px-4 rounded-full shadow-md shadow-[#F26522]/10 hover:scale-[1.01] transition-all duration-200 cursor-pointer"
                  >
                    Register for Examination
                  </Link>
                ) : (
                  <button 
                    disabled 
                    className="w-full bg-gray-100 border border-gray-200 text-gray-400 font-mono py-3 px-4 rounded-full cursor-not-allowed text-center"
                  >
                    Registration Closed
                  </button>
                )}
              </div>

              {/* Vetted Center Cities */}
              {exam.centers && exam.centers.length > 0 && (
                <div className="pt-4 border-t border-gray-150">
                  <span className="block text-[10px] font-mono text-gray-400 uppercase mb-2">Vetted Center Locations</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(exam.centers.map(c => c.city))).map((city, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 bg-gray-50 text-gray-650 rounded border border-gray-200"
                      >
                        <MapPin className="h-3 w-3 text-[#F26522] shrink-0" />
                        <span>{city}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
