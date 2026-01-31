import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Recognition type codes
const RECOGNITION_CODES = {
  EARLY_RISER: 'early_riser',
  NIGHT_SCHOLAR: 'night_scholar',
  MOMENTUM: 'momentum',
  TEAM_SUPPORTER: 'team_supporter',
} as const;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

interface SubmissionWithTime {
  participant_id: string;
  submitted_at: string;
}

interface ParticipantStreak {
  participant_id: string;
  current_streak: number;
}

interface PeerAssistCount {
  participant_id: string;
  peer_assists_given: number;
}

interface RecognitionType {
  id: number;
  code: string;
}

async function findEarlyRisers(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  // Find participants with submissions before 08:00 in the last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('participant_id, submitted_at')
    .gte('submitted_at', yesterday.toISOString())
    .lte('submitted_at', today.toISOString());

  if (error || !submissions) return [];

  // Filter for submissions before 08:00
  const earlyRisers = new Set<string>();
  (submissions as SubmissionWithTime[]).forEach((sub) => {
    const hour = new Date(sub.submitted_at).getHours();
    if (hour < 8) {
      earlyRisers.add(sub.participant_id);
    }
  });

  return Array.from(earlyRisers);
}

async function findNightScholars(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  // Find participants with submissions after 22:00 in the last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('participant_id, submitted_at')
    .gte('submitted_at', yesterday.toISOString())
    .lte('submitted_at', today.toISOString());

  if (error || !submissions) return [];

  // Filter for submissions after 22:00
  const nightScholars = new Set<string>();
  (submissions as SubmissionWithTime[]).forEach((sub) => {
    const hour = new Date(sub.submitted_at).getHours();
    if (hour >= 22) {
      nightScholars.add(sub.participant_id);
    }
  });

  return Array.from(nightScholars);
}

async function findMomentumAchievers(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  // Find participants with 5+ consecutive days streak
  const { data: leaderboard, error } = await supabase
    .from('leaderboard')
    .select('participant_id, current_streak')
    .gte('current_streak', 5);

  if (error || !leaderboard) return [];

  return (leaderboard as ParticipantStreak[]).map((l) => l.participant_id);
}

async function findTeamSupporters(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  // Find participants with 3+ peer assists given
  const { data: mastery, error } = await supabase
    .from('participant_mastery')
    .select('participant_id, peer_assists_given')
    .gte('peer_assists_given', 3);

  if (error || !mastery) return [];

  return (mastery as PeerAssistCount[]).map((m) => m.participant_id);
}

async function awardRecognition(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  participantId: string,
  recognitionTypeId: number,
  context: string
): Promise<boolean> {
  // Check if already awarded
  const { data: existing } = await supabase
    .from('participant_recognitions')
    .select('id')
    .eq('participant_id', participantId)
    .eq('recognition_type_id', recognitionTypeId)
    .single();

  if (existing) {
    return false; // Already has this recognition
  }

  // Award the recognition
  const { error } = await supabase
    .from('participant_recognitions')
    .insert({
      participant_id: participantId,
      recognition_type_id: recognitionTypeId,
      context,
      earned_at: new Date().toISOString(),
    });

  return !error;
}

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch recognition types
    const { data: recognitionTypes, error: typesError } = await supabase
      .from('recognition_types')
      .select('id, code');

    if (typesError || !recognitionTypes) {
      console.error('Error fetching recognition types:', typesError);
      return NextResponse.json({ error: 'Failed to fetch recognition types' }, { status: 500 });
    }

    const typeMap = new Map((recognitionTypes as RecognitionType[]).map((t) => [t.code, t.id]));

    const results = {
      earlyRiser: { found: 0, awarded: 0 },
      nightScholar: { found: 0, awarded: 0 },
      momentum: { found: 0, awarded: 0 },
      teamSupporter: { found: 0, awarded: 0 },
    };

    // Process Early Risers
    const earlyRiserTypeId = typeMap.get(RECOGNITION_CODES.EARLY_RISER);
    if (earlyRiserTypeId) {
      const earlyRisers = await findEarlyRisers(supabase);
      results.earlyRiser.found = earlyRisers.length;

      for (const participantId of earlyRisers) {
        const awarded = await awardRecognition(
          supabase,
          participantId,
          earlyRiserTypeId,
          'Submitted work before 8:00 AM'
        );
        if (awarded) results.earlyRiser.awarded++;
      }
    }

    // Process Night Scholars
    const nightScholarTypeId = typeMap.get(RECOGNITION_CODES.NIGHT_SCHOLAR);
    if (nightScholarTypeId) {
      const nightScholars = await findNightScholars(supabase);
      results.nightScholar.found = nightScholars.length;

      for (const participantId of nightScholars) {
        const awarded = await awardRecognition(
          supabase,
          participantId,
          nightScholarTypeId,
          'Submitted work after 10:00 PM'
        );
        if (awarded) results.nightScholar.awarded++;
      }
    }

    // Process Momentum Achievers
    const momentumTypeId = typeMap.get(RECOGNITION_CODES.MOMENTUM);
    if (momentumTypeId) {
      const momentumAchievers = await findMomentumAchievers(supabase);
      results.momentum.found = momentumAchievers.length;

      for (const participantId of momentumAchievers) {
        const awarded = await awardRecognition(
          supabase,
          participantId,
          momentumTypeId,
          'Maintained 5+ day submission streak'
        );
        if (awarded) results.momentum.awarded++;
      }
    }

    // Process Team Supporters
    const teamSupporterTypeId = typeMap.get(RECOGNITION_CODES.TEAM_SUPPORTER);
    if (teamSupporterTypeId) {
      const teamSupporters = await findTeamSupporters(supabase);
      results.teamSupporter.found = teamSupporters.length;

      for (const participantId of teamSupporters) {
        const awarded = await awardRecognition(
          supabase,
          participantId,
          teamSupporterTypeId,
          'Helped 3+ peers with their work'
        );
        if (awarded) results.teamSupporter.awarded++;
      }
    }

    const totalAwarded =
      results.earlyRiser.awarded +
      results.nightScholar.awarded +
      results.momentum.awarded +
      results.teamSupporter.awarded;

    console.log(`Recognition awards complete: ${totalAwarded} new recognitions awarded`);

    return NextResponse.json({
      success: true,
      results,
      totalAwarded,
    });
  } catch (error) {
    console.error('Recognition cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
