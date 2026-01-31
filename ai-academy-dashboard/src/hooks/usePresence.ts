'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';

export interface PresenceUser {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  online_at: string;
}

interface UsePresenceOptions {
  channelName: string;
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
    role: string;
  } | null;
  onUserJoin?: (user: PresenceUser) => void;
  onUserLeave?: (userId: string) => void;
}

interface UsePresenceReturn {
  users: PresenceUser[];
  onlineCount: number;
  isConnected: boolean;
  error: string | null;
}

export function usePresence({
  channelName,
  user,
  onUserJoin,
  onUserLeave,
}: UsePresenceOptions): UsePresenceReturn {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Transform presence state to user array
  const transformPresenceState = useCallback((state: RealtimePresenceState<PresenceUser>): PresenceUser[] => {
    const userMap = new Map<string, PresenceUser>();

    Object.values(state).forEach((presences) => {
      presences.forEach((presence) => {
        // Dedupe by user ID, keeping the most recent
        const existing = userMap.get(presence.id);
        if (!existing || new Date(presence.online_at) > new Date(existing.online_at)) {
          userMap.set(presence.id, presence);
        }
      });
    });

    return Array.from(userMap.values()).sort(
      (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Track presence state
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const newUsers = transformPresenceState(state);
        setUsers(newUsers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence) => {
          onUserJoin?.(presence as unknown as PresenceUser);
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence) => {
          const p = presence as unknown as PresenceUser;
          onUserLeave?.(p.id);
        });
      });

    // Subscribe and track
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setError(null);
        channelRef.current = channel;

        // Track user presence
        const now = new Date().toISOString();
        await channel.track({
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          role: user.role,
          joined_at: now,
          online_at: now,
        });

        // Start heartbeat to update online_at
        heartbeatRef.current = setInterval(async () => {
          await channel.track({
            id: user.id,
            name: user.name,
            avatar_url: user.avatar_url,
            role: user.role,
            joined_at: now,
            online_at: new Date().toISOString(),
          });
        }, 5000);
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        setError('Connection error');
      } else if (status === 'TIMED_OUT') {
        setIsConnected(false);
        setError('Connection timed out');
      }
    });

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [channelName, user, supabase, transformPresenceState, onUserJoin, onUserLeave]);

  return {
    users,
    onlineCount: users.length,
    isConnected,
    error,
  };
}

// Hook specifically for live session presence
export function useLiveSessionPresence(sessionCode: string, user: UsePresenceOptions['user']) {
  return usePresence({
    channelName: `presence-session-${sessionCode.toUpperCase()}`,
    user,
  });
}
