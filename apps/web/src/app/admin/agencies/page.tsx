"use client";

import React, { useState, useEffect } from "react";
import { Building2, Search, CheckCircle, AlertTriangle, ExternalLink, Calendar, MapPin, Eye, FileText, Ban } from "lucide-react";

interface Agency {
  id: string;
  name: string;
  official_email: string;
  pan_number: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DEREGISTERED";
  slug: string | null;
  created_at: string;
  approved_at: string | null;
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"PENDING" | "ACTIVE" | "SUSPENDED" | "ALL">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch agencies
  const fetchAgencies = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem("admin_token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const statusParam = activeTab === "ALL" ? "" : `status=${activeTab}`;
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      
      const url = `http://localhost:8000/api/v1/admin/agencies?${statusParam}${searchParam}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to retrieve onboarding agency records.");
      
      const data = await res.json();
      setAgencies(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Platform service connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, [activeTab, searchQuery]);

  // Handle actions
  const handleAgencyAction = async (id: string, action: "approve" | "reject" | "suspend") => {
    try {
      setActionLoading(true);
      const token = sessionStorage.getItem("admin_token");
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      
      const url = `http://localhost:8000/api/v1/admin/agencies/${id}/${action}`;
      const res = await fetch(url, { 
        method: "PATCH",
        headers 
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || `Action '${action}' failed.`);
      }
      
      const updatedAgency = await res.json();
      
      // Update local state (optimistic/in-place)
      setAgencies(prev => prev.map(a => a.id === id ? updatedAgency : a));
      if (selectedAgency?.id === id) {
        setSelectedAgency(updatedAgency);
      }
      
      // Refresh lists
      setTimeout(() => {
        fetchAgencies();
      }, 500);
      
    } catch (err: any) {
      alert(err.message || "Failed to execute administrative action.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: Agency["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
            Pending Approval
          </span>
        );
      case "ACTIVE":
        return (
          <span className="bg-green-50 text-green-650 border border-green-200 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
            Active
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="bg-red-50 text-red-655 border border-red-200 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
            Suspended
          </span>
        );
      case "DEREGISTERED":
        return (
          <span className="bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 relative min-h-[calc(100vh-10rem)]">
      {/* Top Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 font-mono tracking-tight">Onboarding & Agencies Registry</h1>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Review organization onboarding credentials, perform identity verification, and configure access levels.</p>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 border border-gray-200 rounded-2xl shadow-sm">
        {/* Tabs */}
        <div className="flex bg-gray-50 p-1 border border-gray-200 rounded-lg">
          {(["PENDING", "ACTIVE", "SUSPENDED", "ALL"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === tab 
                  ? "bg-[#F26522] text-white font-bold shadow-sm" 
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by agency name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 font-mono text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#F26522]"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-3 bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-655">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div>
            <span className="font-bold block mb-1">SYSTEM RETRIEVAL FAIL</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Table Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                <th className="py-4 px-6 font-bold">Organization / ID</th>
                <th className="py-4 px-6 font-bold">Official Contact</th>
                <th className="py-4 px-6 font-bold">PAN Reference</th>
                <th className="py-4 px-6 font-bold">Location</th>
                <th className="py-4 px-6 font-bold">Registry Date</th>
                <th className="py-4 px-6 font-bold">Status</th>
                <th className="py-4 px-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 font-mono text-xs">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="py-6 px-6">
                      <div className="h-4 bg-gray-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : agencies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-6 text-center text-gray-400 uppercase tracking-wider text-[11px]">
                    No agency records matching filters found.
                  </td>
                </tr>
              ) : (
                agencies.map((agency) => (
                  <tr 
                    key={agency.id} 
                    onClick={() => setSelectedAgency(agency)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6">
                      <span className="block font-bold text-gray-900 mb-0.5">{agency.name}</span>
                      <span className="block text-[9px] text-gray-400 uppercase">ID: {agency.id.substring(0, 8)}...</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="block text-gray-800">{agency.official_email}</span>
                      <span className="block text-[9px] text-gray-400">{agency.phone}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900 font-bold uppercase">{agency.pan_number}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="block text-gray-700">{agency.city}</span>
                      <span className="block text-[9px] text-gray-400 uppercase">{agency.state}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {new Date(agency.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(agency.status)}
                    </td>
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedAgency(agency)}
                        className="text-gray-500 hover:text-gray-950 bg-gray-50 border border-gray-200 p-2 rounded-lg transition-colors inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-[10px] px-1 font-bold uppercase">Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide Drawer for Selected Agency Details */}
      {selectedAgency && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="absolute inset-0" onClick={() => setSelectedAgency(null)} />
          
          <div className="relative w-full max-w-xl min-h-screen bg-white border-l border-gray-200 shadow-2xl p-8 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-150">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 font-mono flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-[#F26522]" />
                    <span>Agency Detail Verification</span>
                  </h2>
                  <p className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">ID: {selectedAgency.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedAgency(null)}
                  className="text-gray-500 hover:text-gray-900 font-mono text-sm px-2.5 py-1 border border-gray-200 rounded-full bg-gray-50 hover:bg-gray-150 transition-all cursor-pointer"
                >
                  [Esc]
                </button>
              </div>

              {/* Status Banner */}
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <div className="font-mono text-xs">
                  <span className="text-gray-400 uppercase block text-[9px] mb-0.5 font-bold">Registry Status</span>
                  {getStatusBadge(selectedAgency.status)}
                </div>
                <div className="font-mono text-xs text-right">
                  <span className="text-gray-400 uppercase block text-[9px] mb-0.5 font-bold">Subdomain Slug</span>
                  <span className="font-bold text-gray-900">{selectedAgency.slug ? `${selectedAgency.slug}.parikshasetu.in` : "[None Assigned]"}</span>
                </div>
              </div>

              {/* Details Fields */}
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-150">
                  <span className="text-gray-400 uppercase text-[9px] block mb-1 font-bold">Organization Legal Name</span>
                  <span className="text-gray-900 font-bold">{selectedAgency.name}</span>
                </div>
                <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-150">
                  <span className="text-gray-400 uppercase text-[9px] block mb-1 font-bold">PAN Identifier</span>
                  <span className="text-gray-900 font-bold uppercase">{selectedAgency.pan_number}</span>
                </div>
                <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-150">
                  <span className="text-gray-400 uppercase text-[9px] block mb-1 font-bold">Official Email</span>
                  <span className="text-gray-900 font-bold">{selectedAgency.official_email}</span>
                </div>
                <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-150">
                  <span className="text-gray-400 uppercase text-[9px] block mb-1 font-bold">Phone Number</span>
                  <span className="text-gray-900 font-bold">{selectedAgency.phone}</span>
                </div>
                <div className="col-span-2 bg-gray-50/50 p-3 rounded-lg border border-gray-150 space-y-1">
                  <span className="text-gray-400 uppercase text-[9px] block font-bold">Postal Address</span>
                  <p className="text-gray-900 font-bold">{selectedAgency.address}</p>
                  <p className="text-gray-550 text-[11px] flex items-center space-x-1">
                    <MapPin className="h-3 w-3 inline text-[#F26522]" />
                    <span>{selectedAgency.city}, {selectedAgency.state} - {selectedAgency.pincode}</span>
                  </p>
                </div>
              </div>

              {/* Submitted Verification Document */}
              <div className="space-y-2">
                <span className="text-gray-400 font-mono uppercase text-[9px] font-bold">Onboarding Attachments</span>
                <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-[#F26522]" />
                    <div className="font-mono text-xs">
                      <span className="block text-gray-900 font-bold">PAN_Verification_Document.pdf</span>
                      <span className="block text-[9px] text-gray-400 uppercase">Identity Proof Attachment</span>
                    </div>
                  </div>
                  <button className="text-white hover:bg-gray-800 bg-gray-900 px-3 py-1.5 rounded-full text-xs font-mono flex items-center space-x-1 cursor-pointer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>[View Scan]</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="pt-6 border-t border-gray-150 space-y-3">
              {selectedAgency.status === "PENDING" && (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAgencyAction(selectedAgency.id, "reject")}
                    className="w-full bg-red-50 border border-red-200 text-red-655 hover:bg-red-100 py-3 rounded-full font-mono text-xs uppercase font-bold tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    [Reject Request]
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAgencyAction(selectedAgency.id, "approve")}
                    className="w-full bg-[#F26522] border border-[#F26522] text-white hover:bg-[#e05a1a] py-3 rounded-full font-mono text-xs uppercase font-bold tracking-wider transition-all duration-200 shadow-md shadow-[#F26522]/10 disabled:opacity-50 cursor-pointer"
                  >
                    [Confirm & Approve]
                  </button>
                </div>
              )}

              {selectedAgency.status === "ACTIVE" && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAgencyAction(selectedAgency.id, "suspend")}
                  className="w-full bg-red-50 border border-red-200 text-red-655 hover:bg-red-100 py-3 rounded-full font-mono text-xs uppercase font-bold tracking-wider transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>[Suspend Portal Access]</span>
                </button>
              )}

              {selectedAgency.status === "SUSPENDED" && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAgencyAction(selectedAgency.id, "approve")}
                  className="w-full bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 py-3 rounded-full font-mono text-xs uppercase font-bold tracking-wider transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>[Lift Suspension & Approve]</span>
                </button>
              )}

              <p className="text-[9px] font-mono text-gray-400 text-center uppercase mt-2">
                All changes to agency status are recorded in the system audit logs.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
