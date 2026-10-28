import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Image as ImageIcon, Plus, RefreshCw, Search, Share2, Trash2, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Breadcrumb, Button, Card, SectionTitle } from '../components/UI';
import { FEED_SCRIPT_URL } from '../lib/feed';
import { FLYER_IMAGE, FLYER_LIMITS, Flyer, ShareOutcome, createFlyer, deleteFlyer, downloadFlyer, flyerImageSources, loadFlyers, shareFlyer } from '../lib/flyers';
import { compressImage } from '../lib/images';
import { foldText } from '../lib/courses';
import { can } from '../lib/permissions';
import { timeAgo } from '../lib/text';

const SEARCH_FROM = 8; // a busca só aparece quando há mais flyers que isso

const inputClass =
  'w-full bg-sae-darker border border-sae-border rounded-lg px-3 py-2 text-sae-text placeholder:text-sae-muted/70 focus:border-sae-accent outline-none';

const SHARE_MESSAGE: Record<ShareOutcome, string> = {
  shared: '',
  cancelled: '',
  copied: 'Este navegador não tem compartilhamento: o link do flyer foi copiado.',
  failed: 'Não foi possível compartilhar. Use "Baixar" e envie a imagem.',
};

// Imagem do flyer: se um endereço falhar, tenta o próximo; se todos falharem, mostra um aviso em vez do ícone quebrado.
const FlyerImage: React.FC<{ flyer: Flyer; width: number; className: string }> = ({ flyer, width, className }) => {
  const sources = flyerImageSources(flyer, width);
  const [attempt, setAttempt] = useState(0);

  if (attempt >= sources.length) {
    return (
      <span className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center text-sae-muted">
        <ImageIcon size={36} className="opacity-60" />
        <span className="text-xs">A imagem não carregou agora. Use "Baixar" ou tente atualizar a página.</span>
      </span>
    );
  }
  // Sem referência: o Google recusa (429) as imagens do Drive pedidas por uma página em localhost
  return <img key={sources[attempt]} src={sources[attempt]} alt={flyer.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setAttempt((current) => current + 1)} className={className} />;
};

// Janela para o Administrativo adicionar um flyer: título e uma imagem.
const FlyerComposer: React.FC<{ open: boolean; onClose: () => void; onCreated: () => Promise<void>; user: { login: string; name: string } }> = ({ open, onClose, onCreated, user }) => {
  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');
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

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      setImage(await compressImage(file, FLYER_IMAGE));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível processar a imagem.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || processing) return;
    if (!title.trim()) return setError('Informe o título do flyer.');
    if (!image) return setError('Escolha a imagem do flyer.');
    setSubmitting(true);
    setError('');
    try {
      await createFlyer(title, image, user);
      setTitle('');
      setImage('');
      onClose();
      await onCreated();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível adicionar o flyer.');
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
        aria-labelledby="flyer-composer-title"
        className="relative z-10 w-full max-w-lg my-auto bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-6 space-y-4 animate-fadeIn"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="flyer-composer-title" className="text-xl font-heading font-bold text-sae-text leading-tight">
              Adicionar flyer
            </h2>
            <p className="text-sm text-sae-muted">A imagem fica disponível para a equipe baixar e compartilhar.</p>
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

        <input ref={titleRef} className={inputClass} placeholder="Título (ex.: Pós em Estética, turma 11/2026)" maxLength={FLYER_LIMITS.title} value={title} onChange={(event) => setTitle(event.target.value)} />

        <div>
          {image && (
            <div className="mb-3 rounded-lg overflow-hidden border border-sae-border bg-sae-soft">
              <img src={image} alt="Pré-visualização do flyer" className="w-full max-h-72 object-contain" />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={processing}>
            <ImagePlus size={16} className="mr-2" />
            {processing ? 'Processando...' : image ? 'Trocar imagem' : 'Escolher imagem'}
          </Button>
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
            <Plus size={16} className="mr-2" /> {submitting ? 'Enviando...' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Imagem ampliada, com as mesmas ações do card.
const FlyerPreview: React.FC<{ flyer: Flyer | null; onClose: () => void; actions: React.ReactNode }> = ({ flyer, onClose, actions }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!flyer) return;
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
  }, [flyer, onClose]);

  if (!flyer) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="flyer-preview-title" className="relative z-10 w-full max-w-3xl bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-4 sm:p-6 animate-fadeIn">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="flyer-preview-title" className="text-lg sm:text-xl font-heading font-bold text-sae-text break-words">
            {flyer.title}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-full text-sae-muted hover:text-sae-text hover:bg-sae-soft transition-colors shrink-0">
            <X size={22} />
          </button>
        </div>
        <div className="rounded-lg overflow-hidden bg-sae-soft">
          <div className="flex items-center justify-center min-h-[16rem]">
            <FlyerImage key={flyer.id} flyer={flyer} width={1600} className="w-full max-h-[70vh] object-contain" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">{actions}</div>
      </div>
    </div>
  );
};

