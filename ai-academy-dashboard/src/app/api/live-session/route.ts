import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/live-session - Create a new live session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is instructor/admin
    const { data: participant } = await supabase
      .from('participants')
      .select('id, is_admin')
      .eq('email', user.email)
      .single();

    if (!participant?.is_admin) {
      return NextResponse.json({ error: 'Only instructors can start sessions' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { mission_day_id } = body;

    if (!mission_day_id) {
      return NextResponse.json({ error: 'mission_day_id is required' }, { status: 400 });
    }

    // Generate unique join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create session
    const { data: session, error } = await supabase
      .from('live_sessions')
      .insert({
        instructor_id: participant.id,
        mission_day_id: parseInt(mission_day_id),
        join_code: joinCode,
        current_step: 1,
        current_section: 'briefing',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        join_code: session.join_code,
        mission_day_id: session.mission_day_id,
        current_step: session.current_step,
        current_section: session.current_section,
      },
    });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
