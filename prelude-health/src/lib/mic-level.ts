// Shared microphone level source — one getUserMedia stream + analyser for
// every sound-reactive element (voice orb, visualizer bars). Consumers call
// ensureMic() once, then readLevel() per animation frame; null = mic not
// available (caller falls back to its simulated/CSS animation).

let ac: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let buf: Uint8Array<ArrayBuffer> | null = null;
let stream: MediaStream | null = null;
let starting: Promise<boolean> | null = null;

export function micActive(): boolean {
  return analyser != null;
}

export function ensureMic(): Promise<boolean> {
  if (analyser) return Promise.resolve(true);
  if (starting) return starting;
  starting = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      if (ac.state === 'suspended') await ac.resume();
      const an = ac.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.4;
      ac.createMediaStreamSource(stream).connect(an);
      buf = new Uint8Array(new ArrayBuffer(an.fftSize));
      analyser = an;
      return true;
    } catch {
      starting = null; // allow retry on next user gesture
      return false;
    }
  })();
  return starting;
}

/** Instantaneous mic level 0.05–1, or null when the mic is unavailable. */
export function readLevel(): number | null {
  if (!analyser || !buf) return null;
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const d = (buf[i] - 128) / 128;
    sum += d * d;
  }
  const rms = Math.sqrt(sum / buf.length);
  return Math.max(0.05, Math.min(1, Math.pow(rms * 8, 0.8)));
}
