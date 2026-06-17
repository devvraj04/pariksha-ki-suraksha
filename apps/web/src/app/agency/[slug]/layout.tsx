"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Building2, LayoutDashboard, Users2, ShieldAlert, LogOut, Loader2, Shield, ScanLine } from "lucide-react";
import { agencyApi } from "@/lib/api";

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ agency: any; profile: any } | null>(null);

  // Exclude login and accept-invite routes from auth check & sidebar
  const isAuthRoute = pathname === "/login" || pathname === "/accept-invite";

  useEffect(() => {
    if (isAuthRoute) {
      setLoading(false);
      return;
    }

    const token = sessionStorage.getItem("agency_token");
    if (!token) {
      router.push("/login");
      return;
    }

    async function fetchSession() {
      try {
        const data = await agencyApi.getMe();
        setSession(data);
      } catch (err: any) {
        console.error("Session verification failed:", err);
        // Clear token and redirect to login if session fetch failed (e.g. invalid JWT or suspended)
        sessionStorage.removeItem("agency_token");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [pathname, router, isAuthRoute]);

  const handleLogout = () => {
    sessionStorage.removeItem("agency_token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EFEFEF] text-gray-500 flex flex-col justify-center items-center font-mono text-sm space-y-4">
        <Loader2 className="h-8 w-8 text-[#F26522] animate-spin" />
        <span className="uppercase tracking-widest text-xs">Authenticating Session...</span>
      </div>
    );
  }

  if (isAuthRoute) {
    return <>{children}</>;
  }

  const role = session?.profile?.role || "operator";
  const showStaffNav = role === "agency_head" || role === "manager";
  const showEvalNav = ["grading_teacher", "moderator", "chief_moderator"].includes(role);

  const navItems = [
    { name: "Workspace Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Examinations", href: "/exams", icon: Building2 },
    { name: "Command Center", href: "/command-center", icon: Shield },
  ];

  if (showEvalNav) {
    navItems.push({ name: "Evaluation Panel", href: "/eval", icon: ScanLine });
  }

  if (showStaffNav) {
    navItems.push({ name: "Staff Hierarchy", href: "/staff", icon: Users2 });
    navItems.push({ name: "Leak Reports", href: "/leaks", icon: ShieldAlert });
  }

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-900 text-white flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="h-16 border-b border-gray-800 flex items-center px-6 space-x-3">
            <div className="bg-[#F26522] p-1.5 rounded-lg shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-mono font-bold text-sm tracking-wider text-white">
                {session?.agency?.name ? session.agency.name.split(" ")[0].toUpperCase() : "AGENCY"}
                <span className="text-[#F26522]">SETU</span>
              </span>
              <span className="block text-[8px] font-mono tracking-wider text-gray-400 uppercase">
                {slug} portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const fullHref = `/agency/${slug}${item.href}`;
              const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);

              return (
                <Link
                  key={item.name}
                  href={fullHref}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                    isActive
                      ? "bg-[#F26522] text-white font-bold shadow-md shadow-[#F26522]/15"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/40"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

        </div>

        {/* User Info / Logout */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="overflow-hidden pr-2">
              <span className="block text-xs font-bold text-white truncate">
                {session?.profile?.full_name || "Staff Member"}
              </span>
              <span className="block text-[9px] font-mono text-gray-400 truncate">
                {session?.profile?.email || "staff@agency.org"}
              </span>
            </div>
            <span className="bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 text-[8px] font-mono px-2 py-0.5 rounded font-bold uppercase shrink-0">
              {role.replace("_", " ")}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all duration-150"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>[Disconnect]</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500">
            {session?.agency?.name || "Agency Security Center"} // CONTROL PANEL
          </h2>
          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono text-[#F26522]">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>SECURE HSM CONNECTION ACTIVE</span>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-grow p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
