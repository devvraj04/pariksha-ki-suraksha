"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, ArrowRight, Save, Plus, Trash2, MapPin, 
  Loader2, CheckCircle2, ShieldAlert, Sparkles, Building, Video
} from "lucide-react";
import { agencyApi } from "@/lib/api";

interface Center {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  center_code: string;
  center_officer_id: string;
  rooms: {
    room_code: string;
    seating_capacity: number;
    camera_stream_url: string;
  }[];
}

export default function NewExamWizard() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [step, setStep] = useState(1);
  const [examId, setExamId] = useState<string | null>(null);
  const [createdExamSlug, setCreatedExamSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);

  // Step 1: Basic Info State
  const [name, setName] = useState("");
  const [examSlug, setExamSlug] = useState("");
  const [mode, setMode] = useState("OFFLINE"); // OFFLINE or ONLINE
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(180);
  const [fee, setFee] = useState(500);
  const [totalSeats, setTotalSeats] = useState(1000);

  // Step 2: Eligibility Criteria State
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(35);
  const [qualification, setQualification] = useState("Any Graduate");
  const [categories, setCategories] = useState<string[]>(["General", "OBC", "SC", "ST"]);

  // Step 3: Syllabus State
  const [syllabus, setSyllabus] = useState("");

  // Step 4: Centers & Rooms State
  const [centers, setCenters] = useState<Center[]>([]);
  const [currentCenter, setCurrentCenter] = useState<Center>({
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: 28.6139,
    longitude: 77.2090,
    geofence_radius_meters: 100,
    center_code: "",
    center_officer_id: "",
    rooms: []
  });

  const [currentRoomCode, setCurrentRoomCode] = useState("");
  const [currentRoomCapacity, setCurrentRoomCapacity] = useState(30);
  const [currentRoomCamera, setCurrentRoomCamera] = useState("");

  // Step 5: Brochure polling state
  const [brochureJobId, setBrochureJobId] = useState<string | null>(null);
  const [brochureStatus, setBrochureStatus] = useState("PENDING");

  // Fetch staff for Center Officer assignment
  useEffect(() => {
    async function loadStaff() {
      try {
        const staffList = await agencyApi.getStaff();
        // Filter for center officers or all staff
        const officers = staffList.filter((s: any) => s.role === "center_officer" || s.role === "operator" || s.role === "manager");
        setStaff(officers);
      } catch (err) {
        console.error("Failed to load staff for center selection:", err);
      }
    }
    loadStaff();
  }, []);

  const handleCreateExam = async () => {
    setLoading(true);
    setError(null);
    try {
      const eligibility = {
        min_age: minAge,
        max_age: maxAge,
        qualification,
        allowed_categories: categories
      };
      
      const examData = {
        name,
        slug: examSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        mode,
        exam_date: examDate,
        start_time: startTime.includes(":") && startTime.split(":").length === 2 ? `${startTime}:00` : startTime,
        duration_minutes: Number(duration),
        fee_inr: Number(fee),
        total_seats: Number(totalSeats),
        eligibility_criteria: eligibility,
        syllabus,
        visibility_score_threshold: 8.0
      };

      const res = await agencyApi.createExam(examData);
      setExamId(res.id);
      setCreatedExamSlug(res.slug);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to create exam record.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEligibility = async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const eligibility = {
        min_age: minAge,
        max_age: maxAge,
        qualification,
        allowed_categories: categories
      };
      await agencyApi.updateExam(examId, { eligibility_criteria: eligibility });
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to update eligibility criteria.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSyllabus = async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      await agencyApi.updateExam(examId, { syllabus });
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Failed to update syllabus.");
    } finally {
      setLoading(false);
    }
  };

  const addRoomToCurrentCenter = () => {
    if (!currentRoomCode) {
      alert("Room code is required.");
      return;
    }
    setCurrentCenter({
      ...currentCenter,
      rooms: [
        ...currentCenter.rooms,
        {
          room_code: currentRoomCode,
          seating_capacity: Number(currentRoomCapacity),
          camera_stream_url: currentRoomCamera
        }
      ]
    });
    setCurrentRoomCode("");
    setCurrentRoomCapacity(30);
    setCurrentRoomCamera("");
  };

  const saveCenterToExam = async () => {
    if (!examId) return;
    if (!currentCenter.name || !currentCenter.center_code) {
      setError("Center Name and Center Code are required.");
      return;
    }
    if (currentCenter.rooms.length === 0) {
      setError("Please add at least one room to this center.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Add center
      const centerBody = {
        name: currentCenter.name,
        address: currentCenter.address,
        city: currentCenter.city,
        state: currentCenter.state,
        pincode: currentCenter.pincode,
        latitude: Number(currentCenter.latitude),
        longitude: Number(currentCenter.longitude),
        geofence_radius_meters: Number(currentCenter.geofence_radius_meters),
        center_code: currentCenter.center_code,
        center_officer_id: currentCenter.center_officer_id || null
      };
      
      const newCenter = await agencyApi.addCenter(examId, centerBody);

      // 2. Add rooms
      for (const room of currentCenter.rooms) {
        await agencyApi.addRoom(newCenter.id, room);
      }

      // 3. Update local state list
      setCenters([...centers, { ...currentCenter }]);
      
      // Reset center inputs
      setCurrentCenter({
        name: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        latitude: 28.6139,
        longitude: 77.2090,
        geofence_radius_meters: 100,
        center_code: "",
        center_officer_id: "",
        rooms: []
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to save exam center details.");
    } finally {
      setLoading(false);
    }
  };

  const finishCentersStep = () => {
    if (centers.length === 0) {
      setError("Please add at least one center with rooms to proceed.");
      return;
    }
    setStep(5);
    triggerBrochureGen();
  };

  const triggerBrochureGen = async () => {
    if (!examId) return;
    try {
      const res = await agencyApi.regenerateBrochure(examId);
      if (res.job_id) {
        setBrochureJobId(res.job_id);
        pollBrochureStatus(res.job_id);
      }
    } catch (err) {
      console.error("Brochure trigger failed:", err);
    }
  };

  const pollBrochureStatus = (jobId: string) => {
    if (!examId) return;
    const interval = setInterval(async () => {
      try {
        const res = await agencyApi.getBrochureStatus(examId, jobId);
        if (res.status === "SUCCESS") {
          setBrochureStatus("SUCCESS");
          clearInterval(interval);
        } else if (res.status === "FAILURE" || res.status === "REVOKED") {
          setBrochureStatus("FAILED");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Brochure status check failed:", err);
      }
    }, 2000);
  };

  const totalAddedSeats = centers.reduce(
    (sum, c) => sum + c.rooms.reduce((rSum, r) => rSum + r.seating_capacity, 0),
    0
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href={`/agency/${slug}/exams`}
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-gray-900 uppercase flex items-center space-x-2">
            <span>Create Examination Definition</span>
          </h1>
          <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mt-0.5">
            Phase 3 Stepper Wizard / Exam ID: {examId || "DRAFT_INIT"}
          </p>
        </div>
      </div>

      {/* Stepper HUD */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-5 text-center text-[10px] font-mono uppercase tracking-widest text-gray-400">
        <div className={`py-1 border-r border-gray-100 ${step === 1 ? "text-[#F26522] font-bold" : step > 1 ? "text-green-600 font-bold" : ""}`}>
          1. Basic Info {step > 1 && "✓"}
        </div>
        <div className={`py-1 border-r border-gray-100 ${step === 2 ? "text-[#F26522] font-bold" : step > 2 ? "text-green-600 font-bold" : ""}`}>
          2. Eligibility {step > 2 && "✓"}
        </div>
        <div className={`py-1 border-r border-gray-100 ${step === 3 ? "text-[#F26522] font-bold" : step > 3 ? "text-green-600 font-bold" : ""}`}>
          3. Syllabus {step > 3 && "✓"}
        </div>
        <div className={`py-1 border-r border-gray-100 ${step === 4 ? "text-[#F26522] font-bold" : step > 4 ? "text-green-600 font-bold" : ""}`}>
          4. Centers & Rooms {step > 4 && "✓"}
        </div>
        <div className={`py-1 ${step === 5 ? "text-[#F26522] font-bold" : ""}`}>
          5. Review
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600 flex items-center space-x-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: BASIC INFO */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
            Step 1 // Examination Specifications
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Exam Name</label>
              <input
                type="text"
                required
                placeholder="e.g. National Merit Entrance Exam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Unique Slug Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. nmee-2026"
                value={examSlug}
                onChange={(e) => setExamSlug(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Conduct Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
              >
                <option value="OFFLINE">OFFLINE (PEN & PAPER)</option>
                <option value="ONLINE">ONLINE (COMPUTER-BASED TEST)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Total Allocated Seat Ceiling</label>
              <input
                type="number"
                value={totalSeats}
                onChange={(e) => setTotalSeats(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Exam Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Start Time (HH:MM)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Registration Fee (INR)</label>
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleCreateExam}
              disabled={loading || !name || !examDate || !startTime}
              className="inline-flex items-center space-x-2 bg-[#F26522] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validating Specs...</span>
                </>
              ) : (
                <>
                  <span>Create Exam & Next</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ELIGIBILITY */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
            Step 2 // Candidate Eligibility Parameters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Minimum Age Threshold</label>
              <input
                type="number"
                value={minAge}
                onChange={(e) => setMinAge(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Maximum Age Threshold</label>
              <input
                type="number"
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Minimum Educational Qualification</label>
              <select
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
              >
                <option value="Any Qualification">Any / No Minimum</option>
                <option value="10th Pass">Secondary (10th Standard)</option>
                <option value="12th Pass">Higher Secondary (12th Standard)</option>
                <option value="Any Graduate">Undergraduate Degree (Bachelor's)</option>
                <option value="Postgraduate">Postgraduate Degree (Master's)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Seat Reservation Categories</label>
              <div className="flex flex-wrap gap-3 mt-2">
                {["General", "OBC", "SC", "ST", "EWS"].map((cat) => {
                  const isChecked = categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setCategories(categories.filter((c) => c !== cat));
                        } else {
                          setCategories([...categories, cat]);
                        }
                      }}
                      className={`px-3 py-1 rounded text-xs font-mono border transition-all ${
                        isChecked 
                          ? "bg-[#F26522]/10 text-[#F26522] border-[#F26522]/35 font-bold" 
                          : "bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all"
            >
              <span>Back</span>
            </button>
            <button
              onClick={handleUpdateEligibility}
              disabled={loading || categories.length === 0}
              className="inline-flex items-center space-x-2 bg-[#F26522] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save Eligibility & Next</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SYLLABUS */}
      {step === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
            Step 3 // Curriculum & Syllabus Outline
          </h2>
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Syllabus rich text content / topics list</label>
            <textarea
              rows={8}
              placeholder="Provide a detailed list of sections, marks distribution, and syllabus topics..."
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono resize-none"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all"
            >
              <span>Back</span>
            </button>
            <button
              onClick={handleUpdateSyllabus}
              disabled={loading || !syllabus.trim()}
              className="inline-flex items-center space-x-2 bg-[#F26522] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save Syllabus & Next</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CENTERS & ROOMS */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Main setup container */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <h2 className="text-sm font-mono uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2 flex justify-between items-center">
              <span>Step 4 // Map Centers & Room Inventories</span>
              <span className="text-xs text-[#F26522]">Seats Configured: {totalAddedSeats} / {totalSeats}</span>
            </h2>

            {/* List of already saved centers */}
            {centers.length > 0 && (
              <div className="space-y-3">
                <span className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                  Added Examination Centers ({centers.length})
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {centers.map((c, cIdx) => (
                    <div key={cIdx} className="bg-gray-50 border border-gray-100 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold font-mono text-gray-900 uppercase">{c.name}</span>
                        <span className="bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                          Code: {c.center_code}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{c.address}, {c.city}</p>
                      <div className="flex justify-between text-[10px] font-mono text-gray-400 border-t border-gray-200/60 pt-2 mt-1">
                        <span>Rooms: {c.rooms.length}</span>
                        <span className="text-gray-700 font-semibold">Total Seats: {c.rooms.reduce((s, r) => s + r.seating_capacity, 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form to configure next center */}
            <div className="border border-gray-200 p-5 bg-gray-50/50 rounded-xl space-y-4">
              <div className="text-xs font-bold font-mono text-gray-900 uppercase flex items-center space-x-2">
                <Building className="h-4 w-4 text-[#F26522]" />
                <span>Configure New Test Center</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Center Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Model Engineering College Center"
                    value={currentCenter.name}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, name: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Center Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MEC-01"
                    value={currentCenter.center_code}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, center_code: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Address</label>
                  <input
                    type="text"
                    value={currentCenter.address}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, address: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">City</label>
                  <input
                    type="text"
                    value={currentCenter.city}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, city: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">State</label>
                  <input
                    type="text"
                    value={currentCenter.state}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, state: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={currentCenter.pincode}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, pincode: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Center Officer ID</label>
                  <select
                    value={currentCenter.center_officer_id}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, center_officer_id: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  >
                    <option value="">-- Assign Staff --</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={currentCenter.latitude}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, latitude: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={currentCenter.longitude}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, longitude: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Geofence Radius (m)</label>
                  <input
                    type="number"
                    value={currentCenter.geofence_radius_meters}
                    onChange={(e) => setCurrentCenter({ ...currentCenter, geofence_radius_meters: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
              </div>

              {/* Nested Rooms config */}
              <div className="border-t border-gray-200/60 pt-4 space-y-3">
                <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                  Test Rooms configuration
                </span>

                {currentCenter.rooms.length > 0 && (
                  <div className="bg-gray-100/50 border border-gray-200 p-3 rounded-lg space-y-1">
                    {currentCenter.rooms.map((r, rIdx) => (
                      <div key={rIdx} className="flex justify-between items-center text-xs font-mono text-gray-600">
                        <span>Room Code: <span className="text-gray-900 font-semibold">{r.room_code}</span></span>
                        <span>Capacity: <span className="text-[#F26522] font-bold">{r.seating_capacity} seats</span></span>
                        {r.camera_stream_url && <span className="text-gray-400 truncate max-w-[200px]">{r.camera_stream_url}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-gray-100/30 border border-gray-100 p-3 rounded-lg">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5">Room Code / Number</label>
                    <input
                      type="text"
                      placeholder="e.g. Lab-A, Room 204"
                      value={currentRoomCode}
                      onChange={(e) => setCurrentRoomCode(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5">Capacity</label>
                    <input
                      type="number"
                      value={currentRoomCapacity}
                      onChange={(e) => setCurrentRoomCapacity(Number(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={addRoomToCurrentCenter}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-full text-xs font-mono uppercase transition-all"
                    >
                      [Add Room]
                    </button>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5">CCTV Camera Stream Endpoint URL (RTSP/WebRTC)</label>
                    <input
                      type="text"
                      placeholder="e.g. rtsp://cctv.center.net/stream1"
                      value={currentRoomCamera}
                      onChange={(e) => setCurrentRoomCamera(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Save current center button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={saveCenterToExam}
                  disabled={loading}
                  className="bg-gray-900 hover:bg-gray-800 text-[#F26522] hover:text-[#e05a1a] border border-gray-200 px-4 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all inline-flex items-center space-x-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Writing DB...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>[Save & Register Center]</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all"
            >
              <span>Back</span>
            </button>
            <button
              onClick={finishCentersStep}
              disabled={centers.length === 0}
              className="inline-flex items-center space-x-2 bg-[#F26522] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all shadow-sm"
            >
              <span>Save & Continue to Review</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW */}
      {step === 5 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
            Step 5 // Specifications Review & Draft Confirmation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Exam Name</span>
                <span className="text-gray-900 block font-bold uppercase">{name}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Conduct Mode</span>
                <span className="text-gray-900 block font-semibold">{mode}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Syllabus Length</span>
                <span className="text-gray-900 block font-mono">{syllabus.length} characters</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Registration Fee</span>
                <span className="text-gray-900 block font-mono font-semibold">{fee} INR</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Target Schedule</span>
                <span className="text-gray-900 block font-mono">{examDate} at {startTime}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Configured Centers</span>
                <span className="text-gray-900 block font-mono">{centers.length} Centers ({totalAddedSeats} / {totalSeats} seats)</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-gray-500 uppercase">Eligibility Range</span>
                <span className="text-gray-900 block font-mono">Age: {minAge}-{maxAge} / Qual: {qualification}</span>
              </div>
              
              {/* Brochure status display */}
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg space-y-1">
                <span className="block text-[9px] font-mono text-gray-600 uppercase tracking-widest flex items-center space-x-1">
                  <Sparkles className="h-3 w-3 text-[#F26522] animate-pulse" />
                  <span>AI Brochure Compilation</span>
                </span>
                <div className="text-xs font-mono">
                  {brochureStatus === "SUCCESS" ? (
                    <span className="text-green-600 flex items-center space-x-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span>Brochure generated & signed</span>
                    </span>
                  ) : brochureStatus === "FAILED" ? (
                    <span className="text-red-600">Generation failed. Can regenerate from console.</span>
                  ) : (
                    <span className="text-gray-500 flex items-center space-x-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F26522]" />
                      <span>Compiling PDF document in background...</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-mono uppercase transition-all"
            >
              <span>Back to Centers</span>
            </button>
            <button
              onClick={() => router.push(`/agency/${slug}/exams/${createdExamSlug || examSlug}`)}
              className="inline-flex items-center space-x-2 bg-[#F26522] text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all shadow-sm shadow-[#F26522]/10"
            >
              <span>Go to Exam Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
