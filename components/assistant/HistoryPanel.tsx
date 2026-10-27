import React from 'react';
import { MessageSquare, Plus, Search, Trash2, X } from 'lucide-react';
import { Conversation, ConversationGroup } from '../../lib/assistant/history';

interface HistoryPanelProps {
  groups: ConversationGroup[];
  total: number; // conversas guardadas (antes da busca)
  activeId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClearAll: () => void;
  onClose?: () => void; // só no celular, onde a lista abre por cima da conversa
}

const timeLabel = (conversation: Conversation, now: Date = new Date()): string => {
  const date = new Date(conversation.updatedAt);
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// Lista de conversas anteriores do Meu Assistente (ficam só neste navegador).
export const HistoryPanel: React.FC<HistoryPanelProps> = ({ groups, total, activeId, search, onSearch, onSelect, onDelete, onNew, onClearAll, onClose }) => (
  <div className="flex flex-col h-full min-h-0" aria-label="Histórico de conversas">
    <div className="p-4 border-b border-sae-border flex items-center justify-between gap-2">
      <h3 className="font-heading font-bold text-sae-text">Histórico</h3>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sae-accent text-white text-xs font-semibold hover:bg-sae-accentHover transition-colors"
        >
          <Plus size={14} /> Nova
        </button>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar histórico" className="p-1.5 rounded-full text-sae-muted hover:text-sae-text hover:bg-sae-accent/10">
            <X size={18} />
          </button>
        )}
      </div>
    </div>

    {total > 0 && (
      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sae-muted" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar nas conversas"
            aria-label="Buscar nas conversas"
            className="w-full bg-sae-darker border border-sae-border rounded-lg pl-9 pr-3 py-2 text-sm text-sae-text placeholder:text-sae-muted focus:border-sae-accent outline-none"
          />
        </div>
      </div>
    )}

    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {total === 0 ? (
        <p className="text-sm text-sae-muted text-center px-3 py-8">Suas conversas aparecem aqui, para você voltar a elas depois.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-sae-muted text-center px-3 py-8">Nenhuma conversa encontrada para essa busca.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wide text-sae-muted">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((conversation) => (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={conversation.id === activeId ? 'true' : undefined}
                    className={`w-full text-left flex items-center gap-2 pl-2 pr-9 py-2 rounded-lg text-sm transition-colors ${
                      conversation.id === activeId ? 'bg-sae-accentSoft text-sae-accentText font-semibold' : 'text-sae-text hover:bg-sae-accent/5'
                    }`}
                  >
                    <MessageSquare size={14} className="shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{conversation.title}</span>
                      <span className="block text-[10px] text-sae-muted font-normal">{timeLabel(conversation)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(conversation.id)}
                    aria-label={`Apagar a conversa ${conversation.title}`}
                    title="Apagar conversa"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-sae-muted hover:text-sae-danger hover:bg-sae-danger/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>

    <div className="p-3 border-t border-sae-border space-y-2">
      <p className="text-[10px] text-sae-muted leading-snug">Ficam salvas só neste navegador, no seu login. CPF, e-mail e telefone digitados não são guardados.</p>
      {total > 0 && (
        <button type="button" onClick={onClearAll} className="text-[11px] font-semibold text-sae-danger hover:underline">
          Apagar todo o histórico
        </button>
      )}
    </div>
  </div>
);
