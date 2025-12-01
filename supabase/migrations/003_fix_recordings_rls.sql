-- Fix RLS policy to allow public viewing of shared recordings
CREATE POLICY "Public can view shared recordings"
  ON recordings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM live_shares
    WHERE live_shares.recording_id = recordings.id
    AND live_shares.is_active = true
    AND (live_shares.expires_at IS NULL OR live_shares.expires_at > NOW())
  ));
