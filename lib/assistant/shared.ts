// Tipos e utilitários de busca compartilhados pelo motor do Meu Assistente.
import type { Course } from './catalog';

export type Intent = 'price' | 'docs' | 'info';
export type Pay = 'boleto' | 'pix' | 'cartao';

export interface Chip {
  label: string;
  query: string; // texto enviado ao motor quando a pessoa clica
}

export type Block =
  | { type: 'text'; text: string; tone?: 'warn' | 'muted' }
  | { type: 'course'; title: string; meta: string[]; href?: string }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'facts'; items: [string, string][] }
  | { type: 'list'; title: string; items: string[] }
  | { type: 'links'; items: { label: string; href: string }[] };

export interface Reply {
  tag: string; // para estatística: só o tipo da resposta, nunca o texto da pergunta
  blocks: Block[];
  chips: Chip[];
  sources: string[];
}

// Atendimento consultivo (lib/assistant/consult.ts): o que o assistente já descobriu sobre o aluno do vendedor.
export type LeadStep = 'degree' | 'goal' | 'formation' | 'origin' | 'area' | 'theme' | 'modality' | 'polo' | 'budget' | 'urgency' | 'objective';

export interface LeadArea {
  label: string;
  group: string; // grande área da planilha (educacao, saude...), ou '' quando foi digitada
  words: string[]; // palavras digitadas, procuradas no nome e no eixo dos cursos
}

export interface Lead {
  asked: LeadStep | ''; // pergunta que está esperando resposta
  questions: number; // perguntas já respondidas
  degree: '' | 'sim' | 'nao'; // o aluno já tem graduação?
  tipoKey: string; // escolha de tipo de curso (chave de TIPO_CHOICES)
  tipos: string[] | null; // tipos aceitos (filtro de tipo do motor); null = ainda não definido, [] = qualquer
  area: LeadArea | 'any' | null; // null = ainda não definido
  themed: boolean; // a pergunta do tema dentro da área já foi respondida
  modality: string | null; // 'ead' | 'semi' | 'presencial'; '' = tanto faz; null = ainda não definido
  budget: number | 'any' | null; // parcela mensal máxima estimada
  ies: string;
  sort: 'price' | 'fast';
  objections: string[]; // objeções já trabalhadas no atendimento (ids de lib/assistant/objections.ts)
  origin: { id: number; label: string } | 'any' | null; // graduação de origem (linha do Simulador), na segunda graduação
  polo: string | null; // polo presencial; '' = qualquer
  urgency: 'now' | 'later' | null; // quer começar logo?
  objective: string | null; // objetivo do aluno (carreira, mudar, exigencia, diploma); '' = não sabe
  outcome: '' | 'won' | 'lost'; // como terminou o atendimento
  lostReason: string; // id da objeção (ou 'outro') quando a venda não fechou
}

// Dados que a IA (ou o texto livre) pode preencher no atendimento; cada campo é validado antes de valer.
export interface LeadPatch {
  degree?: 'sim' | 'nao';
  tipo?: string;
  area?: string;
  modality?: string;
  budget?: number;
  ies?: string;
  objective?: string;
  urgency?: 'now' | 'later';
  polo?: string;
}

export interface Context {
  kind: 'course' | 'combo' | null;
  courseIds: number[];
  comboId: number | null;
  pending: Intent[]; // intenção da pergunta que gerou uma lista de opções
  pay: Pay[];
  simDest: string; // palavras do curso de destino de uma pergunta do Simulador que gerou lista de origens
  listIds: number[]; // última lista de cursos (para "mostrar mais")
  listOffset: number;
  listTitle: string;
  lead: Lead | null; // atendimento consultivo em andamento
}

export const EMPTY_CONTEXT: Context = { kind: null, courseIds: [], comboId: null, pending: [], pay: [], simDest: '', listIds: [], listOffset: 0, listTitle: '', lead: null };

export interface Answer {
  reply: Reply;
  ctx: Context;
  needs?: 'agenda'; // a resposta depende de dados que a página precisa carregar antes (calendário de aulas)
}

export const set = (words: string): Set<string> => new Set(words.split(/\s+/).filter(Boolean));

export const STOP = set(
  'a o as os de da do das dos e em no na nos nas para pra por com sem um uma uns umas que qual quais quanto quantos quantas como onde ' +
    'tem ter existe eh ao aos pelo pela me mim minha meu voce vc favor gostaria saber quero queria ver mostrar mostre informar informe ' +
    'diga passe sobre curso cursos sao ser esta estao tambem mais menos entre ha tipo preciso precisa precisar necessario levar ' +
    'quanto quando se ou isso esse essa esses essas la aqui ai pode posso poderia dessa desse desta deste disso voces existem temos nossas nossos',
);
export const IES_WORDS: Record<string, string> = {
  esp: 'ESP',
  unicive: 'UNICIVE',
  unicv: 'UNICIVE',
  unicve: 'UNICIVE',
  alpha: 'ALPHA',
  alfa: 'ALPHA',
  faep: 'FAEP',
  ucesp: 'UCESP',
  iteq: 'ITEQ',
};
// ---------------------------------------------------------------- busca por nome

const editDistanceAtMostOne = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

