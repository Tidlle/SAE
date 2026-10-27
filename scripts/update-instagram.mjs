// Baixa as capas dos reels e posts do Instagram usados na página "Conteúdos do Instagram".
//
// Uso (na pasta do projeto):  npm run instagram:update
//
// O script lê os links de lib/videoLibrary.ts, pergunta ao Instagram (oEmbed) pela capa de cada post, salva a imagem em
// public/instagram/<código>.jpg e grava a lista em lib/instagramThumbs.generated.ts. Os links de capa do Instagram expiram,
// por isso a imagem é copiada para o próprio site. Posts que o Instagram bloqueia (sem capa) ficam com um ícone no card.
// Rode de novo quando incluir posts novos e publique o site (a pasta dist/instagram precisa subir junto).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libraryFile = path.join(root, 'lib', 'videoLibrary.ts');
const imagesDir = path.join(root, 'public', 'instagram');
const outputFile = path.join(root, 'lib', 'instagramThumbs.generated.ts');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Só os links reais (comentários com exemplos ficam de fora; o "//" de "https://" não conta como comentário)
const source = fs
  .readFileSync(libraryFile, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
  .join('\n');
const posts = [...new Set([...source.matchAll(/instagram\.com\/(reels?|p|tv)\/([\w-]+)/gi)].map((match) => `${match[1].toLowerCase().startsWith('reel') ? 'reel' : match[1].toLowerCase()}/${match[2]}`))];
if (posts.length === 0) {
  console.error('Nenhum link do Instagram encontrado em lib/videoLibrary.ts.');
  process.exit(1);
}

fs.mkdirSync(imagesDir, { recursive: true });

const download = async (url, file) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
};

const withCover = [];
for (const post of posts) {
  const code = post.split('/')[1];
  const file = path.join(imagesDir, `${code}.jpg`);
  try {
    const response = await fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(`https://www.instagram.com/${post}/`)}`, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();
    if (!data.thumbnail_url) throw new Error(data.message ?? 'sem capa');
    await download(data.thumbnail_url, file);
    console.log(`ok       ${code}`);
  } catch (error) {
    if (fs.existsSync(file)) console.log(`mantida  ${code} (${error.message})`);
    else console.log(`sem capa ${code} (${error.message})`);
  }
  if (fs.existsSync(file)) withCover.push(code);
}

fs.writeFileSync(
  outputFile,
  `// GERADO por "npm run instagram:update". Não edite à mão.\n// Códigos dos posts do Instagram que têm capa salva em public/instagram/<código>.jpg.\n\nexport const INSTAGRAM_THUMBS: string[] = ${JSON.stringify(withCover, null, 2)};\n`,
);
console.log(`\n${withCover.length} de ${posts.length} capas salvas.`);
