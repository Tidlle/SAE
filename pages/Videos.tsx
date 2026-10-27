import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Play, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Breadcrumb, Button, Card, SectionTitle } from '../components/UI';
import { VIDEOS, Video, watchUrl } from '../lib/videos';

const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

const CopyLinkButton: React.FC<{ id: string; className?: string }> = ({ id, className = '' }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(watchUrl(id));
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

const VideoPlayerModal: React.FC<{ video: Video | null; onClose: () => void }> = ({ video, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!video) return;
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
  }, [video, onClose]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-modal-title"
        className="relative z-10 w-full max-w-4xl bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-4 sm:p-6 animate-fadeIn"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="video-modal-title" className="text-lg sm:text-xl font-heading font-bold text-sae-text">
            {video.title}
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

        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            src={embedUrl(video.id)}
            title={video.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <CopyLinkButton id={video.id} />
          <a
            href={watchUrl(video.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sae-accentText hover:text-sae-accentHover"
          >
            <ExternalLink size={16} /> Abrir no YouTube
          </a>
        </div>
      </div>
    </div>
  );
};

export const Videos: React.FC = () => {
  const [playing, setPlaying] = useState<Video | null>(null);
  const closePlayer = useCallback(() => setPlaying(null), []);

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Vídeos' }]} />
        <SectionTitle
          title="Vídeos Tutoriais"
          subtitle="Tutoriais do Portal do Aluno. Assista aqui mesmo e envie o link ao aluno para orientá-lo."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {VIDEOS.map((video) => (
            <Card key={video.id} className="group flex flex-col overflow-hidden hover:border-sae-accent/50 transition-all duration-300">
              <button
                type="button"
                onClick={() => setPlaying(video)}
                aria-label={`Assistir: ${video.title}`}
                className="relative block w-full aspect-video overflow-hidden bg-sae-soft shrink-0"
              >
                <img
                  src={thumbnailUrl(video.id)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="w-12 h-12 bg-sae-accent/90 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform">
                    <Play size={20} fill="currentColor" className="ml-1" />
                  </span>
                </span>
              </button>

              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-sae-text mb-4 leading-snug">{video.title}</h3>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" className="flex-1 text-xs" onClick={() => setPlaying(video)}>
                    <Play size={14} fill="currentColor" className="mr-1.5" /> Assistir agora
                  </Button>
                  <CopyLinkButton id={video.id} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <VideoPlayerModal video={playing} onClose={closePlayer} />
    </Layout>
  );
};
