'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, FileText, X } from 'lucide-react';
import type { IntelDrop } from '@/lib/types';

interface IntelDropNotificationProps {
  userTaskForce?: string | null;
  onNewIntel?: (intel: IntelDrop) => void;
}

export function IntelDropNotification({
  userTaskForce,
  onNewIntel,
}: IntelDropNotificationProps) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  // Handle new intel drop
  const handleNewIntel = useCallback((intel: IntelDrop) => {
    // Check if this intel affects the user's task force
    const affectsUser =
      !intel.affected_task_forces ||
      intel.affected_task_forces.length === 0 ||
      (userTaskForce && intel.affected_task_forces.includes(userTaskForce));

    if (!affectsUser) return;

    // Determine icon and color based on classification
    const getIcon = () => {
      switch (intel.classification) {
        case 'URGENT':
          return <AlertTriangle className="h-5 w-5 text-red-500" />;
        case 'CLASSIFIED':
          return <Shield className="h-5 w-5 text-amber-500" />;
        default:
          return <FileText className="h-5 w-5 text-blue-500" />;
      }
    };

    // Play notification sound (optional)
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (autoplay restrictions)
      });
    } catch {
      // Ignore audio errors
    }

    // Show toast notification
    toast.custom(
      (t) => (
        <div className="bg-background border rounded-lg shadow-lg p-4 max-w-md">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant={intel.classification === 'URGENT' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {intel.classification}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Day {intel.day}
                </Badge>
              </div>
              <p className="font-medium text-sm">{intel.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {intel.content.split('\n')[0]}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    router.push('/intel');
                    toast.dismiss(t);
                  }}
                >
                  View Intel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toast.dismiss(t)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        duration: 10000,
        position: 'top-right',
      }
    );

    // Callback
    onNewIntel?.(intel);
  }, [router, userTaskForce, onNewIntel]);

  useEffect(() => {
    // Subscribe to intel_drops table changes
    const channel = supabase
      .channel('intel-drops-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'intel_drops',
          filter: 'is_released=eq.true',
        },
        (payload) => {
          // Check if this is a newly released intel (was false, now true)
          const newIntel = payload.new as IntelDrop;
          const oldIntel = payload.old as Partial<IntelDrop>;

          if (newIntel.is_released && !oldIntel.is_released) {
            handleNewIntel(newIntel);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intel_drops',
        },
        (payload) => {
          const newIntel = payload.new as IntelDrop;
          if (newIntel.is_released) {
            handleNewIntel(newIntel);
          }
        }
      )
      .subscribe();

    // Also listen to broadcast channel for cron-released intels
    const broadcastChannel = supabase
      .channel('intel-releases')
      .on('broadcast', { event: 'new_intel' }, ({ payload }) => {
        if (payload.released && Array.isArray(payload.released)) {
          payload.released.forEach((intel: IntelDrop) => {
            handleNewIntel(intel);
          });
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      broadcastChannel.unsubscribe();
    };
  }, [supabase, handleNewIntel]);

  // This component doesn't render anything visible
  // It just sets up the subscription
  return null;
}

// Hook to get unread intel count
export function useUnreadIntelCount(userTaskForce?: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = getSupabaseClient();

  useEffect(() => {
    // Get count of released intel drops in the last 24 hours
    const fetchUnreadCount = async () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      let query = supabase
        .from('intel_drops')
        .select('id', { count: 'exact', head: true })
        .eq('is_released', true)
        .gte('released_at', oneDayAgo.toISOString());

      // Filter by task force if provided
      if (userTaskForce) {
        query = query.or(`affected_task_forces.is.null,affected_task_forces.cs.{${userTaskForce}}`);
      }

      const { count } = await query;
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to changes
    const channel = supabase
      .channel('intel-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'intel_drops',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, userTaskForce]);

  return unreadCount;
}

// Badge component for navigation
export function IntelBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="ml-1 h-5 min-w-5 px-1 text-xs animate-pulse"
    >
      {count > 9 ? '9+' : count}
    </Badge>
  );
}
