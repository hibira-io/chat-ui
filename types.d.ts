/** A chat message as your backend returns it (PROTOCOL.md). */
export interface ChatMessage {
  id?: string;
  /** Position in the conversation, increasing by one per message. */
  seq: number;
  /** Who wrote it: "customer" for the person using the chat, anything else for your side. */
  sender: string;
  name?: string;
  text: string;
  created_at?: string;
  metadata?: AgentMetadata & Record<string, unknown>;
}

/** Marks on an automatic reply. */
export interface AgentMetadata {
  /** Written by your agent. */
  assistant?: boolean;
  /** The agent passed the conversation to a person. */
  handoff?: boolean;
  /** Follow-up questions the customer can send with one tap. */
  suggestions?: string[];
}

export type AgentStep = 'reading' | 'account' | 'searching' | 'writing' | 'checking' | (string & {});

export interface ChatLabels {
  placeholder: string;
  send: string;
  typing: string;
  automatic: string;
  handoff: string;
  suggestions: string;
  copy: string;
  copied: string;
  copyCode: string;
  seen: string;
  empty: string;
  /** {n}: the most characters in one message. */
  tooLong: string;
  steps: Record<string, string>;
}

export type LabelOverrides = Partial<Omit<ChatLabels, 'steps'>> & { steps?: Record<string, string> };

export interface MarkdownOptions {
  /** The page's origin, for same-site links and images (defaults to location.origin in a browser). */
  origin?: string;
  /** Other origins whose images show inline ("*" for any). Others become links. */
  imageOrigins?: string[];
}

export type InlineNode =
  | string
  | { type: 'br' }
  | { type: 'code'; text: string }
  | { type: 'strong' | 'em' | 'del' | 'span'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'imagelink'; href: string; alt: string };

export type Block =
  | { type: 'p' | 'heading'; children: InlineNode[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'quote'; children: Block[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'table'; align: ('left' | 'center' | 'right' | null)[]; head: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'hr' };

export interface ConversationState {
  messages: ChatMessage[];
  loading: boolean;
  error: unknown;
  /** The other side is writing. */
  typing: boolean;
  /** What the agent is doing while it writes. */
  step?: AgentStep;
  /** Anything else load() returned besides messages. */
  extra: Record<string, unknown>;
}

export interface ConversationOptions {
  /** Reads the messages after seq `after` from your backend. */
  load: (after: number, signal: AbortSignal) => Promise<{ messages: ChatMessage[] } & Record<string, unknown>>;
  /** Sends the customer's message; return the stored message (or { message }). */
  send?: (text: string) => Promise<ChatMessage | { message: ChatMessage } | unknown>;
  /** A pusher-js instance pointed at your Hibira app. Without one it polls. */
  pusher?: unknown;
  /** The conversation's channel, e.g. "private-chat.c_123". */
  channel?: string;
  /** The sender value of the person using this page (default "customer"). */
  me?: string;
  pollMs?: number;
  livePollMs?: number;
  /** Hints other than message and typing. */
  onEvent?: (event: string, data: Record<string, unknown>) => void;
}

export interface Conversation {
  get(): ConversationState;
  subscribe(fn: (state: ConversationState) => void): () => void;
  /** Subscribes and starts reading; returns stop. */
  start(): () => void;
  stop(): void;
  refresh(): Promise<void>;
  added(message: ChatMessage): void;
  send(text: string): Promise<unknown>;
  hint(event: string, data?: Record<string, unknown>): void;
}
