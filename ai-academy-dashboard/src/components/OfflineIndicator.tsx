'use client';

import { useOfflineBriefing, formatBytes } from '@/hooks/useOfflineBriefing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Wifi, WifiOff, Download, Trash2, HardDrive, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OfflineIndicatorProps {
  currentDay?: number;
}

export function OfflineIndicator({ currentDay }: OfflineIndicatorProps) {
  const {
    cachedDays,
    isCaching,
    isOnline,
    cacheDay,
    uncacheDay,
    clearAllCache,
    getCacheSize,
    isCached,
  } = useOfflineBriefing();

  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    getCacheSize().then(setCacheSize);
  }, [getCacheSize, cachedDays]);

  const isCurrentDayCached = currentDay ? isCached(currentDay) : false;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          {cachedDays.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {cachedDays.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Online Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Offline</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              {formatBytes(cacheSize)}
            </div>
          </div>

          {/* Current Day Quick Action */}
          {currentDay && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Day {currentDay} Briefing</span>
                {isCurrentDayCached ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => uncacheDay(currentDay)}
                    disabled={isCaching}
                  >
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    Cached
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cacheDay(currentDay)}
                    disabled={isCaching}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {isCaching ? 'Saving...' : 'Save Offline'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Cached Days List */}
          {cachedDays.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Saved Briefings
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-red-500 hover:text-red-600"
                  onClick={clearAllCache}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {cachedDays.map((cached) => (
                  <Button
                    key={cached.day}
                    variant="outline"
                    size="sm"
                    className="h-8 px-0 text-xs"
                    onClick={() => uncacheDay(cached.day)}
                    title={`Cached ${new Date(cached.cachedAt).toLocaleDateString()}`}
                  >
                    {cached.day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {cachedDays.length === 0 && !currentDay && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No briefings saved for offline access.
              <br />
              Open a briefing to save it.
            </div>
          )}

          {/* Help Text */}
          <p className="text-xs text-muted-foreground border-t pt-3">
            Save briefings to access them without internet connection.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
