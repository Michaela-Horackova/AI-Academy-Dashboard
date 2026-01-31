'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface SessionState {
  currentStep: number;
  currentSection: string;
  isActive: boolean;
}

interface Participant {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

interface UseLiveSessionOptions {
  code: string;
  isInstructor?: boolean;
  onStateChange?: (state: SessionState) => void;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (participantId: string) => void;
  onSessionEnd?: () => void;
}

interface UseLiveSessionReturn {
  sessionState: SessionState | null;
  participants: Participant[];
  isConnected: boolean;
  error: string | null;
  sendStateUpdate: (state: Partial<SessionState>) => void;
  sendHeartbeat: () => void;
}

export function useLiveSession({
  code,
  isInstructor = false,
  onStateChange,
  onParticipantJoin,
  onParticipantLeave,
  onSessionEnd,
}: UseLiveSessionOptions): UseLiveSessionReturn {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Send state update (instructor only)
  const sendStateUpdate = useCallback((state: Partial<SessionState>) => {
    if (!channelRef.current || !isInstructor) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'state_update',
      payload: state,
    });

    // Also update local state
    setSessionState((prev) => prev ? { ...prev, ...state } : null);
  }, [isInstructor]);

  // Send heartbeat
  const sendHeartbeat = useCallback(() => {
    if (!channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'heartbeat',
      payload: { timestamp: Date.now(), isInstructor },
    });
  }, [isInstructor]);

  // Fetch initial session state
  const fetchSessionState = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-session/${code}`);
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const data = await response.json();
      const state: SessionState = {
        currentStep: data.session.current_step,
        currentSection: data.session.current_section,
        isActive: data.session.is_active,
      };

      setSessionState(state);

      if (!data.session.is_active) {
        onSessionEnd?.();
      }

      return state;
    } catch (err) {
      setError('Failed to load session');
      console.error(err);
      return null;
    }
  }, [code, onSessionEnd]);

  // Fetch participants
  const fetchParticipants = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-session/${code}/participants`);
      if (!response.ok) return;

      const data = await response.json();
      setParticipants(data.participants || []);
    } catch (err) {
      console.error('Failed to fetch participants:', err);
    }
  }, [code]);

  useEffect(() => {
    const channelName = `live-session-${code.toUpperCase()}`;

    // Create channel
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true },
        presence: { key: '' },
      },
    });

    // Handle state updates
    channel.on('broadcast', { event: 'state_update' }, ({ payload }) => {
      const newState: SessionState = {
        currentStep: payload.currentStep ?? sessionState?.currentStep ?? 1,
        currentSection: payload.currentSection ?? sessionState?.currentSection ?? 'briefing',
        isActive: payload.isActive ?? sessionState?.isActive ?? true,
      };

      setSessionState(newState);
      onStateChange?.(newState);

      if (!newState.isActive) {
        onSessionEnd?.();
      }
    });

    // Handle session end
    channel.on('broadcast', { event: 'session_end' }, () => {
      setSessionState((prev) => prev ? { ...prev, isActive: false } : null);
      onSessionEnd?.();
    });

    // Handle participant join
    channel.on('broadcast', { event: 'participant_join' }, ({ payload }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.id === payload.id)) return prev;
        return [...prev, payload];
      });
      onParticipantJoin?.(payload);
    });

    // Handle participant leave
    channel.on('broadcast', { event: 'participant_leave' }, ({ payload }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== payload.id));
      onParticipantLeave?.(payload.id);
    });

    // Handle heartbeat for connection detection
    channel.on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
      if (payload.isInstructor && !isInstructor) {
        // Reset disconnect timer when instructor heartbeat received
        setIsConnected(true);
      }
    });

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setError(null);
        channelRef.current = channel;

        // Fetch initial state
        await fetchSessionState();
        await fetchParticipants();

        // Start heartbeat interval (every 5 seconds)
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat();
        }, 5000);
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        setError('Connection error');
      }
    });

    return () => {
      // Cleanup
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [code, supabase, isInstructor, fetchSessionState, fetchParticipants, sendHeartbeat, onStateChange, onParticipantJoin, onParticipantLeave, onSessionEnd, sessionState?.currentStep, sessionState?.currentSection, sessionState?.isActive]);

  return {
    sessionState,
    participants,
    isConnected,
    error,
    sendStateUpdate,
    sendHeartbeat,
  };
}

// Hook for instructor-specific functionality
export function useInstructorSession(code: string) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStep = useCallback(async (action: 'next' | 'prev' | number) => {
    setIsUpdating(true);
    try {
      const body = typeof action === 'number'
        ? { step: action }
        : { action: action === 'next' ? 'next_step' : 'prev_step' };

      const response = await fetch(`/api/live-session/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to update step');
      }

      return await response.json();
    } catch (err) {
      console.error('Update step error:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [code]);

  const updateSection = useCallback(async (section: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/live-session/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });

      if (!response.ok) {
        throw new Error('Failed to update section');
      }

      return await response.json();
    } catch (err) {
      console.error('Update section error:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [code]);

  const endSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-session/${code}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      return true;
    } catch (err) {
      console.error('End session error:', err);
      throw err;
    }
  }, [code]);

  return {
    updateStep,
    updateSection,
    endSession,
    isUpdating,
  };
}
