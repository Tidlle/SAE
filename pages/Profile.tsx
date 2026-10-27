import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, History, LogOut, Mail, Megaphone, Phone, ShieldCheck, Trash2, User, XCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Badge, Breadcrumb, Button, Card } from '../components/UI';
import { HOME_SHEET_ID, fetchSheetRanges } from '../lib/sheets';
import { FEED_SCRIPT_URL, FeedPost, deletePost, loadFeed } from '../lib/feed';
import { Permission, can, getCurrentRole, parseRole } from '../lib/permissions';
import { RecentCourse, clearRecents, loadRecents } from '../lib/recentCourses';
import { clearSession } from '../lib/session';
import { initials, timeAgo } from '../lib/text';

interface Account {
  email: string;
  phone: string;
  funcao: string;
  cnpj: string;
  sheetRole: string;
}

const PERMISSIONS: { permission: Permission | null; label: string }[] = [
  { permission: null, label: 'Consultar cursos, combos, simulador, contatos e vídeos' },
  { permission: 'postFeed', label: 'Publicar no feed' },
  { permission: 'createNotice', label: 'Criar avisos' },
  { permission: 'deleteNotice', label: 'Apagar avisos' },
  { permission: 'createUser', label: 'Criar novos usuários' },
];

const PAGE_SIZE = 5;

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
    <span className="mt-0.5 text-sae-accentText shrink-0">{icon}</span>
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-sae-muted">{label}</div>
      <div className="text-sae-text break-words">{value || '—'}</div>
    </div>
  </div>
);

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const name = localStorage.getItem('userNome') ?? '';
  const login = localStorage.getItem('userLogin') ?? '';
  const role = getCurrentRole();

  const [account, setAccount] = useState<Account | null>(null);
  const [accountState, setAccountState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsState, setPostsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const [recents, setRecents] = useState<RecentCourse[]>(loadRecents);

  // Só as colunas sem dados sensíveis: A-D (nome, usuário, e-mail, telefone) e K-M (função, CNPJ, perfil).
  useEffect(() => {
    let active = true;
    if (!login) {
      setAccountState('failed');
      return;
    }
    fetchSheetRanges(['Cadastros!A:D', 'Cadastros!K:M'])
      .then(([basics, extras]) => {
        if (!active) return;
        const index = basics.findIndex((row, i) => i > 0 && (row[1] ?? '').trim() === login);
        if (index === -1) throw new Error('Cadastro não encontrado');
        const base = basics[index] ?? [];
        const more = extras[index] ?? [];
        setAccount({
          email: (base[2] ?? '').trim(),
          phone: (base[3] ?? '').trim(),
          funcao: (more[0] ?? '').trim(),
          cnpj: (more[1] ?? '').trim(),
          sheetRole: (more[2] ?? '').trim(),
        });
        setAccountState('ready');
      })
      .catch(() => active && setAccountState('failed'));
    return () => {
      active = false;
    };
  }, [login]);

  const refreshPosts = useCallback(async () => {
    try {
      const all = await loadFeed();
      setPosts(all.filter((post) => login && post.login === login));
      setPostsState('ready');
    } catch {
      setPostsState('failed');
    }
  }, [login]);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError('');
    try {
      await deletePost(id, login);
      setConfirmingId(null);
      await refreshPosts();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível apagar a publicação.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const roleChanged = account !== null && parseRole(account.sheetRole) !== role;

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12 space-y-8">
        <Breadcrumb items={[{ label: 'Meu perfil' }]} />

        {/* 1. Cabeçalho */}
        <Card className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5 min-w-0">
              <div className="w-20 h-20 rounded-full bg-sae-accent text-white flex items-center justify-center text-2xl font-heading font-bold shrink-0">
                {name ? initials(name) : <User size={32} />}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-sae-text break-words">{name || 'Visitante'}</h1>
                {login && <p className="text-sae-muted">@{login}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {account?.funcao && <Badge variant="secondary">{account.funcao}</Badge>}
                  <Badge variant="primary">Perfil {role}</Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut size={18} className="mr-2" /> Sair
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="space-y-8">
            {/* 2. Dados da conta */}
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold text-sae-text mb-4">Dados da conta</h2>
              {accountState === 'loading' && (
                <div className="py-4 flex justify-center">
                  <div className="animate-spin w-6 h-6 border-4 border-sae-accent border-t-transparent rounded-full"></div>
                </div>
              )}
              {accountState === 'failed' && (
                <p className="text-sm text-sae-muted mb-4">
                  {login ? 'Não foi possível carregar os dados do seu cadastro agora.' : 'Entre novamente no SAE para ver os dados da sua conta.'}
                </p>
              )}
              <div className="divide-y divide-sae-border">
                <InfoRow icon={<User size={18} />} label="Usuário (login)" value={login} />
                {accountState === 'ready' && account && (
                  <>
                    <InfoRow icon={<Mail size={18} />} label="E-mail" value={account.email} />
                    <InfoRow icon={<Phone size={18} />} label="Telefone" value={account.phone} />
                    {account.cnpj && <InfoRow icon={<Building2 size={18} />} label="CNPJ" value={account.cnpj} />}
                  </>
                )}
              </div>
            </Card>

            {/* 4. O que meu perfil pode fazer */}
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold text-sae-text mb-1 flex items-center gap-2">
                <ShieldCheck size={20} className="text-sae-accentText" /> O que meu perfil pode fazer
              </h2>
              <p className="text-sm text-sae-muted mb-4">Perfil {role}</p>
              <ul className="space-y-2">
                {PERMISSIONS.map(({ permission, label }) => {
                  const allowed = permission === null || can(permission, role);
                  return (
                    <li key={label} className="flex items-start gap-2 text-sm">
                      {allowed ? (
                        <CheckCircle2 size={18} className="text-sae-success shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={18} className="text-sae-muted shrink-0 mt-0.5" />
                      )}
                      <span className={allowed ? 'text-sae-text' : 'text-sae-muted'}>
                        {label}
                        {!allowed && <span className="sr-only"> (não permitido)</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {roleChanged && (
                <p role="status" className="mt-4 text-sm text-sae-text bg-sae-accentSoft rounded-lg p-3">
                  Seu perfil foi alterado na planilha. Saia e entre de novo para aplicar a mudança.
                </p>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* 5. Minhas publicações */}
            <section aria-labelledby="my-posts-title">
              <div className="flex items-center justify-between mb-3">
                <h2 id="my-posts-title" className="text-lg font-heading font-bold text-sae-text flex items-center gap-2">
                  <Megaphone size={20} className="text-sae-accentText" /> Minhas publicações no feed
                </h2>
                <Link to="/" className="text-sm font-semibold text-sae-accentText hover:text-sae-accentHover">
                  Ir para o feed
                </Link>
              </div>

              {deleteError && (
                <p role="alert" className="text-sm text-sae-danger mb-3">
                  {deleteError}
                </p>
              )}

              {!HOME_SHEET_ID ? (
                <Card className="p-6 text-sm text-sae-muted">O feed ainda não foi configurado.</Card>
              ) : postsState === 'loading' ? (
                <div className="py-8 flex justify-center">
                  <div className="animate-spin w-6 h-6 border-4 border-sae-accent border-t-transparent rounded-full"></div>
                </div>
              ) : postsState === 'failed' ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-sae-danger mb-3">Não foi possível carregar suas publicações agora.</p>
                  <Button variant="outline" size="sm" onClick={refreshPosts}>
                    Tentar de novo
                  </Button>
                </Card>
              ) : posts.length === 0 ? (
                <Card className="p-6 text-sm text-sae-muted">Você ainda não publicou nada no feed.</Card>
              ) : (
                <div className="space-y-3">
                  {posts.slice(0, visible).map((post) => (
                    <Card key={post.id} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant={post.category === 'Novo curso' ? 'primary' : post.category === 'Aviso' ? 'warning' : 'secondary'}>
                              {post.category || 'Geral'}
                            </Badge>
                            {post.institution && <Badge variant="secondary">{post.institution}</Badge>}
                            <span className="text-xs text-sae-muted" title={post.date.toLocaleString('pt-BR')}>
                              {timeAgo(post.date)}
                            </span>
                          </div>
                          <h3 className="font-heading font-bold text-sae-text break-words">{post.title}</h3>
                          <p className="text-sm text-sae-muted mt-1 line-clamp-2 break-words">{post.message}</p>
                          {post.images.length > 0 && (
                            <p className="text-xs text-sae-muted mt-1">
                              {post.images.length} {post.images.length === 1 ? 'imagem' : 'imagens'}
                            </p>
                          )}
                        </div>
                        {FEED_SCRIPT_URL &&
                          (confirmingId === post.id ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button size="sm" onClick={() => handleDelete(post.id)} disabled={deletingId === post.id}>
                                {deletingId === post.id ? 'Apagando...' : 'Apagar'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)} disabled={deletingId === post.id}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingId(post.id)}
                              className="p-2 text-sae-muted hover:text-sae-danger transition-colors shrink-0"
                              aria-label={`Apagar a publicação ${post.title}`}
                              title="Apagar publicação"
                            >
                              <Trash2 size={18} />
                            </button>
                          ))}
                      </div>
                    </Card>
                  ))}
                  {posts.length > visible && (
                    <div className="text-center">
                      <Button variant="outline" size="sm" onClick={() => setVisible(visible + PAGE_SIZE)}>
                        Ver mais ({posts.length - visible} restantes)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 6. Cursos consultados recentemente */}
            <section aria-labelledby="my-recents-title">
              <div className="flex items-center justify-between mb-3">
                <h2 id="my-recents-title" className="text-lg font-heading font-bold text-sae-text flex items-center gap-2">
                  <History size={20} className="text-sae-accentText" /> Cursos consultados recentemente
                </h2>
                {recents.length > 0 && (
                  <button type="button" onClick={() => setRecents(clearRecents())} className="text-sm text-sae-muted hover:text-sae-accentText transition-colors">
                    Limpar lista
                  </button>
                )}
              </div>
              {recents.length === 0 ? (
                <Card className="p-6 text-sm text-sae-muted">
                  Os cursos que você abrir na{' '}
                  <Link to="/cursos/info" className="font-semibold text-sae-accentText hover:text-sae-accentHover">
                    consulta de cursos
                  </Link>{' '}
                  aparecem aqui.
                </Card>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recents.map((course) => (
                    <Link
                      key={`${course.name}|${course.ies}`}
                      to={`/cursos/info?curso=${encodeURIComponent(course.name)}${course.ies ? `&ies=${encodeURIComponent(course.ies)}` : ''}`}
                      className="max-w-full flex items-center gap-2 px-3 py-2 rounded-full border border-sae-border bg-sae-card text-sm text-sae-text hover:border-sae-accent transition-colors"
                    >
                      <span className="truncate">{course.name}</span>
                      {course.ies && <Badge variant="primary">{course.ies}</Badge>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};
