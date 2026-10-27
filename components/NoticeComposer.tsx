import React, { useEffect, useRef, useState } from 'react';
import { Megaphone, Send, X } from 'lucide-react';
import { Button } from './UI';
import { NOTICE_LIMITS, createNotice } from '../lib/notices';

const inputClass =
  'w-full bg-sae-darker border border-sae-border rounded-lg px-3 py-2 text-sae-text placeholder:text-sae-muted/70 focus:border-sae-accent outline-none';

const NEW_SECTOR = '__novo__';

interface NoticeComposerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  sectors: string[];
  user: { login: string };
}

export const NoticeComposer: React.FC<NoticeComposerProps> = ({ open, onClose, onCreated, sectors, user }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sectorChoice, setSectorChoice] = useState('');
  const [newSector, setNewSector] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, submitting, onClose]);

  if (!open) return null;

  const sector = sectorChoice === NEW_SECTOR ? newSector.trim() : sectorChoice;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!title.trim() || !message.trim() || !sector) {
      setError('Preencha o título, a mensagem e o setor.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createNotice({ title, message, sector }, user);
      setTitle('');
      setMessage('');
      setSectorChoice('');
      setNewSector('');
      onClose();
      await onCreated();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível criar o aviso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-composer-title"
        className="relative z-10 w-full max-w-xl my-auto bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-6 space-y-4 animate-fadeIn"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-sae-accentSoft text-sae-accentText flex items-center justify-center shrink-0">
              <Megaphone size={20} />
            </span>
            <div>
              <h2 id="notice-composer-title" className="text-xl font-heading font-bold text-sae-text leading-tight">
                Novo aviso
              </h2>
              <p className="text-sm text-sae-muted">Ele aparece no Mural de Avisos com a data de hoje.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-sae-muted hover:text-sae-text hover:bg-sae-soft transition-colors disabled:opacity-50"
          >
            <X size={22} />
          </button>
        </div>

        <input
          ref={titleRef}
          className={inputClass}
          placeholder="Título do aviso"
          maxLength={NOTICE_LIMITS.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div>
          <textarea
            className={`${inputClass} min-h-[140px] resize-y`}
            placeholder="Mensagem do aviso"
            maxLength={NOTICE_LIMITS.message}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="text-xs text-sae-muted text-right mt-1">
            {message.length}/{NOTICE_LIMITS.message}
          </div>
        </div>

        <div className="space-y-3">
          <select
            className={inputClass}
            value={sectorChoice}
            onChange={(event) => setSectorChoice(event.target.value)}
            aria-label="Setor"
          >
            <option value="">Selecione o setor</option>
            {sectors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NEW_SECTOR}>Outro setor...</option>
          </select>
          {sectorChoice === NEW_SECTOR && (
            <input
              className={inputClass}
              placeholder="Nome do novo setor"
              maxLength={NOTICE_LIMITS.sector}
              value={newSector}
              onChange={(event) => setNewSector(event.target.value)}
            />
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-sae-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            <Send size={16} className="mr-2" /> {submitting ? 'Publicando...' : 'Publicar aviso'}
          </Button>
        </div>
      </form>
    </div>
  );
};
