"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function AgencyRootPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => {
    const token = sessionStorage.getItem("agency_token");
    if (token) {
      router.replace(`/agency/${slug}/dashboard`);
    } else {
      router.replace(`/agency/${slug}/login`);
    }
  }, [router, slug]);

  return (
    <div className="min-h-screen bg-[#EFEFEF] flex items-center justify-center font-mono text-sm text-gray-500 uppercase tracking-widest">
      <span>Redirecting...</span>
    </div>
  );
}
