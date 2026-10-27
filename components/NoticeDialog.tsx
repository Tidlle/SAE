import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Calendar, X } from 'lucide-react';
import { Badge } from './UI';

export interface NoticeView {
  title: string;
  message: string;
  date: string;
  sector: string;
}

// Texto do aviso com quebras de linha preservadas e endereços (http/https) clicáveis.
const MessageText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split('\n').map((line, index) => (
      <p key={index} className={line.trim() ? '' : 'h-3'}>
        {line.split(/(https?:\/\/[^\s]+)/g).map((part, partIndex) => {
          if (!/^https?:\/\//.test(part)) return part;
          const url = part.replace(/[.,;:!?)]+$/, '');
          return (
            <React.Fragment key={partIndex}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sae-accentText underline break-all">
                {url}
              </a>
              {part.slice(url.length)}
            </React.Fragment>
          );
        })}
      </p>
    ))}
  </>
);

// Janela com o aviso inteiro para leitura (aberta ao clicar num aviso da Home).
export const NoticeDialog: React.FC<{ notice: NoticeView | null; onClose: () => void }> = ({ notice, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!notice) return;
    const trigger = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      trigger?.focus?.();
    };
  }, [notice, onClose]);

  if (!notice) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-dialog-title"
        className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-sae-card border border-sae-border rounded-2xl shadow-2xl animate-fadeIn"
      >
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {notice.sector && <Badge variant="secondary">{notice.sector}</Badge>}
              {notice.date && (
                <span className="text-xs text-sae-muted flex items-center gap-1">
                  <Calendar size={12} /> {notice.date}
                </span>
              )}
            </div>
            <h2 id="notice-dialog-title" className="text-xl sm:text-2xl font-heading font-bold text-sae-text break-words">
              {notice.title || 'Aviso'}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar aviso"
            className="p-1.5 rounded-full text-sae-muted hover:text-sae-text hover:bg-sae-soft transition-colors shrink-0"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-3 overflow-y-auto text-sm sm:text-base text-sae-text leading-relaxed break-words">
          <MessageText text={notice.message} />
        </div>

        <div className="p-5 sm:p-6 pt-3 border-t border-sae-border">
          <Link to="/avisos" onClick={onClose} className="text-sm font-semibold text-sae-accentText hover:text-sae-accentHover">
            Ver todos os avisos
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
};
