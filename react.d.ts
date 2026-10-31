import type { ReactElement, ReactNode } from 'react';
import type { AgentStep, ChatLabels, ChatMessage, Conversation, ConversationState, LabelOverrides } from './types.js';

export type * from './types.js';
export { createConversation } from './index.js';

export interface ChatThreadProps {
  messages: ChatMessage[];
  typing?: boolean;
  step?: AgentStep;
  /** Sends a message; reject with an Error to show its message. Without it there is no reply box. */
  onSend?: (text: string) => Promise<unknown>;
  /** The sender value of the person using this page (default "customer"). */
  me?: string;
  /** en, zh-TW, zh-CN, ja, ko, th or vi (others fall back to English). */
  locale?: string;
  labels?: LabelOverrides;
  /** Most characters in one message (default 4000). */
  maxLength?: number;
  /** The other side has read up to this seq: the last own message shows "Seen". */
  readSeq?: number;
  disabled?: boolean;
  footer?: ReactNode;
  origin?: string;
  imageOrigins?: string[];
  renderName?: (message: ChatMessage) => ReactNode;
}

export function ChatThread(props: ChatThreadProps): ReactElement;
export function Chat(props: Omit<ChatThreadProps, 'messages' | 'typing' | 'step' | 'onSend'> & { conversation: Conversation | null }): ReactElement;
export function useConversation(conversation: Conversation | null): ConversationState;
export function Markdown(props: { text: string; locale?: string; labels?: LabelOverrides; origin?: string; imageOrigins?: string[] }): ReactElement;
export function AgentSteps(props: { typing: boolean; step?: AgentStep; locale?: string; labels?: ChatLabels }): ReactElement | null;
export function Suggestions(props: { items: string[]; onPick: (text: string) => void; disabled?: boolean; locale?: string; labels?: ChatLabels }): ReactElement | null;
export function CopyButton(props: { text: string; label?: string; labels?: ChatLabels; locale?: string; className?: string }): ReactElement;
export function useReveal(text: string, animate: boolean): { shown: string; done: boolean };
