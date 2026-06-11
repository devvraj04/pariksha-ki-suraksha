'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

export default function Header() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Fetch user profile info
        const { data } = await supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          setProfile(data as UserProfile);
        } else {
          setProfile({
            id: session.user.id,
            full_name: session.user.email?.split('@')[0] || 'Operator',
            role: 'operator'
          });
        }
      }
    };
    fetchSession();
  }, []);

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'authority_a': return 'Authority A';
      case 'authority_b': return 'Authority B';
      case 'print_operator': return 'Print Operator';
      case 'driver': return 'Driver';
      case 'supervisor': return 'Supervisor';
      default: return 'Operator';
    }
  };

  return (
    <header className="w-full h-16 bg-[#0D1B3E] border-b border-[#C9A84C]/30 flex items-center justify-between px-6 md:px-12 shadow-lg z-50">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
          <span className="font-serif text-lg md:text-xl font-bold text-[#F9F9F7] tracking-wide">
            परीक्षा की सुरक्षा
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-6">
        {profile ? (
          <>
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-[#F9F9F7]">
                {profile.full_name}
              </span>
              <span className="text-[10px] font-bold text-[#D9BC6A] uppercase tracking-widest mt-0.5">
                {getRoleLabel(profile.role)}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="text-xs font-semibold tracking-widest text-[#F9F9F7] hover:text-[#D9BC6A] transition-colors uppercase border border-[#F9F9F7]/20 rounded-lg px-3 py-1.5 hover:border-[#D9BC6A]/30"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="text-xs font-semibold tracking-widest text-[#F9F9F7] hover:text-[#D9BC6A] transition-colors uppercase"
          >
            Operator Portal
          </Link>
        )}
      </div>
    </header>
  );
}
