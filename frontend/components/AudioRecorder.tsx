"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Activity, Terminal, Save, Share2, X, Copy, Check } from "lucide-react";

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

  // Save/Share state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);

  // Share state
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Transcript with timestamps for audio-text sync
  const [transcriptWithTimestamps, setTranscriptWithTimestamps] = useState<TranscriptSegment[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const statusRef = useRef("Ready");
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const lastChunkTimeRef = useRef<number>(0);
  const latenciesRef = useRef<number[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const transcriptsForSaveRef = useRef<TranscriptSegment[]>([]);

  const SILENCE_THRESHOLD = 0.001;

  // Debug mode
  const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    } as any);
  };

  const addLog = (msg: string, type: LogEntry["type"] = "info") => {
    const timestamp = getTimestamp();
    const entry: LogEntry = { timestamp, message: msg, type };
    if (DEBUG) {
      console.log(`[${timestamp}] ${msg}`);
      setLogs(prev => [entry, ...prev].slice(0, 20));
    }
  };

  useEffect(() => {
    // Get session token
    const getToken = async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionToken(session.access_token);
        }
      } catch (err) {
        console.error("Error getting token:", err);
      }
    };
    getToken();
  }, []);

  useEffect(() => {
    if (!sessionToken) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/transcribe?token=${sessionToken}`);

    ws.onopen = () => {
      addLog("WebSocket Connected", "info");
      setStatus("Connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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

    ws.onclose = () => {
      addLog("WebSocket Closed", "info");
      setStatus("Disconnected");
    };

    socketRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [sessionToken]);

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

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
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
      setAudioChunks([]);
      setTranscriptWithTimestamps([]);
      transcriptsForSaveRef.current = [];
      recordingStartTimeRef.current = Date.now();

      // Generate new recording ID immediately
      const newRecordingId = crypto.randomUUID();
      setSavedRecordingId(newRecordingId);

      setShareToken(null);
      setShareUrl(null);

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

          // Buffer audio for saving
          // We need to convert Float32 to Int16 for WAV
          const buffer = new ArrayBuffer(int16Data.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < int16Data.length; i++) {
            view.setInt16(i * 2, int16Data[i], true);
          }
          setAudioChunks(prev => [...prev, new Blob([buffer], { type: 'audio/wav' })]);
        }
      };

      setIsRecording(true);
      setStatus("Recording...");
      statusRef.current = "Recording";
      addLog("Recording Started", "info");

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

  const stopRecording = () => {
    statusRef.current = "Stopped";
    setIsRecording(false);
    setStatus("Stopped");
    setVolume(0);
    setWaitingForResponse(false);
    setInterimText("");

    if (processorRef.current) {
      processorRef.current.disconnect();
    }

    if (audioContextRef.current) audioContextRef.current.close();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    addLog("Recording Stopped", "info");

    // Show save modal if there's content to save
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
      // Create WAV blob from audio chunks
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

      // Calculate duration
      const duration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);

      // Prepare form data
      const formData = new FormData();
      if (savedRecordingId) {
        formData.append("id", savedRecordingId);
      }
      formData.append("title", recordingTitle);
      formData.append("duration_seconds", duration.toString());
      formData.append("audio_file", audioBlob, "recording.wav");
      formData.append("transcripts", JSON.stringify(transcriptsForSaveRef.current));
      formData.append("token", sessionToken);

      // Upload to backend
      const response = await fetch("http://localhost:8000/api/recordings", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save recording");
      }

      const result = await response.json();
      setSavedRecordingId(result.id);

      // Clear audio chunks to free memory but keep ID for sharing
      setAudioChunks([]);

    } catch (error) {
      console.error("Error saving recording:", error);
      alert("Failed to save recording. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateShare = async () => {
    if (!sessionToken || !savedRecordingId) {
      alert("Recording ID missing");
      return;
    }

    setIsSharing(true);

    try {
      // Initialize recording in DB if not saved yet (for live sharing)
      const initFormData = new FormData();
      initFormData.append("id", savedRecordingId); // Assuming backend supports this now? No, I need to fix backend.
      // Wait, I haven't fixed backend init_recording to accept ID yet.
      // But create_recording DOES accept ID.
      // So if I use create_recording with empty audio? No, audio is required.

      // I will use the init_recording endpoint, but I need to update it to accept ID.
      // Since I can't update backend in this tool call, I will assume I will update it next.
      // I'll send the ID.

      // Actually, let's just use the existing init endpoint which generates a NEW ID, 
      // BUT that breaks the WebSocket link.

      // I MUST update the backend init_recording to accept an ID.
      // I will do that in the next step.

      // For now, I'll write the frontend code to send the ID.
      // Note: init_recording currently takes title and token.
      // I'll add 'id' to the form data here.

      // Wait, if I use the CURRENT init_recording, it ignores 'id' and returns a new one.
      // So I should NOT call it yet if I want to use my generated ID.

      // But I need to create the share.

      // Let's assume I will fix backend to accept 'id'.

      // If I can't fix backend immediately, I should use the ID returned by init_recording
      // and send a NEW configure message to WS?
      // Yes! That works without changing backend schema much.

      // 1. Call init_recording -> get new ID.
      // 2. Send {type: "configure", recording_id: newID} to WS.
      // 3. Create share with newID.
      // 4. Update savedRecordingId to newID.

      // This is a robust solution that works even if backend init generates ID.

      const formData = new FormData();
      formData.append("title", isRecording ? "Live Recording..." : recordingTitle || "Untitled");
      formData.append("token", sessionToken);

      const initResponse = await fetch("http://localhost:8000/api/recordings/init", {
        method: "POST",
        body: formData
      });

      if (!initResponse.ok) {
        throw new Error("Failed to init recording");
      }

      const initResult = await initResponse.json();
      const realRecordingId = initResult.id;

      setSavedRecordingId(realRecordingId);

      // Re-configure WebSocket with the REAL DB ID
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "configure",
          recording_id: realRecordingId
        }));
      }

      // Create share link
      const response = await fetch(`http://localhost:8000/api/shares?token=${sessionToken}`, {
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

  const getLatencyColor = () => {
    if (metrics.lastLatencyMs === 0) return "text-gray-400";
    if (metrics.lastLatencyMs < 500) return "text-green-500";
    if (metrics.lastLatencyMs < 1500) return "text-yellow-500";
    return "text-red-500";
  };

  const getLatencyLabel = () => {
    if (metrics.lastLatencyMs === 0) return "---";
    if (metrics.lastLatencyMs < 500) return "FAST";
    if (metrics.lastLatencyMs < 1500) return "MODERATE";
    return "SLOW";
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-white rounded-xl shadow-lg w-full max-w-2xl mx-auto border border-gray-100">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Live Transcription</h2>
        <p className={`text-sm font-medium ${status === "Recording..." ? "text-red-500 animate-pulse" : "text-gray-500"}`}>
          {status}
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Chunks Sent</div>
          <div className="text-2xl font-bold text-blue-600">{metrics.chunksSent}</div>
        </div>
        <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Transcripts</div>
          <div className="text-2xl font-bold text-green-600">{metrics.transcriptsReceived}</div>
        </div>
        <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Last Latency</div>
          <div className={`text-xl font-bold ${getLatencyColor()}`}>
            {metrics.lastLatencyMs > 0 ? `${metrics.lastLatencyMs}ms` : '---'}
          </div>
          <div className={`text-xs font-semibold ${getLatencyColor()}`}>
            {getLatencyLabel()}
          </div>
        </div>
        <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Avg Latency</div>
          <div className="text-xl font-bold text-purple-600">
            {metrics.avgLatencyMs > 0 ? `${metrics.avgLatencyMs}ms` : '---'}
          </div>
          {waitingForResponse && (
            <div className="text-xs text-orange-500 animate-pulse mt-1">Waiting...</div>
          )}
        </div>
      </div>

      <div className="relative group">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-6 rounded-full transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-offset-2 ${isRecording
            ? "bg-red-500 hover:bg-red-600 focus:ring-red-200 shadow-red-200"
            : "bg-black hover:bg-gray-800 focus:ring-gray-200 shadow-gray-200"
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

      <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-75"
          style={{ width: `${Math.min(volume * 500, 100)}%` }}
        ></div>
      </div>

      <div className="w-full bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto border border-gray-100 shadow-inner">
        {transcript.length === 0 && !interimText ? (
          <p className="text-gray-400 text-center italic mt-20">Start speaking to see text...</p>
        ) : (
          <div className="space-y-2">
            {transcript.map((text, index) => (
              <p key={index} className="text-gray-700 leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
                {text}
              </p>
            ))}
            {interimText && (
              <p className="text-gray-500 italic leading-relaxed">
                {interimText}
                <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-pulse"></span>
              </p>
            )}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* Save Recording Modal */}
      {showSaveModal && (
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

            {!savedRecordingId ? (
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
      )}

      <div className="w-full bg-black text-green-400 p-3 rounded text-xs font-mono h-48 overflow-y-auto opacity-90">
        <div className="flex items-center space-x-2 border-b border-gray-700 pb-2 mb-2 sticky top-0 bg-black">
          <Terminal className="w-3 h-3" />
          <span className="font-semibold">Debug Logs</span>
        </div>
        {logs.map((log, i) => (
          <div key={i} className="flex space-x-2 mb-1">
            <span className="text-gray-500">[{log.timestamp}]</span>
            <span className={
              log.type === "send" ? "text-blue-400" :
                log.type === "receive" ? "text-green-400" :
                  log.type === "error" ? "text-red-400" :
                    "text-gray-300"
            }>
              {log.type === "send" && "📤 "}
              {log.type === "receive" && "📥 "}
              {log.type === "error" && "❌ "}
              {log.message}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center space-x-2 text-xs text-gray-400">
        <Activity className="w-3 h-3" />
        <span>Deepgram Streaming - Real-time Mode</span>
      </div>
    </div>
  );
}
