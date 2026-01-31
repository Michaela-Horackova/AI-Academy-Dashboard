'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';
import type { ParticipantMastery, ClearanceLevel } from '@/lib/types';

interface UseMasteryOptions {
  participantId: string;
  onLevelUp?: (newLevel: number, clearance: ClearanceLevel) => void;
}

interface UseMasteryReturn {
  mastery: ParticipantMastery | null;
  isLoading: boolean;
  error: string | null;
  refreshMastery: () => Promise<void>;
  checkForLevelUp: () => Promise<boolean>;
}

// Mastery level thresholds
const MASTERY_THRESHOLDS = {
  2: {
    daysCompleted: 3,
    aiTutorSessions: 1,
    clearance: 'FIELD_TRAINEE' as ClearanceLevel,
  },
  3: {
    daysCompleted: 10, // Week 2 complete
    artifactsSubmitted: 1,
    clearance: 'FIELD_READY' as ClearanceLevel,
  },
  4: {
    daysCompleted: 20,
    artifactsSubmitted: 3,
    peerAssistsGiven: 2,
    clearance: 'SPECIALIST' as ClearanceLevel,
  },
};

export function useMastery({
  participantId,
  onLevelUp,
}: UseMasteryOptions): UseMasteryReturn {
  const [mastery, setMastery] = useState<ParticipantMastery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  // Fetch current mastery
  const refreshMastery = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('participant_mastery')
        .select('*')
        .eq('participant_id', participantId)
        .single();

      if (fetchError) throw fetchError;
      setMastery(data as ParticipantMastery);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch mastery');
    } finally {
      setIsLoading(false);
    }
  }, [participantId, supabase]);

  // Calculate if user qualifies for level up
  const calculateNewLevel = useCallback((currentMastery: ParticipantMastery): {
    newLevel: number;
    newClearance: ClearanceLevel;
  } | null => {
    const currentLevel = currentMastery.mastery_level;

    // Check for Level 4
    if (currentLevel < 4) {
      const t4 = MASTERY_THRESHOLDS[4];
      if (
        currentMastery.days_completed >= t4.daysCompleted &&
        currentMastery.artifacts_submitted >= t4.artifactsSubmitted &&
        currentMastery.peer_assists_given >= t4.peerAssistsGiven
      ) {
        return { newLevel: 4, newClearance: t4.clearance };
      }
    }

    // Check for Level 3
    if (currentLevel < 3) {
      const t3 = MASTERY_THRESHOLDS[3];
      if (
        currentMastery.days_completed >= t3.daysCompleted &&
        currentMastery.artifacts_submitted >= t3.artifactsSubmitted
      ) {
        return { newLevel: 3, newClearance: t3.clearance };
      }
    }

    // Check for Level 2
    if (currentLevel < 2) {
      const t2 = MASTERY_THRESHOLDS[2];
      if (
        currentMastery.days_completed >= t2.daysCompleted &&
        currentMastery.ai_tutor_sessions >= t2.aiTutorSessions
      ) {
        return { newLevel: 2, newClearance: t2.clearance };
      }
    }

    return null;
  }, []);

  // Check and apply level up
  const checkForLevelUp = useCallback(async (): Promise<boolean> => {
    if (!mastery) return false;

    const levelUp = calculateNewLevel(mastery);
    if (!levelUp) return false;

    try {
      // Update mastery in database
      const { data, error: updateError } = await supabase
        .from('participant_mastery')
        .update({
          mastery_level: levelUp.newLevel,
          clearance: levelUp.newClearance,
        })
        .eq('participant_id', participantId)
        .select()
        .single();

      if (updateError) throw updateError;

      setMastery(data as ParticipantMastery);

      // Show toast notification
      toast.success('Level Up!', {
        description: `You've reached Mastery Level ${levelUp.newLevel} (${levelUp.newClearance})`,
        duration: 5000,
      });

      // Call callback
      onLevelUp?.(levelUp.newLevel, levelUp.newClearance);

      return true;
    } catch (err) {
      console.error('Failed to update mastery level:', err);
      return false;
    }
  }, [mastery, participantId, supabase, calculateNewLevel, onLevelUp]);

  // Initial fetch
  useEffect(() => {
    refreshMastery();
  }, [refreshMastery]);

  // Real-time subscription for mastery changes
  useEffect(() => {
    const channel = supabase
      .channel(`mastery-${participantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participant_mastery',
          filter: `participant_id=eq.${participantId}`,
        },
        (payload) => {
          const newMastery = payload.new as ParticipantMastery;
          const oldMastery = payload.old as ParticipantMastery;

          setMastery(newMastery);

          // Check for level up notification
          if (newMastery.mastery_level > oldMastery.mastery_level) {
            toast.success('Level Up!', {
              description: `You've reached Mastery Level ${newMastery.mastery_level}!`,
              duration: 5000,
            });
            onLevelUp?.(newMastery.mastery_level, newMastery.clearance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [participantId, supabase, onLevelUp]);

  // Also subscribe to submissions to check for level up opportunities
  useEffect(() => {
    const channel = supabase
      .channel(`submissions-mastery-${participantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
        },
        async () => {
          // Refresh mastery and check for level up after a new submission
          await refreshMastery();
          await checkForLevelUp();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [participantId, supabase, refreshMastery, checkForLevelUp]);

  return {
    mastery,
    isLoading,
    error,
    refreshMastery,
    checkForLevelUp,
  };
}

// Hook for getting mastery progress towards next level
export function useMasteryProgress(mastery: ParticipantMastery | null) {
  if (!mastery) {
    return {
      currentLevel: 1,
      nextLevel: 2,
      requirements: [],
      overallProgress: 0,
    };
  }

  const currentLevel = mastery.mastery_level;
  const nextLevel = Math.min(currentLevel + 1, 4);

  if (currentLevel >= 4) {
    return {
      currentLevel: 4,
      nextLevel: null,
      requirements: [],
      overallProgress: 100,
    };
  }

  const threshold = MASTERY_THRESHOLDS[nextLevel as 2 | 3 | 4];
  const requirements: {
    name: string;
    current: number;
    required: number;
    completed: boolean;
  }[] = [];

  // Build requirements list
  if ('daysCompleted' in threshold) {
    requirements.push({
      name: 'Days Completed',
      current: mastery.days_completed,
      required: threshold.daysCompleted,
      completed: mastery.days_completed >= threshold.daysCompleted,
    });
  }

  if ('aiTutorSessions' in threshold) {
    requirements.push({
      name: 'AI Tutor Sessions',
      current: mastery.ai_tutor_sessions,
      required: threshold.aiTutorSessions,
      completed: mastery.ai_tutor_sessions >= threshold.aiTutorSessions,
    });
  }

  if ('artifactsSubmitted' in threshold) {
    requirements.push({
      name: 'Artifacts Submitted',
      current: mastery.artifacts_submitted,
      required: threshold.artifactsSubmitted,
      completed: mastery.artifacts_submitted >= threshold.artifactsSubmitted,
    });
  }

  if ('peerAssistsGiven' in threshold) {
    requirements.push({
      name: 'Peer Assists',
      current: mastery.peer_assists_given,
      required: threshold.peerAssistsGiven,
      completed: mastery.peer_assists_given >= threshold.peerAssistsGiven,
    });
  }

  const completedRequirements = requirements.filter((r) => r.completed).length;
  const overallProgress = Math.round((completedRequirements / requirements.length) * 100);

  return {
    currentLevel,
    nextLevel,
    requirements,
    overallProgress,
  };
}
