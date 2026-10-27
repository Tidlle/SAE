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

export type FacetGroup = 'ies' | 'tipo' | 'modalidade';
export const FACET_GROUPS: FacetGroup[] = ['ies', 'tipo', 'modalidade'];

export interface Facet {
  key: string;
  label: string;
  count: number;
}

// Chave de comparação de um valor de filtro ("EaD" e "EAD" viram a mesma chave).
export const facetKey = (value: unknown): string => foldText((value ?? '').toString().trim());

// Conta os valores distintos de uma coluna, juntando variações de maiúsculas/acentos
// e usando como rótulo a grafia mais frequente.
export const buildFacet = (rows: string[][], index: number): Facet[] => {
  if (index < 0) return [];
  const groups = new Map<string, { count: number; labels: Map<string, number> }>();
  rows.forEach((row) => {
    const raw = (row[index] ?? '').toString().trim();
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
