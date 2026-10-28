import { useEffect, useState } from 'react';
import { callScript } from './feed';
import { LivePlaylist, playlistIds, setLivePlaylists } from './videoLibrary';

// Vídeos novos das playlists do YouTube sem republicar o site: ao abrir uma página de vídeos, o SAE pede ao Apps Script (ação
// youtubePlaylists) os vídeos mais recentes de cada playlist e junta com a lista que já está no código (videoLibrary.ts).
// Se o servidor não responder, a página continua com a lista do código.

const REFRESH_MS = 10 * 60 * 1000; // o Apps Script também guarda o resultado por alguns minutos
let lastFetch = 0;
let inflight: Promise<boolean> | null = null;

// Só aceita o formato esperado e só as playlists que o SAE usa (o que vem do servidor nunca vira outra coisa na tela)
const cleanPlaylists = (raw: unknown): Record<string, LivePlaylist> => {
  const source = (raw && typeof raw === 'object' ? (raw as { playlists?: unknown }).playlists : null) as Record<string, unknown> | null;
  const result: Record<string, LivePlaylist> = {};
  if (!source || typeof source !== 'object') return result;
  const allowed = new Set(playlistIds());
  Object.entries(source).forEach(([id, value]) => {
    const entry = value as { videos?: unknown; complete?: unknown };
    if (!allowed.has(id) || !entry || !Array.isArray(entry.videos)) return;
    const videos = entry.videos
      .filter((video): video is { id: string; title?: string } => Boolean(video) && typeof (video as { id?: unknown }).id === 'string' && /^[\w-]{6,20}$/.test((video as { id: string }).id))
      .map((video) => ({ id: video.id, title: typeof video.title === 'string' ? video.title.slice(0, 200) : '' }));
    if (videos.length > 0) result[id] = { videos, complete: entry.complete === true };
  });
  return result;
};

// Busca os vídeos mais recentes. Devolve true quando chegou algo novo para mostrar.
export const refreshLivePlaylists = (): Promise<boolean> => {
  if (inflight) return inflight;
  if (Date.now() - lastFetch < REFRESH_MS) return Promise.resolve(false);
  inflight = callScript({ action: 'youtubePlaylists', login: localStorage.getItem('userLogin') ?? '', ids: playlistIds().join(',') })
    .then((result) => {
      const playlists = cleanPlaylists(result.data);
      lastFetch = Date.now();
      if (Object.keys(playlists).length === 0) return false;
      setLivePlaylists(playlists);
      return true;
    })
    .catch(() => false) // sem resposta do servidor: fica a lista do código
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

// Dispara a busca ao abrir a página; o número muda quando chegam vídeos, para a página se desenhar de novo.
export const useLivePlaylists = (): number => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    refreshLivePlaylists().then((changed) => {
      if (active && changed) setVersion((current) => current + 1);
    });
    return () => {
      active = false;
    };
  }, []);
  return version;
};
