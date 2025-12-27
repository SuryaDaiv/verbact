import AudioRecord from 'react-native-audio-record';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { Platform } from 'react-native';
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
        // AudioRecord.init will be called in startRecording after permissions

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

            // data is base64 encoded PCM
            const buffer = base64ToArrayBuffer(data);
            this.socket.send(buffer);
        });
    }

    async startRecording(sessionToken: string, recordingId: string) {
        if (this.isRecording) return;

        // 0. Request Permissions (Audio AND Notifications)
        if (Platform.OS === 'android') {
            const { PermissionsAndroid } = require('react-native');

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

            // Request Notifications (Android 13+)
            const grantedNotif = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );

            if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) {
                console.warn('Microphone permission denied');
                this.emit('error', 'Microphone permission denied');
                return;
            }
        }

        // Initialize Audio Record NOW (ensure permissions are granted first)
        const options = {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6, // VOICE_RECOGNITION
            wavFile: 'test.wav'
        };
        AudioRecord.init(options);

        console.log('Starting recording...', recordingId);
        this.recordingId = recordingId;

        // 1. Start Foreground Service Notification
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
                    },
                });
            }
        } catch (err: any) {
            console.error("Foreground Service Error:", err);
            // Don't crash, just warn
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
                    recording_id: recordingId
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
