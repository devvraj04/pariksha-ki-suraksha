"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, FileText, MapPin, Phone, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function AgencyRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    organization_name: "",
    official_email: "",
    pan_number: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic Validation
    if (!formData.organization_name || !formData.official_email || !formData.pan_number || !formData.phone) {
      setError("Please fill out all mandatory fields.");
      setLoading(false);
      return;
    }

    try {
      await agencyApi.register(formData);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred during registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#EFEFEF] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-[#F26522]/30 selection:text-[#F26522]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#F26522]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
          <div className="bg-white py-8 px-6 shadow-sm rounded-2xl sm:px-10 border border-gray-200 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-tr from-green-500 to-emerald-600 p-3 rounded-full shadow-xl shadow-green-500/10">
                <CheckCircle className="h-12 w-12 text-white stroke-[2.5]" />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-mono uppercase mb-4">
              Registration Received
            </h2>
            <p className="text-sm font-sans text-gray-600 mb-6 leading-relaxed">
              Your onboarding request for <span className="text-[#F26522] font-semibold">{formData.organization_name}</span> has been logged under audit trail <code className="text-xs bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-[#F26522] font-bold">AGENCY_REGISTRATION_REQUESTED</code>.
            </p>
            <div className="bg-gray-50 border border-gray-250 p-4 rounded-xl text-left text-xs text-gray-650 space-y-2 mb-6">
              <p>• Our platform administrators will verify your PAN: <strong className="text-gray-900 font-bold">{formData.pan_number}</strong></p>
              <p>• Notification will be sent to: <strong className="text-gray-900 font-bold">{formData.official_email}</strong></p>
              <p>• Once approved, you can access your subdomain login.</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="w-full font-mono bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-[#F26522]/15 transition-all duration-200 uppercase text-sm tracking-wider"
            >
              Return to Landing Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFEFEF] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-[#F26522]/30 selection:text-[#F26522]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#F26522]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <button
          onClick={() => router.push("/")}
          className="mb-6 inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-gray-500 hover:text-[#F26522] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </button>
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-[#F26522] p-2 rounded-2xl shadow-lg shadow-[#F26522]/10">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-mono uppercase">
            PARIKSHA<span className="text-[#F26522]">SETU</span> ONBOARDING
          </h2>
        </div>
        <p className="text-xs font-mono uppercase tracking-wider text-gray-500">
          Register your testing/examination agency on the secure platform.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-gray-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-start space-x-2.5 bg-red-50 border border-red-200 p-3 rounded-xl text-xs font-mono text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  Organization Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    name="organization_name"
                    type="text"
                    required
                    value={formData.organization_name}
                    onChange={handleChange}
                    placeholder="e.g. National Testing Board"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                  />
                </div>
              </div>

              {/* Official Email */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  Official Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    name="official_email"
                    type="email"
                    required
                    value={formData.official_email}
                    onChange={handleChange}
                    placeholder="head@agency.org"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                  />
                </div>
              </div>

              {/* PAN Number */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  PAN Identifier / Tax ID *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    name="pan_number"
                    type="text"
                    required
                    value={formData.pan_number}
                    onChange={handleChange}
                    placeholder="ABCDE1234F"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors uppercase"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  Contact Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    name="phone"
                    type="text"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                  />
                </div>
              </div>

              {/* Pincode */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  Pincode
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    name="pincode"
                    type="text"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="110001"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  Office Address
                </label>
                <div className="relative">
                  <textarea
                    name="address"
                    rows={2}
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Plot No 4, Sector 10, Knowledge Park"
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors resize-none"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  City
                </label>
                <input
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="New Delhi"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  State
                </label>
                <input
                  name="state"
                  type="text"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Delhi"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F26522] transition-colors"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full font-mono bg-[#F26522] hover:bg-[#e05a1a] text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-[#F26522]/15 transition-all duration-200 uppercase text-sm tracking-wider hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Registering Agency..." : "Submit Registration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
