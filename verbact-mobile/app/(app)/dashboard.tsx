import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Alert, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Mic, Square, Share2, Copy, CheckCircle, X, Clock } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { audioService } from '../../lib/AudioService';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient'; // Restored
import { GradientText } from '../../components/ui/GradientText';
// import * as Clipboard from 'expo-clipboard'; 

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const API_BASE_URL = 'https://api.verbact.com'; // Production URL

export default function Dashboard() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<any[]>([]);

  // Saving State & Usage
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [usage, setUsage] = useState<{ used: number, limit: number, remaining: number, tier: string } | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE_URL}/api/user/usage?token=${session.access_token}`);
      if (response.ok) {
        const data = await response.json();
        setUsage({
          used: data.used_seconds,
          limit: data.limit_seconds,
          remaining: data.remaining_seconds,
          tier: data.tier
        });
      }
    } catch (e) {
      console.log("Failed to fetch usage:", e);
    }
  };

  useEffect(() => {
    // wait for init
    const initAudio = async () => {
      try {
        await audioService.init();
        setIsInitialized(true);
      } catch (e) {
        console.error("Audio Init Failed", e);
        Alert.alert("Init Error", "Could not initialize audio recorder.");
      }
    };
    initAudio();
    fetchUsage();



    // ... (inside useEffect)
    const handleTranscript = (data: any) => {
      if (data.is_final) {
        setTranscript(prev => prev + ' ' + data.transcript);
        setInterimTranscript('');

        // Store segment for saving
        setTranscriptSegments(prev => [...prev, {
          text: data.transcript,
          start_time: data.start || 0, // Fallback if backend doesn't send time
          end_time: data.end || 0,
          confidence: data.confidence || 1.0,
          is_final: true
        }]);
      } else {
        setInterimTranscript(data.transcript);
      }
    };
    const handleError = (msg: string) => {
      Alert.alert("Error", msg);
      setIsRecording(false);
      setSaveStatus('idle'); // Reset if error occurs during recording
    };
    const handleStop = () => {
      // setIsRecording(false); // Handled manually in toggle to control flow
    };

    audioService.on('transcript', handleTranscript);
    audioService.on('error', handleError);
    audioService.on('stop', handleStop);

    return () => {
      audioService.off('transcript', handleTranscript);
      audioService.off('error', handleError);
      audioService.off('stop', handleStop);
    };
  }, []);

  const saveRecording = async (id: string, filePath: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !filePath) return;

    try {
      console.log("Saving recording...", id, filePath);
      const formData = new FormData();
      formData.append("id", id);
      formData.append("title", `Mobile Recording ${new Date().toLocaleTimeString()}`);
      formData.append("duration_seconds", "0"); // TODO: Calculate actual duration
      formData.append("token", session.access_token);
      formData.append("transcripts", JSON.stringify(transcriptSegments));

      // Append Audio File
      // @ts-ignore
      formData.append("audio_file", {
        uri: Platform.OS === 'android' ? `file://${filePath}` : filePath,
        type: 'audio/wav',
        name: 'recording.wav',
      });

      const response = await fetch(`${API_BASE_URL}/api/recordings`, {
        method: "POST",
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData
      });

      if (!response.ok) {
        console.error("Save failed", await response.text());
        Alert.alert("Save Error", "Failed to save recording to cloud.");
        setSaveStatus('idle');
      } else {
        console.log("Recording saved successfully!");
        setSaveStatus('success');
        fetchUsage(); // Refresh usage after save
      }
    } catch (e) {
      console.error("Save Error", e);
      Alert.alert("Error", "Exception saving recording.");
      setSaveStatus('idle');
    }
  };

  const handleToggleRecord = async () => {
    if (!isInitialized) return;

    if (isRecording) {
      // STOPPING
      setSaveStatus('saving'); // Show saving UI immediately
      const filePath = await audioService.stopRecording();
      setIsRecording(false);

      // Auto-Save on Stop
      if (recordingId) {
        await saveRecording(recordingId, filePath);
      } else {
        setSaveStatus('idle');
      }
    } else {
      // STARTING
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "No active session");
        return;
      }

      const newId = generateUUID();
      setRecordingId(newId);
      setTranscript('');
      setInterimTranscript('');
      setTranscriptSegments([]); // Reset segments
      setShareUrl(null);
      setSaveStatus('idle'); // Ensure idle

      await audioService.startRecording(session.access_token, newId);
      setIsRecording(true);
    }
  };

  const handleCreateShare = async () => {
    if (shareUrl) {
      Share.share({ message: `Check out my live transcription: ${shareUrl}`, url: shareUrl });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !recordingId) return;

    setIsSharing(true);
    try {
      // 1. Ensure recording exists in DB (init)
      const initFormData = new FormData();
      initFormData.append("id", recordingId);
      initFormData.append("title", `Live Recording ${new Date().toLocaleTimeString()}`);
      initFormData.append("token", session.access_token);

      const initResponse = await fetch(`${API_BASE_URL}/api/recordings/init`, {
        method: "POST",
        body: initFormData
      });

      if (!initResponse.ok) {
        console.warn("Init recording warning:", await initResponse.text());
        // Continue anyway? If init failed, share might fail too, but let's try.
      }

      // 2. Create Share Link
      const response = await fetch(`${API_BASE_URL}/api/shares?token=${session.access_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_id: recordingId,
          expires_in_hours: 24
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Share creation failed:", response.status, errText);
        throw new Error(`Failed to create share: ${response.status} ${errText}`);
      }

      const result = await response.json();
      const url = `https://verbact.com/share/${result.share_token}`;
      setShareUrl(url);

      await Share.share({ message: `Check out my live transcription: ${url}`, url: url });
    } catch (e: any) {
      Alert.alert("Share Error", e.message);
    } finally {
      setIsSharing(false);
    }
  };

  const closeSuccessModal = () => {
    setSaveStatus('idle');
  };

  // Format seconds to compact string
  const formatTime = (seconds: number) => {
    if (seconds === -1) return "∞";
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  return (
    <View style={styles.container}>
      {/* Saving / Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={saveStatus !== 'idle'}
        onRequestClose={() => {
          if (saveStatus === 'success') closeSuccessModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {saveStatus === 'saving' ? (
              <>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
                <Text style={styles.modalTitle}>Saving Recording...</Text>
                <Text style={styles.modalSubtitle}>Syncing to cloud</Text>
              </>
            ) : (
              <>
                <View style={styles.successIcon}>
                  <CheckCircle size={48} color={Colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Saved!</Text>
                <Text style={styles.modalSubtitle}>Recording uploaded successfully.</Text>
                <TouchableOpacity style={styles.modalButton} onPress={closeSuccessModal}>
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Usage Indicator (Top bar) */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 }}>
        {usage ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 }}>
            <Clock size={16} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: Colors.text, fontSize: 13, flex: 1 }}>
              <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{usage.tier.toUpperCase()}</Text> Plan: {formatTime(usage.remaining)} remaining
            </Text>
            <View style={{ width: 60, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
              <View style={{
                width: usage.limit === -1 ? '100%' : `${Math.min(100, (usage.remaining / usage.limit) * 100)}%`,
                height: '100%',
                backgroundColor: usage.remaining < 300 && usage.limit !== -1 ? Colors.error : Colors.primary,
                borderRadius: 2
              }} />
            </View>
          </View>
        ) : (
          <View style={{ height: 44 }} /> // Placeholder
        )}
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Transcript */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.transcriptContainer}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {transcript || interimTranscript ? (
            <Text style={styles.text}>
              {transcript}
              <Text style={styles.interimText}> {interimTranscript}</Text>
            </Text>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Transcript will appear here...</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Bottom Control Deck */}
      <View style={styles.controlsWrapper}>
        <LinearGradient
          colors={['transparent', Colors.background]}
          style={styles.fadeOverlay}
          pointerEvents="none"
        />

        <View style={styles.controls}>
          {/* Status & Timer */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: isRecording ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.1)' }]}>
              <View style={[styles.statusDot, { backgroundColor: isRecording ? Colors.error : Colors.textSecondary }]} />
              <Text style={styles.statusBadgeText}>{isRecording ? "LIVE NOW" : (isInitialized ? "READY" : "INITIALIZING")}</Text>
            </View>
            <Text style={styles.timerText}>00:00</Text>
            <Text style={styles.connectionText}>{isRecording ? "Connected" : "Connected"}</Text>
          </View>

          {/* Primary Actions */}
          <View style={styles.buttonsRow}>
            {/* Share */}
            <TouchableOpacity onPress={handleCreateShare} style={styles.sideButton} disabled={!recordingId}>
              {isSharing ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : (
                <Share2 size={22} color={recordingId ? Colors.text : Colors.textSecondary} />
              )}
              <Text style={[styles.btnLabel, !recordingId && { opacity: 0.5 }]}>Share</Text>
            </TouchableOpacity>

            {/* Record Button */}
            <TouchableOpacity onPress={handleToggleRecord} activeOpacity={0.8} disabled={!isInitialized || saveStatus === 'saving'}>
              <LinearGradient
                colors={isRecording ? ([Colors.error, '#D32F2F'] as const) : (['#FF8C00', '#FF0080'] as const)}
                style={[
                  styles.recordButton,
                  { opacity: (isInitialized && saveStatus !== 'saving') ? 1 : 0.5 }
                ]}
              >
                {isRecording ? (
                  <Square size={28} color="white" fill="white" />
                ) : (
                  <Mic size={32} color="white" />
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Copy/Menu Placeholder */}
            <TouchableOpacity
              style={styles.sideButton}
              disabled={!shareUrl}
              onPress={() => {
                if (shareUrl) {
                  Alert.alert("Link", shareUrl);
                }
              }}
            >
              <Copy size={22} color={shareUrl ? Colors.text : Colors.textSecondary} />
              <Text style={[styles.btnLabel, !shareUrl && { opacity: 0.5 }]}>Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E24',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '80%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#BFC2CF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 100,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successIcon: {
    marginBottom: 16,
    backgroundColor: 'rgba(168, 108, 255, 0.1)',
    padding: 16,
    borderRadius: 50,
  },
  mainContent: {
    flex: 1,
    paddingTop: 10, // Reduced top padding to fit usage bar
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16, // Reduced
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10, // Smaller
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 48, // Reduced from 64
    fontWeight: '700',
    color: '#888',
    letterSpacing: 2,
    marginBottom: 4,
  },
  connectionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    opacity: 0.7,
  },
  transcriptContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 220, // More space for controls
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    opacity: 0.5,
  },
  text: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  interimText: {
    color: Colors.textSecondary,
    opacity: 0.8,
  },
  controlsWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  fadeOverlay: {
    height: 30, // Smaller fade
  },
  controls: {
    backgroundColor: Colors.surface,
    paddingTop: 20, // Reduced
    paddingBottom: 40, // Reduced
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 30,
    gap: 30, // Reduced gap
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
  },
  btnLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  recordButton: {
    width: 72, // Reduced from 80
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  }
});
