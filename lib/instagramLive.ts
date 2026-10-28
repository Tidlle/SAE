import { useCallback, useEffect, useState } from 'react';
import { HOME_SHEET_ID, cell, fetchSheet } from './sheets';
import { callScript } from './feed';
import { instagramPostUrl } from './videos';

// Vídeos do Instagram adicionados pelo próprio site (Vídeos > Conteúdos do Instagram). Os que já vêm no código ficam em
// lib/videoLibrary.ts; estes ficam na aba `Instagram` da planilha da Home e são lidos a cada visita, então aparecem sem publicar o site.
// Só o Administrativo adiciona e exclui (Apps Script, apps-script/feed.gs). As capas ficam no Drive, salvas pelo Apps Script.

export const INSTAGRAM_OTHERS = 'outros'; // tema para o que não é de nenhuma seção do código
export const INSTAGRAM_ADD_LIMIT = 10; // links por vez (o Apps Script confere o mesmo limite)

export interface LiveInstagram {
  id: string;
  date: Date;
  author: string;
  url: string;
  title: string;
  section: string;
  cover: string; // ID do arquivo da capa no Drive, ou ''
  noPlayer: boolean; // o Instagram não deixa incorporar: o botão abre direto no Instagram
}

// Colunas da aba Instagram: id | data | login | autor | url | titulo | secao | capa | status | sem_player
export const loadLiveInstagram = async (): Promise<LiveInstagram[]> => {
  if (!HOME_SHEET_ID) return [];
  try {
    const rows = await fetchSheet('Instagram!A2:J', HOME_SHEET_ID);
    return rows
      .map((row) => ({
        id: cell(row, 0),
        date: new Date(cell(row, 1)),
        author: cell(row, 3),
        url: instagramPostUrl(cell(row, 4)),
        title: cell(row, 5),
        section: cell(row, 6) || INSTAGRAM_OTHERS,
        cover: /^[\w-]{10,}$/.test(cell(row, 7)) ? cell(row, 7) : '',
        status: cell(row, 8).toUpperCase(),
        noPlayer: cell(row, 9).toUpperCase() === 'SIM',
      }))
      .filter((item) => item.id && item.url && item.status !== 'REMOVIDO')
      .map(({ status, ...item }) => item)
      .sort((a, b) => (b.date.getTime() || 0) - (a.date.getTime() || 0));
  } catch {
    return []; // a aba só existe depois do primeiro link adicionado
  }
};

export const instagramCoverUrl = (cover: string, width = 600): string => `https://lh3.googleusercontent.com/d/${cover}=w${width}`;

// Código do post (a parte que identifica o reel), para saber se o link já está no site
export const instagramCode = (url: string): string => /instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/i.exec(url)?.[1] ?? '';

export type AddStatus = 'added' | 'duplicate' | 'invalid' | 'error';

export interface AddResult {
  url: string;
  status: AddStatus;
  cover?: boolean;
  noPlayer?: boolean;
}

export interface AddInput {
  urls: string[];
  section: string;
  title: string;
  noPlayer: boolean;
}

const STATUSES: AddStatus[] = ['added', 'duplicate', 'invalid', 'error'];

export const addInstagramLinks = async (input: AddInput, user: { login: string; name: string }): Promise<AddResult[]> => {
  const result = await callScript({
    action: 'addInstagram',
    login: user.login,
    author: user.name,
    urls: input.urls.join('\n'),
    section: input.section,
    title: input.title.trim(),
    noPlayer: input.noPlayer ? '1' : '',
  });
  const raw = (result as { results?: unknown }).results;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { url: string; status: AddStatus; cover?: boolean; noPlayer?: boolean } => Boolean(item) && typeof item.url === 'string' && STATUSES.includes(item.status))
    .map((item) => ({ url: item.url, status: item.status, cover: item.cover === true, noPlayer: item.noPlayer === true }));
};

export const deleteInstagramItem = async (id: string, login: string): Promise<void> => {
  await callScript({ action: 'deleteInstagram', id, login });
};

// Lista lida da planilha. `reload` busca de novo (depois de adicionar ou excluir).
let cached: LiveInstagram[] = [];

export const useLiveInstagram = () => {
  const [items, setItems] = useState<LiveInstagram[]>(cached);
  const reload = useCallback(async () => {
    const next = await loadLiveInstagram();
    cached = next;
    setItems(next);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { items, reload };
};

