// Tira acentos e maiúsculas, mantendo o tamanho do texto (serve para destacar o trecho achado).
const COMBINING_MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

export const foldText = (value: string): string => (value ?? '').normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();

// Versão para comparar buscas: "educacao" encontra "Educação".
export const normalizeText = (value: string): string => foldText(value).trim();

// Índice da primeira coluna cujo cabeçalho casa com o padrão (-1 se não existir).
export const findColumn = (headers: string[], pattern: RegExp): number =>
  headers.findIndex((header) => Boolean(header) && pattern.test(header));

// Só aceita http(s): valores vindos da planilha nunca viram href com outro esquema (ex.: javascript:).
export const safeHttpUrl = (value: string | undefined): string => {
  const trimmed = (value ?? '').trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : '';
};

// Informativo de um curso presencial: a aba Cursos-Presenciais não tem esse link, então ele vem do mesmo curso na aba Cursos
// (que tem o nome completo, ex.: "IMERSÃO CLÍNICA FULL ... - CAPACITAÇÃO PRESENCIAL - ITAQUERA"). O curso presencial casa com o
// da aba Cursos quando todas as palavras do nome dele aparecem no outro (turno e dia da semana ficam de fora); em caso de dúvida
// vence o que repete também o tipo e o polo e tem menos palavras sobrando. Sem correspondência, devolve ''. Quando os nomes das
// duas abas são diferentes demais, dá para escrever o link na coluna AC ("Informativo") da própria aba Cursos-Presenciais.
const PERIOD_WORDS = new Set(['manha', 'tarde', 'noite', 'sabado', 'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'turma']);
const wordsOf = (value: string): string[] => foldText(value).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

export interface InformativoCandidate {
  name: string; // nome completo, sem acento e em minúsculas
  words: string[];
  link: string;
}

// Cursos presenciais que usam o informativo de um curso com outro nome na aba Cursos (nome do presencial -> começo do nome do curso).
// Os dois lados vão sem acento, em minúsculas e sem pontuação.
const INFORMATIVO_ALIASES: Record<string, string> = {
  'escleroterapia e enzimas esteticas': 'procedimentos injetaveis e regenerativos',
};

// Mesma palavra no singular e no plural ("Prática" e "Práticas"): uma começa com a outra e a diferença é de até 2 letras
const sameWord = (a: string, b: string): boolean => a === b || (Math.min(a.length, b.length) >= 4 && Math.abs(a.length - b.length) <= 2 && (a.startsWith(b) || b.startsWith(a)));

export const informativoCandidates = (rows: string[][], nameIndex: number, linkIndex: number): InformativoCandidate[] =>
  rows
    .map((row) => ({ name: wordsOf((row[nameIndex] ?? '').toString()).join(' '), words: wordsOf((row[nameIndex] ?? '').toString()), link: safeHttpUrl((row[linkIndex] ?? '').toString()) }))
    .filter((candidate) => candidate.link && candidate.words.length > 0);

export const findInformativo = (candidates: InformativoCandidate[], name: string, tipo: string, polo: string): string => {
  const wanted = wordsOf(name).filter((word) => !PERIOD_WORDS.has(word));
  if (wanted.length === 0) return '';
  const alias = INFORMATIVO_ALIASES[wanted.join(' ')];
  if (alias) {
    const aliased = candidates.find((candidate) => candidate.name.startsWith(alias));
    if (aliased) return aliased.link;
  }
  const tipoWords = wordsOf(tipo);
  const poloWord = foldText(polo).trim();
  let best: { link: string; score: number } | null = null;
  candidates.forEach((candidate) => {
    const has = (word: string) => candidate.words.some((other) => sameWord(word, other));
    if (!wanted.every(has)) return;
    const tipoShare = tipoWords.length > 0 ? tipoWords.filter(has).length / tipoWords.length : 0;
    const score = (tipoShare + (poloWord && has(poloWord) ? 1 : 0)) * 10 - (candidate.words.length - wanted.length) * 0.1;
    if (!best || score > best.score) best = { link: candidate.link, score };
  });
  return best ? (best as { link: string }).link : '';
};

// Documentos e pré-requisitos vêm separados por "/" (ou por quebra de linha).
export const splitList = (value: string): string[] =>
  (value.includes('/') ? value.split('/') : value.split('\n')).map((item) => item.trim()).filter(Boolean);

export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export type FacetGroup = 'ies' | 'area' | 'tipo' | 'modalidade';
export const FACET_GROUPS: FacetGroup[] = ['ies', 'area', 'tipo', 'modalidade'];

// Áreas dos cursos. Os eixos da planilha vêm com grafias diferentes ("Saúde", "Saúde e Bem-Estar", "Artes e humanidades"):
// juntam-se em grandes áreas, para o filtro e para o Meu Assistente.
export const AREA_LABEL: Record<string, string> = {
  educacao: 'Educação',
  saude: 'Saúde e Bem-Estar',
  negocios: 'Negócios, Administração e Direito',
  engenharia: 'Engenharia, Produção e Construção',
  ti: 'Computação e TI',
  sociais: 'Ciências Sociais e Comunicação',
  artes: 'Artes e Humanidades',
  servicos: 'Serviços',
  outras: 'Outras áreas',
};

export const areaGroupOf = (eixo: string): string => {
  const key = foldText(eixo).trim();
  if (key.startsWith('educ')) return 'educacao';
  if (/^(saude|veterin)/.test(key)) return 'saude';
  if (/^(negoc|administ|direito)/.test(key)) return 'negocios';
  if (key.startsWith('engenh')) return 'engenharia';
  if (key.startsWith('comput')) return 'ti';
  if (key.startsWith('ciencias soc')) return 'sociais';
  if (key.startsWith('artes')) return 'artes';
  if (key.startsWith('servic')) return 'servicos';
  return 'outras';
};

// Área de um curso a partir do eixo (vazio quando o curso não tem eixo)
export const areaLabelOf = (eixo: unknown): string => {
  const raw = (eixo ?? '').toString().trim();
  return raw ? AREA_LABEL[areaGroupOf(raw)] : '';
};

export interface Facet {
  key: string;
  label: string;
  count: number;
}

// Chave de comparação de um valor de filtro ("EaD" e "EAD" viram a mesma chave).
export const facetKey = (value: unknown): string => foldText((value ?? '').toString().trim());

// Conta os valores distintos de uma coluna, juntando variações de maiúsculas/acentos
// e usando como rótulo a grafia mais frequente.
// `transform` converte o valor da célula antes de contar (usado na área, que junta eixos parecidos).
export const buildFacet = (rows: string[][], index: number, transform?: (raw: string) => string): Facet[] => {
  if (index < 0) return [];
  const groups = new Map<string, { count: number; labels: Map<string, number> }>();
  rows.forEach((row) => {
    const cell = (row[index] ?? '').toString().trim();
    const raw = transform ? transform(cell) : cell;
    if (!raw) return;
    const key = facetKey(raw);
    const group = groups.get(key) ?? { count: 0, labels: new Map<string, number>() };
    group.count += 1;
    group.labels.set(raw, (group.labels.get(raw) ?? 0) + 1);
    groups.set(key, group);
  });
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: [...group.labels.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: group.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
};
