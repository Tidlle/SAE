import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { Button } from './UI';
import { initials } from '../lib/text';
import { compressImage } from '../lib/images';
import {
  FEED_CATEGORIES,
  FEED_LIMITS,
  FeedCategory,
  INSTITUTION_NAMES,
  MAX_IMAGES,
  createPost,
} from '../lib/feed';

const inputClass =
  'w-full bg-sae-darker border border-sae-border rounded-lg px-3 py-2 text-sae-text placeholder:text-sae-muted/70 focus:border-sae-accent outline-none';

const EMPTY_FORM = { category: 'Novo curso' as FeedCategory, title: '', message: '', link: '', institution: '' };

interface PostComposerProps {
  open: boolean;
  onClose: () => void;
  onPublished: (warning?: string) => Promise<void> | void;
  user: { login: string; name: string };
}

export const PostComposer: React.FC<PostComposerProps> = ({ open, onClose, onPublished, user }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []) as File[];
    event.target.value = '';
    if (files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(`Você pode anexar até ${MAX_IMAGES} imagens.`);
      return;
    }
    setError(files.length > room ? `Só cabem mais ${room} imagem(ns); as demais foram ignoradas.` : '');
    setProcessing(true);
    try {
      const prepared: string[] = [];
      for (const file of files.slice(0, room)) prepared.push(await compressImage(file));
      setImages((current) => [...current, ...prepared].slice(0, MAX_IMAGES));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível processar a imagem.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || processing) return;
    if (!form.title.trim() || !form.message.trim()) {
      setError('Preencha o título e a mensagem.');
      return;
    }
    if (form.link.trim() && !/^https?:\/\/\S+$/i.test(form.link.trim())) {
      setError('O link deve começar com http:// ou https://.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { imagesSaved } = await createPost({ ...form, images }, user);
      const imagesLost = images.length > 0 && imagesSaved !== images.length;
      setForm(EMPTY_FORM);
      setImages([]);
      onClose();
      await onPublished(
        imagesLost
          ? 'A publicação foi criada, mas as imagens não foram salvas. O script do feed provavelmente está desatualizado: crie uma nova versão da implantação no Apps Script.'
          : undefined
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível publicar.');
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
        aria-labelledby="composer-title"
        className="relative z-10 w-full max-w-xl my-auto bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-6 space-y-4 animate-fadeIn"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sae-accent text-white flex items-center justify-center font-bold text-sm shrink-0">
              {initials(user.name || 'Visitante')}
            </div>
            <div>
              <h2 id="composer-title" className="text-xl font-heading font-bold text-sae-text leading-tight">
                Nova publicação
              </h2>
              <p className="text-sm text-sae-muted">Compartilhe uma novidade com a equipe.</p>
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

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoria">
          {FEED_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={form.category === category}
              onClick={() => setForm({ ...form, category })}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                form.category === category
                  ? 'bg-sae-accent text-white border-sae-accent'
                  : 'bg-sae-card text-sae-muted border-sae-border hover:border-sae-accent'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <input
          ref={titleRef}
          className={inputClass}
          placeholder="Título"
          maxLength={FEED_LIMITS.title}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <div>
          <textarea
            className={`${inputClass} min-h-[110px] resize-y`}
            placeholder="O que você quer compartilhar?"
            maxLength={FEED_LIMITS.message}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
          />
          <div className="text-xs text-sae-muted text-right mt-1">
            {form.message.length}/{FEED_LIMITS.message}
          </div>
        </div>

        <div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {images.map((src, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-sae-border bg-sae-soft">
                  <img src={src} alt={`Imagem ${index + 1} anexada`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    aria-label={`Remover imagem ${index + 1}`}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-sae-accent transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={processing || images.length >= MAX_IMAGES}
          >
            <ImagePlus size={16} className="mr-2" />
            {processing ? 'Processando...' : `Adicionar imagens (${images.length}/${MAX_IMAGES})`}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className={inputClass}
            type="url"
            placeholder="Link (opcional)"
            value={form.link}
            onChange={(event) => setForm({ ...form, link: event.target.value })}
          />
          <select
            className={inputClass}
            value={form.institution}
            onChange={(event) => setForm({ ...form, institution: event.target.value })}
            aria-label="Instituição"
          >
            <option value="">Todas as instituições</option>
            {INSTITUTION_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={submitting || processing}>
            <Send size={16} className="mr-2" /> {submitting ? 'Publicando...' : 'Publicar'}
          </Button>
        </div>
      </form>
    </div>
  );
};
