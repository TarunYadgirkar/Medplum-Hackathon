// Every model ID the app sends lives here. Checked 2026-10-10 against
// developers.openai.com/api/docs/models, Deepgram's
// agent.deepgram.com/v1/agent/settings/think/models and docs.x.ai voice docs.

// OpenAI small tier (successor to gpt-4o-mini). OPENAI_MODEL overrides it server-side.
export const OPENAI_TEXT_MODEL = 'gpt-6-luna';

// Deepgram Voice Agent think stage (open_ai provider). Must appear in
// Deepgram's supported think-model list, which can lag OpenAI's.
export const VOICE_THINK_MODEL = 'gpt-6-luna';

// xAI Grok Voice (backup engine). Pinned rather than `grok-voice-latest`.
export const GROK_VOICE_MODEL = 'grok-voice-think-fast-2.0';
export const GROK_TRANSCRIBE_MODEL = 'grok-transcribe';
