/**
 * Callback invoked each time the backend produces a finalised transcript.
 */
export type TranscriptHandler = (transcript: string) => void;

/**
 * Provider-agnostic contract for a streaming speech-to-text backend.
 * Implementations own the full capture → encode → transport → decode loop
 * and surface only text to the rest of the application.
 */
export interface SpeechToTextService {
  /**
   * Begin capturing microphone audio and streaming it to the backend.
   * Resolves once the pipeline is live; rejects if any stage fails to open.
   */
  start(onTranscript: TranscriptHandler): Promise<void>;

  /**
   * Tear down the audio pipeline and close the backend connection.
   * Safe to call when already stopped.
   */
  stop(): Promise<void>;

  /**
   * True while audio is actively being streamed.
   */
  isActive(): boolean;
}
