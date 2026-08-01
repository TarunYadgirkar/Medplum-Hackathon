// PCM16 <-> Float32 conversion and mic capture/playback helpers for Grok Voice.

export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export function pcm16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToPCM16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export interface AudioCapture {
  stream: MediaStream;
  audioContext: AudioContext;
  processor: ScriptProcessorNode;
  stop: () => void;
}

// Captures mic audio as PCM16 and forwards base64 chunks via onChunk.
export async function startAudioCapture(
  onChunk: (base64: string) => void
): Promise<AudioCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext({ sampleRate: 24000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  // ScriptProcessorNode requires a destination connection to fire onaudioprocess
  // in most browsers. A GainNode at 0 sinks the output to silence so raw mic
  // audio never reaches the speakers (preventing feedback).
  // TODO: migrate to AudioWorkletNode when browser support is sufficient.
  const zeroGain = audioContext.createGain();
  zeroGain.gain.value = 0;

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(inputData);
    onChunk(pcm16ToBase64(pcm16));
  };

  source.connect(processor);
  processor.connect(zeroGain);
  zeroGain.connect(audioContext.destination);

  return {
    stream,
    audioContext,
    processor,
    stop: () => {
      processor.disconnect();
      zeroGain.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close();
    },
  };
}

// Plays a queue of PCM16 audio chunks (24kHz mono) through an AudioContext.
export class AudioPlaybackQueue {
  private context: AudioContext;
  private nextStartTime = 0;
  private sources: AudioBufferSourceNode[] = [];

  constructor() {
    this.context = new AudioContext({ sampleRate: 24000 });
  }

  enqueue(base64Chunk: string) {
    const pcm16 = base64ToPCM16(base64Chunk);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x8000;
    }

    const buffer = this.context.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const startTime = Math.max(this.context.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    this.sources.push(source);
    source.onended = () => {
      const idx = this.sources.indexOf(source);
      if (idx !== -1) this.sources.splice(idx, 1);
    };
  }

  // Stops all queued/playing audio immediately — used on user interruption.
  clear() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources = [];
    this.nextStartTime = this.context.currentTime;
  }

  close() {
    this.context.close();
  }
}
