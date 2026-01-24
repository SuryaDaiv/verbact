import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Share, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/Colors';
import { Play, Share as ShareIcon, ChevronLeft, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Pause } from 'lucide-react-native';

export default function RecordingDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [recording, setRecording] = useState<any>(null);
    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    // Audio State
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    // Unload sound on unmount
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    useEffect(() => {
        if (!id) return;
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            // Fetch Recording Metadata
            const { data: recData, error: recError } = await supabase
                .from('recordings')
                .select('*')
                .eq('id', id)
                .single();

            if (recError) throw recError;

            // Generate Signed URL if audio_url is a path
            if (recData?.audio_url && !recData.audio_url.startsWith('http')) {
                const { data: signedData, error: signError } = await supabase
                    .storage
                    .from('recordings')
                    .createSignedUrl(recData.audio_url, 3600); // 1 hour expiry

                if (signError) {
                    console.error("Error signing URL:", signError);
                } else if (signedData) {
                    console.log("Generated Signed URL:", signedData.signedUrl);
                    recData.audio_url = signedData.signedUrl;
                }
            }

            setRecording(recData);

            // Fetch Transcripts
            // Note: Adjust table name/query based on actual backend schema. 
            // Assuming 'transcripts' table link via recording_id
            const { data: transData, error: transError } = await supabase
                .from('transcripts')
                .select('*')
                .eq('recording_id', id)
                .order('start_time', { ascending: true });

            if (transError) {
                console.log("Transcript fetch error (might be empty):", transError);
            } else {
                setTranscripts(transData || []);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadAudio = async (url: string) => {
        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: false },
                onPlaybackStatusUpdate
            );
            setSound(newSound);
        } catch (error) {
            console.error('Error loading audio:', error);
        }
    };

    useEffect(() => {
        if (recording?.audio_url) {
            console.log("Loading Audio:", recording.audio_url);

            // Configure Audio for Playback
            Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            }).catch(e => console.error("Audio Mode Error:", e));

            loadAudio(recording.audio_url);
        } else if (recording) {
            console.log("No audio_url for recording:", recording);
        }
    }, [recording]);

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setPosition(status.positionMillis);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                sound?.setPositionAsync(0);
            }
        }
    };

    const togglePlayback = async () => {
        if (!sound) return;
        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            await sound.playAsync();
        }
    };

    const formatTime = (millis: number) => {
        if (!millis) return '00:00';
        const totalSeconds = Math.floor(millis / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleShare = async () => {
        if (!transcripts.length) return;
        const text = transcripts.map(t => t.text).join(' '); // Changed t.content to t.text
        try {
            await Share.share({
                message: text,
                title: recording?.title || "Transcript"
            });
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    if (!recording) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={{ color: 'white' }}>Recording not found</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ title: recording.title || 'Recording' }} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{recording.title}</Text>
                <TouchableOpacity onPress={handleShare}>
                    <ShareIcon size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Meta */}
            <View style={styles.meta}>
                <Calendar size={14} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{new Date(recording.created_at).toLocaleString()}</Text>
            </View>

            {/* Audio Player */}
            {recording.audio_url && (
                <View style={styles.player}>
                    <TouchableOpacity style={styles.playBtn} onPress={togglePlayback}>
                        {isPlaying ? (
                            <Pause size={20} color="white" fill="white" />
                        ) : (
                            <Play size={20} color="white" fill="white" />
                        )}
                    </TouchableOpacity>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${duration > 0 ? (position / duration) * 100 : 0}%` }]} />
                    </View>
                    <Text style={styles.durationText}>{formatTime(position)} / {formatTime(duration)}</Text>
                </View>
            )}

            {/* Transcript */}
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.sectionTitle}>Transcript</Text>
                {transcripts.length > 0 ? (
                    transcripts.map((t, index) => (
                        <View key={index} style={styles.segment}>
                            <Text style={styles.timestamp}>{formatTimestamp(t.start_time)}</Text>
                            <Text style={styles.segmentText}>{t.text}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No transcript available.</Text>
                )}
            </ScrollView>
        </View>
    );
}

function formatTimestamp(seconds: number) {
    if (!seconds) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backBtn: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    metaText: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    player: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
    },
    playBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginRight: 12,
        overflow: 'hidden',
    },
    progressFill: {
        width: '0%', // Dynamic later
        height: '100%',
        backgroundColor: Colors.primary,
    },
    durationText: {
        color: Colors.textSecondary,
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    segment: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    timestamp: {
        width: 50,
        color: Colors.textSecondary,
        fontSize: 12,
        paddingTop: 4,
        opacity: 0.6,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
    segmentText: {
        flex: 1,
        color: Colors.text,
        fontSize: 14, // REDUCED from 16
        lineHeight: 22, // Reduced line height
    },
    emptyText: {
        color: Colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 40,
    }
});
