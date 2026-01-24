import AudioRecord from 'react-native-audio-record';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from './supabase';

// Helper to convert base64 to 16-bit signed integer buffer (PCM)
// react-native-audio-record returns base64 string
function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

class AudioService {
    socket: WebSocket | null = null;
    isRecording = false;
    recordingId: string | null = null;
    notificationId: string | null = null;

    isInitialized = false;

    // Event Listeners
    private listeners: { [key: string]: Function[] } = {};

    on(event: 'transcript' | 'error' | 'stop', callback: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event: 'transcript' | 'error' | 'stop', callback: Function) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    private emit(event: string, data?: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    async init() {
        if (this.isInitialized) return;

        // AudioRecord.init will be called here to ensure single initialization
        const options = {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 1, // 1 = MIC (Better for Emulator), 6 = VOICE_RECOGNITION
            wavFile: 'test.wav'
        };

        try {
            AudioRecord.init(options);
            console.log("AudioRecord initialized with source: 1 (MIC)");
            this.isInitialized = true;
        } catch (e: any) {
            console.error("AudioRecord Init Error:", e);
        }

        // Create notification channel
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: 'recording-channel',
                name: 'Recording Channel',
                lights: false,
                vibration: false,
                importance: AndroidImportance.DEFAULT,
            });
        }

        // Setup event listener for audio data
        AudioRecord.on('data', data => {
            if (!this.isRecording || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

            // Debug log to confirm data flow (throttle this in prod)
            // console.log("Audio Data Packet:", data.length); 

            // data is base64 encoded PCM
            const buffer = base64ToArrayBuffer(data);
            this.socket.send(buffer);
        });
    }

    async startRecording(sessionToken: string, recordingId: string, title: string = "New Recording") {
        try {
            if (this.isRecording) return;

            // Ensure initialized
            if (!this.isInitialized) {
                await this.init();
            }

            // 0. Request Permissions (Audio AND Notifications)
            if (Platform.OS === 'android') {
                try {
                    // Request Audio
                    const grantedAudio = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                        {
                            title: 'Microphone Permission',
                            message: 'Verbact needs access to your microphone to record audio.',
                            buttonNeutral: 'Ask Me Later',
                            buttonNegative: 'Cancel',
                            buttonPositive: 'OK',
                        },
                    );

                    if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) {
                        console.warn('Microphone permission denied');
                        this.emit('error', 'Microphone permission denied');
                        return; // EXIT if denied
                    }

                    // Request Notifications (Safe Check)
                    if (Platform.Version >= 33) {
                        // @ts-ignore
                        const POST_NOTIFICATIONS = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
                        if (POST_NOTIFICATIONS) {
                            await PermissionsAndroid.request(POST_NOTIFICATIONS);
                        }
                    }
                } catch (permErr: any) {
                    console.error("Permission Request Error:", permErr);
                    return; // EXIT on error
                }
            }

            console.log('Starting recording...', recordingId);
            this.recordingId = recordingId;

            // 1. Start Foreground Service Notification (REQUIRED for background recording)
            try {
                if (Platform.OS === 'android') {
                    await notifee.displayNotification({
                        id: 'foreground-service',
                        title: 'Recording in Progress',
                        body: 'Verbact is capturing audio...',
                        android: {
                            channelId: 'recording-channel',
                            asForegroundService: true,
                            category: AndroidCategory.SERVICE,
                            ongoing: true,
                            pressAction: {
                                id: 'default',
                            },
                            // Add action needed for Android 14+ FGS if microphone type
                            foregroundServiceTypes: [2048], // 2048 = FOREGROUND_SERVICE_TYPE_MICROPHONE (api 29+) or define in manifest
                        },
                    });
                }
            } catch (err: any) {
                console.error("Foreground Service Error (Non-Fatal):", err);
            }

            // 2. Connect WebSocket
            const WS_URL = 'wss://api.verbact.com'; // Production URL

            try {
                console.log(`Connecting to WS: ${WS_URL}/ws/transcribe`);
                // Pass headers to satisfy WAFs or backend checks (Origin is often required)
                // @ts-ignore - RN WebSocket supports headers as 3rd arg
                this.socket = new WebSocket(`${WS_URL}/ws/transcribe?token=${sessionToken}`, null, {
                    headers: {
                        'Origin': 'https://verbact.com',
                        'User-Agent': 'VerbactMobile/1.0'
                    }
                });

                this.socket.onopen = () => {
                    console.log('WS Connected');
                    this.socket?.send(JSON.stringify({
                        type: "configure",
                        recording_id: recordingId,
                        title: title
                    }));
                };

                this.socket.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        // Handle protocol messages
                        if (data.transcript) {
                            this.emit('transcript', data);
                        }
                    } catch (err) {
                        console.log('WS Message Error', err);
                    }
                };

                this.socket.onerror = (e: any) => {
                    const errorMsg = e.message || 'Unknown Error';
                    console.error("WS Error Details:", JSON.stringify(e));
                    this.emit('error', `WebSocket Error: ${errorMsg}`);
                };

                this.socket.onclose = (e) => {
                    console.log("WS Closed", e.code, e.reason);
                    if (this.isRecording) {
                        if (e.code === 1000) {
                            this.emit('stop');
                        } else {
                            // 1006 = Abnormal Closure (Commonly SSL or Network)
                            this.emit('error', `Connection closed (${e.code}): ${e.reason || 'Network/SSL Error'}`);
                            this.stopRecording();
                        }
                    }
                };
            } catch (e: any) {
                console.error("WS Setup Error", e);
                this.emit('error', `Connection failed: ${e.message}`);
                return;
            }

            // 3. Start Audio Capture
            try {
                this.isRecording = true;
                AudioRecord.start();
            } catch (err: any) {
                console.error("Audio Start Error:", err);
                this.emit('error', `Failed to start microphone: ${err.message}`);
                this.stopRecording();
            }
        } catch (globalErr: any) {
            console.error("CRITICAL START RECORDING ERROR:", globalErr);
            this.emit('error', `Critical Error: ${globalErr.message}`);
            try {
                this.stopRecording();
            } catch (e) { }
        }
    }

    async stopRecording() {
        if (!this.isRecording) return null;

        console.log('Stopping recording...');
        this.isRecording = false;

        let filePath = null;

        // Stop Audio
        try {
            filePath = await AudioRecord.stop();
        } catch (e) {
            console.error("Error stopping audio record:", e);
        }

        // Close WS
        if (this.socket) {
            try {
                this.socket.send(JSON.stringify({ type: "stop_recording" }));
                this.socket.close();
            } catch (e) { }
            this.socket = null;
        }

        // Stop Foreground Service
        if (Platform.OS === 'android') {
            await notifee.stopForegroundService();
        }

        this.recordingId = null;
        this.emit('stop');
        return filePath;
    }
}

export const audioService = new AudioService();
