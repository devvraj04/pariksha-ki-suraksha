"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, RefreshCw, AlertTriangle, ShieldAlert, Lock } from "lucide-react";

interface PlatformConfig {
  default_visibility_threshold: number;
  default_geofence_radius_meters: number;
  watermark_master_key_ref: string;
  hsm_integration_mode: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<PlatformConfig>({
    default_visibility_threshold: 8.0,
    default_geofence_radius_meters: 100,
    watermark_master_key_ref: "WATERMARK_MASTER_KEY",
    hsm_integration_mode: "Supabase Vault"
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch config
  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = sessionStorage.getItem("admin_token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await fetch("http://localhost:8000/api/v1/admin/config", { headers });
      if (!res.ok) throw new Error("Failed to load platform global parameters.");
      
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to query system config service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const token = sessionStorage.getItem("admin_token");
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      
      const res = await fetch("http://localhost:8000/api/v1/admin/config", {
        method: "PUT",
        headers,
        body: JSON.stringify(config)
      });
      
      if (!res.ok) throw new Error("Failed to save updated config parameters.");
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to commit system config changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 font-mono tracking-tight">Global Security & Rule Configuration</h1>
          <p className="text-xs text-gray-500">Manage global default heuristics, cryptographic modules, and geofencing tolerances.</p>
        </div>
        
        <button
          onClick={fetchConfig}
          disabled={loading || saving}
          className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 px-3.5 py-2 rounded-full font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(loading || saving) ? "animate-spin" : ""}`} />
          <span>[Reload Parameters]</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start space-x-3 bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-655">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div>
            <span className="font-bold block mb-1">CONFIGURATION ACCESS ERROR</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start space-x-3 bg-green-50 border border-green-200 p-4 rounded-xl text-xs font-mono text-green-600">
          <Settings className="h-5 w-5 shrink-0 text-green-500" />
          <div>
            <span className="font-bold block mb-1">UPDATES COMMITTED SUCCESSFULLY</span>
            <span>All global configurations have been written to the master config server.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Heuristics */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-gray-150">
              <ShieldAlert className="h-4 w-4 text-[#F26522]" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-gray-900 font-bold">Answer Sheet OCR & Visual Guard Heuristics</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase text-gray-900 font-bold block">
                  Default Visibility Threshold (0 - 10)
                </label>
                <p className="text-[10px] text-gray-550 leading-normal mb-2">
                  The minimum page score required to pass automatic visual vetting. Scores below this require manual validation.
                </p>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="10.0"
                  required
                  value={config.default_visibility_threshold}
                  onChange={(e) => setConfig({...config, default_visibility_threshold: parseFloat(e.target.value)})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 font-mono text-xs text-gray-900 focus:outline-none focus:border-[#F26522]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase text-gray-900 font-bold block">
                  Geofence Guard Radius (Meters)
                </label>
                <p className="text-[10px] text-gray-550 leading-normal mb-2">
                  Radial distance buffer around exam centers for trunk-opening alerts. Crossings trigger immediate security responses.
                </p>
                <input
                  type="number"
                  required
                  value={config.default_geofence_radius_meters}
                  onChange={(e) => setConfig({...config, default_geofence_radius_meters: parseInt(e.target.value)})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 font-mono text-xs text-gray-900 focus:outline-none focus:border-[#F26522]"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Cryptographic Settings */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-gray-150">
              <Lock className="h-4 w-4 text-[#F26522]" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-gray-900 font-bold">Key Vault & HSM Cryptography Core</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase text-gray-900 font-bold block">
                  HSM Integration Hardware Module
                </label>
                <p className="text-[10px] text-gray-550 leading-normal mb-2">
                  Select the underlying security module for storing secondary shares of exam key-pairs.
                </p>
                <select
                  value={config.hsm_integration_mode}
                  onChange={(e) => setConfig({...config, hsm_integration_mode: e.target.value})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 font-mono text-xs text-gray-900 focus:outline-none focus:border-[#F26522]"
                >
                  <option value="Supabase Vault" className="bg-white text-gray-900">Supabase Vault (Software Dev Reference)</option>
                  <option value="AWS CloudHSM" className="bg-white text-gray-900">AWS CloudHSM v2 (Hardware Cryptokernel)</option>
                  <option value="Azure HSM" className="bg-white text-gray-900">Azure Dedicated HSM Service</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase text-gray-900 font-bold block">
                  Watermark Master Key Reference
                </label>
                <p className="text-[10px] text-gray-550 leading-normal mb-2">
                  The environment reference name for encoding the steganographic matrix on question paper layouts.
                </p>
                <input
                  type="text"
                  required
                  value={config.watermark_master_key_ref}
                  onChange={(e) => setConfig({...config, watermark_master_key_ref: e.target.value})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 font-mono text-xs text-gray-900 focus:outline-none focus:border-[#F26522]"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 bg-[#F26522] hover:bg-[#e05a1a] text-white px-5 py-3 rounded-full font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-md shadow-[#F26522]/10 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>[Commit Settings to Ledger]</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
