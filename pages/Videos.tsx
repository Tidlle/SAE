import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Instagram, Play, Plus, Search, Trash2, Video as VideoIcon } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Breadcrumb, Button, Card, SectionTitle } from '../components/UI';
import { CopyLinkButton, PlayerItem, VideoPlayerModal } from '../components/videos/VideoViewer';
import { VIDEO_GROUPS, VideoGroup, VideoSection, groupByKey, playlistUrl, sectionVideos } from '../lib/videoLibrary';
import { embedUrl, instagramEmbedUrl, instagramPostUrl, instagramThumbnailUrl, thumbnailUrl, watchUrl } from '../lib/videos';
import { foldText } from '../lib/courses';
import { useLivePlaylists } from '../lib/videoLive';
import { INSTAGRAM_OTHERS, LiveInstagram, deleteInstagramItem, instagramCode, instagramCoverUrl, useLiveInstagram } from '../lib/instagramLive';
import { can } from '../lib/permissions';
import { InstagramAddDialog } from '../components/videos/InstagramAddDialog';

const PREVIEW = 6; // vídeos mostrados por seção antes de "Mostrar todos"
const SEARCH_FROM = 8; // a busca só aparece quando a página tem mais vídeos que isso

interface Entry {
  key: string;
  title: string;
  thumbnail?: string; // miniatura do YouTube ou capa salva do Instagram
  external?: boolean; // não abre no player: o botão leva direto ao Instagram
  liveId?: string; // vídeo adicionado pelo site (aba Instagram): o Administrativo pode remover
  item: PlayerItem;
}

// Itens de uma seção (YouTube ou Instagram) já no formato do player. Links do Instagram inválidos ficam de fora.
const entriesOf = (group: VideoGroup, section: VideoSection, live: LiveInstagram[] = []): Entry[] => {
  if (group.kind === 'instagram') {
    // Os adicionados pelo site vêm primeiro (os mais novos no topo); os do código, depois
    const added = live.flatMap((post): Entry[] => {
      const embedSrc = instagramEmbedUrl(post.url);
      if (!embedSrc) return [];
      const title = post.title || 'Conteúdo do Instagram';
      return [{ key: `live-${post.id}`, title, thumbnail: post.cover ? instagramCoverUrl(post.cover) : undefined, external: post.noPlayer, liveId: post.id, item: { title, embedSrc, url: post.url, platform: 'instagram' as const } }];
    });
    // Os posts que não abrem no player (semPlayer) vão para o fim da seção
    const entries = (section.instagram ?? []).flatMap((post, index) => {
      const embedSrc = instagramEmbedUrl(post.url);
      if (!embedSrc) return [];
      const title = post.title?.trim() || `Conteúdo ${index + 1}`;
      return [{ key: post.url, title, thumbnail: instagramThumbnailUrl(post.url) || undefined, external: post.semPlayer, item: { title, embedSrc, url: instagramPostUrl(post.url), platform: 'instagram' as const } }];
    });
    const all = [...added, ...entries];
    return [...all.filter((entry) => !entry.external), ...all.filter((entry) => entry.external)];
  }
  return sectionVideos(section).map((video) => ({
    key: video.id,
    title: video.title,
    thumbnail: thumbnailUrl(video.id),
    item: { title: video.title, embedSrc: embedUrl(video.id), url: watchUrl(video.id), platform: 'youtube' as const },
  }));
};

