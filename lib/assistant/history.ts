import { foldText } from '../courses';
import { redactPersonalData } from './ai';
import { replyToPlain } from './engine';
import type { Reply } from './shared';

// Histórico de conversas do Meu Assistente. Fica no navegador de cada usuário (localStorage, uma chave por login):
// não vai para nenhum servidor e não acompanha a pessoa em outro computador ou navegador.

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  reply?: Reply;
  loading?: boolean; // esperando dados (calendário de aulas) ou a IA
  loadingText?: string;
  loadedAt?: Date; // quando os dados da resposta foram lidos
  timestamp: Date;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  reply?: Reply;
  loadedAt?: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

export interface Store {
  conversations: Conversation[];
  activeId: string | null;
}

export const MAX_CONVERSATIONS = 25;
export const MAX_MESSAGES = 60;
const TITLE_MAX = 60;

export const EMPTY_STORE: Store = { conversations: [], activeId: null };

const storageKey = (login: string): string => `saeAssistantHistory:v1:${login || 'anon'}`;

export const newConversationId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------------------------------------------------------------- leitura e gravação

const isValidMessage = (value: unknown): value is StoredMessage => {
  const message = value as StoredMessage;
  return Boolean(message) && typeof message.id === 'string' && (message.role === 'user' || message.role === 'assistant') && typeof message.timestamp === 'string';
};

export const loadStore = (login: string): Store => {
  try {
    const raw = localStorage.getItem(storageKey(login));
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<Store>;
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations
          .filter((item): item is Conversation => Boolean(item) && typeof item.id === 'string' && Array.isArray(item.messages))
          .map((item) => ({ ...item, title: String(item.title ?? ''), messages: item.messages.filter(isValidMessage) }))
      : [];
    return { conversations, activeId: typeof parsed.activeId === 'string' && conversations.some((item) => item.id === parsed.activeId) ? parsed.activeId : null };
  } catch {
    return EMPTY_STORE;
  }
};

// Grava o histórico. Se o navegador recusar por falta de espaço, apaga as conversas mais antigas (menos a aberta) e tenta de novo.
// Devolve o que ficou gravado.
export const saveStore = (login: string, store: Store): Store => {
  let current = store;
  for (let attempt = 0; attempt < MAX_CONVERSATIONS + 1; attempt++) {
    try {
      localStorage.setItem(storageKey(login), JSON.stringify(current));
      return current;
    } catch {
      const removable = [...current.conversations].reverse().find((item) => item.id !== current.activeId);
      if (!removable) return current;
      current = { ...current, conversations: current.conversations.filter((item) => item.id !== removable.id) };
    }
  }
  return current;
};

export const clearStore = (login: string): Store => {
  try {
    localStorage.removeItem(storageKey(login));
  } catch {
    // armazenamento indisponível
  }
  return EMPTY_STORE;
};

// ---------------------------------------------------------------- conversão

// Só vai para o disco o que já foi respondido. O que a pessoa digitou fica sem CPF, CNPJ, e-mail e telefone.
export const toStored = (messages: ChatMessage[]): StoredMessage[] =>
  messages
    .filter((message) => !message.loading && (message.text || message.reply))
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      id: message.id,
      role: message.role,
      ...(message.text !== undefined ? { text: redactPersonalData(message.text) } : {}),
      ...(message.reply ? { reply: message.reply } : {}),
      ...(message.loadedAt ? { loadedAt: message.loadedAt.toISOString() } : {}),
      timestamp: message.timestamp.toISOString(),
    }));

// Ao reabrir, os botões que guardam um código interno (#c:123, #l:more...) saem: eles apontam para posições da planilha
// de quando a conversa foi feita, que podem ter mudado. Botões de texto ("Aulas em Santos") continuam.
export const fromStored = (messages: StoredMessage[]): ChatMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    reply: message.reply ? { ...message.reply, chips: (message.reply.chips ?? []).filter((chip) => !chip.query.startsWith('#')) } : undefined,
    loadedAt: message.loadedAt ? new Date(message.loadedAt) : undefined,
    timestamp: new Date(message.timestamp),
  }));

export const conversationTitle = (messages: ChatMessage[]): string => {
  const first = messages.find((message) => message.role === 'user' && message.text?.trim());
  const text = redactPersonalData((first?.text ?? '').replace(/\s+/g, ' ').trim());
  if (!text) return 'Nova conversa';
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1).trimEnd()}…` : text;
};

// ---------------------------------------------------------------- operações

export const upsertConversation = (store: Store, id: string, messages: ChatMessage[], now: Date = new Date()): Store => {
  const stored = toStored(messages);
  if (stored.length === 0) return store;
  const previous = store.conversations.find((item) => item.id === id);
  const conversation: Conversation = {
    id,
    title: previous?.title && previous.title !== 'Nova conversa' ? previous.title : conversationTitle(messages),
    createdAt: previous?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    messages: stored,
  };
  const others = store.conversations.filter((item) => item.id !== id);
  const conversations = [conversation, ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_CONVERSATIONS);
  return { conversations, activeId: id };
};

export const removeConversation = (store: Store, id: string): Store => ({
  conversations: store.conversations.filter((item) => item.id !== id),
  activeId: store.activeId === id ? null : store.activeId,
});

// ---------------------------------------------------------------- lista (busca e grupos por dia)

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

export const groupConversations = (conversations: Conversation[], now: Date = new Date()): ConversationGroup[] => {
  const today = startOfDay(now);
  const day = 86400000;
  const groups: ConversationGroup[] = [
    { label: 'Hoje', items: [] },
    { label: 'Ontem', items: [] },
    { label: 'Últimos 7 dias', items: [] },
    { label: 'Mais antigas', items: [] },
  ];
  conversations.forEach((conversation) => {
    const diff = today - startOfDay(new Date(conversation.updatedAt));
    groups[diff <= 0 ? 0 : diff <= day ? 1 : diff <= 7 * day ? 2 : 3].items.push(conversation);
  });
  return groups.filter((group) => group.items.length > 0);
};

// Procura no título e no texto das mensagens (sem diferenciar acento nem maiúscula).
const fold = (value: string): string => foldText(value);

export const searchConversations = (conversations: Conversation[], query: string): Conversation[] => {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return conversations;
  return conversations.filter((conversation) => {
    const haystack = fold(
      [conversation.title, ...conversation.messages.map((message) => (message.role === 'user' ? message.text ?? '' : message.reply ? replyToPlain(message.reply) : ''))].join('\n'),
    );
    return terms.every((term) => haystack.includes(term));
  });
};
