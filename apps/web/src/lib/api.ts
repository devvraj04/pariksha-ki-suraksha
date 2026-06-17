// Typed Fetch API Wrapper for ParikshaSetu AI Services
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options;
  
  // Construct URL with query parameters
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get token (tries sessionStorage for admin/agency bypass, or cookie/localStorage)
  let token = "";
  if (typeof window !== "undefined") {
    token = sessionStorage.getItem("admin_token") || 
            sessionStorage.getItem("agency_token") || 
            sessionStorage.getItem("center_token") || 
            sessionStorage.getItem("student_token") || 
            "";
  }

  const defaultHeaders: Record<string, string> = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...restOptions,
  });

  if (!response.ok) {
    let errorDetail = "Server returned an error response";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.error || errorDetail;
    } catch {
      // Use status text if JSON parsing fails
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  // Handle empty 204 responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Scoped typed API clients
export const publicApi = {
  getExams: (params?: { mode?: string; upcoming?: boolean; page?: number; limit?: number }) =>
    apiRequest<any[]>("/public/exams", { params }),
  getExamDetail: (examId: string) =>
    apiRequest<any>(`/public/exams/${examId}`),
  getPublicExamBySlug: (slug: string) =>
    apiRequest<any>(`/public/exams/by-slug/${slug}`),
  devLogin: (body: { email: string; password: string; slug: string }) =>
    apiRequest<any>("/public/dev-login", { method: "POST", body: JSON.stringify(body) }),
  requestResultOtp: (body: { application_number: string }) =>
    apiRequest<any>("/results/request-otp", { method: "POST", body: JSON.stringify(body) }),
  verifyResult: (body: { application_number: string; otp: string; captcha_token?: string }) =>
    apiRequest<any>("/results/verify", { method: "POST", body: JSON.stringify(body) }),
  submitWhistleblowerReport: (formData: FormData) =>
    apiRequest<any>("/whistleblower/reports", { method: "POST", body: formData }),
  getWhistleblowerStatus: (trackingCode: string) =>
    apiRequest<any>(`/whistleblower/reports/status/${trackingCode}`),
  reportLeakPublic: (formData: FormData) =>
    apiRequest<any>("/leaks/report", { method: "POST", body: formData }),
};

export const adminApi = {
  getStats: () =>
    apiRequest<any>("/admin/stats"),
  getAgencies: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    apiRequest<any[]>("/admin/agencies", { params }),
  approveAgency: (id: string) =>
    apiRequest<any>(`/admin/agencies/${id}/approve`, { method: "PATCH" }),
  rejectAgency: (id: string) =>
    apiRequest<any>(`/admin/agencies/${id}/reject`, { method: "PATCH" }),
  suspendAgency: (id: string) =>
    apiRequest<any>(`/admin/agencies/${id}/suspend`, { method: "PATCH" }),
  getConfig: () =>
    apiRequest<any>("/admin/config"),
  updateConfig: (config: any) =>
    apiRequest<any>("/admin/config", { method: "PUT", body: JSON.stringify(config) }),
  getAuditLogs: (params?: { agency_id?: string; event_type?: string; page?: number; limit?: number }) =>
    apiRequest<any[]>("/admin/audit-logs", { params }),
};

export const agencyApi = {
  register: (body: any) =>
    apiRequest<any>("/agencies/register", { method: "POST", body: JSON.stringify(body) }),
  getMe: () =>
    apiRequest<any>("/agency/me"),
  updateProfile: (body: any) =>
    apiRequest<any>("/agency/me", { method: "PATCH", body: JSON.stringify(body) }),
  getStaff: (params?: { role?: string; is_active?: boolean }) =>
    apiRequest<any[]>("/agency/staff", { params }),
  addStaff: (body: any) =>
    apiRequest<any>("/agency/staff", { method: "POST", body: JSON.stringify(body) }),
  getStaffDetail: (id: string) =>
    apiRequest<any>(`/agency/staff/${id}`),
  updateStaff: (id: string, body: any) =>
    apiRequest<any>(`/agency/staff/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteStaff: (id: string) =>
    apiRequest<any>(`/agency/staff/${id}`, { method: "DELETE" }),
  acceptInvite: (body: any) =>
    apiRequest<any>("/agency/staff/accept-invite", { method: "POST", body: JSON.stringify(body) }),

  getAgencyCenters: () =>
    apiRequest<any[]>("/agency/centers"),
  getExamBySlug: (slug: string) =>
    apiRequest<any>(`/exams/by-slug/${slug}`),

  // ── Phase 3 & 5 — Exam Management ──────────────────────────────────────────
  getExams: (params?: { status?: string; mode?: string; page?: number }) =>
    apiRequest<any[]>("/exams", { params }),
  getExamDetail: (id: string) =>
    apiRequest<any>(`/exams/${id}`),
  createExam: (body: any) =>
    apiRequest<any>("/exams", { method: "POST", body: JSON.stringify(body) }),
  updateExam: (id: string, body: any) =>
    apiRequest<any>(`/exams/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  addCenter: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/centers`, { method: "POST", body: JSON.stringify(body) }),
  updateCenter: (examId: string, centerId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/centers/${centerId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCenter: (examId: string, centerId: string) =>
    apiRequest<any>(`/exams/${examId}/centers/${centerId}`, { method: "DELETE" }),
  addRoom: (centerId: string, body: any) =>
    apiRequest<any>(`/centers/${centerId}/rooms`, { method: "POST", body: JSON.stringify(body) }),
  updateRoom: (centerId: string, roomId: string, body: any) =>
    apiRequest<any>(`/centers/${centerId}/rooms/${roomId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRoom: (centerId: string, roomId: string) =>
    apiRequest<any>(`/centers/${centerId}/rooms/${roomId}`, { method: "DELETE" }),
  publishExam: (id: string) =>
    apiRequest<any>(`/exams/${id}/publish`, { method: "POST" }),
  openRegistration: (id: string) =>
    apiRequest<any>(`/exams/${id}/open-registration`, { method: "POST" }),
  closeRegistration: (id: string) =>
    apiRequest<any>(`/exams/${id}/close-registration`, { method: "POST" }),
  allocateCenters: (id: string) =>
    apiRequest<any>(`/exams/${id}/allocate-centers`, { method: "POST" }),
  getAllocationStatus: (id: string, jobId: string) =>
    apiRequest<any>(`/exams/${id}/allocation-status`, { params: { job_id: jobId } }),
  getAllocations: (id: string, page: number = 1) =>
    apiRequest<any[]>(`/exams/${id}/allocations`, { params: { page } }),
  generateAdmitCards: (id: string) =>
    apiRequest<any>(`/exams/${id}/generate-admit-cards`, { method: "POST" }),
  getAdmitCardsStatus: (id: string, jobId: string) =>
    apiRequest<any>(`/exams/${id}/admit-cards-status`, { params: { job_id: jobId } }),
  regenerateBrochure: (id: string) =>
    apiRequest<any>(`/exams/${id}/regenerate-brochure`, { method: "POST" }),
  getBrochureStatus: (id: string, jobId: string) =>
    apiRequest<any>(`/exams/${id}/brochure-status`, { params: { job_id: jobId } }),

  // ── Phase 6 — Question Paper Vault ─────────────────────────────────────────
  startUploadSession: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/papers/upload-session/start`, { method: "POST" }),
  uploadPaper: (examId: string, formData: FormData, sessionToken: string) =>
    apiRequest<any>(`/exams/${examId}/papers`, {
      method: "POST",
      body: formData,
      headers: { "X-Session-Token": sessionToken },
    }),
  endUploadSession: (token: string) =>
    apiRequest<any>(`/papers/upload-session/${token}/end`, { method: "POST" }),
  getPaperStatus: (examId: string) =>
    apiRequest<any[]>(`/exams/${examId}/papers`),
  getVaultAccessLog: (examId: string) =>
    apiRequest<any[]>(`/exams/${examId}/papers/vault-access-log`),

  // ── Phase 7 — Printing ──────────────────────────────────────────────────────
  getPrintJobs: (examId: string, params?: { center_id?: string; status?: string }) =>
    apiRequest<any[]>(`/exams/${examId}/print-jobs`, { params }),
  createPrintJob: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/print-jobs`, { method: "POST", body: JSON.stringify(body) }),
  getPrintJob: (jobId: string) =>
    apiRequest<any>(`/print-jobs/${jobId}`),
  reviewPrintAlert: (jobId: string, alertId: string, body: any) =>
    apiRequest<any>(`/print-jobs/${jobId}/review-alert/${alertId}`, { method: "PATCH", body: JSON.stringify(body) }),
  startPrintSurveillance: (jobId: string) =>
    apiRequest<any>(`/print-jobs/${jobId}/surveillance/start`, { method: "POST" }),
  stopPrintSurveillance: (jobId: string) =>
    apiRequest<any>(`/print-jobs/${jobId}/surveillance/stop`, { method: "POST" }),

  // ── Phase 8 — Transit ───────────────────────────────────────────────────────
  createTrunk: (printJobId: string, body: any) =>
    apiRequest<any>(`/print-jobs/${printJobId}/trunks`, { method: "POST", body: JSON.stringify(body) }),
  getTrunks: (examId: string) =>
    apiRequest<any[]>(`/exams/${examId}/trunks`),
  getTrunk: (trunkId: string) =>
    apiRequest<any>(`/trunks/${trunkId}`),
  dispatchTrunk: (trunkId: string) =>
    apiRequest<any>(`/trunks/${trunkId}/dispatch`, { method: "POST" }),
  requestTrunkUnlock: (trunkId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/unlock/request`, { method: "POST", body: JSON.stringify(body) }),
  confirmTrunkUnlock: (trunkId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/unlock/confirm`, { method: "POST", body: JSON.stringify(body) }),
  receiptConfirm: (trunkId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/receipt-confirm`, { method: "POST", body: JSON.stringify(body) }),
  getTrunkViolations: (trunkId: string) =>
    apiRequest<any[]>(`/trunks/${trunkId}/violations`),
  resolveViolation: (trunkId: string, violationId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/violations/${violationId}/resolve`, { method: "PATCH", body: JSON.stringify(body) }),

  // ── Phase 9 — Day-of-Exam ───────────────────────────────────────────────────
  checkinVerify: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/checkin`, { method: "POST", body: JSON.stringify(body) }),
  checkinConfirm: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/checkin/confirm`, { method: "POST", body: JSON.stringify(body) }),
  getLiveRooms: (examId: string, centerId: string) =>
    apiRequest<any[]>(`/exams/${examId}/centers/${centerId}/rooms/live`),
  getCheckinProgress: (examId: string, centerId: string) =>
    apiRequest<any>(`/exams/${examId}/centers/${centerId}/checkin-progress`),
  startCBTSession: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/cbt/sessions`, { method: "POST", body: JSON.stringify(body) }),
  recordTabSwitch: (sessionId: string) =>
    apiRequest<any>(`/cbt/sessions/${sessionId}/tab-switch`, { method: "PATCH" }),
  submitCBT: (sessionId: string, body: any) =>
    apiRequest<any>(`/cbt/sessions/${sessionId}/submit`, { method: "POST", body: JSON.stringify(body) }),
  getSurveillanceAlerts: (examId: string, params?: { center_id?: string; alert_type?: string }) =>
    apiRequest<any[]>(`/exams/${examId}/surveillance/alerts`, { params }),
  reviewSurveillanceAlert: (alertId: string, body: any) =>
    apiRequest<any>(`/surveillance/alerts/${alertId}/review`, { method: "PATCH", body: JSON.stringify(body) }),

  // ── Phase 10 — Answer Sheets ─────────────────────────────────────────────────
  getAnswerSheets: (examId: string, params?: { center_id?: string; upload_status?: string }) =>
    apiRequest<any[]>(`/exams/${examId}/answer-sheets`, { params }),
  uploadAnswerSheet: (examId: string, formData: FormData) =>
    apiRequest<any>(`/exams/${examId}/answer-sheets/upload`, { method: "POST", body: formData }),
  getAnswerSheet: (uploadId: string) =>
    apiRequest<any>(`/answer-sheets/${uploadId}`),
  rescanAnswerSheet: (uploadId: string, formData: FormData) =>
    apiRequest<any>(`/answer-sheets/${uploadId}/rescan`, { method: "POST", body: formData }),
  sealAnswerSheet: (uploadId: string) =>
    apiRequest<any>(`/answer-sheets/${uploadId}/seal`, { method: "POST" }),
  sealAllAnswerSheets: (examId: string, centerId: string) =>
    apiRequest<any>(`/exams/${examId}/answer-sheets/seal-all`, { method: "POST", body: JSON.stringify({ center_id: centerId }) }),
  uploadAnswerKey: (examId: string, formData: FormData) =>
    apiRequest<any>(`/exams/${examId}/answer-key/upload`, { method: "POST", body: formData }),

  // ── Phase 11 — Evaluation ──────────────────────────────────────────────────
  anonymizeEvaluation: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/evaluation/anonymize`, { method: "POST" }),
  createEvaluationAssignment: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/evaluation/assignments`, { method: "POST", body: JSON.stringify(body) }),
  getExamEvaluatorAssignments: (examId: string) =>
    apiRequest<any[]>(`/exams/${examId}/evaluation/assignments`),
  getEvaluatorAssignments: () =>
    apiRequest<any[]>("/evaluation/assignments/me"),
  getAssignmentPapers: (assignmentId: string) =>
    apiRequest<any[]>(`/evaluation/assignments/${assignmentId}/papers`),
  submitMarks: (body: any) =>
    apiRequest<any>("/evaluation/marks", { method: "POST", body: JSON.stringify(body) }),
  completeAssignment: (assignmentId: string) =>
    apiRequest<any>(`/evaluation/assignments/${assignmentId}/complete`, { method: "POST" }),
  getEvaluationDiscrepancies: (examId: string) =>
    apiRequest<any[]>(`/exams/${examId}/evaluation/discrepancies`),
  resolveDiscrepancy: (discrepancyId: string, body: any) =>
    apiRequest<any>(`/evaluation/discrepancies/${discrepancyId}/resolve`, { method: "POST", body: JSON.stringify(body) }),
  approveEvaluation: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/evaluation/approve`, { method: "POST" }),

  // ── Phase 12 — Results ──────────────────────────────────────────────────────
  getPublicationReadiness: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/publication-readiness`),
  compileResults: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/results/compile`, { method: "POST" }),
  getResultsPreview: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/results/preview`),
  publishResults: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/results/publish`, { method: "POST" }),

  // ── Phase 13 — Leaks ────────────────────────────────────────────────────────
  getLeaksReports: (params?: { exam_id?: string; investigation_status?: string }) =>
    apiRequest<any[]>("/leaks/reports", { params }),
  getLeakReportDetail: (id: string) =>
    apiRequest<any>(`/leaks/reports/${id}`),

  // ── Phase 14 — Whistleblower ────────────────────────────────────────────────
  getWhistleblowerReports: (params?: { category?: string; routing_status?: string; exam_id?: string; page?: number }) =>
    apiRequest<any[]>("/admin/whistleblower-reports", { params }),
  getWhistleblowerReportDetail: (id: string) =>
    apiRequest<any>(`/admin/whistleblower-reports/${id}`),
  closeWhistleblowerReport: (id: string) =>
    apiRequest<any>(`/admin/whistleblower-reports/${id}/close`, { method: "PATCH" }),

  // ── Phase 15 — Grievances ───────────────────────────────────────────────────
  getAgencyGrievances: (examId: string, params?: { category?: string; status?: string }) =>
    apiRequest<any[]>(`/exams/${examId}/grievances`, { params }),
  getAgencyGrievanceDetail: (examId: string, id: string) =>
    apiRequest<any>(`/exams/${examId}/grievances/${id}`),
  assignGrievance: (id: string, body: { assigned_to: string }) =>
    apiRequest<any>(`/grievances/${id}/assign`, { method: "PATCH", body: JSON.stringify(body) }),
  resolveGrievance: (id: string, body: { resolution_notes: string; outcome: string }) =>
    apiRequest<any>(`/grievances/${id}/resolve`, { method: "PATCH", body: JSON.stringify(body) }),
};

