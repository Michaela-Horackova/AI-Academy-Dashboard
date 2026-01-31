-- Migration: Add email notifications and intel notification tracking
-- Date: 2026-01-31
-- Adds: participants.email_notifications, intel_drops.notification_sent

-- ============================================
-- PARTICIPANTS EMAIL NOTIFICATIONS PREFERENCE
-- ============================================

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;

-- ============================================
-- INTEL DROPS NOTIFICATION TRACKING
-- ============================================

ALTER TABLE intel_drops
  ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN NOT NULL DEFAULT false;

-- Update existing released intel drops as already notified (to avoid sending old notifications)
UPDATE intel_drops
SET notification_sent = true
WHERE is_released = true;

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_intel_drops_notification_sent
ON intel_drops(notification_sent)
WHERE notification_sent = false;
