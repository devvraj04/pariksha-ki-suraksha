'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { apiFetch } from '@/lib/api';

interface PrintSessionData {
  id: string;
  paper_id: string;
  authorized_by_a: string;
  authorized_by_b: string;
  authorized_copies: number;
  authorized_centers: string[];
  expires_at: string;
  is_active: boolean;
}

interface CenterProfile {
  id: string;
  name: string;
  city: string;
}

function SecureViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paperId = searchParams.get('paper_id');
  const sessionId = searchParams.get('session_id');

  const [session, setSession] = useState<PrintSessionData | null>(null);
  const [centers, setCenters] = useState<CenterProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Print Form state
  const [selectedCenter, setSelectedCenter] = useState('');
  const [printerId, setPrinterId] = useState('mock');
  const [copiesRequested, setCopiesRequested] = useState(1);
  const [spooling, setSpooling] = useState(false);
  const [spoolStatus, setSpoolStatus] = useState('');

  // PDF render state
  const [pdfPagesCount, setPdfPagesCount] = useState(0);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  const pdfDataRef = useRef<Uint8Array | null>(null);

  // Security and Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('Session Locked');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // 1. Fetch Print Session & Centers Metadata
  useEffect(() => {
    if (!paperId || !sessionId) {
      setError('Missing paper_id or session_id query parameters.');
      setLoading(false);
      return;
    }

    const loadMetadata = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        // Fetch session
        const { data: sessionData, error: sessionErr } = await supabase
          .from('print_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionErr || !sessionData) {
          setError('Failed to load print session. It may not exist.');
          setLoading(false);
          return;
        }

        const sess = sessionData as PrintSessionData;
        setSession(sess);

        if (!sess.is_active) {
          setError('Print session is inactive.');
          setLoading(false);
          return;
        }

        // Check expiration
        const expiresAt = new Date(sess.expires_at).getTime();
        const now = Date.now();
        if (expiresAt < now) {
          setError('Print session has expired.');
          setLoading(false);
          return;
        }

        // Set remaining time in seconds
        setTimeLeft(Math.floor((expiresAt - now) / 1000));

        // Fetch centers
        const { data: centersData } = await supabase
          .from('exam_centers')
          .select('id, name, city');

        if (centersData) {
          const filteredCenters = (centersData as CenterProfile[]).filter((c) =>
            sess.authorized_centers.includes(c.id)
          );
          setCenters(filteredCenters);
          if (filteredCenters.length > 0) {
            setSelectedCenter(filteredCenters[0].id);
          }
        }

        // Fetch PDF and Render
        await fetchAndRenderPDF(paperId);

      } catch (err: any) {
        setError(err.message || 'Error loading secure viewer metadata.');
        setLoading(false);
      }
    };

    loadMetadata();
  }, [paperId, sessionId]);

  // 2. Countdown Timer
  useEffect(() => {
    if (timeLeft === null || isLocked) return;

    if (timeLeft <= 0) {
      handleLock('Print window has expired.');
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          handleLock('Print window has expired.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, isLocked]);

  // 3. Screen Sharing Block & Shortcut Suppression
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Suppress keyboard shortcuts
    const preventShortcuts = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        alert('Security violation: Keyboard shortcut blocked.');
      }
    };

    // Suppress Right-Click Context Menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Override displayMedia to block screen captures
    let originalGetDisplayMedia: any = null;
    if (navigator.mediaDevices) {
      originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      navigator.mediaDevices.getDisplayMedia = async () => {
        throw new DOMException('Screen capture is restricted on this secure page.', 'NotAllowedError');
      };
    }

    // Visibility Change listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleLock('Tab focus lost. Security lock engaged.');
      }
    };

    document.addEventListener('keydown', preventShortcuts);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('keydown', preventShortcuts);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (navigator.mediaDevices && originalGetDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
    };
  }, []);

  // 4. Fetch PDF using View Token & Render on Canvas
  const fetchAndRenderPDF = async (pId: string) => {
    try {
      setLoading(true);
      
      // Request view token
      const tokenResp = await apiFetch<{ token: string }>(`/vault/papers/${pId}/view-token`);
      if (!tokenResp.success || !tokenResp.data?.token) {
        throw new Error(tokenResp.error?.message || 'Failed to acquire single-use view token.');
      }

      const token = tokenResp.data.token;

      // Fetch decrypted PDF blob
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const pdfUrl = `${API_BASE_URL}/vault/papers/${pId}/view?token=${token}`;
      
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to stream paper content: ${errText || response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfData = new Uint8Array(arrayBuffer);
      pdfDataRef.current = pdfData;

      // Load PDF via PDF.js
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs`;

      const loadingTask = pdfjs.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      setPdfPagesCount(pdf.numPages);
      setLoading(false);

      // Render pages onto canvases in next frame
      setTimeout(async () => {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const canvas = canvasRefs.current[i - 1];
          if (canvas) {
            const context = canvas.getContext('2d');
            if (context) {
              const viewport = page.getViewport({ scale: 1.5 });
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              
              const renderContext = {
                canvasContext: context,
                viewport: viewport,
              };
              await page.render(renderContext).promise;
            }
          }
        }
      }, 100);

    } catch (err: any) {
      setError(err.message || 'Decrypted PDF streaming failed.');
      setLoading(false);
    }
  };

  // Lock session and blank canvases
  const handleLock = (reason: string) => {
    setIsLocked(true);
    setLockReason(reason);
    
    // Clear canvas visual displays immediately
    canvasRefs.current.forEach((canvas) => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  };

  // Supervisor Re-authentication
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockLoading(true);
    setUnlockError('');

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Attempt login with supervisor credentials
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: unlockEmail,
        password: unlockPassword,
      });

      if (authErr) {
        setUnlockError(authErr.message);
        setUnlockLoading(false);
        return;
      }

      // Check role authorization
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (!profile || !['super_admin', 'supervisor', 'print_operator'].includes(profile.role)) {
        await supabase.auth.signOut();
        setUnlockError('Unauthorized. Only Super Admin, Supervisor, or Print Operator credentials can unlock.');
        setUnlockLoading(false);
        return;
      }

      // Re-fetch metadata, retrieve new view token, and re-render PDF
      setIsLocked(false);
      setUnlockEmail('');
      setUnlockPassword('');
      
      if (paperId) {
        await fetchAndRenderPDF(paperId);
      }

    } catch (err: any) {
      setUnlockError(err.message || 'Unlock process failed.');
    } finally {
      setUnlockLoading(false);
    }
  };

  // Form Submission — Spool Print Job
  const handleSpoolPrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperId || !sessionId || !selectedCenter) return;

    setSpooling(true);
    setSpoolStatus('Interacting with hardware spooler...');

    try {
      const resp = await apiFetch('/print/jobs', {
        method: 'POST',
        body: JSON.stringify({
          paper_id: paperId,
          session_id: sessionId,
          center_id: selectedCenter,
          printer_id: printerId,
          copies_requested: copiesRequested,
        }),
      });

      if (resp.success) {
        setSpoolStatus('Print job spooled and completed successfully!');
        alert('Success: Secure watermark tracking injected and print completed!');
        router.push('/print-room');
      } else {
        throw new Error(resp.error?.message || 'Print job request rejected.');
      }
    } catch (err: any) {
      setSpoolStatus(`Error: ${err.message}`);
      alert(`Print Failure: ${err.message}`);
    } finally {
      setSpooling(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="glass-card max-w-lg p-8 rounded-3xl border border-[var(--color-danger)]/20 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="font-serif text-2xl font-bold text-[var(--color-text-primary)]">
              Secure Viewer Error
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {error}
            </p>
            <div className="pt-4">
              <Link href="/print-room" className="btn-primary">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col relative select-none">
      <Header />

      {/* Main Container */}
      <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* PDF Canvas area (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6 relative">
          <div className="glass-card p-6 rounded-3xl flex flex-col min-h-[600px] border border-[var(--color-border-glass)] shadow-xl relative overflow-hidden">
            
            {/* Visual Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--color-border-indigo)] pb-4 mb-6 gap-3">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[var(--color-text-primary)]">
                  Decrypted Question Paper Canvas
                </h2>
                <p className="text-xs text-[var(--color-danger)] font-medium mt-1">
                  ⚠️ RESTRICTED ACCESS: Physical and digital captures are strictly logged.
                </p>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-indigo-100)] border border-[var(--color-border-indigo)] rounded-full text-xs text-[var(--color-indigo-900)] font-semibold font-mono">
                {pdfPagesCount} {pdfPagesCount === 1 ? 'PAGE' : 'PAGES'} LOADED
              </div>
            </div>

            {/* Canvas Rendering Loop */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-4 border-[var(--color-indigo-500)] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-[var(--color-text-muted)]">Assembling and decrypting shares in RAM...</span>
              </div>
            ) : (
              <div className="flex-grow space-y-6 overflow-y-auto max-h-[750px] p-4 bg-[var(--color-bg-soft)] rounded-2xl border border-[var(--color-border-glass-b)] flex flex-col items-center select-none">
                {Array.from({ length: pdfPagesCount }).map((_, index) => (
                  <div
                    key={index}
                    className="relative border border-[var(--color-border-glass)] bg-white rounded-xl shadow-md overflow-hidden max-w-full"
                  >
                    <canvas
                      ref={(el) => {
                        if (el) canvasRefs.current[index] = el;
                      }}
                      className="max-w-full h-auto"
                    />
                    <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center opacity-[0.04]">
                      <span className="text-6xl md:text-8xl font-bold text-black transform -rotate-45 font-mono select-none">
                        LEAKGUARD AI
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Session Locked Overlay */}
            {isLocked && (
              <div className="absolute inset-0 glass-modal flex items-center justify-center p-6 z-50">
                <div className="w-full max-w-md bg-white/60 border border-white/80 p-8 rounded-3xl shadow-2xl text-center space-y-6">
                  <div className="w-14 h-14 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] flex items-center justify-center mx-auto text-2xl font-bold animate-pulse shadow-[var(--shadow-danger)]">
                    🔒
                  </div>
                  
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[var(--color-text-primary)]">
                      {lockReason}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                      Enter supervisor or admin credentials to unlock session and resume rendering.
                    </p>
                  </div>

                  {unlockError && (
                    <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 rounded-xl text-xs text-[var(--color-danger)] font-medium text-left">
                      {unlockError}
                    </div>
                  )}

                  <form onSubmit={handleUnlock} className="space-y-4 text-left">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-1.5">
                        Supervisor Email
                      </label>
                      <input
                        type="email"
                        required
                        value={unlockEmail}
                        onChange={(e) => setUnlockEmail(e.target.value)}
                        className="input-field w-full text-xs"
                        placeholder="supervisor@leakguard.ai"
                        disabled={unlockLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-1.5">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        className="input-field w-full text-xs"
                        placeholder="••••••••"
                        disabled={unlockLoading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={unlockLoading}
                      className="btn-primary w-full py-2.5 text-xs disabled:opacity-50"
                    >
                      {unlockLoading ? 'Verifying Credentials...' : 'Unlock Viewer'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls (Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Timer Display */}
          <div className="glass-card p-6 rounded-3xl border border-[var(--color-border-glass)] shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                Print Window Time
              </span>
              <h3 className="font-serif text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                Remaining Duration
              </h3>
            </div>
            
            <div className={`px-4 py-2.5 rounded-2xl font-mono text-2xl font-bold shadow-sm ${
              timeLeft !== null && timeLeft < 60
                ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] animate-pulse'
                : 'bg-[var(--color-indigo-100)] text-[var(--color-indigo-900)]'
            }`}>
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
          </div>

          {/* Secure Spooler Form */}
          <div className="glass-card p-6 rounded-3xl border border-[var(--color-border-glass)] shadow-md space-y-6">
            <h3 className="font-serif text-xl font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border-indigo)] pb-3">
              Spool Print Job
            </h3>

            <form onSubmit={handleSpoolPrint} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-1.5">
                  Authorized Exam Center
                </label>
                {centers.length > 0 ? (
                  <select
                    value={selectedCenter}
                    onChange={(e) => setSelectedCenter(e.target.value)}
                    className="input-field w-full text-xs"
                    required
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.city})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-[var(--color-text-muted)] p-3.5 bg-black/5 rounded-xl border border-dashed border-black/10">
                    No authorized centers found in session settings.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-1.5">
                  Spool Printer Port ID
                </label>
                <input
                  type="text"
                  required
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                  className="input-field w-full text-xs"
                  placeholder="mock"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-indigo-900)] uppercase tracking-widest mb-1.5">
                  Copies Count
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={session ? session.authorized_copies : 50}
                  value={copiesRequested}
                  onChange={(e) => setCopiesRequested(parseInt(e.target.value) || 1)}
                  className="input-field w-full text-xs"
                />
                <span className="text-[10px] text-[var(--color-text-muted)] mt-1.5 block">
                  Limit: {session ? session.authorized_copies : '--'} authorized copies.
                </span>
              </div>

              {spoolStatus && (
                <div className="p-3 bg-[var(--color-indigo-050)] border border-[var(--color-border-indigo)] rounded-xl text-xs text-[var(--color-indigo-900)] font-mono font-medium">
                  {spoolStatus}
                </div>
              )}

              <button
                type="submit"
                disabled={spooling || centers.length === 0}
                className="btn-official w-full py-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {spooling ? 'Watermarking & Spooling...' : 'Spool Print Copy Job'}
              </button>
            </form>
          </div>

          {/* Session Details */}
          <div className="glass-card p-6 rounded-3xl border border-[var(--color-border-glass)] shadow-md space-y-4">
            <h3 className="font-serif text-sm font-bold text-[var(--color-indigo-900)] uppercase tracking-widest border-b border-[var(--color-border-indigo)] pb-2">
              Authentication Audit
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[var(--color-text-muted)] font-medium block">Authorized Authority A:</span>
                <span className="font-mono bg-black/5 px-2 py-0.5 rounded text-[10px] text-[var(--color-text-secondary)] mt-1 inline-block break-all">
                  {session?.authorized_by_a || 'Loading...'}
                </span>
              </div>

              <div>
                <span className="text-[var(--color-text-muted)] font-medium block">Authorized Authority B:</span>
                <span className="font-mono bg-black/5 px-2 py-0.5 rounded text-[10px] text-[var(--color-text-secondary)] mt-1 inline-block break-all">
                  {session?.authorized_by_b || 'Loading...'}
                </span>
              </div>

              <div>
                <span className="text-[var(--color-text-muted)] font-medium block">Active Session Token:</span>
                <span className="font-mono text-[10px] text-[var(--color-success)] mt-0.5 block">
                  RAM CACHE ACTIVE
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function SecureViewerPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[var(--color-indigo-500)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </main>
    }>
      <SecureViewerContent />
    </Suspense>
  );
}
