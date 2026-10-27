import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Megaphone, PenSquare, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card } from './UI';
import { PostComposer } from './PostComposer';
import { linkify, initials, timeAgo } from '../lib/text';
import { FEED_SCRIPT_URL, FeedPost, deletePost, imageUrl, loadFeed } from '../lib/feed';
import { can } from '../lib/permissions';

const PAGE_SIZE = 10;
const REFRESH_MS = 60000;

const CATEGORY_VARIANT: Record<string, 'primary' | 'secondary' | 'warning'> = {
  'Novo curso': 'primary',
  Aviso: 'warning',
};

const PostImages: React.FC<{ ids: string[]; author: string }> = ({ ids, author }) => {
  if (ids.length === 0) return null;
  const single = ids.length === 1;
  return (
    <div className={`mt-3 grid gap-2 ${single ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {ids.map((id, index) => (
        <a
          key={id}
          href={imageUrl(id, 2000)}
          target="_blank"
          rel="noopener noreferrer"
          className={`block overflow-hidden rounded-lg border border-sae-border bg-sae-soft ${
            single ? '' : ids.length === 3 && index === 0 ? 'col-span-2' : ''
          }`}
        >
          <img
            src={imageUrl(id, single ? 1200 : 700)}
            alt={`Imagem ${index + 1} da publicação de ${author || 'usuário'}`}
            loading="lazy"
            className={`w-full object-cover ${single ? 'max-h-[28rem] object-contain bg-sae-soft' : 'aspect-[4/3]'}`}
          />
        </a>
      ))}
    </div>
  );
};

export const Feed: React.FC = () => {
  const userName = localStorage.getItem('userNome') ?? '';
  const userLogin = localStorage.getItem('userLogin') ?? '';

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [composerOpen, setComposerOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [publishWarning, setPublishWarning] = useState('');

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      setPosts(await loadFeed());
      setLoadError('');
    } catch {
      setLoadError('Não foi possível carregar o feed agora.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const mayPost = can('postFeed');
  const canPublish = mayPost && Boolean(FEED_SCRIPT_URL) && Boolean(userLogin);
  const blockedReason = !mayPost
    ? 'Seu perfil permite apenas visualizar o feed.'
    : !FEED_SCRIPT_URL
      ? 'O envio de publicações ainda não foi configurado. Por enquanto o feed é somente leitura.'
      : !userLogin
        ? 'Entre novamente no SAE para poder publicar.'
        : '';

  const closeComposer = useCallback(() => setComposerOpen(false), []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setActionError('');
    try {
      await deletePost(id, userLogin);
      setConfirmingId(null);
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível apagar.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section aria-labelledby="feed-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="feed-title" className="text-2xl font-heading font-bold text-sae-text flex items-center gap-2">
          <Megaphone size={24} className="text-sae-accentText" /> Feed
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-sm text-sae-muted hover:text-sae-accentText transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </button>
          {mayPost && (
            <Button size="sm" onClick={() => setComposerOpen(true)} disabled={!canPublish}>
              <PenSquare size={16} className="mr-2" /> Nova publicação
            </Button>
          )}
        </div>
      </div>

      {blockedReason && <p className="text-sm text-sae-muted mb-4">{blockedReason}</p>}

      <PostComposer
        open={composerOpen}
        onClose={closeComposer}
        onPublished={async (warning) => {
          setPublishWarning(warning ?? '');
          await refresh();
        }}
        user={{ login: userLogin, name: userName }}
      />

      {publishWarning && (
        <div role="alert" className="flex items-start justify-between gap-3 mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-sae-text">
          <span>{publishWarning}</span>
          <button type="button" onClick={() => setPublishWarning('')} className="font-semibold text-sae-accentText shrink-0">
            Fechar
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="text-sm text-sae-danger mb-3">
          {actionError}
        </p>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin w-8 h-8 border-4 border-sae-accent border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sae-muted text-sm">Carregando publicações...</p>
        </div>
      ) : loadError && posts.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sae-danger text-sm mb-3">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => refresh(true)}>
            Tentar de novo
          </Button>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sae-text font-medium">Ainda não há publicações.</p>
          <p className="text-sae-muted text-sm mt-1">Seja o primeiro a compartilhar uma novidade.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.slice(0, visible).map((post) => {
            const isOwner = Boolean(userLogin) && post.login === userLogin;
            return (
              <Card key={post.id} className="p-5 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-sae-accentSoft text-sae-accentText flex items-center justify-center font-bold text-sm shrink-0">
                    {initials(post.author)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-sae-text">{post.author || 'Usuário'}</span>
                      <span className="text-xs text-sae-muted" title={post.date.toLocaleString('pt-BR')}>
                        {timeAgo(post.date)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant={CATEGORY_VARIANT[post.category] ?? 'secondary'}>{post.category || 'Geral'}</Badge>
                      {post.institution && <Badge variant="secondary">{post.institution}</Badge>}
                    </div>
                  </div>
                  {isOwner &&
                    (confirmingId === post.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" onClick={() => handleDelete(post.id)} disabled={deletingId === post.id}>
                          {deletingId === post.id ? 'Apagando...' : 'Apagar'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(post.id)}
                        className="p-2 text-sae-muted hover:text-sae-danger transition-colors shrink-0"
                        aria-label="Apagar publicação"
                        title="Apagar publicação"
                      >
                        <Trash2 size={18} />
                      </button>
                    ))}
                </div>

                <h3 className="text-lg font-heading font-bold text-sae-text mt-3">{post.title}</h3>
                <p className="text-sae-text mt-1 whitespace-pre-wrap break-words leading-relaxed">{linkify(post.message)}</p>
                <PostImages ids={post.images} author={post.author} />
                {post.link && (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-sae-accentText hover:text-sae-accentHover"
                  >
                    <ExternalLink size={16} /> Abrir link
                  </a>
                )}
              </Card>
            );
          })}

          {posts.length > visible && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setVisible(visible + PAGE_SIZE)}>
                Ver mais publicações
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
