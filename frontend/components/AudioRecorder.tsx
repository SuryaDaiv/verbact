"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Activity, Save, Share2, X, Copy, Check, RefreshCw } from "lucide-react";
import { API_BASE_URL, WS_BASE_URL } from "@/utils/config";

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "send" | "receive" | "error";
}

interface Metrics {
  chunksSent: number;
  transcriptsReceived: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
}

interface TranscriptSegment {
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
}

type SubscriptionTier = "free" | "pro" | "unlimited";

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [volume, setVolume] = useState(0);
  const [status, setStatus] = useState("Disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    chunksSent: 0,
    transcriptsReceived: 0,
    lastLatencyMs: 0,
    avgLatencyMs: 0,
  });
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const tierLimits: Record<SubscriptionTier, number | null> = {
    free: 10 * 60, // 10 minutes
    pro: 1200 * 60, // 1,200 minutes
    unlimited: null,
  };
  const sessionLimitSeconds = tierLimits[subscriptionTier];
  const [authError, setAuthError] = useState<string | null>(null);

  const getToken = async () => {
    setStatus("Authenticating...");
    setAuthError(null);
    const startTime = performance.now();
    console.log(`[Auth Debug] Starting session check at ${new Date().toISOString()}`);

    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();

      // Log config (masked)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      console.log(`[Auth Debug] Config: URL=${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'MISSING'}`);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth check timed out (10s)")), 10000)
      );

      // Race the auth check against the timeout
      const sessionPromise = supabase.auth.getSession();

      const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any }, error: any };
      const { data: { session }, error } = result;

      const endTime = performance.now();
      console.log(`[Auth Debug] Session check complete in ${(endTime - startTime).toFixed(2)}ms`);

      if (error) {
        console.error("[Auth Debug] Auth error:", error);
        setStatus("Auth Failed");
        setAuthError(error.message);
        return;
      }

      if (session) {
        console.log(`[Auth Debug] Session found for user ${session.user.id}`);
        setSessionToken(session.access_token);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", session.user.id)
          .single();

        if (profileError) {
          console.error("[Auth Debug] Profile fetch error:", profileError);
        } else if (profile?.subscription_tier) {
          setSubscriptionTier(profile.subscription_tier as SubscriptionTier);
        }
      } else {
        console.log("[Auth Debug] No session found (user not logged in)");
        setStatus("Not Logged In");
        setAuthError("Please log in to record.");
      }
    } catch (err: any) {
      const endTime = performance.now();
      console.error(`[Auth Debug] Error getting token after ${(endTime - startTime).toFixed(2)}ms:`, err);
      setStatus("Connection Failed");
      setAuthError(err.message || "Unknown error");
    }
  };

  useEffect(() => {
    setMounted(true);
    getToken();
  }, []);

  const handleRetry = () => {
    getToken();
  };

  // Save/Share state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // New state to track if actually saved to DB
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);

  // Share state
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const transcriptsForSaveRef = useRef<TranscriptSegment[]>([]);
  const lastChunkTimeRef = useRef<number>(0);
  const latenciesRef = useRef<number[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  const [transcriptWithTimestamps, setTranscriptWithTimestamps] = useState<TranscriptSegment[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const statusRef = useRef("Ready");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const SILENCE_THRESHOLD = 0.001;

  // ... (rest of the file)



  // ...

  // In the JSX for Modal:
  /*
          {
            showSaveModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Save Recording</h3>
                    <button
                      onClick={() => setShowSaveModal(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {!isSaved ? ( // Check isSaved instead of savedRecordingId
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recording Title</label>
                        <input
                          type="text"
                          value={recordingTitle}
                          onChange={(e) => setRecordingTitle(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="My Recording"
                        />
                      </div>

                      <div className="flex justify-end space-x-3 pt-2">
                        <button
                          onClick={() => setShowSaveModal(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handleSaveRecording}
                          disabled={isSaving}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <>
                              <Activity className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Recording
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">Recording Saved!</h3>
                      <p className="text-gray-600 mb-6">Your recording has been saved successfully.</p>
                      <button
                        onClick={() => window.location.href = `/recordings/${savedRecordingId}`}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        View Recording
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          }
  */

  // Debug mode
  const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

  const getTimestamp = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions & { fractionalSecondDigits?: number } = {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    };
    return now.toLocaleTimeString('en-US', options);
  };

  const addLog = (msg: string, type: LogEntry["type"] = "info") => {
    const timestamp = getTimestamp();
    const entry: LogEntry = { timestamp, message: msg, type };
    if (DEBUG) {
      console.log(`[${timestamp}] ${msg}`);
      setLogs(prev => [entry, ...prev].slice(0, 20));
    }
  };

  const recordingIdRef = useRef<string | null>(null);
  const limitReachedRef = useRef(false);

  useEffect(() => {
    if (savedRecordingId) {
      recordingIdRef.current = savedRecordingId;
    }
  }, [savedRecordingId]);

  const handleLimitReached = (source: string) => {
    if (sessionLimitSeconds === null) return;
    if (limitReachedRef.current) return;
    limitReachedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (sessionLimitSeconds) {
      setElapsedTime(sessionLimitSeconds);
    }

    stopRecording("Time limit reached");

    const minutes = Math.floor(sessionLimitSeconds / 60);
    alert(`You've reached your ${subscriptionTier} plan limit (${minutes} minute${minutes === 1 ? "" : "s"}). Recording has been stopped.`);
    if (subscriptionTier === "free") {
      window.location.href = "/pricing";
    }
  };

  useEffect(() => {
    if (!sessionToken) return;

    const ws = new WebSocket(`${WS_BASE_URL}/ws/transcribe?token=${sessionToken}`);

    ws.onopen = () => {
      addLog("WebSocket Connected", "info");
      setStatus("Connected");

      // Re-configure if we have an active recording ID (e.g. after reconnect)
      if (recordingIdRef.current) {
        ws.send(JSON.stringify({
          type: "configure",
          recording_id: recordingIdRef.current
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data?.type === "limit_reached") {
          handleLimitReached("server");
          return;
        }

        const { transcript: text, is_final, confidence } = data;

        if (text && !text.startsWith("[Error")) {
          if (is_final) {
            // Final result - add to transcript history
            setTranscript((prev) => [...prev, text]);
            setInterimText("");
            addLog(`✓ Final: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`, "receive");

            // Save with timestamp for audio-text sync
            const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000;
            const segmentDuration = text.split(' ').length * 0.5; // Approximate duration based on word count
            const transcriptSegment: TranscriptSegment = {
              text,
              start_time: Math.max(0, currentTime - segmentDuration),
              end_time: currentTime,
              confidence
            };

            setTranscriptWithTimestamps(prev => [...prev, transcriptSegment]);
            transcriptsForSaveRef.current.push(transcriptSegment);

            // Calculate latency and update metrics
            const now = Date.now();
            const latency = now - lastChunkTimeRef.current;
            setMetrics(prev => {
              const newTranscripts = prev.transcriptsReceived + 1;
              latenciesRef.current.push(latency);
              if (latenciesRef.current.length > 50) latenciesRef.current.shift();
              const avgLatency = latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length;

              return {
                ...prev,
                transcriptsReceived: newTranscripts,
                lastLatencyMs: latency,
                avgLatencyMs: Math.round(avgLatency),
              };
            });
          } else {
            // Interim result - update temporary display
            setInterimText(text);
          }

          setWaitingForResponse(false);
        }
      } catch (e) {
        // Fallback for non-JSON messages
        const text = event.data;
        if (text && !text.startsWith("[Error")) {
          setTranscript((prev) => [...prev, text]);
          addLog(`Rx: ${text.substring(0, 30)}`, "receive");
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("WS Error");
      addLog("WebSocket Error!", "error");
    };

    ws.onclose = (event) => {
      addLog(`WebSocket Closed (Code: ${event.code})`, "info");
      if (event.code === 4002) {
        handleLimitReached("server-close");
        return;
      }
      setStatus("Disconnected");
    };

    socketRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [sessionToken, sessionLimitSeconds, subscriptionTier]);

  const visualize = () => {
    if (!analyserRef.current || statusRef.current !== "Recording") return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const average = sum / bufferLength / 255;
    setVolume(average);

    animationFrameRef.current = requestAnimationFrame(visualize);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser");
      }

      const audioContext = new AudioContextClass({
        sampleRate: 16000
      });
      await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(analyser);
      source.connect(processor);
      processor.connect(audioContext.destination);

      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      processorRef.current = processor;

      // Reset state for new recording
      limitReachedRef.current = false;
      setAudioChunks([]);
      setTranscriptWithTimestamps([]);
      transcriptsForSaveRef.current = [];
      // Generate new recording ID immediately
      const newRecordingId = crypto.randomUUID();
      setSavedRecordingId(newRecordingId);
      recordingIdRef.current = newRecordingId;
      setIsSaved(false); // Reset saved state

      setShareToken(null);
      setShareUrl(null);

      // Setup MediaRecorder for saving valid audio file
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("Audio chunk received:", event.data.size);
          setAudioChunks((prev) => [...prev, event.data]);
        }
      };

      // Request data every 1 second to ensure we capture chunks even if stop() doesn't fire ondataavailable immediately
      mediaRecorder.start(1000);
      recordingStartTimeRef.current = performance.now();

      // Configure WebSocket with recording ID for live sharing
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "configure",
          recording_id: newRecordingId
        }));
        addLog(`Configured backend with ID: ${newRecordingId}`, "info");
      } else {
        addLog("WebSocket not ready for configuration", "error");
      }

      processor.onaudioprocess = (e) => {
        if (statusRef.current !== "Recording") return;

        const inputData = e.inputBuffer.getChannelData(0);

        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const average = sum / inputData.length;

        if (average > SILENCE_THRESHOLD) {
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(int16Data.buffer);
            lastChunkTimeRef.current = Date.now();
            setWaitingForResponse(true);

            setMetrics(prev => ({
              ...prev,
              chunksSent: prev.chunksSent + 1,
            }));
          }
        }
      };

      setIsRecording(true);
      setStatus("Recording...");
      statusRef.current = "Recording";
      addLog("Recording Started", "info");

      // Start timer
      setElapsedTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const next = prev + 1;
          if (sessionLimitSeconds && next >= sessionLimitSeconds) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            handleLimitReached("timer");
            return sessionLimitSeconds;
          }
          return next;
        });
      }, 1000);

      setMetrics({
        chunksSent: 0,
        transcriptsReceived: 0,
        lastLatencyMs: 0,
        avgLatencyMs: 0,
      });
      latenciesRef.current = [];

      visualize();

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setStatus("Mic Access Denied");
      addLog("Microphone Error", "error");
    }
  };

  const stopRecording = (reason?: string) => {
    statusRef.current = "Stopped";
    setIsRecording(false);
    setStatus(reason || "Stopped");
    setVolume(0);
    setWaitingForResponse(false);
    setInterimText("");

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "stop_recording" }));
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
    }

    if (audioContextRef.current) audioContextRef.current.close();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    addLog(reason ? `Recording Stopped (${reason})` : "Recording Stopped", "info");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (transcriptsForSaveRef.current.length > 0 || audioChunks.length > 0) {
      setRecordingTitle(`Recording ${new Date().toLocaleString()}`);
      setShowSaveModal(true);
    }
  };

  const handleSaveRecording = async () => {
    if (!sessionToken || audioChunks.length === 0) {
      alert("No audio data to save");
      return;
    }

    setIsSaving(true);

    try {
      // Pick the active recording ID (ensure consistent with live-share/placeholder)
      const recordingId = savedRecordingId || recordingIdRef.current || crypto.randomUUID();
      recordingIdRef.current = recordingId;
      if (!savedRecordingId) {
        setSavedRecordingId(recordingId);
      }

      // Create WebM blob from audio chunks (MediaRecorder output)
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      // Calculate duration
      let duration = Math.floor((performance.now() - recordingStartTimeRef.current) / 1000);
      if (duration < 1) duration = 1;

      // Prepare form data
      const formData = new FormData();
      formData.append("id", recordingId);
      formData.append("title", recordingTitle || `Recording ${new Date().toLocaleString()}`);
      formData.append("duration_seconds", duration.toString());
      formData.append("audio_file", audioBlob, "recording.webm");
      formData.append("transcripts", JSON.stringify(transcriptsForSaveRef.current));
      formData.append("token", sessionToken);

      console.log("Saving recording:", {
        id: recordingId,
        title: recordingTitle,
        duration,
        audioSize: audioBlob.size,
        transcriptsCount: transcriptsForSaveRef.current.length
      });

      // Upload to backend
      const response = await fetch(`${API_BASE_URL}/api/recordings`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save recording");
      }

      const result = await response.json();
      setSavedRecordingId(result.id);
      setIsSaved(true); // Mark as saved

      // Clear audio chunks to free memory but keep ID for sharing
      setAudioChunks([]);

      // Redirect to recording page
      window.location.href = `/recordings/${result.id}`;

    } catch (error) {
      console.error("Error saving recording:", error);
      alert("Failed to save recording. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateShare = async () => {
    if (!sessionToken) {
      alert("Recording ID missing");
      return;
    }

    setIsSharing(true);

    try {
      const recordingId = recordingIdRef.current || savedRecordingId || crypto.randomUUID();
      const baseTitle = isRecording
        ? `Live Recording ${new Date().toLocaleString()}`
        : (recordingTitle || `Recording ${new Date().toLocaleString()}`);

      if (!savedRecordingId) {
        setSavedRecordingId(recordingId);
      }
      if (!recordingTitle) {
        setRecordingTitle(baseTitle);
      }
      recordingIdRef.current = recordingId;

      // Initialize recording in DB if not saved yet (for live sharing)
      const initFormData = new FormData();
      initFormData.append("id", recordingId);
      initFormData.append("title", baseTitle);
      initFormData.append("token", sessionToken);

      const initResponse = await fetch(`${API_BASE_URL}/api/recordings/init`, {
        method: "POST",
        body: initFormData
      });

      if (!initResponse.ok) {
        throw new Error("Failed to init recording");
      }

      const initResult = await initResponse.json();
      const realRecordingId = initResult.id;

      setSavedRecordingId(realRecordingId);
      recordingIdRef.current = realRecordingId;

      // Re-configure WebSocket with the REAL DB ID
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "configure",
          recording_id: realRecordingId
        }));
      }

      // Create share link
      const response = await fetch(`${API_BASE_URL}/api/shares?token=${sessionToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_id: realRecordingId,
          expires_in_hours: 24
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const result = await response.json();
      const url = `${window.location.origin}/share/${result.share_token}`;
      setShareUrl(url);
      setShareToken(result.share_token);

    } catch (error) {
      console.error("Error creating share:", error);
      alert("Failed to create share link");
    } finally {
      setIsSharing(false);
    }
  };



  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-white rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-gray-100">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Live Transcription</h2>
        <p className={`text-sm font-medium ${status === "Recording..." ? "text-red-500 animate-pulse" : "text-gray-500"}`}>
          {status}
        </p>
        {authError && (
          <div className="flex flex-col items-center mt-2 space-y-2">
            <p className="text-xs text-red-500">{authError}</p>
            <button
              onClick={handleRetry}
              className="flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry Connection
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center py-4">
        <div className={`text-5xl font-mono font-bold tracking-widest ${isRecording ? 'text-red-500' : 'text-gray-700'}`}>
          {formatTime(elapsedTime)}
        </div>
        <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Duration</div>
      </div>

      <div className="relative group">
        <button
          onClick={() => (isRecording ? stopRecording() : startRecording())}
          disabled={status !== "Connected" && status !== "Recording..."}
          className={`p-6 rounded-full transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-offset-2 ${isRecording
            ? "bg-red-500 hover:bg-red-600 focus:ring-red-200 shadow-red-200"
            : status === "Connected"
              ? "bg-black hover:bg-gray-800 focus:ring-gray-200 shadow-gray-200"
              : "bg-gray-300 cursor-not-allowed"
            } shadow-xl`}
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white fill-current" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
        {isRecording && (
          <div className="absolute -inset-1 rounded-full border-2 border-red-500 opacity-50 animate-ping pointer-events-none"></div>
        )}
      </div>

      {/* Live Share Button */}
      {
        isRecording && savedRecordingId && (
          <div className="w-full">
            {!shareUrl ? (
              <button
                onClick={handleCreateShare}
                disabled={isSharing}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                {isSharing ? (
                  <Activity className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4 mr-2" />
                )}
                Share Live Link
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                <span className="text-xs font-semibold text-indigo-800 uppercase px-2">Live Link:</span>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 p-1 text-sm bg-white border border-indigo-200 rounded"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    alert("Copied!");
                  }}
                  className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )
      }

      <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-75"
          style={{ width: `${Math.min(volume * 500, 100)}%` }}
        ></div>
      </div>

      <div className="w-full bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto border border-gray-100 shadow-inner">
        {transcript.length === 0 && !interimText ? (
          <p className="text-gray-400 text-center mt-20">Start speaking to see text...</p>
        ) : (
          <div className="space-y-2">
            {transcript.map((text, index) => (
              <p key={index} className="text-gray-700 leading-relaxed">
                {text}
              </p>
            ))}
            {interimText && (
              <p className="text-gray-700 leading-relaxed">
                {interimText}
              </p>
            )}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* Save Recording Modal */}
      {
        showSaveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Save Recording</h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!isSaved ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recording Title</label>
                    <input
                      type="text"
                      value={recordingTitle}
                      onChange={(e) => setRecordingTitle(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="My Recording"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setShowSaveModal(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSaveRecording}
                      disabled={isSaving}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Activity className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Recording
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                    <Check className="w-5 h-5 mr-2" />
                    Recording saved successfully!
                  </div>

                  <div className="pt-2">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Share this recording</h4>
                    {!shareUrl ? (
                      <button
                        onClick={handleCreateShare}
                        disabled={isSharing}
                        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        {isSharing ? (
                          <Activity className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Share2 className="w-4 h-4 mr-2" />
                        )}
                        Generate Share Link
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={shareUrl}
                          className="flex-1 p-2 text-sm bg-gray-50 border border-gray-300 rounded-lg"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl);
                            alert("Copied to clipboard!");
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setShowSaveModal(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }



      <div className="flex items-center space-x-2 text-xs text-gray-400">
        <Activity className="w-3 h-3" />
        <span>Real-time Transcription</span>
      </div>
    </div >
  );
}
