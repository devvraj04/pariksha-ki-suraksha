"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Menu, X, Star } from "lucide-react";

// Safe dynamic import for shaders
const ShaderBackground = () => {
  const [ShaderComponents, setShaderComponents] = useState<any>(null);

  useEffect(() => {
    import("shaders/react")
      .then((mod) => {
        setShaderComponents(mod);
      })
      .catch((err) => {
        console.error("Failed to load shaders package", err);
      });
  }, []);

  if (!ShaderComponents) {
    return <div className="absolute inset-0 bg-[#EFEFEF]" />;
  }

  const { Shader, Swirl, ChromaFlow, FlutedGlass, FilmGrain } = ShaderComponents;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none w-full h-full overflow-hidden">
      <Shader className="w-full h-full">
        <Swirl colorA="#ffffff" colorB="#f0f0f0" detail={1.7} />
        <ChromaFlow
          baseColor="#ffffff"
          downColor="#ff5f03"
          leftColor="#ff5f03"
          rightColor="#ff5f03"
          upColor="#ff5f03"
          momentum={13}
          radius={3.5}
        />
        <FlutedGlass
          aberration={0.61}
          angle={31}
          frequency={8}
          highlight={0.12}
          highlightSoftness={0}
          lightAngle={-90}
          refraction={4}
          shape="rounded"
          softness={1}
          speed={0.15}
        />
        <FilmGrain strength={0.05} />
      </Shader>
    </div>
  );
};

