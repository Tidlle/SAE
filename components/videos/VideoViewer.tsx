import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { Button } from '../UI';

// Item aberto no player: um vídeo do YouTube ou um post/reel do Instagram.
export interface PlayerItem {
  title: string;
  embedSrc: string;
  url: string; // endereço para abrir e compartilhar
  platform: 'youtube' | 'instagram';
}

export const CopyLinkButton: React.FC<{ url: string; className?: string }> = ({ url, className = '' }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <Button variant="secondary" size="sm" onClick={copy} className={`text-xs gap-1.5 ${className}`} aria-live="polite">
      {state === 'copied' ? <Check size={16} /> : <Copy size={16} />}
      {state === 'copied' ? 'Link copiado' : state === 'failed' ? 'Não foi possível copiar' : 'Copiar link'}
    </Button>
  );
};

export const VideoPlayerModal: React.FC<{ item: PlayerItem | null; onClose: () => void }> = ({ item, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!item) return;
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
    };
  }, [item, onClose]);

  if (!item) return null;
  const instagram = item.platform === 'instagram';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-modal-title"
        className={`relative z-10 w-full ${instagram ? 'max-w-lg' : 'max-w-4xl'} bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-4 sm:p-6 animate-fadeIn`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="video-modal-title" className="text-lg sm:text-xl font-heading font-bold text-sae-text">
            {item.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar vídeo"
            className="p-1.5 rounded-full text-sae-muted hover:text-sae-text hover:bg-sae-soft transition-colors shrink-0"
          >
            <X size={22} />
          </button>
        </div>

        {instagram ? (
          <div className="relative w-full overflow-hidden rounded-lg bg-white">
            {!loaded && <p className="absolute inset-x-0 top-24 text-center text-sm text-gray-500 animate-pulse">Carregando do Instagram...</p>}
            <iframe src={item.embedSrc} title={item.title} onLoad={() => setLoaded(true)} className="relative w-full h-[640px] border-0" allow="encrypted-media; fullscreen" allowFullScreen />
          </div>
        ) : (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              src={item.embedSrc}
              title={item.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <CopyLinkButton url={item.url} />
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sae-accentText hover:text-sae-accentHover">
            <ExternalLink size={16} /> {instagram ? 'Abrir no Instagram' : 'Abrir no YouTube'}
          </a>
        </div>
        {instagram && <p className="text-xs text-sae-muted mt-3">Se aparecer "link quebrado" ou o vídeo não carregar, o Instagram não permite exibir este post aqui: use "Abrir no Instagram".</p>}
      </div>
    </div>
  );
};
