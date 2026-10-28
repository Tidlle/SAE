import { HOME_SHEET_ID, cell, fetchSheet } from './sheets';
import { callScript } from './feed';
import type { CompressOptions } from './images';

// Flyers: imagens de divulgação. O Administrativo adiciona e exclui; os demais perfis só baixam e compartilham.
// Ficam na aba `Flyers` da mesma planilha do feed; os arquivos ficam no Drive (enviados pelo Apps Script, apps-script/feed.gs).

export const FLYER_LIMITS = { title: 80 } as const;
// Flyers mantêm mais qualidade que as imagens do feed (lado maior de 2000px, até 1,8 MB)
export const FLYER_IMAGE: CompressOptions = { maxSide: 2000, maxBytes: 1800 * 1024 };

export interface Flyer {
  id: string;
  date: Date;
  login: string;
  author: string;
  title: string;
  image: string; // ID do arquivo no Drive
}

// Colunas da aba Flyers: id | data | login | autor | titulo | imagem | status
export const loadFlyers = async (): Promise<Flyer[]> => {
  if (!HOME_SHEET_ID) return [];
  const rows = await fetchSheet('Flyers!A2:G', HOME_SHEET_ID);
  return rows
    .map((row) => ({
      id: cell(row, 0),
      date: new Date(cell(row, 1)),
      login: cell(row, 2),
      author: cell(row, 3),
      title: cell(row, 4),
      image: cell(row, 5),
      status: cell(row, 6).toUpperCase(),
    }))
    .filter((flyer) => flyer.id && /^[\w-]{10,}$/.test(flyer.image) && flyer.status !== 'REMOVIDO')
    .map(({ status, ...flyer }) => flyer)
    .sort((a, b) => (b.date.getTime() || 0) - (a.date.getTime() || 0));
};

export const createFlyer = async (title: string, imageDataUrl: string, user: { login: string; name: string }): Promise<void> => {
  await callScript({ action: 'createFlyer', login: user.login, author: user.name, title: title.trim(), image0: imageDataUrl });
};

export const deleteFlyer = async (id: string, login: string): Promise<void> => {
  await callScript({ action: 'deleteFlyer', id, login });
};

// Endereços para exibir a imagem, do mais direto ao último recurso. O googleusercontent entrega o arquivo sem
// redirecionamento nem depender do login do Google no navegador (o endereço de miniatura do Drive depende dos dois);
// por isso vem primeiro, e a página tenta o seguinte quando um falha. O mesmo endereço libera CORS, o que permite baixar
// e compartilhar o arquivo pelo próprio site; o link do Drive abre a imagem em outra aba.
export const flyerImageSources = (flyer: Flyer, width = 600): string[] => [
  `https://lh3.googleusercontent.com/d/${flyer.image}=w${width}`,
  `https://drive.google.com/thumbnail?id=${flyer.image}&sz=w${width}`,
  `https://lh3.googleusercontent.com/d/${flyer.image}=s0`,
];
const originalUrl = (flyer: Flyer): string => `https://lh3.googleusercontent.com/d/${flyer.image}=s0`;
export const flyerLink = (flyer: Flyer): string => `https://drive.google.com/file/d/${flyer.image}/view`;

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const fetchOriginal = async (flyer: Flyer): Promise<File> => {
  const response = await fetch(originalUrl(flyer), { referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const type = EXTENSIONS[blob.type] ? blob.type : 'image/jpeg';
  const base =
    flyer.title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'flyer';
  return new File([blob], `${base}.${EXTENSIONS[type]}`, { type });
};

// Baixa o arquivo original. Se o navegador não deixar buscar a imagem, abre o link do Drive.
export const downloadFlyer = async (flyer: Flyer): Promise<'downloaded' | 'opened'> => {
  try {
    const file = await fetchOriginal(flyer);
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  } catch {
    window.open(flyerLink(flyer), '_blank', 'noopener,noreferrer');
    return 'opened';
  }
};

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

// Compartilha a imagem pelo menu do aparelho (WhatsApp, e-mail...). Sem suporte a arquivos, compartilha o link;
// sem compartilhamento nenhum (alguns computadores), copia o link.
export const shareFlyer = async (flyer: Flyer): Promise<ShareOutcome> => {
  try {
    if (typeof navigator.share === 'function') {
      try {
        const file = await fetchOriginal(flyer);
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: flyer.title });
          return 'shared';
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
      await navigator.share({ title: flyer.title, url: flyerLink(flyer) });
      return 'shared';
    }
    await navigator.clipboard.writeText(flyerLink(flyer));
    return 'copied';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
};
