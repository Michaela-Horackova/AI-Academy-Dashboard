import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { StudentSessionView } from '@/components/StudentSessionView';
import type { MissionDay } from '@/lib/types';

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function StudentViewPage({ searchParams }: PageProps) {
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

  // Get participant
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, role')
    .eq('email', user.email)
    .single();

  if (!participant) {
    redirect('/onboarding');
  }

  // Get session
  const { data: session } = await supabase
    .from('live_sessions')
    .select(`
      *,
      mission_days(*),
      participants:instructor_id(name, avatar_url)
    `)
    .eq('join_code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (!session) {
    redirect('/live-session');
  }

  // Join session (register participant)
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/live-session/${code}/participants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch(() => {
    // Ignore errors, will handle in client
  });

  return (
    <StudentSessionView
      session={session}
      missionDay={session.mission_days as MissionDay}
      instructor={session.participants as { name: string; avatar_url: string | null }}
      participantName={participant.name}
    />
  );
}