const GroupTabs: React.FC<{ active: VideoGroup['key'] }> = ({ active }) => (
  <nav aria-label="Tipos de vídeo" className="flex flex-wrap gap-2 mb-8">
    {VIDEO_GROUPS.map((group) => (
      <Link
        key={group.key}
        to={group.path}
        aria-current={group.key === active ? 'page' : undefined}
        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
          group.key === active ? 'bg-sae-accent text-white border-sae-accent' : 'bg-sae-card text-sae-text border-sae-border hover:border-sae-accent'
        }`}
      >
        {group.navLabel}
      </Link>
    ))}
  </nav>
);

const VideoCard: React.FC<{ entry: Entry; onPlay: (item: PlayerItem) => void; onRemove?: (entry: Entry) => void }> = ({ entry, onPlay, onRemove }) => {
  const instagram = entry.item.platform === 'instagram';
  const open = () => {
    if (entry.external) window.open(entry.item.url, '_blank', 'noopener,noreferrer');
    else onPlay(entry.item);
  };
  return (
    <Card className="group flex flex-col overflow-hidden hover:border-sae-accent/50 transition-all duration-300">
      <button
        type="button"
        onClick={open}
        aria-label={`${entry.external ? 'Abrir no Instagram' : 'Assistir'}: ${entry.title}`}
        className="relative block w-full aspect-video overflow-hidden bg-sae-soft shrink-0"
      >
        {entry.thumbnail ? (
          <img src={entry.thumbnail} alt="" loading="lazy" className={`w-full h-full object-cover ${instagram ? 'object-[50%_30%]' : ''} transform group-hover:scale-105 transition-transform duration-500`} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sae-accent/25 via-sae-accentSoft to-sae-accent/10 text-sae-accentText">
            <Instagram size={44} />
          </span>
        )}
        <span className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span className="w-12 h-12 bg-sae-accent/90 rounded-full flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform">
            <Play size={20} fill="currentColor" className="ml-1" />
          </span>
        </span>
      </button>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-sae-text mb-4 leading-snug break-words">{entry.title}</h3>
        <div className="flex gap-2 mt-auto">
          <Button size="sm" className="flex-1 text-xs" onClick={open}>
            {entry.external ? <ExternalLink size={14} className="mr-1.5" /> : <Play size={14} fill="currentColor" className="mr-1.5" />}
            {entry.external ? 'Abrir no Instagram' : instagram ? 'Ver aqui' : 'Assistir agora'}
          </Button>
          <CopyLinkButton url={entry.item.url} />
          {onRemove && entry.liveId && (
            <button
              type="button"
              onClick={() => onRemove(entry)}
              aria-label={`Remover: ${entry.title}`}
              title="Remover este vídeo"
              className="px-3 rounded-full border border-sae-border text-sae-muted hover:text-sae-danger hover:border-sae-danger transition-colors"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

// Página de uma das três bibliotecas: cada seção é um tema.
const VideoLibraryPage: React.FC<{ groupKey: VideoGroup['key'] }> = ({ groupKey }) => {
  const group = groupByKey(groupKey);
  const [playing, setPlaying] = useState<PlayerItem | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const closePlayer = useCallback(() => setPlaying(null), []);
  const liveVersion = useLivePlaylists(); // muda quando chegam vídeos novos do YouTube
  const { items: liveInstagram, reload: reloadInstagram } = useLiveInstagram();
  const mayManage = group.kind === 'instagram' && can('manageVideos');
  const [adding, setAdding] = useState(false);

  // Temas do código mais "Outros conteúdos" (que só existe quando há vídeo adicionado que não é de nenhum tema)
  const sections = useMemo(() => {
    const base = group.sections;
    const knownIds = new Set(base.map((section) => section.id));
    const hasOthers = group.kind === 'instagram' && liveInstagram.some((post) => !knownIds.has(post.section));
    const all = hasOthers ? [...base, { id: INSTAGRAM_OTHERS, title: 'Outros conteúdos' } as VideoSection] : base;
    return all.map((section) => ({
      section,
      entries: entriesOf(group, section, group.kind === 'instagram' ? liveInstagram.filter((post) => (section.id === INSTAGRAM_OTHERS ? !knownIds.has(post.section) : post.section === section.id)) : []),
    }));
  }, [group, liveVersion, liveInstagram]);

  // Posts que já estão no site (do código e adicionados), para não repetir
  const knownCodes = useMemo(() => {
    const codes = new Set<string>();
    group.sections.forEach((section) => (section.instagram ?? []).forEach((post) => codes.add(instagramCode(post.url))));
    liveInstagram.forEach((post) => codes.add(instagramCode(post.url)));
    return codes;
  }, [group, liveInstagram]);

  const removeLive = async (entry: Entry) => {
    if (!entry.liveId || !window.confirm(`Remover "${entry.title}" do site?`)) return;
    try {
      await deleteInstagramItem(entry.liveId, localStorage.getItem('userLogin') ?? '');
      await reloadInstagram();
    } catch (problem) {
      window.alert(problem instanceof Error ? problem.message : 'Não foi possível remover agora.');
    }
  };
  const total = sections.reduce((sum, item) => sum + item.entries.length, 0);
  const term = foldText(search).trim();
  const visible = sections
    .map((item) => ({ ...item, shown: term ? item.entries.filter((entry) => foldText(`${entry.title} ${item.section.title}`).includes(term)) : item.entries }))
    .filter((item) => item.shown.length > 0 || (!term && item.entries.length === 0));

  const jumpTo = (id: string) => document.getElementById(`secao-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Conteúdos', path: '#' }, { label: group.navLabel }]} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title={group.title} />
          {mayManage && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={16} className="mr-1.5" /> Adicionar vídeo do Instagram
            </Button>
          )}
        </div>
        <GroupTabs active={group.key} />

        {sections.length === 0 ? (
          <Card className="p-10 text-center">
            <VideoIcon size={40} className="mx-auto mb-3 text-sae-muted opacity-60" />
            <h2 className="text-lg font-heading font-bold text-sae-text">Em breve</h2>
            <p className="text-sae-muted mt-1 max-w-md mx-auto">Os conteúdos desta página ainda estão sendo organizados por tema. Volte em breve.</p>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0" aria-label="Ir para o tema">
                {sections.map(({ section, entries }) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpTo(section.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-sae-border bg-sae-card text-sae-text hover:border-sae-accent hover:text-sae-accentText transition-colors"
                  >
                    {section.title} <span className="text-sae-muted font-normal">({entries.length})</span>
                  </button>
                ))}
              </div>
              {total > SEARCH_FROM && (
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sae-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar vídeo"
                    aria-label="Buscar vídeo"
                    className="w-full bg-sae-darker border border-sae-border rounded-lg pl-9 pr-3 py-2 text-sm text-sae-text placeholder:text-sae-muted focus:border-sae-accent outline-none"
                  />
                </div>
              )}
            </div>

            {visible.length === 0 && <p className="text-sae-muted py-8 text-center">Nenhum vídeo encontrado para essa busca.</p>}

            <div className="space-y-14">
              {visible.map(({ section, entries, shown }) => {
                const open = Boolean(term) || expanded[section.id];
                const list = open ? shown : shown.slice(0, PREVIEW);
                return (
                  <section key={section.id} id={`secao-${section.id}`} aria-labelledby={`titulo-${section.id}`} className="scroll-mt-28">
                    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 mb-5 border-b border-sae-border pb-3">
                      <div className="min-w-0">
                        <h2 id={`titulo-${section.id}`} className="text-2xl font-heading font-bold text-sae-text">
                          {section.title} <span className="text-base font-semibold text-sae-muted">({entries.length})</span>
                        </h2>
                        {section.description && <p className="text-sm text-sae-muted mt-1">{section.description}</p>}
                      </div>
                      {section.playlistId && (
                        <a href={playlistUrl(section.playlistId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sae-accentText hover:text-sae-accentHover">
                          <ExternalLink size={15} /> Ver playlist completa no YouTube
                        </a>
                      )}
                    </div>

                    {entries.length === 0 ? (
                      <p className="text-sm text-sae-muted">Os vídeos deste tema estão na playlist do YouTube.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {list.map((entry) => (
                            <VideoCard key={entry.key} entry={entry} onPlay={setPlaying} onRemove={mayManage ? removeLive : undefined} />
                          ))}
                        </div>
                        {!term && shown.length > PREVIEW && (
                          <div className="mt-6 text-center">
                            <Button variant="outline" size="sm" onClick={() => setExpanded((current) => ({ ...current, [section.id]: !current[section.id] }))}>
                              {open ? 'Mostrar menos' : `Mostrar todos (${shown.length})`}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>

      <VideoPlayerModal item={playing} onClose={closePlayer} />
      {mayManage && (
        <InstagramAddDialog
          open={adding}
          sections={[...group.sections.map((section) => ({ id: section.id, title: section.title })), { id: INSTAGRAM_OTHERS, title: 'Outros conteúdos' }]}
          knownCodes={knownCodes}
          onClose={() => setAdding(false)}
          onAdded={() => void reloadInstagram()}
        />
      )}
    </Layout>
  );
};

export const VideoTutorials: React.FC = () => <VideoLibraryPage groupKey="tutoriais" />;
export const VideoLessons: React.FC = () => <VideoLibraryPage groupKey="aulas" />;
export const VideoInstagram: React.FC = () => <VideoLibraryPage groupKey="instagram" />;