export const studentApi = {
  register: (formData: FormData) =>
    apiRequest<any>("/students/register", { method: "POST", body: formData }),
  getMe: () =>
    apiRequest<any>("/students/me"),
  updateProfile: (body: any) =>
    apiRequest<any>("/students/me", { method: "PATCH", body: JSON.stringify(body) }),
  getRegistrationForm: (examId: string) =>
    apiRequest<any>(`/exams/${examId}/registration-form`),
  registerForExam: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/registrations`, { method: "POST", body: JSON.stringify(body) }),
  initiatePayment: (regId: string) =>
    apiRequest<any>(`/registrations/${regId}/payment/initiate`, { method: "POST" }),
  confirmPayment: (regId: string) =>
    apiRequest<any>(`/registrations/${regId}/payment/confirm`, { method: "POST" }),
  getRegistrations: () =>
    apiRequest<any[]>("/students/me/registrations"),
  getRegistrationDetail: (regId: string) =>
    apiRequest<any>(`/registrations/${regId}`),
  getAdmitCard: (regId: string) =>
    apiRequest<any>(`/registrations/${regId}/admit-card`),
  getMyResults: () =>
    apiRequest<any[]>("/students/me/results"),
  fileGrievance: (examId: string, formData: FormData) =>
    apiRequest<any>(`/exams/${examId}/grievances`, { method: "POST", body: formData }),
  getMyGrievances: () =>
    apiRequest<any[]>("/students/me/grievances"),
  getMyGrievanceDetail: (id: string) =>
    apiRequest<any>(`/students/me/grievances/${id}`),
};

export const centerApi = {
  login: (body: { email: string; password: string; center_slug: string }) =>
    apiRequest<any>("/center/login", { method: "POST", body: JSON.stringify(body) }),
  getMe: () =>
    apiRequest<any>("/center/me"),
  getLiveRooms: (examId: string, centerId: string) =>
    apiRequest<any[]>(`/exams/${examId}/centers/${centerId}/rooms/live`),
  getCheckinProgress: (examId: string, centerId: string) =>
    apiRequest<any>(`/exams/${examId}/centers/${centerId}/checkin-progress`),
  checkinVerify: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/checkin`, { method: "POST", body: JSON.stringify(body) }),
  checkinConfirm: (examId: string, body: any) =>
    apiRequest<any>(`/exams/${examId}/checkin/confirm`, { method: "POST", body: JSON.stringify(body) }),
  getAnswerSheets: (examId: string, params?: any) =>
    apiRequest<any[]>(`/exams/${examId}/answer-sheets`, { params }),
  uploadAnswerSheet: (examId: string, formData: FormData) =>
    apiRequest<any>(`/exams/${examId}/answer-sheets/upload`, { method: "POST", body: formData }),
  rescanAnswerSheet: (uploadId: string, formData: FormData) =>
    apiRequest<any>(`/answer-sheets/${uploadId}/rescan`, { method: "POST", body: formData }),
  sealAnswerSheet: (uploadId: string) =>
    apiRequest<any>(`/answer-sheets/${uploadId}/seal`, { method: "POST" }),
  sealAllAnswerSheets: (examId: string, centerId: string) =>
    apiRequest<any>(`/exams/${examId}/answer-sheets/seal-all`, { method: "POST", body: JSON.stringify({ center_id: centerId }) }),
  getTrunk: (trunkId: string) =>
    apiRequest<any>(`/trunks/${trunkId}`),
  requestTrunkUnlock: (trunkId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/unlock/request`, { method: "POST", body: JSON.stringify(body) }),
  confirmTrunkUnlock: (trunkId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/unlock/confirm`, { method: "POST", body: JSON.stringify(body) }),
  receiptConfirm: (trunkId: string, body: any) =>
    apiRequest<any>(`/trunks/${trunkId}/receipt-confirm`, { method: "POST", body: JSON.stringify(body) }),
};
