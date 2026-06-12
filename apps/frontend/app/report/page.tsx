'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function ForensicPortal() {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image file to upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/v1/forensic/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to upload image');
      }

      // Redirect to the status tracking page
      router.push(`/report/status/${data.data.job_id}`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during upload.');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-radial from-slate-900 to-black text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-600/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-20 -left-20 w-80 h-80 bg-blue-600/10 blur-[80px] rounded-full"></div>
      </div>

      <div className="w-full max-w-xl bg-slate-950/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10 transition-all duration-500 hover:shadow-rose-900/10 hover:border-slate-700">
        <div className="text-center mb-8">
          <div className="inline-block bg-rose-600/20 text-rose-400 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4 ring-1 ring-rose-500/30 animate-pulse">
            Public Leak Portal
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-br from-white via-rose-100 to-rose-400 bg-clip-text text-transparent drop-shadow-sm mb-3">
            See Something. Secure Something.
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            Submit suspected examination paper leakage photos or documents anonymously. Our forensic engine will analyze the image for watermarks.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-200 text-sm flex items-start animate-fade-in">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Leaked Document Photo / Image
            </label>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg, image/png, image/webp" 
              className="hidden" 
            />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group ${
                isDragging 
                  ? 'border-rose-500 bg-rose-900/10 scale-[1.02]' 
                  : file 
                    ? 'border-green-500/50 bg-green-900/10 hover:bg-green-900/20' 
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 mb-4 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                {file ? (
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-slate-400 group-hover:text-rose-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
              </div>
              
              <span className={`text-sm font-medium ${file ? 'text-green-300' : 'text-slate-300'}`}>
                {file ? file.name : 'Click to browse or drag & drop'}
              </span>
              <span className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-wider">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Supports PNG, JPEG up to 10MB'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Additional Details <span className="text-slate-600 normal-case tracking-normal font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all text-white h-24 resize-none placeholder-slate-600"
              placeholder="Provide any context about where or when this image was obtained..."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !file}
            className={`w-full font-bold py-4 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 ${
              isSubmitting || !file
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/20 active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Encrypting & Uploading...
              </>
            ) : (
              'Submit Secure Anonymous Report'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/50 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-medium">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Fully anonymous submission. IP hashes are encrypted.
        </div>
      </div>
    </main>
  );
}
