import type { AgentMetadata, AgentStep } from './types.js';

export const STEPS: readonly string[];
export function cleanSuggestions(list: unknown): string[];
export function agentMetadata(options?: { handoff?: boolean; suggestions?: unknown }): AgentMetadata;

export interface ChatServer {
  message(channel: string, data: { seq: number; from?: string }): Promise<unknown>;
  typing(channel: string, data?: { from?: string; step?: AgentStep }): Promise<unknown>;
  hint(channel: string, event: string, data?: Record<string, unknown>): Promise<unknown>;
  agentTyping(channel: string, options?: { from?: string; step?: AgentStep }): { step(name: AgentStep): void; stop(): void };
}

export function createChatServer(options: { pusher: { trigger(channel: string, event: string, data: unknown): unknown }; typingEvery?: number }): ChatServer;
