import { OPENAI_TEXT_MODEL } from './models';

type ChatContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export interface JsonChatRequest {
  messages: Array<{ role: 'system' | 'user'; content: ChatContent }>;
  // Reasoning tokens count toward this budget, so it is sized for the answer
  // plus thinking, not the answer alone.
  maxOutputTokens: number;
  effort?: 'none' | 'low' | 'medium';
  timeoutMs?: number;
}

export function requestJsonChat(apiKey: string, req: JsonChatRequest): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(req.timeoutMs ?? 45_000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || OPENAI_TEXT_MODEL,
      reasoning_effort: req.effort ?? 'none',
      max_completion_tokens: req.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: req.messages,
    }),
  });
}
