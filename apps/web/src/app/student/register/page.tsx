"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Upload, Loader2, CheckCircle2, ShieldCheck, UserPlus, Info } from "lucide-react";
import { studentApi } from "@/lib/api";

export default function StudentRegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("MALE");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [idType, setIdType] = useState("Aadhaar");
  const [idNumber, setIdNumber] = useState("");

  // Files
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreviewName, setIdPreviewName] = useState<string | null>(null);

  // Webcam Capture Mode
  const [useWebcam, setUseWebcam] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop webcam stream helper
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  // Start webcam
  const startWebcam = async () => {
    setError(null);
    setUseWebcam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setWebcamActive(true);
    } catch (err: any) {
      setError("Webcam access denied. Please grant permission or upload photo.");
      setUseWebcam(false);
    }
  };

  // Capture photo from canvas
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 400, 300);
        canvas.toBlob((blob) => {
          if (blob) {
            setPhotoBlob(blob);
            setPhotoPreview(canvas.toDataURL("image/jpeg"));
            stopWebcam();
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  // Handle file uploads
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoBlob(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setUseWebcam(false);
      stopWebcam();
    }
  };

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdFile(file);
      setIdPreviewName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!photoBlob) {
      setError("Biometric face photo is required.");
      return;
    }
    if (!idFile) {
      setError("ID proof scan is required.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("full_name", fullName);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("phone", phone);
      formData.append("date_of_birth", dob);
      formData.append("gender", gender);
      formData.append("address", address);
      formData.append("city", city);
      formData.append("state", state);
      formData.append("pincode", pincode);
      formData.append("id_proof_type", idType);
      formData.append("id_proof_number", idNumber);
      
      // Append files
      formData.append("photo", photoBlob, "profile_cam.jpg");
      formData.append("id_proof_scan", idFile, idFile.name);

      await studentApi.register(formData);
      setSuccess(true);
      setTimeout(() => {
        router.push("/student/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col items-center justify-center p-6 selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Brand logo link */}
      <div className="h-16 flex items-center space-x-3 mb-6">
        <div className="bg-[#F26522] p-2 rounded-xl shadow-md">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="font-mono font-bold text-lg tracking-wider text-gray-900">
            PARIKSHA<span className="text-[#F26522]">SETU</span>
          </span>
          <span className="block text-[9px] font-mono tracking-widest text-gray-500 uppercase">
            secured student registry
          </span>
        </div>
      </div>

      <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 space-y-6">
          <div className="border-b border-gray-150 pb-4">
            <h1 className="text-xl font-bold font-mono text-gray-900 uppercase flex items-center space-x-2">
              <UserPlus className="h-5 w-5 text-[#F26522]" />
              <span>Create Candidate Account</span>
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Please fill all fields accurately. Biometric verification will be carried out on exam day.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs font-mono text-red-655">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold font-mono text-gray-900 uppercase">Account Provisioned</h3>
              <p className="text-xs text-gray-500 font-mono">
                Redirecting to secure login interface...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECTION 1: Personal Details */}
              <div className="space-y-4">
                <span className="block text-xs font-mono uppercase text-[#F26522] border-b border-gray-150 pb-1">
                  1. Personal & Contact Details
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Full Name (As on Certificate)</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Login Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Phone Number (with OTP support)</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                    >
                      <option value="MALE" className="bg-white text-gray-900">MALE</option>
                      <option value="FEMALE" className="bg-white text-gray-900">FEMALE</option>
                      <option value="OTHER" className="bg-white text-gray-900">OTHER</option>
                      <option value="PREFER_NOT_TO_SAY" className="bg-white text-gray-900">PREFER NOT TO SAY</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Residential Address</label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Pincode</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Identity & Biometrics */}
              <div className="space-y-4">
                <span className="block text-xs font-mono uppercase text-[#F26522] border-b border-gray-150 pb-1">
                  2. Identity & Biometrics Verification
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Government ID Proof Type</label>
                      <select
                        value={idType}
                        onChange={(e) => setIdType(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522]"
                      >
                        <option value="Aadhaar" className="bg-white text-gray-900">Aadhaar Card (UIDAI)</option>
                        <option value="PAN" className="bg-white text-gray-900">PAN Card</option>
                        <option value="Passport" className="bg-white text-gray-900">Indian Passport</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">ID Card Number</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 12-digit Aadhaar / alphanumeric PAN"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-[#F26522] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Upload ID Proof Scan (PDF/Image)</label>
                      <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 hover:bg-gray-50 p-4 rounded-xl cursor-pointer transition-all">
                        <Upload className="h-6 w-6 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500 font-mono text-center">
                          {idPreviewName || "Click to browse scanner PDF"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          required
                          onChange={handleIdUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Photo capture section */}
                  <div className="space-y-4">
                    <label className="block text-[10px] font-mono uppercase text-gray-500">
                      Live Biometric Face Capture
                    </label>

                    {/* Camera overlay container */}
                    <div className="relative aspect-video bg-gray-950 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
                      {useWebcam && webcamActive ? (
                        <>
                          <video
                            ref={videoRef}
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          {/* Face Box Overlay */}
                          <div className="absolute inset-0 border-[3px] border-dashed border-green-500/50 m-8 rounded-[50%] pointer-events-none flex items-center justify-center">
                            <span className="bg-green-950/80 border border-green-500/40 text-[9px] font-mono text-green-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              Align Face Here
                            </span>
                          </div>
                        </>
                      ) : photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Captured profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-gray-500 font-mono text-[10px] p-6">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <span>No live feed. Trigger webcam check.</span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      {useWebcam && webcamActive ? (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-mono font-bold uppercase hover:bg-green-500 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Capture Photo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startWebcam}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          <Camera className="h-4 w-4" />
                          <span>[Open Webcam]</span>
                        </button>
                      )}
                      
                      <label className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 py-1.5 rounded-lg text-xs font-mono uppercase cursor-pointer flex items-center justify-center space-x-2">
                        <Upload className="h-4 w-4" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg flex items-start space-x-2 text-[10px] font-mono text-gray-500 border border-gray-100">
                      <Info className="h-4 w-4 text-[#F26522] shrink-0 mt-0.5" />
                      <p>
                        This image represents the master template for live matching checks on exam day. Avoid filters, caps, or glasses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit panel */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gray-150 pt-6 gap-4">
                <span className="text-[10px] font-mono text-gray-500 uppercase">
                  Already have an account?{" "}
                  <Link href="/student/login" className="text-[#F26522] hover:underline font-bold">
                    Access Portal
                  </Link>
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#F26522] hover:bg-[#e05a1a] disabled:opacity-50 text-white px-6 py-3 rounded-full text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-md shadow-[#F26522]/10 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating biometric signatures...</span>
                    </>
                  ) : (
                    <>
                      <span>Register & Set Up Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
