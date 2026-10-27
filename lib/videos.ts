// Endereços de vídeos do YouTube e do Instagram. A lista de vídeos fica em lib/videoLibrary.ts.
import { INSTAGRAM_THUMBS } from './instagramThumbs.generated';

export const watchUrl = (id: string): string => `https://youtu.be/${id}`;
export const thumbnailUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const embedUrl = (id: string): string => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

// Post ou reel do Instagram: devolve o endereço de incorporação, ou '' se o link não for de um post do Instagram.
export const instagramEmbedUrl = (url: string): string => {
  const match = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/i.exec(url.trim());
  if (!match) return '';
  const kind = match[1].toLowerCase().startsWith('reel') ? 'reel' : match[1].toLowerCase();
  return `https://www.instagram.com/${kind}/${match[2]}/embed/`;
};

// Endereço limpo do post (sem parâmetros de rastreamento)
export const instagramPostUrl = (url: string): string => {
  const embed = instagramEmbedUrl(url);
  return embed ? embed.replace(/embed\/$/, '') : '';
};

// Capa salva em public/instagram (gerada por `npm run instagram:update`); '' se o post não tem capa.
export const instagramThumbnailUrl = (url: string): string => {
  const code = /instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/i.exec(url)?.[1];
  return code && INSTAGRAM_THUMBS.includes(code) ? `${import.meta.env.BASE_URL}instagram/${code}.jpg` : '';
};
