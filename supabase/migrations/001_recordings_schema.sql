-- Recordings table
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Recording',
  audio_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcripts table with timestamps for audio-text sync
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  confidence REAL,
  is_final BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Live shares table for real-time sharing
CREATE TABLE IF NOT EXISTS live_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON transcripts(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_time ON transcripts(recording_id, start_time);
CREATE INDEX IF NOT EXISTS idx_live_shares_token ON live_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_live_shares_recording ON live_shares(recording_id);
CREATE INDEX IF NOT EXISTS idx_live_shares_active ON live_shares(is_active);

-- Row Level Security
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_shares ENABLE ROW LEVEL SECURITY;

-- Recording Policies
CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings"
  ON recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings"
  ON recordings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings"
  ON recordings FOR DELETE
  USING (auth.uid() = user_id);

-- Transcript Policies
CREATE POLICY "Users can view transcripts of own recordings"
  ON transcripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM recordings
    WHERE recordings.id = transcripts.recording_id
    AND recordings.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transcripts for own recordings"
  ON transcripts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM recordings
    WHERE recordings.id = transcripts.recording_id
    AND recordings.user_id = auth.uid()
  ));

CREATE POLICY "Public can view shared transcripts"
  ON transcripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM live_shares
    WHERE live_shares.recording_id = transcripts.recording_id
    AND live_shares.is_active = true
    AND (live_shares.expires_at IS NULL OR live_shares.expires_at > NOW())
  ));

-- Live Share Policies
CREATE POLICY "Users can manage shares for own recordings"
  ON live_shares FOR ALL
  USING (EXISTS (
    SELECT 1 FROM recordings
    WHERE recordings.id = live_shares.recording_id
    AND recordings.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can view active shares"
  ON live_shares FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for recordings
CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired shares
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
  UPDATE live_shares
  SET is_active = false
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW()
  AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE recordings IS 'Stores user audio recordings with metadata';
COMMENT ON TABLE transcripts IS 'Stores transcript segments with timestamps for audio-text synchronization';
COMMENT ON TABLE live_shares IS 'Manages public sharing links for live and recorded transcripts';
COMMENT ON COLUMN transcripts.start_time IS 'Start time in seconds for audio-text sync';
COMMENT ON COLUMN transcripts.end_time IS 'End time in seconds for audio-text sync';
COMMENT ON COLUMN live_shares.share_token IS 'Unique token for public share URLs';
COMMENT ON COLUMN live_shares.viewer_count IS 'Number of active viewers (updated via WebSocket)';