export const Flyers: React.FC = () => {
  const userName = localStorage.getItem('userNome') ?? '';
  const userLogin = localStorage.getItem('userLogin') ?? '';
  const mayManage = can('manageFlyers');
  const canAdd = mayManage && Boolean(FEED_SCRIPT_URL) && Boolean(userLogin);

  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [preview, setPreview] = useState<Flyer | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      setFlyers(await loadFlyers());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const closeComposer = useCallback(() => setComposerOpen(false), []);
  const closePreview = useCallback(() => setPreview(null), []);

  const handleDownload = async (flyer: Flyer) => {
    setBusyId(flyer.id);
    setProblem('');
    setMessage((await downloadFlyer(flyer)) === 'opened' ? 'O navegador não deixou baixar direto: a imagem abriu em outra aba, onde você pode salvá-la.' : '');
    setBusyId(null);
  };

  const handleShare = async (flyer: Flyer) => {
    setBusyId(flyer.id);
    setProblem('');
    const outcome = await shareFlyer(flyer);
    setMessage(outcome === 'failed' ? '' : SHARE_MESSAGE[outcome]);
    setProblem(outcome === 'failed' ? SHARE_MESSAGE.failed : '');
    setBusyId(null);
  };

  const handleDelete = async (flyer: Flyer) => {
    setBusyId(flyer.id);
    setProblem('');
    setMessage('');
    try {
      await deleteFlyer(flyer.id, userLogin);
      setConfirmingId(null);
      setPreview(null);
      await refresh();
      setMessage('Flyer excluído.');
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Não foi possível excluir o flyer.');
    } finally {
      setBusyId(null);
    }
  };

  const term = foldText(search).trim();
  const shown = term ? flyers.filter((flyer) => foldText(flyer.title).includes(term)) : flyers;

  const actionsOf = (flyer: Flyer, size: 'sm' | 'md' = 'sm') => (
    <>
      <Button size={size} className="flex-1 text-xs" onClick={() => handleDownload(flyer)} disabled={busyId === flyer.id}>
        <Download size={14} className="mr-1.5" /> Baixar
      </Button>
      <Button size={size} variant="secondary" className="flex-1 text-xs" onClick={() => handleShare(flyer)} disabled={busyId === flyer.id}>
        <Share2 size={14} className="mr-1.5" /> Compartilhar
      </Button>
    </>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Conteúdos', path: '#' }, { label: 'Flyers' }]} />
        <SectionTitle title="Flyers" subtitle={mayManage ? 'Adicione e exclua os flyers de divulgação da equipe.' : 'Baixe ou compartilhe os flyers de divulgação.'} />

        <div className="flex flex-wrap items-center gap-3 mb-8">
          {flyers.length > SEARCH_FROM && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sae-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar flyer" aria-label="Buscar flyer" className="w-full bg-sae-darker border border-sae-border rounded-lg pl-9 pr-3 py-2 text-sm text-sae-text placeholder:text-sae-muted focus:border-sae-accent outline-none" />
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button type="button" onClick={() => refresh(true)} disabled={refreshing} className="flex items-center gap-1.5 text-sm text-sae-muted hover:text-sae-accentText transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Atualizar
            </button>
            {mayManage && (
              <Button onClick={() => setComposerOpen(true)} disabled={!canAdd} title={canAdd ? undefined : 'O envio ainda não foi configurado ou você precisa entrar de novo no SAE.'}>
                <Plus size={16} className="mr-2" /> Adicionar flyer
              </Button>
            )}
          </div>
        </div>

        <div aria-live="polite">
          {message && <p className="text-sm text-sae-muted mb-4">{message}</p>}
          {problem && (
            <p role="alert" className="text-sm text-sae-danger mb-4">
              {problem}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-sae-muted py-8 text-center animate-pulse">Carregando flyers...</p>
        ) : loadError ? (
          <Card className="p-10 text-center">
            <ImageIcon size={40} className="mx-auto mb-3 text-sae-muted opacity-60" />
            <h2 className="text-lg font-heading font-bold text-sae-text">Não foi possível carregar os flyers agora</h2>
            <p className="text-sae-muted mt-1 max-w-md mx-auto">Tente atualizar em instantes.{mayManage && ' Se for a primeira vez, rode a função setup() no Apps Script para criar a aba Flyers.'}</p>
          </Card>
        ) : flyers.length === 0 ? (
          <Card className="p-10 text-center">
            <ImageIcon size={40} className="mx-auto mb-3 text-sae-muted opacity-60" />
            <h2 className="text-lg font-heading font-bold text-sae-text">Nenhum flyer por aqui ainda</h2>
            <p className="text-sae-muted mt-1 max-w-md mx-auto">{mayManage ? 'Use "Adicionar flyer" para enviar o primeiro.' : 'Quando a equipe administrativa adicionar flyers, eles aparecem aqui.'}</p>
          </Card>
        ) : shown.length === 0 ? (
          <p className="text-sae-muted py-8 text-center">Nenhum flyer encontrado para essa busca.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {shown.map((flyer) => (
              <Card key={flyer.id} className="flex flex-col hover:border-sae-accent/50 transition-all duration-300">
                <button type="button" onClick={() => setPreview(flyer)} aria-label={`Ampliar: ${flyer.title}`} className="block w-full aspect-square bg-sae-soft overflow-hidden">
                  <FlyerImage flyer={flyer} width={600} className="w-full h-full object-contain" />
                </button>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-sae-text leading-snug break-words">{flyer.title}</h3>
                  {!Number.isNaN(flyer.date.getTime()) && <p className="text-xs text-sae-muted mt-1">Adicionado {timeAgo(flyer.date)}</p>}
                  <div className="flex gap-2 mt-4">{actionsOf(flyer)}</div>
                  {mayManage && (
                    <div className="mt-2">
                      {confirmingId === flyer.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-sae-muted">Excluir este flyer?</span>
                          <Button size="sm" variant="secondary" className="text-xs" onClick={() => handleDelete(flyer)} disabled={busyId === flyer.id}>
                            {busyId === flyer.id ? 'Excluindo...' : 'Sim, excluir'}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmingId(null)} disabled={busyId === flyer.id}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmingId(flyer.id)} className="flex items-center gap-1.5 text-xs text-sae-muted hover:text-sae-danger transition-colors">
                          <Trash2 size={14} /> Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FlyerPreview flyer={preview} onClose={closePreview} actions={preview ? actionsOf(preview, 'md') : null} />
      {mayManage && <FlyerComposer open={composerOpen} onClose={closeComposer} onCreated={refresh} user={{ login: userLogin, name: userName }} />}
    </Layout>
  );
};
