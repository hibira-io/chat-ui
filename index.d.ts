import type { Block, ChatLabels, ChatMessage, Conversation, ConversationOptions, InlineNode, LabelOverrides, MarkdownOptions } from './types.js';

export type * from './types.js';

export function parseMarkdown(text: string, options?: MarkdownOptions): Block[];
export function parseInline(text: string, options?: MarkdownOptions): InlineNode[];
export function plainText(text: string): string;
export function safeHref(url: string): string | null;
export function imageSrc(url: string, options?: MarkdownOptions): string | null;

export function createConversation(options: ConversationOptions): Conversation;
export function mergeMessages(list: ChatMessage[], page: ChatMessage[]): ChatMessage[];
export function lastSeq(list: ChatMessage[]): number;
export function isAutomatic(message: ChatMessage | undefined | null): boolean;
export const STEPS: readonly string[];
export const POLL_MS: number;
export const POLL_LIVE_MS: number;
export const TYPING_SHOW_MS: number;

export const LOCALES: Record<'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'th' | 'vi', ChatLabels>;
export function labelsFor(locale?: string, overrides?: LabelOverrides): ChatLabels;
export function format(text: string, vars?: Record<string, string | number>): string;
