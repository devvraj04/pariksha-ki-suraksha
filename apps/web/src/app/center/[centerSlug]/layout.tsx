"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  ShieldAlert, LayoutDashboard, UserCheck, Activity, KeyRound, 
  ScanLine, LogOut, Loader2, Menu, X, Landmark, Calendar, User
} from "lucide-react";
import { centerApi } from "@/lib/api";

interface CenterContextType {
  center: any;
  exam: any;
  officerName: string;
  refreshData: () => Promise<void>;
}

const CenterContext = createContext<CenterContextType | null>(null);

export function useCenter() {
  const context = useContext(CenterContext);
  if (!context) {
    throw new Error("useCenter must be used within a CenterLayout");
  }
  return context;
}

export default function CenterLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const centerSlug = params.centerSlug as string;

  const [loading, setLoading] = useState(true);
  const [centerData, setCenterData] = useState<any>(null);
  const [officerName, setOfficerName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname.endsWith("/login");

  const loadCenterDetails = async () => {
    try {
      const res = await centerApi.getMe();
      setCenterData(res);
      
      // Try to recover officer name from sessionStorage
      if (typeof window !== "undefined") {
        setOfficerName(sessionStorage.getItem("center_officer_name") || "Officer");
      }
    } catch (err) {
      console.error("Failed to load center session:", err);
      if (!isLoginPage) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const token = sessionStorage.getItem("center_token");
    if (!token) {
      router.push("/login");
      setLoading(false);
      return;
    }

    loadCenterDetails();
  }, [pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem("center_token");
    sessionStorage.removeItem("center_officer_name");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span>Authenticating center security keys...</span>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  const exam = centerData?.exams || null;

  const navItems = [
    { label: "Console Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Student Check-In", path: "/checkin", icon: UserCheck },
    { label: "Live Room Feeds", path: "/rooms", icon: Activity },
    { label: "Unlock Trunks", path: "/trunk-unlock", icon: KeyRound },
    { label: "Scan Answer Sheets", path: "/answer-sheets", icon: ScanLine },
  ];

  return (
    <CenterContext.Provider value={{ center: centerData, exam, officerName, refreshData: loadCenterDetails }}>
      <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex flex-col md:flex-row font-sans selection:bg-[#F26522]/30 selection:text-[#F26522]">
        
        {/* Mobile Header */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0 md:hidden z-50 shadow-sm">
          <div className="flex items-center space-x-2">
            <Landmark className="h-5 w-5 text-[#F26522]" />
            <span className="font-mono font-bold text-sm tracking-wider">
              PORTAL<span className="text-[#F26522]">CENTER</span>
            </span>
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-500 hover:text-gray-900 focus:outline-none"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {/* Sidebar Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 w-64 bg-gray-900 border-r border-gray-800 z-40 transform transition-transform duration-300 md:translate-x-0 md:relative
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          flex flex-col justify-between p-6 shrink-0 text-white
        `}>
          <div className="space-y-8">
            {/* Logo area */}
            <div className="flex items-center space-x-3 border-b border-gray-800 pb-4">
              <div className="bg-[#F26522] p-1.5 rounded-lg">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-mono font-bold text-sm tracking-wider text-white">
                  PORTAL<span className="text-[#F26522]">CENTER</span>
                </span>
                <span className="block text-[8px] font-mono tracking-widest text-gray-400 uppercase">
                  secured on-site node
                </span>
              </div>
            </div>

            {/* Nav list */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                // Match exact dashboard root `/` or path prefixes
                const isActive = item.path === "/" 
                  ? pathname === "/" || pathname === "" 
                  : pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-mono font-bold uppercase transition-all tracking-wider
                      ${isActive 
                        ? "bg-[#F26522] text-white shadow-lg shadow-[#F26522]/15" 
                        : "text-gray-400 hover:text-white hover:bg-gray-800/40 border border-transparent hover:border-gray-800/20"}
                    `}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Info Area */}
          <div className="space-y-4 border-t border-gray-800 pt-4">
            <div className="bg-gray-800/40 p-3.5 rounded-xl border border-gray-800 space-y-2">
              <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400">
                <User className="h-3.5 w-3.5 text-[#F26522]" />
                <span className="font-bold text-white truncate max-w-[150px]">{officerName}</span>
              </div>
              <div className="flex items-center space-x-2 text-[9px] font-mono text-gray-500">
                <ShieldAlert className="h-3.5 w-3.5 text-[#F26522]/60" />
                <span className="truncate max-w-[150px] uppercase text-gray-400">{centerData?.name}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 rounded-xl text-xs font-mono text-red-400 hover:text-red-300 font-bold uppercase tracking-wider transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Info Ribbon */}
          <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0 font-mono text-[10px] text-gray-500 uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center space-x-4">
              <span className="hidden sm:inline text-[#F26522] font-bold">SECURE CHANNEL STATUS: ACTIVE</span>
              <span className="hidden sm:inline text-gray-300">|</span>
              <span className="flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span>{exam?.exam_date || "—"}</span>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-green-500/10 border border-green-500/20 text-green-600 text-[9px] px-2 py-0.5 rounded font-bold">
                RLS SHIELD ENGAGED
              </span>
            </div>
          </div>

          {/* Page body */}
          <main className="flex-grow p-6 overflow-y-auto">
            {children}
          </main>
        </div>

      </div>
    </CenterContext.Provider>
  );
}