export const wordScore = (query: string, word: string, fuzzy: boolean): number => {
  if (query === word) return 1;
  if (query.length >= 3 && word.startsWith(query)) return 0.85;
  if (query.length >= 4 && word.includes(query)) return 0.6;
  if (fuzzy && query.length >= 5 && word.length >= 5 && editDistanceAtMostOne(query, word)) return 0.55;
  return 0;
};

export interface Scored<T> {
  item: T;
  score: number;
  average: number; // quão bem as palavras da pergunta casam com o nome (1 = palavras idênticas)
}

export const rank = <T extends { words: string[] }>(items: T[], tokens: string[], fuzzy: boolean): Scored<T>[] => {
  const result: Scored<T>[] = [];
  items.forEach((item) => {
    let total = 0;
    const used = new Set<number>();
    for (const token of tokens) {
      let best = 0;
      let bestIndex = -1;
      item.words.forEach((word, index) => {
        const value = wordScore(token, word, fuzzy);
        if (value > best) {
          best = value;
          bestIndex = index;
        }
      });
      if (best === 0) return;
      total += best;
      used.add(bestIndex);
    }
    const average = total / tokens.length;
    const coverage = used.size / Math.max(1, item.words.length);
    result.push({ item, score: 0.7 * average + 0.3 * coverage, average });
  });
  return result.sort((a, b) => b.score - a.score || a.item.words.length - b.item.words.length);
};

export const shortName = (name: string, max = 90): string => (name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name);

export const textReply = (tag: string, text: string, chips: Chip[] = [], extra: Block[] = []): Reply => ({
  tag,
  blocks: [{ type: 'text', text }, ...extra],
  chips,
  sources: [],
});

// Filtros de curso por palavras da pergunta
export const MODALITY_WORDS: Record<string, string> = {
  ead: 'ead',
  distancia: 'ead',
  presencial: 'presencial',
  presenciais: 'presencial',
  semipresencial: 'semi',
  semi: 'semi',
};
export const TIPO_WORDS: Record<string, string> = {
  pos: 'pos',
  posgraduacao: 'pos',
  posgraduacoes: 'pos',
  especializacao: 'pos',
  mba: 'pos',
  graduacao: 'graduacao',
  graduacoes: 'graduacao',
  licenciatura: 'licenciatura',
  licenciaturas: 'licenciatura',
  bacharelado: 'bacharel',
  bacharelados: 'bacharel',
  tecnologo: 'tecnolog',
  tecnologos: 'tecnolog',
  tecnologicos: 'tecnolog',
  tecnologico: 'tecnolog',
  extensao: 'extensao',
  extensoes: 'extensao',
  capacitacao: 'capacitacao',
  capacitacoes: 'capacitacao',
  aperfeicoamento: 'aperfeicoamento',
  aperfeicoamentos: 'aperfeicoamento',
  atualizacao: 'atualizacao',
  atualizacoes: 'atualizacao',
  livre: 'livre',
  livres: 'livre',
};
export interface CourseFilters {
  ies: string;
  modality: string;
  tipo: string;
}

// Separa do nome do curso as palavras que são filtro (IES, modalidade, tipo).
export const splitCourseTokens = (tokens: string[]): { name: string[]; filters: CourseFilters } => {
  const filters: CourseFilters = { ies: '', modality: '', tipo: '' };
  const hasPos = tokens.includes('pos') || tokens.includes('posgraduacao') || tokens.includes('posgraduacoes');
  const name: string[] = [];
  tokens.forEach((token) => {
    if (IES_WORDS[token]) filters.ies = IES_WORDS[token];
    else if (token === 'channel' && tokens.some((t) => t === 'alpha' || t === 'alfa')) return;
    else if (MODALITY_WORDS[token]) filters.modality = MODALITY_WORDS[token];
    else if (TIPO_WORDS[token] && !(TIPO_WORDS[token] === 'graduacao' && hasPos)) filters.tipo = TIPO_WORDS[token];
    else if (TIPO_WORDS[token] === 'graduacao' && hasPos) return;
    else name.push(token);
  });
  return { name, filters };
};

export const passesFilters = (course: Course, filters: CourseFilters): boolean => {
  if (filters.ies && course.ies.toUpperCase() !== filters.ies) return false;
  if (filters.modality && !course.modalidadeKey.startsWith(filters.modality)) return false;
  if (filters.tipo) {
    if (filters.tipo === 'graduacao') {
      if (!(course.tipoKey === 'graduacao' || /^(bachar|licenc|tecnolog)/.test(course.tipoKey))) return false;
    } else if (filters.tipo === 'pos') {
      if (!course.tipoKey.startsWith('pos')) return false;
    } else if (!course.tipoKey.includes(filters.tipo)) return false;
  }
  return true;
};

const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'para', 'com', 'a', 'o']);

// Nomes escritos em CAIXA ALTA na planilha viram "Caixa Alta" só na tela (a busca e o link usam o nome original).
export const displayName = (name: string): string => {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .split(' ')
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
    .replace(/(^|\s|-\s)(e|ead|ies|mba)(?=\s|$)/gi, (match) => match.toUpperCase() === match ? match : match);
};
