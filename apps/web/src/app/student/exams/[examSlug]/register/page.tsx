"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, CheckCircle } from "lucide-react";
import { studentApi, publicApi } from "@/lib/api";

export default function ExamRegisterPreferencesPage() {
  const params = useParams();
  const router = useRouter();
  const examSlug = params.examSlug as string;

  const [student, setStudent] = useState<any>(null);
  const [formDetails, setFormDetails] = useState<any>(null);
  const [examId, setExamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Preferences
  const [pref1, setPref1] = useState("");
  const [pref2, setPref2] = useState("");
  const [pref3, setPref3] = useState("");

  useEffect(() => {
    async function loadForm() {
      try {
        const profile = await studentApi.getMe();
        setStudent(profile);
        
        // Resolve slug to UUID
        const examDetail = await publicApi.getPublicExamBySlug(examSlug);
        setExamId(examDetail.id);
        
        const details = await studentApi.getRegistrationForm(examDetail.id);
        setFormDetails(details);
        
        if (details.centers && details.centers.length > 0) {
          setPref1(details.centers[0]?.id || "");
          setPref2(details.centers[1]?.id || details.centers[0]?.id || "");
          setPref3(details.centers[2]?.id || details.centers[0]?.id || "");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load exam registration requirements.");
      } finally {
        setLoading(false);
      }
    }
    if (examSlug) {
      loadForm();
    }
  }, [examSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pref1 || !pref2 || !pref3) {
      setError("Please rank all three exam center preferences.");
      return;
    }

    if (pref1 === pref2 || pref1 === pref3 || pref2 === pref3) {
      setError("Please select distinct center locations for each preference ranking.");
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await studentApi.registerForExam(examId, {
        center_preference_1: pref1,
        center_preference_2: pref2,
        center_preference_3: pref3
      });
      // Redirect to checkout with registration ID
      router.push(`/student/exams/${examSlug}/payment?regId=${res.registration_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to submit exam registration.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span className="text-gray-500 text-xs">Syncing preference options...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-8">
      
      {/* Navigation / Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/student/dashboard"
          className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold font-mono text-gray-900 uppercase">
            Configure Exam Registration
          </h1>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-0.5">
            Exam Code: {examId}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-650">
          {error}
        </div>
      )}

      {formDetails?.is_registered ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-4 shadow-sm">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <div>
            <h3 className="text-sm font-bold font-mono text-gray-900 uppercase">Already Mapped</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">
              You have already registered for {formDetails.exam_name}. Status: {formDetails.registration_status}
            </p>
          </div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all"
          >
            <span>Back to Dashboard</span>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: Personal Details summary */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
            <span className="block text-xs font-mono uppercase text-[#F26522] border-b border-gray-150 pb-1">
              1. Candidate Profile Overview
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-gray-600">
              <div>
                <span className="block text-[10px] text-gray-400 uppercase mb-0.5 font-bold">Candidate Name</span>
                <span className="text-gray-900 font-bold uppercase">{student?.full_name}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase mb-0.5 font-bold">Registry Email</span>
                <span className="text-gray-900">{student?.email}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase mb-0.5 font-bold">Exam Target Name</span>
                <span className="text-gray-900 uppercase font-bold">{formDetails?.exam_name}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-400 uppercase mb-0.5 font-bold">Registration Fee Due</span>
                <span className="text-[#F26522] font-bold">{formDetails?.fee_inr} INR</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Center Preferences selection */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
            <span className="block text-xs font-mono uppercase text-[#F26522] border-b border-gray-150 pb-1">
              2. Test Center Location Preferences
            </span>

            {formDetails?.centers?.length === 0 ? (
              <div className="text-xs font-mono text-amber-600">
                Warning: No test centers have been configured by the agency for this examination yet.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
                    1st Preference (Primary choice)
                  </label>
                  <select
                    value={pref1}
                    onChange={(e) => setPref1(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                  >
                    {formDetails.centers.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-white text-gray-900">
                        {c.name} // {c.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
                    2nd Preference
                  </label>
                  <select
                    value={pref2}
                    onChange={(e) => setPref2(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                  >
                    {formDetails.centers.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-white text-gray-900">
                        {c.name} // {c.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
                    3rd Preference
                  </label>
                  <select
                    value={pref3}
                    onChange={(e) => setPref3(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                  >
                    {formDetails.centers.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-white text-gray-900">
                        {c.name} // {c.city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitLoading || formDetails?.centers?.length < 3}
              className="bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white px-6 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer shadow-md shadow-[#F26522]/10"
            >
              {submitLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Preference Roster...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Submit & Proceed to Payment</span>
                </>
              )}
            </button>
          </div>

          {formDetails?.centers?.length < 3 && (
            <p className="text-[10px] text-red-500 font-mono text-right mt-1">
              * Allocation requires at least 3 centers configured. Please contact administration.
            </p>
          )}

        </form>
      )}
    </div>
  );
}
