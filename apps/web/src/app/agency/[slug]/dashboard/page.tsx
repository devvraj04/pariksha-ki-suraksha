"use client";

import React, { useState, useEffect } from "react";
import { Building2, Phone, MapPin, User, Shield, CheckCircle, Edit3, Save, X } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function AgencyDashboardPage() {
  const [data, setData] = useState<{ agency: any; profile: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await agencyApi.getMe();
        setData(res);
        setPhone(res.agency.phone || "");
        setAddress(res.agency.address || "");
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard metrics.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setError(null);
    setEditSuccess(false);

    try {
      const updatedAgency = await agencyApi.updateProfile({ phone, address });
      setData((prev: any) => (prev ? { ...prev, agency: updatedAgency } : null));
      setEditSuccess(true);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to update agency profile.");
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 font-mono text-gray-550 text-xs uppercase">
        <span>Loading workspace stats...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-650 font-bold shadow-sm">
        {error}
      </div>
    );
  }

  const { agency, profile } = data!;
  const isHead = profile?.role === "agency_head";

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-gray-900 uppercase">
            Welcome back, <span className="text-[#F26522]">{profile?.full_name || "Agent"}</span>
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider">
            Clearance Level: {profile?.role?.replace("_", " ")} // Session active since {profile?.joined_at ? new Date(profile.joined_at).toLocaleDateString() : "Activation"}
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 text-green-700 border border-green-200 text-xs font-mono px-3 py-1.5 rounded-xl shrink-0 font-bold">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>AGENCY STATUS // {agency?.status}</span>
        </div>
      </div>

      {/* Grid statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">
            Registered Agency Name
          </span>
          <div className="text-lg font-bold text-gray-900 font-mono uppercase truncate">
            {agency?.name}
          </div>
          <div className="text-[10px] font-mono text-[#F26522] mt-2 font-bold">
            PAN: {agency?.pan_number}
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">
            Active Examinations
          </span>
          <div className="text-3xl font-bold text-gray-900 font-mono">
            0
          </div>
          <div className="text-[10px] font-mono text-gray-400 mt-2 uppercase">
            No active registrations in cycle
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">
            Center Staff Count
          </span>
          <div className="text-3xl font-bold text-gray-900 font-mono">
            1
          </div>
          <div className="text-[10px] font-mono text-gray-400 mt-2 uppercase">
            Only agency head provisioned
          </div>
        </div>
      </div>

      {/* Profile Details & Inline updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agency details panel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2 font-bold">
              <Building2 className="h-4 w-4 text-[#F26522]" />
              <span>Agency Profile Details</span>
            </h3>
            {isHead && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1 text-xs font-mono text-[#F26522] hover:text-[#e05a1a] transition-colors uppercase font-bold"
              >
                <Edit3 className="h-3 w-3" />
                <span>[Edit Profile]</span>
              </button>
            )}
          </div>

          {editSuccess && (
            <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-xs font-mono text-green-700 font-bold">
              Agency profile details updated successfully.
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
                  Head Office Address
                </label>
                <textarea
                  rows={3}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] resize-none"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center space-x-1.5 bg-[#F26522] text-white px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#e05a1a] transition-all disabled:opacity-50 shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>[Save Changes]</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setPhone(agency.phone || "");
                    setAddress(agency.address || "");
                  }}
                  className="inline-flex items-center space-x-1.5 bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-mono uppercase hover:bg-gray-50 transition-all shadow-sm"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>[Cancel]</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <span className="block text-[10px] font-mono text-gray-500 uppercase">
                  Official Email
                </span>
                <span className="text-gray-900 block truncate font-medium">{agency?.official_email}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-mono text-gray-500 uppercase">
                  Contact Phone
                </span>
                <span className="text-gray-900 block font-mono font-medium">{agency?.phone}</span>
              </div>
              <div className="space-y-1 md:col-span-2">
                <span className="block text-[10px] font-mono text-gray-500 uppercase">
                  Registered Address
                </span>
                <span className="text-gray-900 block font-medium">{agency?.address}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-mono text-gray-500 uppercase">
                  City / State
                </span>
                <span className="text-gray-900 block font-medium">{agency?.city}, {agency?.state}</span>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-mono text-gray-500 uppercase">
                  Pincode
                </span>
                <span className="text-gray-900 block font-mono font-medium">{agency?.pincode}</span>
              </div>
            </div>
          )}
        </div>

        {/* Staff details panel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="text-sm font-mono uppercase tracking-widest text-gray-900 flex items-center space-x-2 font-bold">
              <User className="h-4 w-4 text-[#F26522]" />
              <span>Operator Session Profile</span>
            </h3>
            <span className="bg-green-50 text-green-700 border border-green-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center space-x-1">
              <Shield className="h-3 w-3 text-green-600" />
              <span>Session Authenticated</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-gray-500 uppercase">
                Staff Member Name
              </span>
              <span className="text-gray-900 block font-bold">{profile?.full_name}</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-gray-500 uppercase">
                Registry Email
              </span>
              <span className="text-gray-900 block truncate font-medium">{profile?.email}</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-gray-500 uppercase">
                Assigned Role Type
              </span>
              <span className="text-gray-900 block uppercase font-mono font-medium">{profile?.role?.replace("_", " ")}</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-gray-500 uppercase">
                Operator Registry ID
              </span>
              <span className="text-gray-900 block font-mono text-xs font-medium">{profile?.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
