import { HOME_SHEET_ID, cell, fetchSheet } from './sheets';
import { INSTITUTION_NAMES } from './institutions';
import { MAX_IMAGES } from './images';

// URL do aplicativo da Web do Apps Script (apps-script/feed.gs). Vazia = feed somente leitura.
export const FEED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2P2ZGLPm08fDsiSQcQ9Y-5NTTJNDq363jWvzrKp2zEiDD1nVTx7XRDtJTMzELId5X/exec';

export const FEED_CATEGORIES = ['Novo curso', 'Aviso', 'Geral'] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

export const FEED_LIMITS = { title: 120, message: 2000 } as const;
export { INSTITUTION_NAMES };
export { MAX_IMAGES };

// Imagens ficam no Drive (enviadas pelo Apps Script); a planilha guarda só os IDs dos arquivos.
export const imageUrl = (id: string, width = 1000): string => `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;

export interface FeedPost {
  id: string;
  date: Date;
  login: string;
  author: string;
  category: string;
  title: string;
  message: string;
  link: string;
  institution: string;
  images: string[];
}

export interface NewPostInput {
  category: FeedCategory;
  title: string;
  message: string;
  link: string;
  institution: string;
  images: string[];
}

// Colunas da aba Feed: id | data | login | autor | categoria | titulo | mensagem | link | instituicao | status | imagens
export const loadFeed = async (): Promise<FeedPost[]> => {
  if (!HOME_SHEET_ID) return [];
  const rows = await fetchSheet('Feed!A2:K', HOME_SHEET_ID);
  return rows
    .map((row) => ({
      id: cell(row, 0),
      date: new Date(cell(row, 1)),
      login: cell(row, 2),
      author: cell(row, 3),
      category: cell(row, 4),
      title: cell(row, 5),
      message: cell(row, 6),
      link: cell(row, 7),
      institution: cell(row, 8),
      status: cell(row, 9).toUpperCase(),
      images: cell(row, 10)
        .split(/[\s,]+/)
        .filter((id) => /^[\w-]{10,}$/.test(id))
        .slice(0, MAX_IMAGES),
    }))
    .filter((post) => post.id && (post.title || post.message) && post.status !== 'REMOVIDO' && !Number.isNaN(post.date.getTime()))
    .map(({ status, ...post }) => post)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
};

interface ScriptResult {
  ok?: boolean;
  error?: string;
  images?: number;
  data?: unknown;
  answer?: string;
  code?: string;
}

export const callScript = async (params: Record<string, string>): Promise<ScriptResult> => {
  if (!FEED_SCRIPT_URL) throw new Error('O envio de publicações ainda não foi configurado.');
  let result: ScriptResult | null = null;
  try {
    const response = await fetch(FEED_SCRIPT_URL, { method: 'POST', body: new URLSearchParams(params) });
    result = await response.json();
  } catch {
    throw new Error('Não foi possível falar com o servidor. Tente novamente.');
  }
  if (!result || result.ok !== true) {
    const failure = new Error(result?.error || 'O servidor recusou a operação.') as Error & { code?: string };
    failure.code = result?.code;
    throw failure;
  }
  return result;
};

// Devolve quantas imagens o servidor salvou (undefined = script desatualizado, que não informa isso).
export const createPost = async (input: NewPostInput, user: { login: string; name: string }): Promise<{ imagesSaved?: number }> => {
  const params: Record<string, string> = {
    action: 'create',
    login: user.login,
    author: user.name,
    category: input.category,
    title: input.title.trim(),
    message: input.message.trim(),
    link: input.link.trim(),
    institution: input.institution,
  };
  input.images.slice(0, MAX_IMAGES).forEach((dataUrl, index) => {
    params[`image${index}`] = dataUrl;
  });
  const result = await callScript(params);
  return { imagesSaved: result.images };
};

export const deletePost = async (id: string, login: string): Promise<void> => {
  await callScript({ action: 'delete', id, login });
};
