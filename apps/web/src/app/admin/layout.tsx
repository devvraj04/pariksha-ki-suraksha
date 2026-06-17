"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, LayoutDashboard, Building2, ClipboardList, Settings, LogOut, ShieldAlert } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Simple auth check on load
  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (!token && pathname !== "/login") {
      router.push("/login");
    }
  }, [pathname, router]);
 
  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    router.push("/login");
  };
 
  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Agencies", href: "/agencies", icon: Building2 },
    { name: "Audit Logs", href: "/audit", icon: ClipboardList },
    { name: "Whistleblowers", href: "/whistleblower", icon: ShieldAlert },
    { name: "Global Config", href: "/config", icon: Settings },
  ];
 
  // If on login page, render children directly without sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 flex selection:bg-[#F26522]/30 selection:text-[#F26522]">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-900 text-white flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="h-16 border-b border-gray-800 flex items-center px-6 space-x-3">
            <div className="bg-[#F26522] p-1.5 rounded-lg shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-mono font-bold text-sm tracking-wider text-white">PARIKSHA<span className="text-[#F26522]">SETU</span></span>
              <span className="block text-[8px] font-mono tracking-wider text-gray-400 uppercase">Admin Command</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              // Subdomain rewrites make "/" map to "/admin/" in Next.js router
              const isActive = pathname === `/admin${item.href === "/" ? "" : item.href}`;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
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
            <div className="overflow-hidden">
              <span className="block text-xs font-bold text-white truncate">Platform Root</span>
              <span className="block text-[9px] font-mono text-gray-400 truncate">admin@parikshasetu.in</span>
            </div>
            <span className="bg-[#F26522]/10 text-[#F26522] border border-[#F26522]/20 text-[8px] font-mono px-2 py-0.5 rounded font-bold">
              ROOT
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all duration-150"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>[Log Out]</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500">
            SYSTEM STATUS // SECURED DIRECTORY
          </h2>
          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono text-[#F26522]">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>REALTIME SYNC ACTIVE</span>
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
