"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Users2, UserPlus, ShieldAlert, Mail, Phone, ShieldCheck, Ban, Trash2, Send, Plus, RefreshCw, CheckCircle } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function AgencyStaffPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [staff, setStaff] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<any[]>([]);

  // Invitation Form state
  const [isInviting, setIsInviting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("operator");
  const [formCenterId, setFormCenterId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ invite_token: string; temp_password: string } | null>(null);

  const allowedRoles = [
    { value: "manager", label: "Manager" },
    { value: "operator", label: "Operator" },
    { value: "transit_manager", label: "Transit Manager" },
    { value: "center_officer", label: "Center Officer" },
    { value: "chief_moderator", label: "Chief Moderator" },
    { value: "moderator", label: "Moderator" },
    { value: "grading_teacher", label: "Grading Teacher" }
  ];

  async function loadStaff() {
    try {
      setLoading(true);
      setError(null);
      
      // Load current user profile details
      const session = await agencyApi.getMe();
      setMyProfile(session.profile);

      // Fetch all staff members
      const list = await agencyApi.getStaff();
      setStaff(list);

      // Fetch exam centers
      const centersList = await agencyApi.getAgencyCenters();
      setCenters(centersList);
    } catch (err: any) {
      setError(err.message || "Failed to load staff records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setError(null);
    setInviteResult(null);

    try {
      const res = await agencyApi.addStaff({
        full_name: formName,
        email: formEmail,
        phone: formPhone,
        role: formRole,
        center_id: formCenterId || null
      });

      setInviteResult({
        invite_token: res.invite_token,
        temp_password: res.temp_password
      });

      // Clear Form
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setFormRole("operator");
      setFormCenterId("");

      // Reload list
      const list = await agencyApi.getStaff();
      setStaff(list);
    } catch (err: any) {
      setError(err.message || "Failed to invite staff member.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeCenter = async (id: string, newCenterId: string) => {
    try {
      setError(null);
      await agencyApi.updateStaff(id, { center_id: newCenterId || null });
      
      // Reload list
      const list = await agencyApi.getStaff();
      setStaff(list);
    } catch (err: any) {
      setError(err.message || "Failed to assign center to staff member.");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      setError(null);
      await agencyApi.updateStaff(id, { is_active: !currentActive });
      
      // Reload list
      const list = await agencyApi.getStaff();
      setStaff(list);
    } catch (err: any) {
      setError(err.message || "Failed to update staff member status.");
    }
  };

  const handleChangeRole = async (id: string, newRole: string) => {
    try {
      setError(null);
      await agencyApi.updateStaff(id, { role: newRole });
      
      // Reload list
      const list = await agencyApi.getStaff();
      setStaff(list);
    } catch (err: any) {
      setError(err.message || "Failed to change staff member role.");
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Are you sure you want to revoke access and delete this staff member?")) {
      return;
    }

    try {
      setError(null);
      await agencyApi.deleteStaff(id);
      
      // Reload list
      const list = await agencyApi.getStaff();
      setStaff(list);
    } catch (err: any) {
      setError(err.message || "Failed to delete staff member.");
    }
  };

  if (loading && staff.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 font-mono text-gray-500 text-xs uppercase">
        <span>Loading staff hierarchy...</span>
      </div>
    );
  }

  const isHead = myProfile?.role === "agency_head";

  return (
    <div className="space-y-8">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-gray-900 uppercase flex items-center space-x-3">
            <Users2 className="h-6 w-6 text-[#F26522]" />
            <span>Staff Hierarchy Management</span>
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider">
            Provision, authorize, and suspend operational staff members.
          </p>
        </div>
        <div className="flex space-x-3 shrink-0">
          <button
            onClick={loadStaff}
            className="inline-flex items-center space-x-1 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-full text-xs font-mono border border-gray-200 transition-all shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Roster</span>
          </button>
          {isHead && (
            <button
              onClick={() => {
                setIsInviting(!isInviting);
                setInviteResult(null);
              }}
              className="inline-flex items-center space-x-1.5 bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm"
            >
              {isInviting ? <Trash2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              <span>{isInviting ? "Close Form" : "Invite Staff"}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-600">
          {error}
        </div>
      )}

      {/* Invite form overlay/panel */}
      {isInviting && isHead && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2 border-b border-gray-100 pb-3">
            <UserPlus className="h-4.5 w-4.5 text-[#F26522]" />
            <span>Invite Operational Staff Member</span>
          </h3>

          {inviteResult && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono text-green-700 font-bold">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>STAFF PROVISIONED IN DB</span>
              </div>
              <p className="text-xs text-gray-600">
                Email invitation has been scheduled under Celery task registry. For local testing, copy the invite credentials below:
              </p>
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs font-mono text-gray-700 space-y-1.5">
                <p>• Setup URL: <strong className="text-[#F26522]">http://{slug}.localhost:3000/accept-invite?token={inviteResult.invite_token}</strong></p>
                <p>• Token: <strong className="text-gray-900 select-all">{inviteResult.invite_token}</strong></p>
                <p>• Temp Password: <strong className="text-gray-900 select-all">{inviteResult.temp_password}</strong></p>
              </div>
            </div>
          )}

          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="john@agency.com"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                />
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+91 98765..."
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522]"
                />
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Security Role
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              >
                {allowedRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                Assigned Center
              </label>
              <select
                value={formCenterId}
                onChange={(e) => setFormCenterId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] focus:ring-1 focus:ring-[#F26522] font-mono"
              >
                <option value="">None (Global Access/HQ)</option>
                {centers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-5 flex justify-end">
              <button
                type="submit"
                disabled={inviteLoading}
                className="inline-flex items-center space-x-2 bg-[#F26522] hover:bg-[#e05a1a] text-white px-4 py-2 rounded-full font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>[Send Invitation]</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Roster Grid/Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-gray-500">
            Registered Staff Registry // Directory List
          </span>
          <span className="bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Total Rows: {staff.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-gray-700">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 font-mono text-[10px] uppercase text-gray-500 tracking-wider">
                <th className="px-6 py-4">Staff Name</th>
                <th className="px-6 py-4">Email Address</th>
                <th className="px-6 py-4">Security Role</th>
                <th className="px-6 py-4">Assigned Center</th>
                <th className="px-6 py-4">Invited On</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {staff.map((member) => {
                const isMe = member.user_id === myProfile?.user_id;
                const isHeadMember = member.role === "agency_head";
                
                // Determine Status label
                let statusBadge = (
                  <span className="bg-green-50 text-green-700 border border-green-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                    Active
                  </span>
                );
                
                if (!member.joined_at) {
                  statusBadge = (
                    <span className="bg-yellow-50 text-yellow-700 border border-yellow-250 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase animate-pulse">
                      Invited
                    </span>
                  );
                } else if (!member.is_active) {
                  statusBadge = (
                    <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                      Suspended
                    </span>
                  );
                }

                return (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 flex items-center space-x-1.5">
                        <span>{member.full_name}</span>
                        {isMe && (
                          <span className="bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 text-[8px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">{member.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{member.email}</td>
                    <td className="px-6 py-4">
                      {isHead && !isMe && !isHeadMember ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value)}
                          className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono text-gray-700 focus:outline-none focus:border-[#F26522]"
                        >
                          {allowedRoles.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs uppercase font-mono bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-600">
                          {member.role?.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isHead && !isMe && !isHeadMember ? (
                        <select
                          value={member.center_id || ""}
                          onChange={(e) => handleChangeCenter(member.id, e.target.value)}
                          className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono text-gray-700 focus:outline-none focus:border-[#F26522]"
                        >
                          <option value="">None (Global Access/HQ)</option>
                          {centers.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-mono text-gray-700">
                          {centers.find((c: any) => c.id === member.center_id)?.name || "None (Global Access/HQ)"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      {new Date(member.invited_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">{statusBadge}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      {isHead && !isMe && !isHeadMember && (
                        <>
                          <button
                            onClick={() => handleToggleActive(member.id, member.is_active)}
                            title={member.is_active ? "Suspend access" : "Activate access"}
                            className={`inline-flex items-center justify-center p-1.5 rounded transition-all border ${
                              member.is_active 
                                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white" 
                                : "bg-green-50 text-green-600 border-green-200 hover:bg-green-600 hover:text-white"
                            }`}
                          >
                            {member.is_active ? <Ban className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(member.id)}
                            title="Soft delete staff"
                            className="inline-flex items-center justify-center p-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
