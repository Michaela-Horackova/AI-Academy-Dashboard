'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const CACHE_NAME = 'briefing-offline-cache';
const CACHED_DAYS_KEY = 'offline-cached-days';

interface CachedDay {
  day: number;
  cachedAt: string;
  size: number;
}

export interface UseOfflineBriefingReturn {
  cachedDays: CachedDay[];
  isCaching: boolean;
  isOnline: boolean;
  cacheDay: (day: number) => Promise<boolean>;
  uncacheDay: (day: number) => Promise<boolean>;
  cacheMultipleDays: (days: number[]) => Promise<void>;
  clearAllCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  isCached: (day: number) => boolean;
}

export function useOfflineBriefing(): UseOfflineBriefingReturn {
  const [cachedDays, setCachedDays] = useState<CachedDay[]>([]);
  const [isCaching, setIsCaching] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Load cached days from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(CACHED_DAYS_KEY);
    if (stored) {
      try {
        setCachedDays(JSON.parse(stored));
      } catch {
        localStorage.removeItem(CACHED_DAYS_KEY);
      }
    }

    // Track online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      toast.info('You are offline', {
        description: 'Cached briefings are still available',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save cached days to localStorage
  const updateCachedDays = useCallback((days: CachedDay[]) => {
    setCachedDays(days);
    localStorage.setItem(CACHED_DAYS_KEY, JSON.stringify(days));
  }, []);

  // Cache a single day's briefing content
  const cacheDay = useCallback(async (day: number): Promise<boolean> => {
    if (!('caches' in window)) {
      toast.error('Offline caching not supported in this browser');
      return false;
    }

    setIsCaching(true);

    try {
      const cache = await caches.open(CACHE_NAME);

      // URLs to cache for this day
      const urls = [
        `/api/content/day/${day}`,
        `/mission/day/${day}`,
      ];

      // Fetch and cache each URL
      let totalSize = 0;
      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const clone = response.clone();
            await cache.put(url, response);
            const blob = await clone.blob();
            totalSize += blob.size;
          }
        } catch (err) {
          console.warn(`Failed to cache ${url}:`, err);
        }
      }

      // Update cached days list
      const newCachedDay: CachedDay = {
        day,
        cachedAt: new Date().toISOString(),
        size: totalSize,
      };

      const updatedDays = [...cachedDays.filter((d) => d.day !== day), newCachedDay];
      updatedDays.sort((a, b) => a.day - b.day);
      updateCachedDays(updatedDays);

      toast.success(`Day ${day} saved for offline access`);
      return true;
    } catch (error) {
      console.error('Failed to cache day:', error);
      toast.error('Failed to save for offline access');
      return false;
    } finally {
      setIsCaching(false);
    }
  }, [cachedDays, updateCachedDays]);

  // Remove a day from cache
  const uncacheDay = useCallback(async (day: number): Promise<boolean> => {
    if (!('caches' in window)) return false;

    try {
      const cache = await caches.open(CACHE_NAME);

      const urls = [
        `/api/content/day/${day}`,
        `/mission/day/${day}`,
      ];

      for (const url of urls) {
        await cache.delete(url);
      }

      const updatedDays = cachedDays.filter((d) => d.day !== day);
      updateCachedDays(updatedDays);

      toast.success(`Day ${day} removed from offline cache`);
      return true;
    } catch (error) {
      console.error('Failed to uncache day:', error);
      return false;
    }
  }, [cachedDays, updateCachedDays]);

  // Cache multiple days at once
  const cacheMultipleDays = useCallback(async (days: number[]): Promise<void> => {
    setIsCaching(true);

    for (const day of days) {
      await cacheDay(day);
    }

    setIsCaching(false);
    toast.success(`Cached ${days.length} days for offline access`);
  }, [cacheDay]);

  // Clear all cached briefings
  const clearAllCache = useCallback(async (): Promise<void> => {
    if (!('caches' in window)) return;

    try {
      await caches.delete(CACHE_NAME);
      updateCachedDays([]);
      toast.success('Offline cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    }
  }, [updateCachedDays]);

  // Get total cache size
  const getCacheSize = useCallback(async (): Promise<number> => {
    if (!('caches' in window)) return 0;

    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      let totalSize = 0;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }, []);

  // Check if a specific day is cached
  const isCached = useCallback((day: number): boolean => {
    return cachedDays.some((d) => d.day === day);
  }, [cachedDays]);

  return {
    cachedDays,
    isCaching,
    isOnline,
    cacheDay,
    uncacheDay,
    cacheMultipleDays,
    clearAllCache,
    getCacheSize,
    isCached,
  };
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
