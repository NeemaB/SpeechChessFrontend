import type { SpeechToTextService, TranscriptHandler } from './speech_to_text_service';

export interface AssemblyAIConfig {
  /** WebSocket relay that forwards PCM to AssemblyAI's realtime endpoint. */
  serverUrl?: string;
  /** Sample rate requested from the browser AudioContext. */
  sampleRate?: number;
  /** ScriptProcessor buffer size; larger = more latency, fewer sends. */
  bufferSize?: number;
}

/**
 * Streams microphone audio as 16-bit little-endian PCM over a WebSocket to
 * a local relay server, which in turn forwards to AssemblyAI's real-time
 * transcription API. Transcripts arrive back over the same socket as JSON
 * objects with a `transcript` string field.
 */
export class AssemblyAISpeechService implements SpeechToTextService {
  private readonly serverUrl: string;
  private readonly sampleRate: number;
  private readonly bufferSize: number;

  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;

  constructor(config: AssemblyAIConfig = {}) {
    this.serverUrl = config.serverUrl ?? 'ws://localhost:3001';
    this.sampleRate = config.sampleRate ?? 16000;
    this.bufferSize = config.bufferSize ?? 4096;
  }

  public isActive(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public async start(onTranscript: TranscriptHandler): Promise<void> {
    if (this.socket !== null) {
      throw new Error('AssemblyAISpeechService is already running; call stop() first.');
    }

    const socket = new WebSocket(this.serverUrl);
    this.socket = socket;

    await this.waitForSocketOpen(socket);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.transcript) {
        onTranscript(data.transcript);
      }
    };

    await this.openAudioPipeline(socket);
  }

  public async stop(): Promise<void> {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    this.socket?.close();
    this.socket = null;
  }

  // ── private ────────────────────────────────────────────────────────────

  private waitForSocketOpen(socket: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => {
        this.socket = null;
        reject(new Error(`Failed to connect to speech relay at ${this.serverUrl}`));
      };
    });
  }

  private async openAudioPipeline(socket: WebSocket): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(this.floatTo16BitPcm(event.inputBuffer.getChannelData(0)));
    };
  }

  /** Convert Float32 samples in [-1, 1] to signed 16-bit PCM. */
  private floatTo16BitPcm(input: Float32Array): ArrayBuffer {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
  }
}
