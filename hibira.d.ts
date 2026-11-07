import type { ChatMessage, Conversation } from './types.js';

export const DEFAULT_HOST: string;
export const CHAT_EVENTS: readonly string[];

export interface ChatClientOptions {
  /** The Hibira app ID. */
  appId: string;
  /** The user token, or a function returning one; called again before it expires and after a 401. */
  token?: string | (() => string | Promise<string>);
  /** Instead of token: a URL on your site that answers { token }. */
  tokenUrl?: string;
  /** The HTTP API host (default api.hibira.io); may include http://. */
  host?: string;
  fetch?: typeof fetch;
}

export interface Attachment {
  id: string;
  name: string;
  content_type: string;
  size: number;
  /** A download link, valid for an hour. */
  url?: string;
}

/** A message of the Hibira Chat API. */
export interface ChatApiMessage extends ChatMessage {
  id: string;
  kind?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  /** Each emoji and the members who reacted, in order. */
  reactions?: Record<string, string[]>;
  attachments?: Attachment[];
}

export interface ChatApiConversation {
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
  members: { user_id: string; read_seq: number }[];
  last_seq: number;
  created_at: string;
  updated_at: string;
  /** In conversations(): last_seq minus the user's read_seq. */
  unread?: number;
}

export interface SendInput {
  text?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[] | { id: string }[];
}

export interface Report {
  id: string;
  conversation_id: string;
  seq: number;
  reported_by: string;
  reason: string;
  message: ChatApiMessage;
}

type Opts = { signal?: AbortSignal };

export interface ChatClient {
  /** The token's user (sub), once a token is known. */
  user(): string;
  conversations(options?: { limit?: number; before?: string } & Opts): Promise<{ conversations: ChatApiConversation[]; next: string }>;
  conversation(id: string, options?: Opts): Promise<ChatApiConversation>;
  messages(id: string, options?: { after?: number; last?: number; limit?: number } & Opts): Promise<{ messages: ChatApiMessage[]; last_seq: number }>;
  search(id: string, q: string, options?: { before?: number | string; limit?: number } & Opts): Promise<{ messages: ChatApiMessage[]; next: string }>;
  send(id: string, message: string | SendInput): Promise<{ message: ChatApiMessage; push?: { users: number; error?: string } }>;
  edit(id: string, seq: number, change: string | { text?: string; metadata?: Record<string, unknown> }): Promise<ChatApiMessage>;
  remove(id: string, seq: number): Promise<ChatApiMessage>;
  react(id: string, seq: number, emoji: string, on?: boolean): Promise<ChatApiMessage>;
  report(id: string, seq: number, reason?: string): Promise<Report>;
  read(id: string, seq: number): Promise<{ read_seq: number }>;
  typing(id: string, typing?: boolean): Promise<unknown>;
  /** Uploads a File or Blob (up to 25 MB); send the result in a message's attachments. */
  upload(id: string, file: Blob & { name?: string }, options?: { name?: string }): Promise<Attachment>;
}

export class ChatApiError extends Error {
  status: number;
  constructor(status: number, message?: string);
}

export function createChatClient(options: ChatClientOptions): ChatClient;
export function tokenUser(token: string): string;
export function onChatEvents(pusher: unknown, handler: (event: string, data: any) => void): () => void;

export interface ChatConversationOptions {
  /** A pusher-js instance signed in as the user (pusher.signin()). Without one it polls. */
  pusher?: unknown;
  /** The user ID (default: the token's sub). */
  me?: string;
  pollMs?: number;
  livePollMs?: number;
  /** chat.read, chat.conversation, chat.left and chat.deleted for this conversation. */
  onEvent?: (event: string, data: any) => void;
}

export function chatConversation(client: ChatClient, id: string, options?: ChatConversationOptions): Conversation;
