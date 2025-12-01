-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  false,
  52428800, -- 50MB limit
  ARRAY['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recordings bucket
CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own recordings"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access for shared recordings
CREATE POLICY "Public can read shared recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recordings' AND
    EXISTS (
      SELECT 1
      FROM recordings r
      JOIN live_shares ls ON ls.recording_id = r.id
      WHERE r.audio_url LIKE '%' || name || '%'
      AND ls.is_active = true
      AND (ls.expires_at IS NULL OR ls.expires_at > NOW())
    )
  );
