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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      console.log(`[Auth Debug] Config: URL=${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'MISSING'}`);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth check timed out (10s)")), 10000)
      );

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
  const [isSaved, setIsSaved] = useState(false);
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

  // Scroll ref
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, interimText]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const SILENCE_THRESHOLD = 0.001;

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
            setTranscript((prev) => [...prev, text]);
            setInterimText("");
            addLog(`✓ Final: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`, "receive");

            const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000;
            const segmentDuration = text.split(' ').length * 0.5;
            const transcriptSegment: TranscriptSegment = {
              text,
              start_time: Math.max(0, currentTime - segmentDuration),
              end_time: currentTime,
              confidence
            };

            setTranscriptWithTimestamps(prev => [...prev, transcriptSegment]);
            transcriptsForSaveRef.current.push(transcriptSegment);

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
            setInterimText(text);
          }

          setWaitingForResponse(false);
        }
      } catch (e) {
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

      limitReachedRef.current = false;
      setAudioChunks([]);
      setTranscriptWithTimestamps([]);
      transcriptsForSaveRef.current = [];
      const newRecordingId = crypto.randomUUID();
      setSavedRecordingId(newRecordingId);
      recordingIdRef.current = newRecordingId;
      setIsSaved(false);

      setShareToken(null);
      setShareUrl(null);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("Audio chunk received:", event.data.size);
          setAudioChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorder.start(1000);
      recordingStartTimeRef.current = performance.now();

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
      const recordingId = savedRecordingId || recordingIdRef.current || crypto.randomUUID();
      recordingIdRef.current = recordingId;
      if (!savedRecordingId) {
        setSavedRecordingId(recordingId);
      }

      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      let duration = Math.floor((performance.now() - recordingStartTimeRef.current) / 1000);
      if (duration < 1) duration = 1;

      const formData = new FormData();
      formData.append("id", recordingId);
      formData.append("title", recordingTitle || `Recording ${new Date().toLocaleString()}`);
      formData.append("duration_seconds", duration.toString());
      formData.append("audio_file", audioBlob, "recording.webm");
      formData.append("transcripts", JSON.stringify(transcriptsForSaveRef.current));
      formData.append("token", sessionToken);

      const response = await fetch(`${API_BASE_URL}/api/recordings`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save recording");
      }

      const result = await response.json();
      setSavedRecordingId(result.id);
      setIsSaved(true);

      setAudioChunks([]);

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

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "configure",
          recording_id: realRecordingId
        }));
      }

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
    <div className="flex flex-col items-center justify-center min-h-[85vh] w-full max-w-4xl mx-auto px-4 pt-20">

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#181A20] rounded-2xl border border-white/10 p-8 w-full max-w-md shadow-2xl glow-box">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white tracking-tight">Save Recording</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isSaved ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#BFC2CF] mb-2">Title</label>
                  <input
                    type="text"
                    value={recordingTitle}
                    onChange={(e) => setRecordingTitle(e.target.value)}
                    className="w-full bg-[#0E0E12] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#A86CFF] focus:ring-1 focus:ring-[#A86CFF] transition-all"
                    placeholder="My Recording"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2 text-[#BFC2CF] hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSaveRecording}
                    disabled={isSaving}
                    className="flex items-center px-6 py-2 bg-gradient-to-r from-[#A86CFF] to-[#FF6F61] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium shadow-lg shadow-[#A86CFF]/20"
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
                <div className="w-16 h-16 bg-[#A86CFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-[#A86CFF]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Saved Successfully!</h3>
                <p className="text-[#BFC2CF] mb-6">Your recording is ready.</p>
                <button
                  onClick={() => window.location.href = `/recordings/${savedRecordingId}`}
                  className="px-6 py-2 bg-[#A86CFF] text-white rounded-lg hover:bg-[#9755f5] transition-colors"
                >
                  View Recording
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Core Card */}
      <div className="glass-card rounded-[28px] p-8 w-full relative overflow-hidden flex flex-col items-center">

        {/* Subtle radial highlight background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-b from-[#A86CFF]/5 to-transparent pointer-events-none" />

        {/* Top Section: Breadcrumb & Timestamp */}
        <div className="w-full flex flex-col items-center mb-10 z-10 transition-all duration-500">
          {/* Breadcrumb / Status */}
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-[#FF6F61] animate-pulse shadow-[0_0_8px_#FF6F61]' : 'bg-[#BFC2CF]/30'}`} />
            <span className="text-sm uppercase tracking-widest text-[#BFC2CF] font-medium">
              {isRecording ? 'Live Recording' : 'Ready to Record'}
            </span>
          </div>

          {/* Large Timer */}
          <div className={`text-6xl md:text-7xl font-bold font-mono tracking-wider tabular-nums transition-all duration-300 ${isRecording ? 'text-gradient scale-105 glow-text' : 'text-white/20'}`}>
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Center: Record Button */}
        <div className="relative z-10 mb-12 group">
          <button
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            disabled={status !== "Connected" && status !== "Recording..."}
            className={`relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-500 transform hover:scale-105 focus:outline-none 
                    ${isRecording
                ? 'shadow-[0_0_40px_rgba(255,111,97,0.4)]'
                : 'shadow-[0_0_40px_rgba(168,108,255,0.2)] hover:shadow-[0_0_60px_rgba(168,108,255,0.4)]'
              }`
            }
          >
            {/* Gradient Ring Background */}
            <div className={`absolute inset-0 rounded-full bg-gradient-to-br transition-all duration-500
                    ${isRecording ? 'from-[#FF6F61] to-[#FFB55A] animate-pulse-slow' : 'from-[#181A20] to-[#252830] border border-white/10 group-hover:border-[#A86CFF]/50'}`}
            />

            {/* Icon */}
            <div className="relative z-10">
              {isRecording ? (
                <Square className="w-10 h-10 text-white fill-current animate-float" />
              ) : (
                <Mic className={`w-10 h-10 transition-colors duration-300 ${status === "Connected" ? 'text-white' : 'text-gray-500'}`} />
              )}
            </div>

            {/* Outer Glow Ring on Hover */}
            {!isRecording && (
              <div className="absolute -inset-1 rounded-full border border-[#A86CFF]/30 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
            )}
          </button>
          <div className="mt-4 text-center h-6">
            <p className="text-xs text-[#666]">{status}</p>
            {authError &&
              <button onClick={handleRetry} className="text-xs text-[#FF6F61] flex items-center justify-center mt-1 mx-auto hover:underline">
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </button>
            }
          </div>
        </div>

        {/* Share Link (Conditional) */}
        {isRecording && (
          <div className="mb-8 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            {!shareUrl ? (
              <button
                onClick={handleCreateShare}
                className="w-full py-3 rounded-full border border-[#A86CFF]/30 bg-[#A86CFF]/5 text-[#A86CFF] text-sm font-medium hover:bg-[#A86CFF]/10 transition-colors flex items-center justify-center"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Create Live Public Link
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-[#181A20]/80 border border-[#A86CFF]/30 rounded-full p-1 pl-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#A86CFF]/5 to-transparent pointer-events-none" />
                <span className="text-xs text-[#BFC2CF] truncate flex-1">{shareUrl}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl || "");
                    alert("Copied to clipboard!");
                  }}
                  className="bg-[#A86CFF] p-2 rounded-full text-white hover:bg-[#9755f5] transition-colors z-10"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Transcription Block */}
        <div className="w-full max-w-2xl bg-[#111218]/50 border border-white/5 rounded-2xl p-6 h-[250px] md:h-[300px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 transition-colors shadow-inner">
          {transcript.length === 0 && !interimText ? (
            <div className="h-full flex flex-col items-center justify-center text-[#BFC2CF]/30 space-y-3">
              <Activity className="w-8 h-8 opacity-20" />
              <p className="text-sm">Transcripts will appear here...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transcript.map((text, i) => (
                <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-[#E0E0E0] text-lg leading-relaxed">{text}</p>
                </div>
              ))}
              {interimText && (
                <div className="animate-pulse">
                  <p className="text-[#A86CFF] text-lg leading-relaxed italic opacity-80">{interimText}</p>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

      </div>
    </div>
            
            {/* Live Transcript Overlay */ }
  <div className="mt-8 w-full max-w-2xl h-48 overflow-y-auto no-scrollbar scroll-smooth relative mask-image-b">
    <style jsx global>{`
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .no-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}</style>
    <div ref={transcriptEndRef} className="space-y-2 pb-10">
      {transcript.map((text, i) => (
        <p key={i} className="text-lg text-white/80 leading-snug animate-in fade-in slide-in-from-bottom-2">
          {text}
        </p>
      ))}
      {interimText && (
        <p className="text-lg text-[#A86CFF] italic leading-snug animate-pulse">
          {interimText}
        </p>
      )}
      <div ref={transcriptEndRef} />
    </div>
  </div>

      </div >
    </div >
  );
}
