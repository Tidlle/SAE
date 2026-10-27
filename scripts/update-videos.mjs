// Atualiza a lista de vídeos das playlists do YouTube usadas na página "Conteúdo das aulas".
//
// Uso (na pasta do projeto):  npm run videos:update
//
// O script lê os `playlistId` de lib/videoLibrary.ts, abre a página pública de cada playlist (e o feed RSS, quando a página
// não traz os vídeos) e grava lib/videoPlaylists.generated.ts. Não usa chave de API. Playlists privadas não aparecem; as
// "não listadas" funcionam se você souber o endereço. Depois de rodar, publique o site de novo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libraryFile = path.join(root, 'lib', 'videoLibrary.ts');
const outputFile = path.join(root, 'lib', 'videoPlaylists.generated.ts');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const source = fs.readFileSync(libraryFile, 'utf8');
const ids = [...new Set([...source.matchAll(/playlistId:\s*'([\w-]+)'/g)].map((match) => match[1]))];
if (ids.length === 0) {
  console.error('Nenhum playlistId encontrado em lib/videoLibrary.ts.');
  process.exit(1);
}

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/​/g, '')
    .trim();

const get = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

// Página da playlist: os vídeos vêm em "lockupViewModel" (contentId de 11 caracteres = id do vídeo)
const fromPage = (html) => {
  const match = /ytInitialData\s*=\s*(\{.*?\});<\/script>/s.exec(html);
  if (!match) return { title: '', videos: [] };
  const data = JSON.parse(match[1]);
  const videos = [];
  const seen = new Set();
  let title = '';
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const lockup = node.lockupViewModel;
    if (lockup && typeof lockup.contentId === 'string' && lockup.contentId.length === 11 && !seen.has(lockup.contentId)) {
      seen.add(lockup.contentId);
      videos.push({ id: lockup.contentId, title: decode(lockup.metadata?.lockupMetadataViewModel?.title?.content ?? '') });
    }
    if (node.playlistMetadataRenderer?.title) title = node.playlistMetadataRenderer.title;
    Object.values(node).forEach(walk);
  };
  walk(data);
  return { title, videos };
};

// Feed RSS da playlist (até 15 vídeos): serve de reserva quando a página não traz a lista
const fromFeed = (xml) => ({
  title: decode(/<title>(.*?)<\/title>/s.exec(xml)?.[1] ?? ''),
  videos: [...xml.matchAll(/<entry>.*?<\/entry>/gs)].map((entry) => ({
    id: /<yt:videoId>(.*?)<\/yt:videoId>/.exec(entry[0])?.[1] ?? '',
    title: decode(/<title>(.*?)<\/title>/s.exec(entry[0])?.[1] ?? ''),
  })),
});

const playlists = {};
let failed = 0;
for (const id of ids) {
  try {
    let result = fromPage(await get(`https://www.youtube.com/playlist?list=${id}&hl=pt-BR&gl=BR`));
    let origin = 'página';
    if (result.videos.length === 0) {
      result = fromFeed(await get(`https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`));
      origin = 'feed RSS';
    }
    const videos = result.videos.filter((video) => video.id);
    if (videos.length === 0) throw new Error('nenhum vídeo encontrado (playlist privada ou vazia?)');
    playlists[id] = { title: result.title, videos };
    console.log(`OK   ${id.slice(0, 16).padEnd(16)} ${String(videos.length).padStart(3)} vídeos (${origin}) ${result.title}`);
  } catch (error) {
    failed += 1;
    console.log(`ERRO ${id.slice(0, 16).padEnd(16)} ${error.message}`);
  }
}

if (failed > 0 && fs.existsSync(outputFile)) {
  console.error(`\n${failed} playlist(s) falharam: o arquivo anterior foi mantido para não perder dados.`);
  process.exit(1);
}

const file = `// Gerado por scripts/update-videos.mjs (npm run videos:update). Não edite à mão: rode o comando para atualizar.
export interface SnapshotVideo {
  id: string;
  title: string;
}

export const PLAYLISTS_UPDATED_AT = '${new Date().toISOString()}';

export const PLAYLISTS: Record<string, { title: string; videos: SnapshotVideo[] }> = ${JSON.stringify(playlists, null, 2)};
`;
fs.writeFileSync(outputFile, file, 'utf8');
console.log(`\nGravado: ${path.relative(root, outputFile)} (${Object.keys(playlists).length} playlists).`);
