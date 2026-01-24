import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Alert, ScrollView, ActivityIndicator, Platform, Modal, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Mic, Square, Share2, Copy, CheckCircle, X } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { audioService } from '../../lib/AudioService';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const API_BASE_URL = 'https://api.verbact.com'; // Production URL

export default function RecordScreen() {
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [transcriptSegments, setTranscriptSegments] = useState<any[]>([]);

    // Saving State
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

    const scrollViewRef = useRef<ScrollView>(null);

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
            // Handled manually
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

    const [recordingDuration, setRecordingDuration] = useState(0);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            // @ts-ignore
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // Reset timer on start
    useEffect(() => {
        if (isRecording && recordingDuration === 0) {
            // Started
        } else if (!isRecording && recordingDuration > 0) {
            // Stopped - handled in toggle
        }
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Save Logic - CLIENT SIDE NOW JUST SHOWS SUCCESS (Server does the work)
    const saveRecording = async (id: string, filePath: string | null, finalDuration: number) => {
        // Optimization: Server saves the recording automatically on stop.
        // We just show the UI feedback here.

        console.log("Server-side save triggered. Local file:", filePath);
        setSaveStatus('success');

        // Optional: Wait a moment for server to finalize if we were to act on it
        // but for UX we can just show success.
    };

    // Toggle Logic
    const handleToggleRecord = async () => {
        try {
            if (!isInitialized) return;

            if (isRecording) {
                // STOPPING
                setSaveStatus('saving'); // Show saving UI immediately
                const filePath = await audioService.stopRecording();
                setIsRecording(false);
                // Don't reset duration yet so user can see final time

                // Auto-Save on Stop (Server handles it, we just update UI)
                if (recordingId) {
                    // Pass the actual duration captured
                    await saveRecording(recordingId, filePath, recordingDuration);
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
                const title = `Mobile Recording ${new Date().toLocaleTimeString()}`;
                setRecordingId(newId);
                setTranscript('');
                setInterimTranscript('');
                setTranscriptSegments([]); // Reset segments
                setShareUrl(null);
                setSaveStatus('idle'); // Ensure idle
                setRecordingDuration(0); // Reset timer

                await audioService.startRecording(session.access_token, newId, title);
                setIsRecording(true);
            }
        } catch (err: any) {
            Alert.alert("Error", "Failed to toggle recording: " + err.message);
            setIsRecording(false);
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

            {/* NEW: Top Header (Timer & Title) */}
            <View style={styles.topHeader}>
                <Text style={styles.headerTitle}>Record</Text>
                <View style={styles.timerContainer}>
                    <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                    <Text style={styles.statusText}>{isRecording ? "LIVE" : (isInitialized ? "Ready" : "Initializing...")}</Text>
                </View>
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
                    {/* Primary Actions */}
                    <View style={styles.buttonsRow}>
                        {/* Share */}
                        <TouchableOpacity onPress={handleCreateShare} style={styles.sideButton} disabled={!recordingId}>
                            {isSharing ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : (
                                <Share2 size={24} color={recordingId ? Colors.text : Colors.textSecondary} />
                            )}
                        </TouchableOpacity>

                        {/* Record Button - Standard Mic/Stop */}
                        <TouchableOpacity onPress={handleToggleRecord} activeOpacity={0.8} disabled={!isInitialized || saveStatus === 'saving'}>
                            <View style={[
                                styles.recordButtonContainer,
                                isRecording ? styles.recordingActive : styles.recordingIdle
                            ]}>
                                {isRecording ? (
                                    <Square size={32} color="white" fill="white" />
                                ) : (
                                    <Mic size={32} color="white" />
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Right Side - Empty for balance (or could be removed if width adjusted) */}
                        <View style={styles.sideButton} />
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
    topHeader: {
        paddingTop: 60, // Safe area
        paddingHorizontal: 24,
        paddingBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    timerContainer: {
        alignItems: 'center',
        gap: 4,
    },
    timerText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        fontSize: 40, // Slightly larger
        fontWeight: '700',
        color: Colors.text,
        letterSpacing: 2,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        opacity: 0.8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },

    // ... modal styles unchanged ...
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
        // paddingTop removed, handled by header
    },
    transcriptContainer: {
        flex: 1,
        paddingHorizontal: 24,
    },
    scrollContent: {
        paddingBottom: 220, // Reduced from 280
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
        height: 30,
    },
    controls: {
        backgroundColor: Colors.surface,
        paddingTop: 16, // Reduced from 20
        paddingBottom: 24, // Reduced from 40
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
        paddingHorizontal: 20, // Reduced from 30
        gap: 20, // Reduced from 30
    },
    sideButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
        // backgroundColor: 'rgba(255,255,255,0.05)', // Removed background for cleaner look on empty
    },
    recordButtonContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    recordingIdle: {
        backgroundColor: '#FF4444', // Red for Start
    },
    recordingActive: {
        backgroundColor: '#FF4444', // Keep Red (or change to darker/lighter)
        borderWidth: 4,
        borderColor: 'rgba(255, 68, 68, 0.3)', // Pulse effect ring
    }
});
