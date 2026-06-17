"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Calendar, Clock, MapPin, Users, HelpCircle, Shield,
  Sparkles, CheckCircle2, AlertTriangle, Play, FileText, ArrowRight,
  UserCheck, Download, Plus, Trash2, Loader2, Eye, Lock, Printer,
  Truck, ScanLine, Upload, RefreshCw, Zap, AlertOctagon, KeyRound
} from "lucide-react";
import { agencyApi } from "@/lib/api";

type TabType = "overview" | "centers" | "allocation" | "admit-cards" | "vault" | "printing" | "transit" | "answer-sheets" | "evaluation" | "results" | "grievances";

export default function ExamWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const examSlug = params.examSlug as string;

  const [exam, setExam] = useState<any>(null);
  const examId = exam?.id || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Allocation State
  const [allocating, setAllocating] = useState(false);
  const [allocJobId, setAllocJobId] = useState<string | null>(null);
  const [allocStatus, setAllocStatus] = useState<any>(null);
  const [allocations, setAllocations] = useState<any[]>([]);

  // Vault State
  const [vaultSession, setVaultSession] = useState<{token: string; expiresAt: number} | null>(null);
  const [vaultPapers, setVaultPapers] = useState<any[]>([]);
  const [vaultAccessLog, setVaultAccessLog] = useState<any[]>([]);
  const [uploadingPaper, setUploadingPaper] = useState(false);
  const vaultFileRef = useRef<HTMLInputElement>(null);

  // Printing State
  const [printJobs, setPrintJobs] = useState<any[]>([]);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [printCenterId, setPrintCenterId] = useState("");
  const [printCopies, setPrintCopies] = useState(0);
  const [printPrinterId, setPrintPrinterId] = useState("");
  const [selectedPrintJob, setSelectedPrintJob] = useState<any>(null);

  // Transit State
  const [trunks, setTrunks] = useState<any[]>([]);
  const [loadingTrunks, setLoadingTrunks] = useState(false);
  const [trunkUnlockId, setTrunkUnlockId] = useState("");
  const [trunkOtp, setTrunkOtp] = useState("");
  const [trunkOtpSent, setTrunkOtpSent] = useState(false);

  // Answer Sheets State
  const [answerSheets, setAnswerSheets] = useState<any[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const answerSheetFileRef = useRef<HTMLInputElement>(null);
  const [asStudentId, setAsStudentId] = useState("");
  const [asCenterId, setAsCenterId] = useState("");
  const answerKeyFileRef = useRef<HTMLInputElement>(null);
  const [uploadingKey, setUploadingKey] = useState(false);

  // Evaluation State
  const [evalAssignments, setEvalAssignments] = useState<any[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalAnonymizing, setEvalAnonymizing] = useState(false);
  const [evalStats, setEvalStats] = useState<{total_sheets: number; batches_ready: number} | null>(null);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [showCreateAssignmentForm, setShowCreateAssignmentForm] = useState(false);
  const [assignEvaluatorId, setAssignEvaluatorId] = useState("");
  const [assignRole, setAssignRole] = useState("grading_teacher");
  const [assignUploadIds, setAssignUploadIds] = useState<string[]>([]);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [answerKeyStatus, setAnswerKeyStatus] = useState<string | null>(null);

  // Results State
  const [resultReadiness, setResultReadiness] = useState<any>(null);
  const [compilingResults, setCompilingResults] = useState(false);
  const [resultsPreview, setResultsPreview] = useState<any>(null);
  const [publishingResults, setPublishingResults] = useState(false);

  // Grievances State
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loadingGrievances, setLoadingGrievances] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState<any>(null);
  const [loadingGrievanceDetail, setLoadingGrievanceDetail] = useState(false);
  const [resolvingGrievance, setResolvingGrievance] = useState(false);
  const [grievanceResNotes, setGrievanceResNotes] = useState("");
  const [grievanceAssignee, setGrievanceAssignee] = useState("");

  const fetchAnswerKeyStatus = async () => {
    if (!examId) return;
    try {
      const papers = await agencyApi.getPaperStatus(examId).catch(() => []);
      const keyPaper = papers.find((p: any) => p.paper_version === -1);
      if (keyPaper) {
        setAnswerKeyStatus(keyPaper.status);
      } else {
        setAnswerKeyStatus(null);
      }
    } catch (err) {
      console.error("Failed to load answer key status:", err);
    }
  };

  const fetchEvalData = async () => {
    if (!examId) return;
    setLoadingEval(true);
    try {
      const assignments = await agencyApi.getExamEvaluatorAssignments(examId).catch(() => []);
      setEvalAssignments(assignments);
      const sheets = await agencyApi.getAnswerSheets(examId).catch(() => []);
      setAnswerSheets(sheets);
    } catch (err) {
      console.error(err);
    }
    setLoadingEval(false);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEvaluatorId || assignUploadIds.length === 0) {
      alert("Please select an evaluator and at least one answer sheet.");
      return;
    }
    setCreatingAssignment(true);
    try {
      const body = {
        evaluator_id: assignEvaluatorId,
        role: assignRole,
        upload_ids: assignUploadIds,
      };
      await agencyApi.createEvaluationAssignment(examId, body);
      alert("Evaluation assignment created successfully.");
      setAssignEvaluatorId("");
      setAssignUploadIds([]);
      setShowCreateAssignmentForm(false);
      await fetchEvalData();
    } catch (err: any) {
      alert(err.message || "Failed to create assignment.");
    } finally {
      setCreatingAssignment(false);
    }
  };

  const fetchResultsData = async () => {
    if (!examId) return;
    try {
      const read = await agencyApi.getPublicationReadiness(examId).catch(() => null);
      setResultReadiness(read);
      const prev = await agencyApi.getResultsPreview(examId).catch(() => null);
      setResultsPreview(prev);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGrievancesData = async () => {
    if (!examId) return;
    setLoadingGrievances(true);
    try {
      const data = await agencyApi.getAgencyGrievances(examId);
      setGrievances(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGrievances(false);
    }
  };

  useEffect(() => {
    if (activeTab === "evaluation") {
      fetchEvalData();
    } else if (activeTab === "results") {
      fetchResultsData();
    } else if (activeTab === "grievances" as any) {
      fetchGrievancesData();
    } else if (activeTab === "answer-sheets") {
      // Load answer sheets automatically when switching to the tab
      const loadSheets = async () => {
        setLoadingSheets(true);
        const sheets = await agencyApi.getAnswerSheets(examId).catch(() => []);
        setAnswerSheets(sheets);
        setLoadingSheets(false);
      };
      loadSheets();
      fetchAnswerKeyStatus();
    }
  }, [activeTab, examId]);

  // Admit Cards State
  const [generatingAC, setGeneratingAC] = useState(false);
  const [acJobId, setAcJobId] = useState<string | null>(null);
  const [acStatus, setAcStatus] = useState<any>(null);

  // Center & Room Management State
  const [staff, setStaff] = useState<any[]>([]);
  const [showAddCenterForm, setShowAddCenterForm] = useState(false);
  const [centerName, setCenterName] = useState("");
  const [centerCode, setCenterCode] = useState("");
  const [centerAddress, setCenterAddress] = useState("");
  const [centerCity, setCenterCity] = useState("");
  const [centerState, setCenterState] = useState("");
  const [centerPincode, setCenterPincode] = useState("");
  const [centerLat, setCenterLat] = useState(28.6139);
  const [centerLon, setCenterLon] = useState(77.2090);
  const [centerGeofence, setCenterGeofence] = useState(100);
  const [centerOfficerId, setCenterOfficerId] = useState("");
  const [centerRooms, setCenterRooms] = useState<any[]>([]);
  
  // Temp states for center rooms creation
  const [roomCode, setRoomCode] = useState("");
  const [roomCapacity, setRoomCapacity] = useState(30);
  const [roomCamera, setRoomCamera] = useState("");

  // Add room to existing center state
  const [activeAddRoomCenterId, setActiveAddRoomCenterId] = useState<string | null>(null);
  const [existingCenterRoomCode, setExistingCenterRoomCode] = useState("");
  const [existingCenterRoomCapacity, setExistingCenterRoomCapacity] = useState(30);
  const [existingCenterRoomCamera, setExistingCenterRoomCamera] = useState("");

  // Load staff for Center Officer selection
  useEffect(() => {
    async function loadStaff() {
      try {
        const staffList = await agencyApi.getStaff();
        setAllStaff(staffList);
        const officers = staffList.filter((s: any) => s.role === "center_officer" || s.role === "operator" || s.role === "manager");
        setStaff(officers);
      } catch (err) {
        console.error("Failed to load staff list:", err);
      }
    }
    loadStaff();
  }, []);

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerName || !centerCode) {
      alert("Center Name and Center Code are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const centerBody = {
        name: centerName,
        address: centerAddress,
        city: centerCity,
        state: centerState,
        pincode: centerPincode,
        latitude: Number(centerLat),
        longitude: Number(centerLon),
        geofence_radius_meters: Number(centerGeofence),
        center_code: centerCode,
        center_officer_id: centerOfficerId || null
      };
      
      const newCenter = await agencyApi.addCenter(examId, centerBody);

      // Add rooms to the new center
      for (const room of centerRooms) {
        await agencyApi.addRoom(newCenter.id, room);
      }

      // Reload exam details
      await loadExamDetails();
      
      // Reset form
      setCenterName("");
      setCenterCode("");
      setCenterAddress("");
      setCenterCity("");
      setCenterState("");
      setCenterPincode("");
      setCenterLat(28.6139);
      setCenterLon(77.2090);
      setCenterGeofence(100);
      setCenterOfficerId("");
      setCenterRooms([]);
      setShowAddCenterForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to add center.");
    } finally {
      setLoading(false);
    }
  };

  const addRoomToTempCenter = () => {
    if (!roomCode) {
      alert("Room code is required.");
      return;
    }
    setCenterRooms([
      ...centerRooms,
      {
        room_code: roomCode,
        seating_capacity: Number(roomCapacity),
        camera_stream_url: roomCamera || null
      }
    ]);
    setRoomCode("");
    setRoomCapacity(30);
    setRoomCamera("");
  };

  const handleAddRoomToExistingCenter = async (centerId: string) => {
    if (!existingCenterRoomCode) {
      alert("Room code is required.");
      return;
    }
    setLoading(true);
    try {
      await agencyApi.addRoom(centerId, {
        room_code: existingCenterRoomCode,
        seating_capacity: Number(existingCenterRoomCapacity),
        camera_stream_url: existingCenterRoomCamera || null
      });
      await loadExamDetails();
      setActiveAddRoomCenterId(null);
      setExistingCenterRoomCode("");
      setExistingCenterRoomCapacity(30);
      setExistingCenterRoomCamera("");
    } catch (err: any) {
      setError(err.message || "Failed to add room.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCenter = async (centerId: string) => {
    if (!confirm("Are you sure you want to delete this test center? This will cascade delete all rooms.")) return;
    setLoading(true);
    try {
      await agencyApi.deleteCenter(examId, centerId);
      await loadExamDetails();
    } catch (err: any) {
      setError(err.message || "Failed to delete center.");
      setLoading(false);
    }
  };

  // Load exam data
  const loadExamDetails = async () => {
    try {
      const data = await agencyApi.getExamBySlug(examSlug);
      setExam(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load examination details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examSlug) {
      loadExamDetails();
    }
  }, [examSlug]);

  // Load allocations if activeTab is "allocation"
  useEffect(() => {
    if (activeTab === "allocation" && exam?.status === "REGISTRATION_CLOSED") {
      async function fetchAllocations() {
        try {
          const list = await agencyApi.getAllocations(examId);
          setAllocations(list);
        } catch (err) {
          console.error("Failed to load allocations:", err);
        }
      }
      fetchAllocations();
    }
  }, [activeTab, exam]);

  const handlePublish = async () => {
    setLoading(true);
    try {
      await agencyApi.publishExam(examId);
      await loadExamDetails();
    } catch (err: any) {
      setError(err.message || "Failed to publish exam.");
      setLoading(false);
    }
  };

  const handleOpenRegistration = async () => {
    setLoading(true);
    try {
      await agencyApi.openRegistration(examId);
      await loadExamDetails();
    } catch (err: any) {
      setError(err.message || "Failed to open registration.");
      setLoading(false);
    }
  };

  const handleCloseRegistration = async () => {
    setLoading(true);
    try {
      await agencyApi.closeRegistration(examId);
      await loadExamDetails();
    } catch (err: any) {
      setError(err.message || "Failed to close registration.");
      setLoading(false);
    }
  };

  const runCenterAllocation = async () => {
    setAllocating(true);
    setError(null);
    try {
      const res = await agencyApi.allocateCenters(examId);
      if (res.job_id) {
        setAllocJobId(res.job_id);
        pollAllocation(res.job_id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate center allocation.");
      setAllocating(false);
    }
  };

  const pollAllocation = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await agencyApi.getAllocationStatus(examId, jobId);
        setAllocStatus(res);
        if (res.status === "SUCCESS") {
          setAllocating(false);
          clearInterval(interval);
          // Reload exam & allocations list
          loadExamDetails();
          const list = await agencyApi.getAllocations(examId);
          setAllocations(list);
        } else if (res.status === "FAILURE") {
          setAllocating(false);
          setError("Allocation task failed to execute.");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error polling allocation status:", err);
      }
    }, 2000);
  };

  const runAdmitCardGeneration = async () => {
    setGeneratingAC(true);
    setError(null);
    try {
      const res = await agencyApi.generateAdmitCards(examId);
      if (res.job_id) {
        setAcJobId(res.job_id);
        pollAdmitCards(res.job_id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate admit card generation.");
      setGeneratingAC(false);
    }
  };

  const pollAdmitCards = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await agencyApi.getAdmitCardsStatus(examId, jobId);
        setAcStatus(res);
        if (res.status === "SUCCESS") {
          setGeneratingAC(false);
          clearInterval(interval);
          loadExamDetails();
        } else if (res.status === "FAILURE") {
          setGeneratingAC(false);
          setError("Admit card generation task failed.");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error polling admit card status:", err);
      }
    }, 2000);
  };

  if (loading && !exam) {
    return (
      <div className="flex flex-col justify-center items-center h-64 font-mono text-gray-500 text-xs uppercase space-y-4">
        <Loader2 className="h-6 w-6 animate-spin text-[#F26522]" />
        <span>Syncing workspace core...</span>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600">
        {error}
      </div>
    );
  }

  const getLifecycleButton = () => {
    const status = exam.status.toUpperCase();
    
    switch (status) {
      case "DRAFT":
        return (
          <button
            onClick={handlePublish}
            className="inline-flex items-center space-x-1.5 bg-[#F26522] hover:bg-[#e05a1a] text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm"
          >
            <Play className="h-4 w-4" />
            <span>[Publish Exam Specs]</span>
          </button>
        );
      case "PUBLISHED":
        return (
          <button
            onClick={handleOpenRegistration}
            className="inline-flex items-center space-x-1.5 bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm"
          >
            <UserCheck className="h-4 w-4" />
            <span>[Open Registration Roster]</span>
          </button>
        );
      case "REGISTRATION_OPEN":
        return (
          <button
            onClick={handleCloseRegistration}
            className="inline-flex items-center space-x-1.5 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm"
          >
            <Shield className="h-4 w-4" />
            <span>[Force Close Registration]</span>
          </button>
        );
      default:
        return (
          <span className="bg-gray-900 text-white text-[10px] font-mono px-3.5 py-2 rounded-full font-bold uppercase">
            Lifecycle: {exam.status.replace("_", " ")}
          </span>
        );
    }
  };

  const getStatusClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "DRAFT": return "text-gray-500 bg-gray-100 border-gray-200";
      case "PUBLISHED": return "text-blue-600 bg-blue-50 border-blue-200";
      case "REGISTRATION_OPEN": return "text-green-700 bg-green-50 border-green-200";
      case "REGISTRATION_CLOSED": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "ADMIT_CARDS_ISSUED": return "text-teal-700 bg-teal-50 border-teal-200";
      case "ONGOING": return "text-[#F26522] bg-[#F26522]/10 border-[#F26522]/20";
      default: return "text-gray-500 bg-gray-100 border-gray-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Sticky Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href={`/agency/${slug}/exams`}
            className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-all shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-mono text-gray-900 uppercase flex items-center space-x-2">
              <span>{exam.name}</span>
              <span className={`inline-block border text-[9px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${getStatusClass(exam.status)}`}>
                {exam.status.replace("_", " ")}
              </span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mt-0.5">
              Scheduled Date: {exam.exam_date} // Format: {exam.mode}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          {getLifecycleButton()}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600">
          {error}
        </div>
      )}

      {/* Tabs list */}
      <div className="flex border-b border-gray-200 overflow-x-auto space-x-6 pb-px font-mono text-xs uppercase tracking-wider">
        {[
          { key: "overview", label: "Overview", disabled: false },
          { key: "centers", label: "Centers & Rooms", disabled: false },
          { key: "allocation", label: "Center Allocation", disabled: exam.status === "DRAFT" || exam.status === "PUBLISHED" },
          { key: "admit-cards", label: "Admit Cards", disabled: exam.status === "DRAFT" || exam.status === "PUBLISHED" },
          { key: "vault", label: "🔒 Question Vault", disabled: false },
          { key: "printing", label: "🖨 Print Module", disabled: exam.mode !== "OFFLINE" },
          { key: "transit", label: "🚚 Chain-of-Custody", disabled: exam.mode !== "OFFLINE" },
          { key: "answer-sheets", label: "📋 Answer Sheets", disabled: false },
          { key: "evaluation", label: "🛡 Evaluation", disabled: exam.status === "DRAFT" || exam.status === "PUBLISHED" || exam.status === "REGISTRATION_OPEN" },
          { key: "results", label: "🏆 Results", disabled: exam.status === "DRAFT" || exam.status === "PUBLISHED" || exam.status === "REGISTRATION_OPEN" },
          { key: "grievances", label: "⚖ Grievances", disabled: false },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && setActiveTab(tab.key as TabType)}
            disabled={tab.disabled}
            className={`pb-3 border-b-2 font-bold px-1 transition-all whitespace-nowrap ${
              tab.disabled 
                ? "text-gray-300 border-transparent cursor-not-allowed opacity-50"
                : activeTab === tab.key
                  ? "text-[#F26522] border-[#F26522] font-bold"
                  : "text-gray-500 border-transparent hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 border-b border-gray-100 pb-2">
                Exam Details Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="block text-[10px] font-mono text-gray-400 uppercase">Registration Fee</span>
                  <span className="text-gray-900 block font-mono font-semibold">{exam.fee_inr} INR</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-gray-400 uppercase">Duration</span>
                  <span className="text-gray-900 block font-mono">{exam.duration_minutes} Minutes</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-gray-400 uppercase">Total Seats</span>
                  <span className="text-gray-900 block font-mono">{exam.total_seats} Seats</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono text-gray-400 uppercase">Eligibility Qualification</span>
                  <span className="text-gray-900 block font-mono">{exam.eligibility_criteria?.qualification || "Any Graduate"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 border-b border-gray-100 pb-2">
                Syllabus Outline
              </h3>
              <p className="text-xs text-gray-700 font-mono whitespace-pre-wrap bg-gray-50 border border-gray-100 p-4 rounded-xl">
                {exam.syllabus || "No syllabus outline provided."}
              </p>
            </div>
          </div>

          {/* Brochure column */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 border-b border-gray-100 pb-2">
                Information Brochure
              </h3>
              {exam.brochure_pdf_path ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs font-mono text-green-700 flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Brochure compiled & active</span>
                  </div>
                  {exam.brochure_signed_url && (
                    <a
                      href={exam.brochure_signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-[#F26522] px-4 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all"
                    >
                      <Download className="h-4 w-4 text-[#F26522]" />
                      <span>[Download PDF]</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs font-mono text-yellow-700 flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span>Brochure generation pending</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CENTERS TAB */}
      {activeTab === "centers" && (
        <div className="space-y-6">
          {/* Header + Add Center Toggle */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900">
              Exam Center Registries ({exam.centers?.length || 0})
            </h3>
            <button
              onClick={() => setShowAddCenterForm(!showAddCenterForm)}
              className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm ${
                showAddCenterForm
                  ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  : "bg-[#F26522] text-white hover:bg-[#e05a1a]"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAddCenterForm ? "[Cancel]" : "[Add Center]"}</span>
            </button>
          </div>

          {/* Add Center Form */}
          {showAddCenterForm && (
            <form
              onSubmit={handleSaveCenter}
              className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5"
            >
              <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-[#F26522] border-b border-gray-100 pb-2">
                New Exam Center Details
              </h4>

              {/* Center Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Center Name *</label>
                  <input
                    type="text"
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                    placeholder="e.g. Delhi North Centre"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Center Code *</label>
                  <input
                    type="text"
                    value={centerCode}
                    onChange={(e) => setCenterCode(e.target.value)}
                    placeholder="e.g. DL-N-01"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Full Address</label>
                  <input
                    type="text"
                    value={centerAddress}
                    onChange={(e) => setCenterAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">City</label>
                  <input
                    type="text"
                    value={centerCity}
                    onChange={(e) => setCenterCity(e.target.value)}
                    placeholder="City"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">State</label>
                  <input
                    type="text"
                    value={centerState}
                    onChange={(e) => setCenterState(e.target.value)}
                    placeholder="State"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={centerPincode}
                    onChange={(e) => setCenterPincode(e.target.value)}
                    placeholder="110001"
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Geofence Radius (m)</label>
                  <input
                    type="number"
                    value={centerGeofence}
                    onChange={(e) => setCenterGeofence(Number(e.target.value))}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={centerLat}
                    onChange={(e) => setCenterLat(Number(e.target.value))}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={centerLon}
                    onChange={(e) => setCenterLon(Number(e.target.value))}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Center Officer</label>
                  <select
                    value={centerOfficerId}
                    onChange={(e) => setCenterOfficerId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                  >
                    <option value="">-- Assign Staff --</option>
                    {staff.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nested Room Builder */}
              <div className="border-t border-gray-150 pt-4 space-y-3">
                <h5 className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">
                  Add Rooms to This Center
                </h5>
                {centerRooms.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {centerRooms.map((r: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded px-3 py-1.5 text-xs font-mono text-gray-700">
                        <span>Room <span className="text-[#F26522] font-bold">{r.room_code}</span></span>
                        <span className="text-gray-500 font-semibold">{r.seating_capacity} seats</span>
                        <button
                          type="button"
                          onClick={() => setCenterRooms(centerRooms.filter((_: any, i: number) => i !== idx))}
                          className="text-red-500 hover:text-red-400 ml-3"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Room Code *</label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      placeholder="e.g. A-101"
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Capacity *</label>
                    <input
                      type="number"
                      value={roomCapacity}
                      onChange={(e) => setRoomCapacity(Number(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addRoomToTempCenter}
                    className="inline-flex items-center justify-center space-x-1 bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Room</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center space-x-2 bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Save Center</span>
                </button>
              </div>
            </form>
          )}

          {/* Existing Center Cards */}
          {(!exam.centers || exam.centers.length === 0) && !showAddCenterForm && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">No centers registered yet.</p>
              <p className="text-[10px] font-mono text-gray-400 mt-1">Click [Add Center] to add your first exam centre.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exam.centers?.map((c: any) => (
              <div key={c.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                {/* Center Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold font-mono text-gray-900 uppercase">{c.name}</h4>
                    <span className="block text-[10px] text-gray-400 font-mono mt-0.5 uppercase">
                      Code: {c.center_code} // City: {c.city}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 text-[9px] font-mono px-2 py-0.5 rounded font-bold">
                      {c.total_capacity} SEATS
                    </span>
                    {exam.status === "DRAFT" && (
                      <button
                        onClick={() => handleDeleteCenter(c.id)}
                        title="Delete Center (DRAFT only)"
                        className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Center Info */}
                <div className="text-xs text-gray-500 space-y-1 font-mono">
                  <p>{c.address}, {c.city}, {c.state} – {c.pincode}</p>
                  <p>GPS: {c.latitude}, {c.longitude} (Geofence: {c.geofence_radius_meters}m)</p>
                </div>

                {/* Rooms List */}
                <div className="border-t border-gray-100 pt-3 mt-2 space-y-2">
                  <span className="block text-[9px] font-mono text-gray-400 uppercase tracking-wider">
                    Active Room Listings ({c.rooms?.length || 0})
                  </span>
                  <div className="space-y-1">
                    {c.rooms?.map((r: any) => (
                      <div key={r.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded px-3 py-1.5 text-xs font-mono text-gray-600">
                        <span>Room: <span className="text-gray-900 font-bold">{r.room_code}</span></span>
                        <span className="text-gray-500 font-semibold">{r.seating_capacity} seats</span>
                      </div>
                    ))}
                    {(!c.rooms || c.rooms.length === 0) && (
                      <p className="text-[10px] font-mono text-gray-400 italic">No rooms yet.</p>
                    )}
                  </div>

                  {/* Add Room to Existing Center Toggle */}
                  {activeAddRoomCenterId === c.id ? (
                    <div className="mt-3 bg-gray-50/50 border border-gray-200 rounded-xl p-3 space-y-3">
                      <p className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Add New Room</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Room Code</label>
                          <input
                            type="text"
                            value={existingCenterRoomCode}
                            onChange={(e) => setExistingCenterRoomCode(e.target.value)}
                            placeholder="e.g. B-202"
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Capacity</label>
                          <input
                            type="number"
                            value={existingCenterRoomCapacity}
                            onChange={(e) => setExistingCenterRoomCapacity(Number(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Camera Stream URL (optional)</label>
                          <input
                            type="text"
                            value={existingCenterRoomCamera}
                            onChange={(e) => setExistingCenterRoomCamera(e.target.value)}
                            placeholder="rtsp://..."
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setActiveAddRoomCenterId(null); setExistingCenterRoomCode(""); setExistingCenterRoomCapacity(30); setExistingCenterRoomCamera(""); }}
                          className="text-[10px] font-mono text-gray-400 hover:text-gray-600 uppercase px-2 py-1 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRoomToExistingCenter(c.id)}
                          disabled={loading}
                          className="inline-flex items-center space-x-1 bg-[#F26522] disabled:opacity-50 text-white px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase hover:bg-[#e05a1a] transition-all"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          <span>Save Room</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveAddRoomCenterId(c.id)}
                      className="mt-2 inline-flex items-center space-x-1.5 text-[10px] font-mono font-bold uppercase text-gray-500 hover:text-[#F26522] border border-gray-200 hover:border-[#F26522]/30 rounded-full px-3 py-1.5 transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      <span>[+ Add Room]</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CENTER ALLOCATION TAB */}
      {activeTab === "allocation" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 border-b border-gray-100 pb-2">
              Center Allocation Control
            </h3>

            {/* Closed Registration Check */}
            {exam.status === "REGISTRATION_CLOSED" ? (
              <div className="space-y-6">
                {allocations.length === 0 ? (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 font-mono uppercase">
                      Registration is closed. You can now execute the priority-weighted center allocation algorithm.
                    </p>
                    <button
                      onClick={runCenterAllocation}
                      disabled={allocating}
                      className="inline-flex items-center space-x-2 bg-[#F26522] disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all shadow-sm"
                    >
                      {allocating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                          <span>Allocating Seats (Polling Celery)...</span>
                        </>
                      ) : (
                        <>
                          <span>Run Center Allocation</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                    {allocStatus && (
                      <div className="text-xs font-mono text-gray-500 mt-2">
                        Task Status: {allocStatus.status}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-xs font-mono text-green-700 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span>Center allocations successfully compiled in DB. All seats allocated.</span>
                      </div>
                      <button
                        onClick={runAdmitCardGeneration}
                        disabled={generatingAC}
                        className="inline-flex items-center space-x-1.5 bg-[#F26522] text-white px-3.5 py-2 rounded-full text-xs font-mono font-bold uppercase hover:bg-[#e05a1a] transition-all shadow-sm"
                      >
                        {generatingAC ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                            <span>Issuing Cards...</span>
                          </>
                        ) : (
                          <>
                            <span>Generate & Issue Admit Cards</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Allocations Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                              <th className="px-6 py-4">Student Name</th>
                              <th className="px-6 py-4">Email Address</th>
                              <th className="px-6 py-4">Allocated Center</th>
                              <th className="px-6 py-4">Preference Matched</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-150 text-gray-700 text-xs font-mono">
                            {allocations.map((a) => (
                              <tr key={a.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                                <td className="px-6 py-4 font-bold text-gray-900 uppercase">{a.students?.full_name}</td>
                                <td className="px-6 py-4 text-gray-500">{a.students?.email}</td>
                                <td className="px-6 py-4 uppercase text-gray-600">{a.exam_centers?.name}</td>
                                <td className="px-6 py-4">
                                  {a.preference_rank_matched > 0 ? (
                                    <span className="text-green-600 font-bold">Choice {a.preference_rank_matched} ✓</span>
                                  ) : (
                                    <span className="text-[#F26522] font-bold">Fallback (Nearest)</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : exam.status === "REGISTRATION_OPEN" ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-xs font-mono text-yellow-700">
                Roster allocation is locked while registration is open.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-xs font-mono text-green-700 flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Seat allocation completed for this lifecycle window.</span>
                </div>
                {/* Allocations Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                          <th className="px-6 py-4">Student Name</th>
                          <th className="px-6 py-4">Email Address</th>
                          <th className="px-6 py-4">Allocated Center</th>
                          <th className="px-6 py-4">Preference Matched</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 text-gray-700 text-xs font-mono">
                        {allocations.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                            <td className="px-6 py-4 font-bold text-gray-900 uppercase">{a.students?.full_name}</td>
                            <td className="px-6 py-4 text-gray-500">{a.students?.email}</td>
                            <td className="px-6 py-4 uppercase text-gray-600">{a.exam_centers?.name}</td>
                            <td className="px-6 py-4">
                              {a.preference_rank_matched > 0 ? (
                                <span className="text-green-600 font-bold">Choice {a.preference_rank_matched} ✓</span>
                              ) : (
                                <span className="text-[#F26522] font-bold">Fallback (Nearest)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIT CARDS TAB */}
      {activeTab === "admit-cards" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 border-b border-gray-100 pb-2">
              Secured Admit Cards Roster
            </h3>
            {exam.status === "ADMIT_CARDS_ISSUED" ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-xs font-mono text-green-700 flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Admit cards have been generated, signed, and issued to candidate portals.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 font-mono uppercase">
                  Admit cards generation can be initiated from the "Center Allocation" tab once seating allocation finishes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VAULT TAB — Phase 6 */}
      {activeTab === "vault" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-3 gap-2">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2">
                <Lock className="h-4 w-4 text-[#F26522]" /><span>Secure Question Paper Vault (AES-256-GCM)</span>
              </h3>
              {!vaultSession ? (
                <button
                  onClick={async () => {
                    try {
                      const res = await agencyApi.startUploadSession(examId);
                      setVaultSession({ token: res.session_token, expiresAt: Date.now() + res.expires_in_seconds * 1000 });
                      const papers = await agencyApi.getPaperStatus(examId);
                      setVaultPapers(papers);
                    } catch (err: any) { alert(err.message); }
                  }}
                  className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm shrink-0"
                >
                  🔐 Start Monitored Session
                </button>
              ) : (
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-xs font-mono text-green-600 animate-pulse">● Session Active</span>
                  <button
                    onClick={async () => {
                      if (vaultSession) { await agencyApi.endUploadSession(vaultSession.token).catch(() => {}); }
                      setVaultSession(null);
                    }}
                    className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-full text-xs font-mono hover:bg-red-100 transition-all"
                  >
                    End Session
                  </button>
                </div>
              )}
            </div>

            {vaultSession && (
              <div className="bg-[#F26522]/5 border border-[#F26522]/20 p-4 rounded-xl space-y-3">
                <p className="text-xs font-mono text-[#F26522] uppercase tracking-wider">📷 Webcam monitoring active. Upload the encrypted question paper PDF.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <input ref={vaultFileRef} type="file" accept=".pdf" className="hidden" />
                  <button
                    onClick={() => vaultFileRef.current?.click()}
                    className="bg-gray-900 text-white px-4 py-2 rounded-full text-xs font-mono hover:bg-gray-800 transition-all"
                  >
                    Select PDF File
                  </button>
                  <span className="text-xs text-gray-500 font-mono">{vaultFileRef.current?.files?.[0]?.name || "No file selected"}</span>
                  <button
                    disabled={uploadingPaper}
                    onClick={async () => {
                      if (!vaultFileRef.current?.files?.[0] || !vaultSession) return;
                      setUploadingPaper(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", vaultFileRef.current.files[0]);
                        await agencyApi.uploadPaper(examId, fd, vaultSession.token);
                        const papers = await agencyApi.getPaperStatus(examId);
                        setVaultPapers(papers);
                        const logs = await agencyApi.getVaultAccessLog(examId);
                        setVaultAccessLog(logs);
                        alert("Paper encrypted and vaulted successfully!");
                      } catch (err: any) { alert(err.message); }
                      finally { setUploadingPaper(false); }
                    }}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase transition-all disabled:opacity-50"
                  >
                    {uploadingPaper ? <><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Encrypting...</> : "Upload & Vault"}
                  </button>
                </div>
              </div>
            )}

            {/* Papers List */}
            {vaultPapers.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase text-gray-500">Vaulted Papers</h4>
                {vaultPapers.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 p-3 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Lock className="h-4 w-4 text-green-600" />
                      <div>
                        <span className="text-sm font-bold text-gray-900">Paper v{p.paper_version}</span>
                        <span className="block text-[10px] font-mono text-gray-400">{new Date(p.uploaded_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                      p.status === "VAULTED" ? "bg-green-50 border border-green-200 text-green-700" :
                      p.status === "ARCHIVED" ? "bg-gray-200 text-gray-500 border border-gray-300" : "bg-[#F26522]/10 text-[#F26522]"
                    }`}>{p.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 font-mono text-xs">
                No papers vaulted yet. Start a monitored session to upload.
              </div>
            )}

            {/* Access Log */}
            {vaultAccessLog.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase text-gray-500">Vault Access Log (Immutable)</h4>
                <div className="overflow-auto max-h-48 border border-gray-150 rounded-xl p-3 bg-gray-50/50">
                  <table className="w-full text-xs font-mono">
                    <thead><tr className="text-gray-400 border-b border-gray-200">
                      <th className="text-left py-1 pr-4">Access Type</th>
                      <th className="text-left py-1 pr-4">Actor</th>
                      <th className="text-left py-1">Timestamp</th>
                    </tr></thead>
                    <tbody>
                      {vaultAccessLog.map((l: any) => (
                        <tr key={l.id} className="border-b border-gray-100">
                          <td className="py-1 pr-4 text-[#F26522] font-semibold">{l.access_type}</td>
                          <td className="py-1 pr-4 text-gray-700">{l.agency_staff?.full_name || l.accessed_by}</td>
                          <td className="py-1 text-gray-400">{new Date(l.accessed_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINTING TAB — Phase 7 */}
      {activeTab === "printing" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2">
                <Printer className="h-4 w-4 text-[#F26522]" /><span>Intelligent Printing Module</span>
              </h3>
              <button
                onClick={async () => {
                  setLoadingPrint(true);
                  const jobs = await agencyApi.getPrintJobs(examId).catch(() => []);
                  setPrintJobs(jobs);
                  setLoadingPrint(false);
                }}
                className="bg-gray-950 text-white px-3 py-1.5 rounded-full text-xs font-mono hover:bg-gray-800 transition-all flex items-center space-x-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Create Print Job Form */}
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase text-[#F26522]">Initiate New Print Job</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Center</label>
                  <select value={printCenterId} onChange={e => setPrintCenterId(e.target.value)}
                    className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-lg focus:outline-none focus:border-[#F26522]">
                    <option value="">-- Select Center --</option>
                    {exam.centers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Copies Requested</label>
                  <input type="number" value={printCopies} onChange={e => setPrintCopies(Number(e.target.value))}
                    min={1} className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-lg focus:outline-none focus:border-[#F26522]" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Printer ID</label>
                  <input type="text" value={printPrinterId} onChange={e => setPrintPrinterId(e.target.value)}
                    placeholder="MAC or Printer ID" className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-lg focus:outline-none focus:border-[#F26522]" />
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!printCenterId || !printCopies || !printPrinterId) { alert("Fill all fields."); return; }
                  try {
                    const job = await agencyApi.createPrintJob(examId, { center_id: printCenterId, copies_requested: printCopies, printer_id: printPrinterId });
                    alert(`Print job created. Status: ${job.status}`);
                    const jobs = await agencyApi.getPrintJobs(examId).catch(() => []);
                    setPrintJobs(jobs);
                  } catch (err: any) { alert(err.message); }
                }}
                className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 inline mr-1" />Create Print Job
              </button>
            </div>

            {/* Print Jobs Table */}
            {loadingPrint ? <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#F26522] mx-auto" /></div> : (
              <div className="overflow-auto border border-gray-200 rounded-xl bg-white">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2.5 px-4">Center</th>
                    <th className="text-left py-2.5 px-4">Copies</th>
                    <th className="text-left py-2.5 px-4">Budget</th>
                    <th className="text-left py-2.5 px-4">Status</th>
                    <th className="text-left py-2.5 px-4">Created</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {printJobs.map((j: any) => (
                      <tr key={j.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={async () => {
                        const detail = await agencyApi.getPrintJob(j.id);
                        setSelectedPrintJob(detail);
                      }}>
                        <td className="py-2.5 px-4 text-gray-900 font-semibold">{j.exam_centers?.name || "—"}</td>
                        <td className="py-2.5 px-4">{j.copies_requested}</td>
                        <td className="py-2.5 px-4">{j.copies_budget}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            j.status === "COMPLETED" ? "bg-green-50 text-green-700 border border-green-150" :
                            j.status === "PRINTING" ? "bg-blue-50 text-blue-700 border border-blue-150 animate-pulse" :
                            j.status.startsWith("BLOCKED") ? "bg-red-50 text-red-700 border border-red-150" : "bg-[#F26522]/10 text-[#F26522]"
                          }`}>{j.status}</span>
                        </td>
                        <td className="py-2.5 px-4 text-gray-400">{new Date(j.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {printJobs.length === 0 && <div className="text-center py-8 text-gray-400 font-mono text-xs">No print jobs yet.</div>}
              </div>
            )}

            {/* Selected Job Alerts */}
            {selectedPrintJob && selectedPrintJob.surveillance_alerts?.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-mono font-bold uppercase text-red-600 flex items-center space-x-1">
                  <AlertOctagon className="h-3.5 w-3.5" /><span>Print Room Surveillance Alerts</span>
                </h4>
                {selectedPrintJob.surveillance_alerts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between bg-red-50 border border-red-200 p-3 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-red-700">{a.alert_type.replace(/_/g, " ")}</span>
                      <span className="block text-[10px] text-gray-500">{new Date(a.detected_at).toLocaleString()} · Confidence: {(a.confidence_score * 100).toFixed(1)}%</span>
                    </div>
                    {!a.review_outcome && (
                      <select onChange={async (e) => {
                        await agencyApi.reviewPrintAlert(selectedPrintJob.id, a.id, { review_outcome: e.target.value });
                        const detail = await agencyApi.getPrintJob(selectedPrintJob.id);
                        setSelectedPrintJob(detail);
                      }} defaultValue="" className="bg-white border border-gray-200 text-gray-900 text-xs font-mono p-1 rounded focus:outline-none">
                        <option value="" disabled>Review...</option>
                        <option value="DISMISSED">Dismiss</option>
                        <option value="ESCALATED">Escalate</option>
                        <option value="ACTION_TAKEN">Action Taken</option>
                      </select>
                    )}
                    {a.review_outcome && <span className="text-[10px] font-mono text-gray-500">{a.review_outcome}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRANSIT TAB — Phase 8 */}
      {activeTab === "transit" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2">
                <Truck className="h-4 w-4 text-[#F26522]" /><span>Chain-of-Custody Transit Tracking</span>
              </h3>
              <button
                onClick={async () => {
                  setLoadingTrunks(true);
                  const t = await agencyApi.getTrunks(examId).catch(() => []);
                  setTrunks(t);
                  setLoadingTrunks(false);
                }}
                className="bg-gray-950 text-white px-3 py-1.5 rounded-full text-xs font-mono hover:bg-gray-800 transition-all flex items-center space-x-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loadingTrunks ? <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#F26522] mx-auto" /></div> : (
              <div className="overflow-auto border border-gray-200 rounded-xl bg-white">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2.5 px-4">Trunk Code</th>
                    <th className="text-left py-2.5 px-4">Destination</th>
                    <th className="text-left py-2.5 px-4">Status</th>
                    <th className="text-left py-2.5 px-4">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {trunks.map((t: any) => (
                      <tr key={t.id} className="border-b border-gray-100">
                        <td className="py-2.5 px-4 font-bold text-gray-900">{t.trunk_code}</td>
                        <td className="py-2.5 px-4 text-gray-600">{t.exam_centers?.name || "—"}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === "DELIVERED" ? "bg-green-50 text-green-700 border border-green-150" :
                            t.status === "IN_TRANSIT" ? "bg-blue-50 text-blue-700 border border-blue-150 animate-pulse" :
                            t.status === "COMPROMISED" ? "bg-red-50 text-red-700 border border-red-150" :
                            t.status === "UNLOCKED" ? "bg-purple-50 text-purple-700 border border-purple-150" : "bg-[#F26522]/10 text-[#F26522]"
                          }`}>{t.status}</span>
                        </td>
                        <td className="py-2.5 px-4 space-x-2">
                          {t.status === "SEALED" && (
                            <button onClick={async () => { await agencyApi.dispatchTrunk(t.id); const tl = await agencyApi.getTrunks(examId).catch(() => []); setTrunks(tl); }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-2 py-1 rounded text-[10px] font-mono transition-all">Dispatch</button>
                          )}
                          {t.status === "IN_TRANSIT" && (
                            <button onClick={async () => {
                              const loc = { latitude: 28.6139, longitude: 77.2090 };
                              const res = await agencyApi.requestTrunkUnlock(t.id, loc);
                              if (res.otp_sent) { setTrunkUnlockId(t.id); setTrunkOtpSent(true); alert(`OTP sent! Dev OTP: ${res.dev_otp}`); }
                              else alert(res.error || "Outside geofence");
                            }} className="bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border border-yellow-200 px-2 py-1 rounded text-[10px] font-mono transition-all">Request Unlock</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trunks.length === 0 && <div className="text-center py-8 text-gray-400 font-mono text-xs">No trunks created yet. Create trunks from completed print jobs.</div>}
              </div>
            )}

            {/* OTP Unlock Confirm */}
            {trunkOtpSent && trunkUnlockId && (
              <div className="bg-[#F26522]/5 border border-[#F26522]/20 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase text-[#F26522] flex items-center space-x-1">
                  <KeyRound className="h-3.5 w-3.5 text-[#F26522]" /><span>3-Factor Trunk Unlock</span>
                </h4>
                <div className="flex items-center space-x-3">
                  <input type="text" value={trunkOtp} onChange={e => setTrunkOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP" className="bg-white border border-gray-200 text-gray-900 text-sm font-mono p-2 rounded-lg w-48 focus:outline-none focus:border-[#F26522]" />
                  <button onClick={async () => {
                    try {
                      const res = await agencyApi.confirmTrunkUnlock(trunkUnlockId, { otp: trunkOtp, biometric_data: "mock" });
                      alert(`Trunk ${res.status}!`);
                      setTrunkOtpSent(false); setTrunkOtp(""); setTrunkUnlockId("");
                      const tl = await agencyApi.getTrunks(examId).catch(() => []); setTrunks(tl);
                    } catch (err: any) { alert(err.message); }
                  }} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full text-xs font-mono font-bold transition-all">
                    Confirm Unlock
                  </button>
                  <button onClick={() => { setTrunkOtpSent(false); setTrunkOtp(""); }} className="text-gray-400 text-xs font-mono hover:text-gray-600">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANSWER SHEETS TAB — Phase 10 */}
      {activeTab === "answer-sheets" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2">
                <ScanLine className="h-4 w-4 text-[#F26522]" /><span>Answer Sheet Upload & AI Scoring</span>
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={async () => {
                    setLoadingSheets(true);
                    const sheets = await agencyApi.getAnswerSheets(examId).catch(() => []);
                    setAnswerSheets(sheets);
                    setLoadingSheets(false);
                  }}
                  className="bg-gray-950 text-white px-3 py-1.5 rounded-full text-xs font-mono hover:bg-gray-800 transition-all flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Upload Form */}
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase text-[#F26522]">Upload Answer Sheet</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Student ID</label>
                  <input type="text" value={asStudentId} onChange={e => setAsStudentId(e.target.value)}
                    placeholder="Student UUID" className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-lg focus:outline-none focus:border-[#F26522]" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase">Center</label>
                  <select value={asCenterId} onChange={e => setAsCenterId(e.target.value)}
                    className="w-full mt-1 bg-white border border-gray-200 text-gray-900 text-xs font-mono p-2 rounded-lg focus:outline-none focus:border-[#F26522]">
                    <option value="">-- Select Center --</option>
                    {exam.centers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input ref={answerSheetFileRef} type="file" accept=".pdf" className="hidden" />
                <button onClick={() => answerSheetFileRef.current?.click()}
                  className="bg-gray-950 text-white px-4 py-2 rounded-full text-xs font-mono hover:bg-gray-800 transition-all">
                  Select PDF
                </button>
                <button
                  onClick={async () => {
                    if (!answerSheetFileRef.current?.files?.[0] || !asStudentId || !asCenterId) { alert("Select PDF, enter Student ID and center."); return; }
                    try {
                      const fd = new FormData();
                      fd.append("file", answerSheetFileRef.current.files[0]);
                      fd.append("student_id", asStudentId);
                      fd.append("center_id", asCenterId);
                      await agencyApi.uploadAnswerSheet(examId, fd);
                      alert("Answer sheet uploaded. AI scoring in progress.");
                      const sheets = await agencyApi.getAnswerSheets(examId).catch(() => []);
                      setAnswerSheets(sheets);
                    } catch (err: any) { alert(err.message); }
                  }}
                  className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm"
                >
                  <Upload className="h-3.5 w-3.5 inline mr-1" />Upload & Score
                </button>
              </div>
            </div>

            {/* Answer Key Upload Form */}
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase text-[#F26522]">Upload Official Answer Key</h4>
              <p className="text-[10px] font-mono text-gray-500 uppercase">Securely vault the official answer key for evaluation setup.</p>
              
              {answerKeyStatus === "VAULTED" && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs font-mono text-green-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Answer key vaulted successfully</span>
                  </div>
                  <span className="bg-green-100 text-green-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                    VAULTED
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <input ref={answerKeyFileRef} type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                  if (!e.target.files?.[0]) return;
                  setUploadingKey(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", e.target.files[0]);
                    await agencyApi.uploadAnswerKey(examId, fd);
                    alert("Official answer key uploaded and secured in vault.");
                    await fetchAnswerKeyStatus();
                  } catch (err: any) {
                    alert(err.message || "Failed to upload answer key.");
                  } finally {
                    setUploadingKey(false);
                  }
                }} />
                <button
                  disabled={uploadingKey}
                  onClick={() => answerKeyFileRef.current?.click()}
                  className="bg-gray-950 text-white px-4 py-2 rounded-full text-xs font-mono hover:bg-gray-800 transition-all flex items-center space-x-1.5"
                >
                  {uploadingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>Select &amp; Upload PDF Key</span>
                </button>
              </div>
            </div>

            {/* Answer Sheets Table */}
            {loadingSheets ? <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#F26522] mx-auto" /></div> : (
              <div className="overflow-auto border border-gray-200 rounded-xl bg-white">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2.5 px-4">Student</th>
                    <th className="text-left py-2.5 px-4">Center</th>
                    <th className="text-left py-2.5 px-4">Pages</th>
                    <th className="text-left py-2.5 px-4">Status</th>
                    <th className="text-left py-2.5 px-4">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {answerSheets.map((s: any) => (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="py-2.5 px-4 text-gray-900 font-semibold">{s.students?.full_name || "—"}<span className="block text-[10px] text-gray-400 font-normal">{s.students?.email}</span></td>
                        <td className="py-2.5 px-4 text-gray-600">{s.exam_centers?.name || "—"}</td>
                        <td className="py-2.5 px-4">{s.total_pages}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.upload_status === "APPROVED" ? "bg-green-50 text-green-700 border border-green-150" :
                            s.upload_status === "RESCAN_REQUIRED" ? "bg-red-50 text-red-700 border border-red-150" :
                            s.upload_status === "SEALED" ? "bg-purple-50 text-purple-700 border border-purple-150" :
                            s.upload_status === "SCORING" ? "bg-blue-50 text-blue-700 border border-blue-150 animate-pulse" : "bg-amber-50 text-amber-700 border border-amber-150"
                          }`}>{s.upload_status}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          {s.upload_status === "APPROVED" && (
                            <button onClick={async () => { await agencyApi.sealAnswerSheet(s.id); const sheets = await agencyApi.getAnswerSheets(examId).catch(() => []); setAnswerSheets(sheets); }}
                              className="bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 px-2 py-1 rounded text-[10px] font-mono transition-all">Seal</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {answerSheets.length === 0 && <div className="text-center py-8 text-gray-400 font-mono text-xs">No answer sheets uploaded yet.</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EVALUATION TAB */}
      {activeTab === "evaluation" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-3 gap-2">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2">
                <Shield className="h-4 w-4 text-[#F26522]" /><span>Multi-Tier Evaluation &amp; Anonymization</span>
              </h3>
              
              <button
                disabled={evalAnonymizing}
                onClick={async () => {
                  setEvalAnonymizing(true);
                  try {
                    const res = await agencyApi.anonymizeEvaluation(examId);
                    setEvalStats(res);
                    alert(`Anonymization compiled. ${res.total_sheets} papers grouped into ${res.batches_ready} ready batches.`);
                  } catch (err: any) {
                    alert(err.message || "Anonymization failed.");
                  } finally {
                    setEvalAnonymizing(false);
                  }
                }}
                className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm shrink-0"
              >
                {evalAnonymizing ? "Running Anonymization..." : "Run Anonymization Pass"}
              </button>
            </div>

            {evalStats && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-xs font-mono text-green-700">
                Anonymization status: COMPLETE. Student names and IDs have been replaced with 12-character hashes. {evalStats.total_sheets} answer sheets fully anonymized. {evalStats.batches_ready} batches prepared for grading.
              </div>
            )}

            {/* Assignments list */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-mono font-bold uppercase text-gray-500">Active Evaluator Assignments ({evalAssignments.length})</h4>
                <button
                  onClick={() => setShowCreateAssignmentForm(!showCreateAssignmentForm)}
                  className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all shadow-sm flex items-center space-x-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showCreateAssignmentForm ? "[Cancel]" : "[Create Assignment]"}</span>
                </button>
              </div>

              {/* Create Assignment Form */}
              {showCreateAssignmentForm && (
                <form onSubmit={handleCreateAssignment} className="bg-gray-50 border border-gray-200 p-5 rounded-2xl space-y-4 shadow-inner">
                  <h4 className="text-xs font-mono font-bold uppercase text-[#F26522] border-b border-gray-150 pb-2">
                    Create Evaluator Assignment
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Select Evaluator *</label>
                      <select
                        value={assignEvaluatorId}
                        onChange={e => setAssignEvaluatorId(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522]"
                        required
                      >
                        <option value="">-- Select Staff member --</option>
                        {allStaff
                          .filter((s: any) => ["grading_teacher", "moderator", "chief_moderator"].includes(s.role))
                          .map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name} ({s.role.replace(/_/g, " ")})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Grading Role Scope *</label>
                      <select
                        value={assignRole}
                        onChange={e => setAssignRole(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#F26522]"
                        required
                      >
                        <option value="grading_teacher">Grading Teacher (Tier 1)</option>
                        <option value="moderator">Moderator (Tier 2)</option>
                        <option value="chief_moderator">Chief Moderator (Tier 3)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-mono uppercase text-gray-500">
                        Select Answer Sheets ({assignUploadIds.length} selected) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const sealedSheetIds = answerSheets
                            .filter(s => s.upload_status === "SEALED")
                            .map(s => s.id);
                          setAssignUploadIds(
                            assignUploadIds.length === sealedSheetIds.length ? [] : sealedSheetIds
                          );
                        }}
                        className="text-[10px] font-mono uppercase text-[#F26522] hover:underline"
                      >
                        {assignUploadIds.length === answerSheets.filter(s => s.upload_status === "SEALED").length
                          ? "Deselect All"
                          : "Select All Sealed"}
                      </button>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-white space-y-2">
                      {answerSheets.length === 0 ? (
                        <div className="text-center py-4 text-xs text-gray-400 font-mono">
                          No answer sheets found. Make sure sheets are uploaded and sealed.
                        </div>
                      ) : (
                        answerSheets.map((s: any) => {
                          const isSealed = s.upload_status === "SEALED";
                          const isChecked = assignUploadIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center space-x-3 p-2 rounded-lg border text-xs font-mono transition-all ${
                                isChecked
                                  ? "bg-orange-50/50 border-[#F26522]/30 text-gray-950 font-bold"
                                  : "bg-white border-gray-150 text-gray-600"
                              } ${!isSealed ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <input
                                type="checkbox"
                                disabled={!isSealed}
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setAssignUploadIds([...assignUploadIds, s.id]);
                                  } else {
                                    setAssignUploadIds(assignUploadIds.filter(id => id !== s.id));
                                  }
                                }}
                                className="rounded border-gray-300 text-[#F26522] focus:ring-[#F26522]"
                              />
                              <div className="flex-1 flex justify-between">
                                <div>
                                  <span>
                                    {s.students?.full_name || `Anonymized: ${s.id.substring(0, 8)}`}
                                  </span>
                                  <span className="text-[10px] text-gray-400 block">
                                    {s.students?.email || s.exam_centers?.name}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  isSealed ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-500"
                                }`}>
                                  {s.upload_status}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateAssignmentForm(false);
                        setAssignEvaluatorId("");
                        setAssignUploadIds([]);
                      }}
                      className="bg-white border border-gray-250 text-gray-700 px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingAssignment}
                      className="bg-[#F26522] hover:bg-[#e05a1a] text-white px-5 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                    >
                      {creatingAssignment ? "Assigning..." : "Create Assignment"}
                    </button>
                  </div>
                </form>
              )}

              {loadingEval ? <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#F26522] mx-auto" /></div> : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                  <table className="w-full text-xs font-mono text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase">
                        <th className="px-4 py-3">Batch Code</th>
                        <th className="px-4 py-3">Evaluator</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Papers</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Assigned Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {evalAssignments.map((a: any) => (
                        <tr key={a.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-bold text-gray-900">{a.batch_code}</td>
                          <td className="px-4 py-3 text-gray-900 font-semibold">
                            {a.evaluator?.full_name || a.evaluator_id.substring(0, 8)}
                            <span className="block text-[10px] text-gray-400 font-normal">{a.evaluator?.email}</span>
                          </td>
                          <td className="px-4 py-3 capitalize">{a.role.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3">{a.upload_ids?.length || 0} sheets</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.status === "COMPLETED" ? "bg-green-50 text-green-700 border border-green-150" : "bg-amber-50 text-amber-700 border border-amber-150"
                            }`}>{a.status}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{new Date(a.assigned_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {evalAssignments.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">No grading assignments created yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Approval Action */}
            <div className="pt-4 border-t border-gray-150 flex justify-end">
              <button
                onClick={async () => {
                  try {
                    await agencyApi.approveEvaluation(examId);
                    alert("Evaluation approved for publication.");
                    loadExamDetails();
                  } catch (err: any) {
                    alert(err.message || "Failed to approve evaluation.");
                  }
                }}
                className="bg-gray-900 hover:bg-gray-800 text-white font-mono font-bold text-xs uppercase px-5 py-2.5 rounded-full transition-all"
              >
                Approve Evaluation Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS TAB */}
      {activeTab === "results" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 border-b border-gray-100 pb-2">
              Results Compilation &amp; Declaration
            </h3>

            {/* Readiness checklist */}
            {resultReadiness && (
              <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase text-[#F26522]">Publication Readiness Checklist</h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <span className={resultReadiness.all_sheets_sealed ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {resultReadiness.all_sheets_sealed ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-700">Answer Sheets Sealed ({resultReadiness.sealed_sheets})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={resultReadiness.all_assignments_completed ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {resultReadiness.all_assignments_completed ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-700">Evaluator Assignments Completed ({resultReadiness.completed_assignments})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={resultReadiness.all_discrepancies_resolved ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {resultReadiness.all_discrepancies_resolved ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-700">Escalation Discrepancies Resolved (Pending: {resultReadiness.open_discrepancies})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={resultReadiness.chief_moderator_approved ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {resultReadiness.chief_moderator_approved ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-700">Chief Moderator Formally Approved</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200/60 flex flex-wrap gap-3">
                  <button
                    disabled={!resultReadiness.ready_to_publish || compilingResults}
                    onClick={async () => {
                      setCompilingResults(true);
                      try {
                        await agencyApi.compileResults(examId);
                        alert("Results compilation job successfully queued. Refresh in a few moments.");
                        await fetchResultsData();
                      } catch (err: any) {
                        alert(err.message || "Compilation failed.");
                      } finally {
                        setCompilingResults(false);
                      }
                    }}
                    className="bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white font-mono font-bold text-xs uppercase px-4 py-2.5 rounded-full transition-all shadow-sm"
                  >
                    {compilingResults ? "Compiling..." : "Compile Results"}
                  </button>

                  {resultsPreview?.compiled && (
                    <button
                      disabled={publishingResults}
                      onClick={async () => {
                        if (!confirm("Are you sure you want to declare and publish the results to candidate portals?")) return;
                        setPublishingResults(true);
                        try {
                          await agencyApi.publishResults(examId);
                          alert("Results published successfully.");
                          loadExamDetails();
                        } catch (err: any) {
                          alert(err.message || "Publishing failed.");
                        } finally {
                          setPublishingResults(false);
                        }
                      }}
                      className="bg-green-600 hover:bg-green-500 text-white font-mono font-bold text-xs uppercase px-4 py-2.5 rounded-full transition-all"
                    >
                      {publishingResults ? "Publishing..." : "Publish Results"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Results Preview */}
            {resultsPreview?.compiled && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl text-center shadow-sm">
                    <div className="text-2xl font-mono font-bold text-gray-900">{resultsPreview.total_candidates}</div>
                    <div className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">Total Candidates</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl text-center shadow-sm">
                    <div className="text-2xl font-mono font-bold text-green-600">{resultsPreview.pass_rate}%</div>
                    <div className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">Qualified Rate</div>
                  </div>
                </div>

                {/* Top 10 Ranks */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase text-gray-500">Merit List Preview (Top 10 Rankers)</h4>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs font-mono text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
                          <th className="px-5 py-3">Rank</th>
                          <th className="px-5 py-3">Application Number</th>
                          <th className="px-5 py-3 text-right">Final Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {resultsPreview.top_10?.map((cand: any) => (
                          <tr key={cand.rank} className="hover:bg-gray-50/50">
                            <td className="px-5 py-3 font-bold text-gray-900">#{cand.rank}</td>
                            <td className="px-5 py-3 font-bold text-gray-500">{cand.application_number}</td>
                            <td className="px-5 py-3 text-right text-gray-900 font-bold">{cand.score} / 100</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRIEVANCES TAB */}
      {activeTab === "grievances" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-gray-150 pb-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2">
                <span>⚖ Candidate Grievance System &amp; CCTV Audit</span>
              </h3>
              <button 
                onClick={fetchGrievancesData}
                className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-950 transition-all flex items-center space-x-1 font-mono text-xs uppercase"
                title="Refresh Grievances"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingGrievances ? "animate-spin" : ""}`} />
                <span>Sync</span>
              </button>
            </div>

            {loadingGrievances ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#F26522]" />
              </div>
            ) : grievances.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-mono text-xs uppercase">
                No candidate grievances filed for this exam.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Kanban board or list of grievances */}
                <div className="lg:col-span-1 space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  <h4 className="text-xs font-mono font-bold uppercase text-gray-500 mb-2">Grievance Ticket Logs</h4>
                  {grievances.map((g: any) => (
                    <button
                      key={g.id}
                      onClick={async () => {
                        setLoadingGrievanceDetail(true);
                        try {
                          const detail = await agencyApi.getAgencyGrievanceDetail(examId, g.id);
                          setSelectedGrievance(detail);
                          setGrievanceResNotes(detail.resolution_notes || "");
                          setGrievanceAssignee(detail.assigned_to || "");
                        } catch (err: any) {
                          alert(err.message || "Failed to load grievance details.");
                        } finally {
                          setLoadingGrievanceDetail(false);
                        }
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all space-y-2 block font-mono text-xs ${
                        selectedGrievance?.id === g.id
                          ? "bg-gray-100 border-[#F26522] text-gray-900 shadow-md"
                          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-600"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-gray-400">GRV-{g.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          g.status === "OPEN" ? "bg-amber-50 text-amber-700 border border-amber-150" :
                          g.status === "UNDER_REVIEW" ? "bg-blue-50 text-blue-700 border border-blue-150" :
                          g.status === "RESOLVED" ? "bg-green-50 text-green-700 border border-green-150" :
                          "bg-red-50 text-red-700 border border-red-150"
                        }`}>
                          {g.status}
                        </span>
                      </div>
                      <div className="font-bold text-[13px]">{g.category.replace(/_/g, " ")}</div>
                      <p className="text-gray-500 line-clamp-2 text-[11px] normal-case">{g.description}</p>
                      <div className="text-[10px] text-gray-400 flex justify-between items-center pt-1 border-t border-gray-150">
                        <span>Candidate: {g.students?.full_name || "Anonymous"}</span>
                        <span>{new Date(g.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Detail and action pane */}
                <div className="lg:col-span-2">
                  {loadingGrievanceDetail ? (
                    <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center flex flex-col items-center justify-center space-y-2 h-full min-h-[400px]">
                      <Loader2 className="h-6 w-6 animate-spin text-[#F26522]" />
                      <div className="text-[11px] font-bold uppercase text-gray-400">Loading Ticket Details &amp; CCTV Feeds...</div>
                    </div>
                  ) : selectedGrievance ? (
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                      <div className="flex justify-between items-start border-b border-gray-150 pb-4">
                        <div>
                          <h4 className="text-sm font-mono font-bold text-gray-900 uppercase flex items-center space-x-2">
                            <span>Grievance Details</span>
                            <span className="text-gray-400">GRV-{selectedGrievance.id.slice(0, 8).toUpperCase()}</span>
                          </h4>
                          <div className="text-[10px] font-mono text-gray-400 uppercase mt-1">
                            Candidate: {selectedGrievance.students?.full_name || "Unknown"} | Application: {selectedGrievance.exam_registrations?.application_number || "N/A"}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono uppercase ${
                            selectedGrievance.status === "OPEN" ? "bg-amber-50 text-amber-700 border border-amber-150" :
                            selectedGrievance.status === "UNDER_REVIEW" ? "bg-blue-50 text-blue-700 border border-blue-150" :
                            selectedGrievance.status === "RESOLVED" ? "bg-green-50 text-green-700 border border-green-150" :
                            "bg-red-50 text-red-700 border border-red-150"
                          }`}>
                            Status: {selectedGrievance.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 font-mono text-xs">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-400 block uppercase">Category</span>
                            <span className="text-gray-900 text-xs font-bold uppercase">{selectedGrievance.category.replace(/_/g, " ")}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block uppercase">Priority Level</span>
                            <span className="text-red-600 text-xs font-bold uppercase">{selectedGrievance.priority}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 block uppercase">Description / Grievance Body</span>
                          <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-150 whitespace-pre-wrap normal-case mt-1.5">
                            {selectedGrievance.description}
                          </p>
                        </div>

                        {selectedGrievance.signed_evidence_urls && selectedGrievance.signed_evidence_urls.length > 0 && (
                          <div>
                            <span className="text-gray-400 block uppercase mb-2">Student Evidence Attachments ({selectedGrievance.signed_evidence_urls.length})</span>
                            <div className="flex flex-wrap gap-2">
                              {selectedGrievance.signed_evidence_urls.map((url: string, idx: number) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-950 px-3 py-1.5 rounded-full font-bold transition-all"
                                >
                                  <FileText className="h-3.5 w-3.5 text-[#F26522]" />
                                  <span>Evidence #{idx + 1}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CCTV Video Section */}
                        <div className="border-t border-gray-150 pt-4 space-y-3">
                          <span className="text-gray-400 block uppercase">Automated Room CCTV Evidence</span>
                          
                          {selectedGrievance.auto_cctv_attached && selectedGrievance.cctv_attachment ? (
                            <div className="space-y-2">
                              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-gray-200 bg-black flex flex-col justify-center items-center group shadow-sm">
                                <video 
                                  src={selectedGrievance.cctv_attachment.signed_footage_url} 
                                  controls 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-3 left-3 bg-white/95 border border-gray-200 px-2 py-1 rounded text-[9px] font-bold text-green-600 uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                                  <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping animate-duration-1000"></span>
                                  <span>CCTV VMS Stream Clip</span>
                                </div>
                              </div>
                              <div className="text-[10px] text-gray-400 flex justify-between font-mono">
                                <span>Camera ID: {selectedGrievance.cctv_attachment.camera_id}</span>
                                <span>Footage Window: {new Date(selectedGrievance.cctv_attachment.footage_start).toLocaleTimeString()} - {new Date(selectedGrievance.cctv_attachment.footage_end).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-[#F26522]" />
                              <div className="text-[11px] font-bold uppercase text-gray-500">Processing CCTV Feed Stream</div>
                              <p className="text-[10px] text-gray-400 max-w-sm normal-case">
                                Querying biometric check-in logs and trimming room feed ({selectedGrievance.room_code || "Desk Allocation Room"}) around candidate check-in timestamp...
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Resolution Notes and Actions */}
                        <div className="border-t border-gray-150 pt-6 space-y-4">
                          <h5 className="text-xs font-mono font-bold uppercase text-gray-500">Grievance Investigation &amp; Resolution</h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] text-gray-400 uppercase block mb-1">Assignee Officer</label>
                              <select
                                value={grievanceAssignee}
                                onChange={(e) => setGrievanceAssignee(e.target.value)}
                                className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-gray-900 text-xs font-mono focus:outline-none"
                              >
                                <option value="">Unassigned</option>
                                {staff.map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.role.replace(/_/g, " ")})</option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="flex items-end">
                              <button
                                onClick={async () => {
                                  if (!grievanceAssignee) {
                                    alert("Please select a staff member to assign.");
                                    return;
                                  }
                                  try {
                                    await agencyApi.assignGrievance(selectedGrievance.id, {
                                      assigned_to: grievanceAssignee
                                    });
                                    alert("Grievance updated and marked as under review.");
                                    fetchGrievancesData();
                                    // reload detail
                                    const detail = await agencyApi.getAgencyGrievanceDetail(examId, selectedGrievance.id);
                                    setSelectedGrievance(detail);
                                  } catch (err: any) {
                                    alert(err.message || "Failed to update assignment.");
                                  }
                                }}
                                className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2.5 rounded-full transition-all font-mono text-xs uppercase"
                              >
                                Save Assignment
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase block mb-1">Resolution Summary / Verdict Notes</label>
                            <textarea
                              value={grievanceResNotes}
                              onChange={(e) => setGrievanceResNotes(e.target.value)}
                              placeholder="Describe the findings of the CCTV review and candidate checking log audit..."
                              rows={3}
                              className="w-full bg-white border border-gray-200 p-3 rounded-xl text-gray-900 text-xs font-mono focus:outline-none focus:border-[#F26522]"
                            />
                          </div>

                          <div className="flex space-x-3 pt-2">
                            <button
                              disabled={resolvingGrievance}
                              onClick={async () => {
                                if (!grievanceResNotes) {
                                  alert("Please enter resolution notes before resolving.");
                                  return;
                                }
                                setResolvingGrievance(true);
                                try {
                                  await agencyApi.resolveGrievance(selectedGrievance.id, {
                                    resolution_notes: grievanceResNotes,
                                    outcome: "RESOLVED"
                                  });
                                  alert("Grievance resolved successfully.");
                                  fetchGrievancesData();
                                  setSelectedGrievance(null);
                                } catch (err: any) {
                                  alert(err.message || "Failed to resolve.");
                                } finally {
                                  setResolvingGrievance(false);
                                }
                              }}
                              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-full transition-all font-mono text-xs uppercase"
                            >
                              Resolve Grievance
                            </button>
                            <button
                              disabled={resolvingGrievance}
                              onClick={async () => {
                                if (!grievanceResNotes) {
                                  alert("Please enter resolution notes before rejecting.");
                                  return;
                                }
                                setResolvingGrievance(true);
                                try {
                                  await agencyApi.resolveGrievance(selectedGrievance.id, {
                                    resolution_notes: grievanceResNotes,
                                    outcome: "REJECTED"
                                  });
                                  alert("Grievance rejected successfully.");
                                  fetchGrievancesData();
                                  setSelectedGrievance(null);
                                } catch (err: any) {
                                  alert(err.message || "Failed to reject.");
                                } finally {
                                  setResolvingGrievance(false);
                                }
                              }}
                              className="flex-1 bg-red-655 hover:bg-red-500 bg-red-600 text-white font-bold py-2.5 rounded-full transition-all font-mono text-xs uppercase"
                            >
                              Reject Grievance
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center text-gray-400 font-mono text-xs uppercase flex items-center justify-center h-full min-h-[400px]">
                      Select a grievance from the left ticket log list to review details &amp; CCTV stream.
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
