import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ClearanceLevel } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60 seconds for processing

// Mastery level thresholds
const MASTERY_THRESHOLDS: Record<number, {
  daysCompleted: number;
  aiTutorSessions?: number;
  artifactsSubmitted?: number;
  peerAssistsGiven?: number;
  clearance: ClearanceLevel;
}> = {
  2: {
    daysCompleted: 3,
    aiTutorSessions: 1,
    clearance: 'FIELD_TRAINEE',
  },
  3: {
    daysCompleted: 10,
    artifactsSubmitted: 1,
    clearance: 'FIELD_READY',
  },
  4: {
    daysCompleted: 20,
    artifactsSubmitted: 3,
    peerAssistsGiven: 2,
    clearance: 'SPECIALIST',
  },
};

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

interface MasteryRecord {
  id: string;
  participant_id: string;
  mastery_level: number;
  clearance: ClearanceLevel;
  days_completed: number;
  artifacts_submitted: number;
  ai_tutor_sessions: number;
  peer_assists_given: number;
}

function calculateNewLevel(mastery: MasteryRecord): {
  newLevel: number;
  newClearance: ClearanceLevel;
} | null {
  const currentLevel = mastery.mastery_level;

  // Check for Level 4
  if (currentLevel < 4) {
    const t4 = MASTERY_THRESHOLDS[4];
    if (
      mastery.days_completed >= t4.daysCompleted &&
      mastery.artifacts_submitted >= (t4.artifactsSubmitted ?? 0) &&
      mastery.peer_assists_given >= (t4.peerAssistsGiven ?? 0)
    ) {
      return { newLevel: 4, newClearance: t4.clearance };
    }
  }

  // Check for Level 3
  if (currentLevel < 3) {
    const t3 = MASTERY_THRESHOLDS[3];
    if (
      mastery.days_completed >= t3.daysCompleted &&
      mastery.artifacts_submitted >= (t3.artifactsSubmitted ?? 0)
    ) {
      return { newLevel: 3, newClearance: t3.clearance };
    }
  }

  // Check for Level 2
  if (currentLevel < 2) {
    const t2 = MASTERY_THRESHOLDS[2];
    if (
      mastery.days_completed >= t2.daysCompleted &&
      mastery.ai_tutor_sessions >= (t2.aiTutorSessions ?? 0)
    ) {
      return { newLevel: 2, newClearance: t2.clearance };
    }
  }

  return null;
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

    // Fetch all participant mastery records
    const { data: masteryRecords, error: fetchError } = await supabase
      .from('participant_mastery')
      .select('*');

    if (fetchError) {
      console.error('Error fetching mastery records:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }

    const updates: {
      participantId: string;
      oldLevel: number;
      newLevel: number;
      newClearance: ClearanceLevel;
    }[] = [];

    // Check each participant for level up
    for (const mastery of (masteryRecords as MasteryRecord[]) || []) {
      const levelUp = calculateNewLevel(mastery);

      if (levelUp) {
        const { error: updateError } = await supabase
          .from('participant_mastery')
          .update({
            mastery_level: levelUp.newLevel,
            clearance: levelUp.newClearance,
          })
          .eq('id', mastery.id);

        if (!updateError) {
          updates.push({
            participantId: mastery.participant_id,
            oldLevel: mastery.mastery_level,
            newLevel: levelUp.newLevel,
            newClearance: levelUp.newClearance,
          });
        } else {
          console.error(`Failed to update mastery for ${mastery.participant_id}:`, updateError);
        }
      }
    }

    console.log(`Mastery update complete: ${updates.length} participants leveled up`);

    return NextResponse.json({
      success: true,
      processed: masteryRecords?.length ?? 0,
      updated: updates.length,
      updates,
    });
  } catch (error) {
    console.error('Mastery update cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
