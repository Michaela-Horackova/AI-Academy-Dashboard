import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { InstructorControlPanel } from '@/components/InstructorControlPanel';
import type { MissionDay } from '@/lib/types';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function InstructorControlPage({ searchParams }: PageProps) {
  const { code } = await searchParams;

  if (!code) {
    redirect('/live-session');
  }

  const supabase = await createServerSupabaseClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is instructor/admin
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, is_admin')
    .eq('email', user.email)
    .single();

  if (!participant?.is_admin) {
    redirect('/live-session');
  }

  // Get session
  const { data: session } = await supabase
    .from('live_sessions')
    .select(`
      *,
      mission_days(*)
    `)
    .eq('join_code', code.toUpperCase())
    .single();

  if (!session) {
    redirect('/live-session');
  }

  // Verify instructor owns this session
  if (session.instructor_id !== participant.id) {
    redirect('/live-session');
  }

  return (
    <InstructorControlPanel
      session={session}
      missionDay={session.mission_days as MissionDay}
      instructorName={participant.name}
    />
  );
}