export default function ParikshaSetuLandingPage() {
  const [londonTime, setLondonTime] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live London Time Clock
  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      };
      setLondonTime(new Intl.DateTimeFormat("en-GB", options).format(new Date()));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#EFEFEF] text-gray-900 selection:bg-[#F26522]/30 selection:text-[#F26522] overflow-x-hidden flex flex-col font-sans">
      
      {/* SECTION 1: HERO */}
      <section className="relative min-h-screen flex flex-col justify-between overflow-hidden">
        {/* Animated Shader Overlay */}
        <ShaderBackground />

        {/* Navigation */}
        <header className="relative z-20 w-full max-w-[1440px] mx-auto p-2 sm:p-3">
          <div className="bg-white rounded-full p-[5px] pl-2 pr-2 sm:pr-[5px] flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            
            {/* LEFT: Logo & Links */}
            <div className="flex items-center gap-6">
              <Link href="/" className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-tight uppercase">PS</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <a href="#audits" className="text-[14px] text-gray-900 hover:text-gray-500 transition-colors duration-300">Audits</a>
                <a href="#about" className="text-[14px] text-gray-900 hover:text-gray-500 transition-colors duration-300">Technology</a>
                <a href="#services" className="text-[14px] text-gray-900 hover:text-gray-500 transition-colors duration-300">Protocols</a>
                <Link href="/student/login" className="text-[14px] text-gray-900 hover:text-gray-500 transition-colors duration-300 font-medium">Candidate Portal</Link>
                <Link href="http://admin.localhost:3000/login" className="text-[14px] text-gray-900 hover:text-gray-500 transition-colors duration-300 font-medium">Platform Admin</Link>
              </nav>
            </div>

            {/* RIGHT: Time & CTAs */}
            <div className="hidden md:flex items-center gap-6">
              <span className="text-[13px] text-gray-600 hidden lg:inline">Monitoring exams for Q1 2026</span>
              <div className="flex items-center gap-1.5 text-[13px] text-gray-600">
                <Clock className="w-3.5 h-3.5" />
                <span>{londonTime || "12:00"} in London</span>
              </div>
              
              {/* CTA button with hover text roll animation */}
              <Link 
                href="/student/login"
                className="group bg-gray-900 hover:bg-gray-800 text-white rounded-full pl-5 pr-2 py-2 flex items-center gap-3 select-none transition-colors duration-300"
              >
                <div className="overflow-hidden h-[20px] relative">
                  <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                    <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Candidate Login</span>
                    <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Candidate Login</span>
                  </div>
                </div>
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 text-gray-900 transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45" />
                </div>
              </Link>
            </div>

            {/* MOBILE MENU TOGGLE */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden bg-gray-900 text-white rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
            >
              <span>Menu</span>
              <Menu className="w-3.5 h-3.5" />
            </button>

          </div>
        </header>

        {/* MOBILE MENU OVERLAY */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setMobileMenuOpen(false)} />
            
            {/* White bottom sheet */}
            <div className="relative z-10 bg-white rounded-t-2xl mx-3 mb-3 p-6 flex flex-col gap-6 shadow-2xl animate-[slideUp_0.5s_cubic-bezier(0.32,0.72,0,1)]">
              
              {/* Close Row */}
              <div className="flex items-center justify-between">
                <div className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>{londonTime || "12:00"} London</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-gray-900 text-white w-9 h-9 rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex flex-col gap-4 py-4">
                <a 
                  href="#audits" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-2xl sm:text-3xl font-medium text-gray-900 hover:text-gray-500 transition-colors"
                >
                  Audits
                </a>
                <a 
                  href="#about" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-2xl sm:text-3xl font-medium text-gray-900 hover:text-gray-500 transition-colors"
                >
                  Technology
                </a>
                <a 
                  href="#services" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-2xl sm:text-3xl font-medium text-gray-900 hover:text-gray-500 transition-colors"
                >
                  Protocols
                </a>
                <Link 
                  href="/student/dashboard" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-2xl sm:text-3xl font-medium text-[#F26522] hover:text-[#e05a1a] transition-colors"
                >
                  Candidate Portal
                </Link>
                <Link 
                  href="http://admin.localhost:3000/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-2xl sm:text-3xl font-medium text-gray-900 hover:text-gray-500 transition-colors"
                >
                  Platform Admin
                </Link>
              </nav>

              {/* Start a project / Login */}
              <Link
                href="/student/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full bg-[#F26522] text-white py-3 rounded-full flex items-center justify-center gap-3 font-medium hover:bg-[#e05a1a] transition-colors"
              >
                <span>Candidate Portal Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Hero Content (Positioned Bottom) */}
        <div className="relative z-20 flex-1 flex flex-col justify-end w-full max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 pb-14 sm:pb-16 lg:pb-20">
          <div className="max-w-[950px]">
            {/* Label */}
            <span className="inline-block text-[13px] sm:text-[14px] text-gray-900 font-semibold tracking-wide uppercase mb-5 sm:mb-8">
              ParikshaSetu AI
            </span>

            {/* Headline H1 */}
            <h1 className="text-[clamp(1.75rem,7vw,4.2rem)] sm:text-[clamp(2.5rem,5vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-gray-900">
              We secure the entire exam lifecycle<br className="hidden sm:block" />
              <span className="sm:hidden"> </span>from vault to evaluation<br className="hidden sm:block" />
              <span className="sm:hidden"> </span>with cryptographic trust.
            </h1>

            {/* CTA row */}
            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
              
              {/* Orange button */}
              <Link
                href="/student/register"
                className="group bg-[#F26522] hover:bg-[#e05a1a] text-white rounded-full pl-5 sm:pl-6 pr-2 py-2 flex items-center gap-3 select-none transition-colors duration-300"
              >
                <div className="overflow-hidden h-[20px] relative">
                  <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                    <span className="h-[20px] flex items-center text-[13px] sm:text-[14px] font-medium whitespace-nowrap">Start an audit</span>
                    <span className="h-[20px] flex items-center text-[13px] sm:text-[14px] font-medium whitespace-nowrap">Start an audit</span>
                  </div>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4 text-[#F26522] transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45" />
                </div>
              </Link>

              {/* Partner badge */}
              <div className="bg-white rounded-[4px] p-2 px-3 sm:px-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex items-center gap-3 border border-gray-150">
                {/* SVG starburst */}
                <div className="w-5 h-5 sm:w-6 sm:h-6 text-[#E8704E] fill-current">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full">
                    <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"/>
                  </svg>
                </div>
                <span className="text-[13px] sm:text-[14px] text-gray-800 font-medium">Certified Partner</span>
                <span className="text-[10px] sm:text-[11px] bg-gray-900 text-white px-1.5 sm:px-2 py-0.5 rounded uppercase font-bold shrink-0">Featured</span>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: ABOUT */}
      <section id="about" className="bg-white pt-16 sm:pt-20 lg:pt-32 pb-12 sm:pb-16 lg:pb-24 overflow-hidden">
        <div className="max-w-[1440px] mx-auto">
          
          {/* Badge row */}
          <div className="px-5 sm:px-8 lg:px-12 flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] sm:text-[12px] font-semibold">
              1
            </div>
            <div className="text-[12px] sm:text-[13px] font-medium border border-gray-200 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-gray-700">
              Introducing ParikshaSetu
            </div>
          </div>

          {/* Heading h2 */}
          <div className="px-5 sm:px-8 lg:px-12">
            <h2 className="text-[clamp(1.5rem,4vw,3.2rem)] font-medium leading-[1.12] tracking-[-0.02em] text-gray-900 mb-12 sm:mb-16 lg:mb-28">
              Strategy-led security, delivering<br className="hidden sm:block" /> results in examination trust.
            </h2>
          </div>

          {/* Content Area (MOBILE / TABLET) */}
          <div className="lg:hidden px-5 sm:px-8 space-y-8">
            <p className="text-[15px] sm:text-[17px] leading-[1.6] font-medium text-gray-900 max-w-[600px]">
              Through research, biometric intelligence and cryptographic proof we help testing agencies realize their digital security potential.
            </p>
            
            <Link
              href="/student/login"
              className="group bg-[#F26522] hover:bg-[#e05a1a] text-white rounded-full pl-5 pr-2 py-2 inline-flex items-center gap-3 select-none transition-colors duration-300"
            >
              <div className="overflow-hidden h-[20px] relative">
                <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                  <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Access Portal</span>
                  <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Access Portal</span>
                </div>
              </div>
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0">
                <ArrowRight className="w-3.5 h-3.5 text-[#F26522] transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45" />
              </div>
            </Link>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 pt-4">
              <div className="sm:w-[45%] aspect-[438/346] relative rounded-xl overflow-hidden shadow-sm">
                <img 
                  src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090123_74be96d4-9c1b-40cf-932a-96f4f4babed3.png&w=1280&q=85" 
                  alt="Audit Center" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:w-[55%] aspect-[900/600] relative rounded-xl overflow-hidden shadow-sm">
                <img 
                  src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090133_c157d30b-a99a-4477-bec1-a446149ec3f2.png&w=1280&q=85" 
                  alt="Attribution Operations" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Content Area (DESKTOP) */}
          <div className="hidden lg:grid grid-cols-[26%_1fr_48%] items-end gap-6 xl:gap-8 px-12">
            {/* Left Col */}
            <div className="aspect-[438/346] relative rounded-2xl overflow-hidden shadow-sm">
              <img 
                src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090123_74be96d4-9c1b-40cf-932a-96f4f4babed3.png&w=1280&q=85" 
                alt="Audit Center" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Center Col */}
            <div className="self-start flex flex-col items-end text-right justify-between h-full py-2">
              <p className="text-[16px] xl:text-[18px] leading-[1.65] font-medium text-gray-900 whitespace-nowrap">
                Through research, biometric intelligence<br />
                and cryptographic proof we help testing agencies<br />
                realize their digital security potential.
              </p>
              
              <Link
                href="/student/login"
                className="group bg-[#F26522] hover:bg-[#e05a1a] text-white rounded-full pl-5 pr-2 py-2 flex items-center gap-3 select-none transition-colors duration-300 self-end mt-8"
              >
                <div className="overflow-hidden h-[20px] relative">
                  <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                    <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Access Portal</span>
                    <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Access Portal</span>
                  </div>
                </div>
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 text-[#F26522] transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45" />
                </div>
              </Link>
            </div>

            {/* Right Col */}
            <div className="aspect-[3/2] relative rounded-2xl overflow-hidden shadow-sm">
              <img 
                src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090133_c157d30b-a99a-4477-bec1-a446149ec3f2.png&w=1280&q=85" 
                alt="Attribution Operations" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 3: AUDITS (CASE STUDIES) */}
      <section id="audits" className="bg-[#F5F5F5] pt-16 sm:pt-20 lg:pt-28 pb-16 sm:pb-20 lg:pb-28">
        <div className="max-w-[1440px] mx-auto">
          
          {/* Badge row */}
          <div className="px-5 sm:px-8 lg:px-12 flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] sm:text-[12px] font-semibold">
              2
            </div>
            <div className="text-[12px] sm:text-[13px] font-medium border border-gray-300 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-gray-700">
              Featured security audits
            </div>
          </div>

          {/* Heading h2 */}
          <div className="px-5 sm:px-8 lg:px-12 mb-10 sm:mb-14 lg:mb-16">
            <h2 className="text-[clamp(1.75rem,7vw,4.2rem)] sm:text-[clamp(2.5rem,5vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-gray-900">
              Active Security Audits
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-7 px-5 sm:px-8 lg:px-12">
            
            {/* Card 1: Narrativ */}
            <div className="flex flex-col">
              <div className="group relative aspect-[329/246] rounded-2xl overflow-hidden bg-[#1a1d2e] cursor-pointer shadow-sm">
                <video 
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260516_122702_390f5305-8719-41d5-ae80-d23ab3796c28.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Expanding hover button */}
                <div className="absolute bottom-4 left-4 h-9 w-9 bg-white rounded-full flex items-center overflow-hidden transition-all duration-300 ease-in-out group-hover:w-[148px] px-[10px] shadow-md z-20">
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-[13px] text-gray-900 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                      Learn more
                    </span>
                    <div className="shrink-0 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-gray-900 transition-transform duration-300 -rotate-45 group-hover:rotate-0">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Narrativ Metadata */}
              <div className="mt-4">
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-gray-900">Narrativ Assessment</h3>
                <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1 leading-relaxed">
                  Winner of Secure Platform of the Month 2025 - an interactive 3D examination client driving zero-leak trust.
                </p>
              </div>
            </div>

            {/* Card 2: Luminar */}
            <div className="flex flex-col">
              <div className="group relative aspect-square rounded-2xl overflow-hidden bg-[#6b6b6b] cursor-pointer shadow-sm">
                <video 
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260516_123323_f909c2b8-ff6c-4edf-882b-8ebcdbe389b5.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Expanding hover button */}
                <div className="absolute bottom-4 left-4 h-9 w-9 bg-gray-900 rounded-full flex items-center overflow-hidden transition-all duration-300 ease-in-out group-hover:w-[168px] px-[10px] shadow-md z-20">
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-[13px] text-white font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                      View case study
                    </span>
                    <div className="shrink-0 flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-white transition-transform duration-300 -rotate-45 group-hover:rotate-0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Luminar Metadata */}
              <div className="mt-4">
                <h3 className="text-[14px] sm:text-[15px] font-semibold text-gray-900">Luminar Audits</h3>
                <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1 leading-relaxed">
                  Transforming a legacy offline platform into an AI-proctored, conversion-focused candidate console.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 4: MARQUEE LOGO STRIP */}
      <section className="bg-white py-10 sm:py-12 lg:py-16 border-t border-b border-gray-100 overflow-hidden select-none">
        <div className="px-5 sm:px-8 lg:px-12 mb-6 sm:mb-8">
          <span className="text-[12px] sm:text-[13px] text-gray-400 font-semibold tracking-wide uppercase">
            Trusted by leading agencies
          </span>
        </div>

        {/* Outer track wrapper */}
        <div className="w-full overflow-hidden relative">
          {/* Inner track (flex) */}
          <div className="flex w-max hover:[animation-play-state:paused] animate-[marquee_28s_linear_infinite]">
            {/* Set 1 */}
            <div className="flex items-center shrink-0">
              {["NTA", "UPSC", "SSC", "AIIMS", "IIT JEE", "NEET", "CBSE", "GATE"].map((brand, idx) => (
                <div key={`b1-${idx}`} className="inline-flex items-center gap-2 mx-8 sm:mx-12 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200" />
                  <span className="text-[15px] sm:text-[16px] font-semibold text-gray-300">{brand}</span>
                </div>
              ))}
            </div>
            {/* Set 2 (Duplicated for loop) */}
            <div className="flex items-center shrink-0">
              {["NTA", "UPSC", "SSC", "AIIMS", "IIT JEE", "NEET", "CBSE", "GATE"].map((brand, idx) => (
                <div key={`b2-${idx}`} className="inline-flex items-center gap-2 mx-8 sm:mx-12 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200" />
                  <span className="text-[15px] sm:text-[16px] font-semibold text-gray-300">{brand}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: PROTOCOLS (SERVICES) */}
      <section id="services" className="bg-white pt-16 sm:pt-20 lg:pt-28 pb-16 sm:pb-20 lg:pb-28">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12">
          
          {/* Badge row */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] sm:text-[12px] font-semibold">
              3
            </div>
            <div className="text-[12px] sm:text-[13px] font-medium border border-gray-200 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-gray-700">
              What we do
            </div>
          </div>

          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-[clamp(1.5rem,4vw,3.2rem)] font-medium leading-[1.12] tracking-[-0.02em] text-gray-900">
              End-to-end examination<br className="hidden sm:block" /> security services.
            </h2>
            <p className="text-[14px] sm:text-[15px] text-gray-500 leading-[1.6] sm:max-w-[280px] sm:text-right">
              From paper vault encryption to anonymized multi-tier grading — we protect everything.
            </p>
          </div>

          {/* Services list */}
          <div className="flex flex-col border-t border-gray-100">
            {[
              { num: "01", name: "Secure Question Paper Vault", tag: "HSM Vault" },
              { num: "02", name: "Print Room YOLOv8 Surveillance", tag: "Edge AI" },
              { num: "03", name: "Smart Trunk GPS & Transit Geofencing", tag: "Transit" },
              { num: "04", name: "Candidate Check-in & Face Verification", tag: "Identity" },
              { num: "05", name: "Double-Blind Anonymized Evaluation", tag: "Evaluation" },
              { num: "06", name: "Signed Result PDFs & OTP Access", tag: "Results" },
            ].map((service, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between py-5 sm:py-6 border-b border-gray-100 group cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-xl px-2 -mx-2"
              >
                {/* Left */}
                <div className="flex items-center gap-4">
                  <span className="text-[13px] text-gray-400 w-8 shrink-0 font-medium">{service.num}</span>
                  <span className="text-[15px] sm:text-[16px] font-medium text-gray-900 group-hover:text-[#F26522] transition-colors duration-200">
                    {service.name}
                  </span>
                </div>

                {/* Right */}
                <div className="flex items-center gap-3">
                  <span className="text-[12px] sm:text-[13px] font-medium bg-gray-100 text-gray-600 px-3 py-1 rounded-full transition-colors duration-200 group-hover:bg-[#F26522]/10 group-hover:text-[#F26522]">
                    {service.tag}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#F26522] -rotate-45 group-hover:rotate-0 transition-all duration-200 shrink-0" />
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 6: TESTIMONIALS */}
      <section className="bg-[#F5F5F5] pt-16 sm:pt-20 lg:pt-28 pb-16 sm:pb-20 lg:pb-28">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12">
          
          {/* Badge row */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] sm:text-[12px] font-semibold">
              4
            </div>
            <div className="text-[12px] sm:text-[13px] font-medium border border-gray-300 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-gray-700">
              Kind words
            </div>
          </div>

          {/* Heading h2 */}
          <div className="mb-10 sm:mb-14">
            <h2 className="text-[clamp(1.75rem,7vw,4.2rem)] sm:text-[clamp(2.5rem,5vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-gray-900">
              What test controllers say
            </h2>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                initials: "JL",
                name: "Jamie Lawson",
                role: "Chairman, Narrativ Board",
                quote: "ParikshaSetu completely transformed how our high-stakes exams run. The biometric checks and audit logs they brought was unlike anything we'd experienced before.",
              },
              {
                initials: "SC",
                name: "Sofia Chen",
                role: "Controller, Luminar Exams",
                quote: "Working with ParikshaSetu felt effortless. They understood our strict security compliance immediately and delivered a platform that prevented all leak vectors.",
              },
              {
                initials: "MR",
                name: "Marcus Reid",
                role: "Director, Veldt Testing",
                quote: "From vault upload through to result publication, ParikshaSetu handled everything securely. Our encrypted transcripts have been game-changing.",
              },
            ].map((t, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 sm:p-8 flex flex-col gap-5 shadow-sm border border-gray-100">
                {/* Star Row */}
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#F26522] fill-current" />
                  ))}
                </div>
                
                {/* Quote */}
                <p className="text-[15px] sm:text-[17px] leading-[1.65] text-gray-700 font-medium flex-1">
                  "{t.quote}"
                </p>

                {/* Bottom Profile */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-[12px] font-semibold text-gray-500 shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <h4 className="text-[14px] sm:text-[15px] font-semibold text-gray-900">{t.name}</h4>
                    <span className="text-[12px] sm:text-[13px] text-gray-500">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 7: FOOTER CTA + FOOTER */}
      <footer className="bg-gray-900 text-white mt-auto overflow-hidden">
        
        {/* CTA Block */}
        <div className="pt-20 sm:pt-24 lg:pt-32 pb-16 sm:pb-20 px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto border-b border-gray-800">
          <span className="block text-[13px] sm:text-[14px] text-gray-400 tracking-wide uppercase mb-5 sm:mb-8">
            Let's work together
          </span>
          
          <h2 className="text-[clamp(1.75rem,7vw,4.2rem)] sm:text-[clamp(2.5rem,5vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.03em] text-white">
            Ready to secure your<br className="hidden sm:block" />
            <span className="sm:hidden"> </span>examinations?
          </h2>

          <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-start gap-4">
            {/* Start project button */}
            <Link
              href="/student/register"
              className="group bg-[#F26522] hover:bg-[#e05a1a] text-white rounded-full pl-5 pr-2 py-2 flex items-center gap-3 select-none transition-colors duration-300"
            >
              <div className="overflow-hidden h-[20px] relative">
                <div className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                  <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Get Started</span>
                  <span className="h-[20px] flex items-center text-[13px] font-medium whitespace-nowrap">Get Started</span>
                </div>
              </div>
              <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4 text-[#F26522] transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45" />
              </div>
            </Link>

            {/* View Work */}
            <a
              href="#audits"
              className="bg-white/10 hover:bg-white/15 text-white text-[13px] font-medium rounded-full px-5 py-2.5 transition-colors duration-300"
            >
              View Active Audits
            </a>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="py-8 sm:py-10 px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-white uppercase tracking-tight">PS</span>
            </div>
            <span className="text-[14px] font-medium text-white">ParikshaSetu AI</span>
          </div>

          {/* Links */}
          <nav className="hidden sm:flex items-center gap-4 sm:gap-6 text-[13px] text-gray-400">
            <a href="#audits" className="hover:text-white transition-colors duration-300">Audits</a>
            <a href="#about" className="hover:text-white transition-colors duration-300">Technology</a>
            <a href="#services" className="hover:text-white transition-colors duration-300">Protocols</a>
            <Link href="/student/dashboard" className="hover:text-white transition-colors duration-300">Candidate Console</Link>
            <Link href="http://admin.localhost:3000/login" className="hover:text-white transition-colors duration-300">Admin</Link>
          </nav>

          {/* Copyright */}
          <span className="text-[12px] sm:text-[13px] text-gray-500">
            © 2026 ParikshaSetu AI. All rights reserved.
          </span>
        </div>

      </footer>

    </div>
  );
}
