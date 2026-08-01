'use client';
// Deepgram Voice Agent hook — adapted from carepath's useVoiceConversation
// (which drove Grok Voice) to Deepgram's Agent WebSocket protocol.
// Mic PCM16 @16k goes up as binary frames; agent PCM16 @24k comes back as
// binary frames; JSON control messages ride the same socket.

import { useCallback, useRef, useState } from 'react';
import { AGENT_WS_URL, buildAgentSettings } from '@/lib/agent-config';
import { floatTo16BitPCM } from '@/lib/audio';
import { buildEpicContext } from '@/lib/epic-import';
import { buildMedCardContext, getMedCard } from '@/lib/medcard';
import type { CoverageSummary, TranscriptUtterance } from '@/types';

export type VoiceAgentState = 'idle' | 'connecting' | 'active' | 'agent_speaking' | 'ended' | 'error';

interface StartArgs {
  patientId: string;
  patientName: string;
  appointmentType: string;
}

export function useVoiceAgent() {
  const [state, setState] = useState<VoiceAgentState>('idle');
  const [transcript, setTranscript] = useState<TranscriptUtterance[]>([]);
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const playingSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptRef = useRef<TranscriptUtterance[]>([]);
  const patientIdRef = useRef<string>('');

  const pushTranscript = useCallback((u: TranscriptUtterance) => {
    transcriptRef.current = [...transcriptRef.current, u];
    setTranscript(transcriptRef.current);
  }, []);

  const playChunk = useCallback((buf: ArrayBuffer) => {
    if (!playCtxRef.current) {
      playCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = 0;
    }
    const ctx = playCtxRef.current;
    const pcm16 = new Int16Array(buf);
    if (pcm16.length === 0) return;
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
    playingSourcesRef.current.push(source);
    source.onended = () => {
      playingSourcesRef.current = playingSourcesRef.current.filter((s) => s !== source);
    };
  }, []);

  const stopPlayback = useCallback(() => {
    for (const s of playingSourcesRef.current) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    playingSourcesRef.current = [];
    if (playCtxRef.current) nextPlayTimeRef.current = playCtxRef.current.currentTime;
  }, []);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const handleFunctionCall = useCallback(async (msg: any, ws: WebSocket) => {
    const calls: any[] = Array.isArray(msg.functions) ? msg.functions : [msg];
    for (const call of calls) {
      if (call.client_side === false) continue; // server-side calls are not ours to answer
      const name = call.name || call.function_name;
      const id = call.id || call.function_call_id;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments || {};
      } catch { /* keep empty */ }

      let content = 'Function not available.';
      try {
        if (name === 'check_insurance_coverage') {
          const res = await fetch('/api/eligibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ careLevel: parsedArgs.care_level || 'primary_care' }),
          });
          const data: CoverageSummary = await res.json();
          setCoverage(data);
          content = data.spoken_summary;
        } else if (name === 'lookup_patient_history') {
          const res = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId: patientIdRef.current, query: parsedArgs.query || '' }),
          });
          const data = await res.json();
          content = data.results?.length
            ? `Relevant history found:\n${data.results.map((r: { text: string }) => `- ${r.text}`).join('\n')}`
            : 'No relevant history found.';
        }
      } catch (err) {
        console.error('Function call failed:', err);
        content = 'The lookup failed — continue the conversation without it.';
      }
      ws.send(JSON.stringify({ type: 'FunctionCallResponse', id, name, content }));
    }
  }, []);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const stop = useCallback((finalState: VoiceAgentState = 'ended') => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micCtxRef.current?.close().catch(() => undefined);
    micCtxRef.current = null;
    stopPlayback();
    playCtxRef.current?.close().catch(() => undefined);
    playCtxRef.current = null;
    setState(finalState);
    return transcriptRef.current;
  }, [stopPlayback]);

  const start = useCallback(async (args: StartArgs) => {
    setState('connecting');
    setError(null);
    transcriptRef.current = [];
    setTranscript([]);
    patientIdRef.current = args.patientId;

    let token: string;
    let scheme = 'bearer';
    try {
      const res = await fetch('/api/voice-token', { method: 'POST' });
      if (!res.ok) throw new Error(`token ${res.status}`);
      const data = await res.json();
      token = data.access_token;
      scheme = data.scheme || 'bearer'; // 'bearer' for JWT, 'token' for raw key
    } catch {
      setError('Could not get a Deepgram token. Is DEEPGRAM_API_KEY set?');
      setState('error');
      return;
    }

    // Browser WebSocket auth via Sec-WebSocket-Protocol: ['bearer', <jwt>] or ['token', <key>]
    const ws = new WebSocket(AGENT_WS_URL, [scheme, token]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    const chartContext = [buildEpicContext(), buildMedCardContext(getMedCard())].filter(Boolean).join('\n') || null;

    ws.onopen = async () => {
      ws.send(JSON.stringify(buildAgentSettings({ ...args, chartContext })));
      // KeepAlive prevents the agent socket from idling out during pauses.
      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }, 8000);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
        micStreamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: 16000 });
        micCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const zeroGain = ctx.createGain();
        zeroGain.gain.value = 0;
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(floatTo16BitPCM(e.inputBuffer.getChannelData(0)).buffer);
          }
        };
        source.connect(processor);
        processor.connect(zeroGain);
        zeroGain.connect(ctx.destination);
        setState('active');
      } catch {
        setError('Microphone access denied. Allow the mic and try again.');
        stop('error');
      }
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        playChunk(event.data);
        return;
      }
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'ConversationText':
            pushTranscript({ role: msg.role === 'assistant' ? 'agent' : 'user', content: msg.content });
            break;
          case 'UserStartedSpeaking':
            stopPlayback(); // barge-in
            setState('active');
            break;
          case 'AgentStartedSpeaking':
            setState('agent_speaking');
            break;
          case 'AgentAudioDone':
            setState('active');
            break;
          case 'FunctionCallRequest':
            void handleFunctionCall(msg, ws);
            break;
          case 'Error':
            console.error('Agent error:', msg);
            setError(msg.description || msg.message || 'Voice agent error');
            break;
        }
      } catch { /* non-JSON text frame — ignore */ }
    };

    ws.onerror = () => {
      setError('Voice connection failed.');
      setState('error');
    };
    ws.onclose = () => {
      if (transcriptRef.current.length > 0) setState((s) => (s === 'error' ? s : 'ended'));
    };
  }, [handleFunctionCall, playChunk, pushTranscript, stop, stopPlayback]);

  return { state, transcript, coverage, error, start, stop };
}
