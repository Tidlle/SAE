import { HOME_SHEET_ID, cell, fetchSheet } from './sheets';
import { InstitutionProfile, PRESENTATION_ORDER, profileFor } from './institutionProfiles';

export const INSTITUTION_NAMES = ['ESP', 'Alpha Channel', 'UCESP', 'UNICIVE'] as const;

export interface Institution {
  name: string;
  summary: string;
  year: string;
  history: string;
  site: string;
  logo: string;
  order: number;
  // Apresentação completa (lib/institutionProfiles.ts); os campos acima, quando preenchidos na planilha, têm prioridade.
  profile?: InstitutionProfile;
}

const blank = (name: string, order: number): Institution => ({
  name,
  summary: '',
  year: '',
  history: '',
  site: '',
  logo: '',
  order,
  profile: profileFor(name),
});

const FALLBACK: Institution[] = INSTITUTION_NAMES.map((name, index) => blank(name, index + 1));

// Garante as apresentações que existem no código mesmo sem linha na planilha (hoje, o ITEQ, que abre a lista).
const withKnownProfiles = (items: Institution[]): Institution[] => {
  const present = new Set(items.map((item) => item.name.toLowerCase()));
  const extras = PRESENTATION_ORDER.filter((name) => !present.has(name.toLowerCase()) && profileFor(name)).map((name, index) =>
    blank(name, name === PRESENTATION_ORDER[0] ? 0 : 100 + index),
  );
  return [...items, ...extras].sort((a, b) => a.order - b.order);
};

// Colunas da aba Instituições: nome | resumo | ano | historia | site | logo | ordem
// Todas, menos o nome, são opcionais: o que ficar vazio usa a apresentação de lib/institutionProfiles.ts.
export const loadInstitutions = async (): Promise<Institution[]> => {
  if (!HOME_SHEET_ID) return withKnownProfiles(FALLBACK);
  try {
    const rows = await fetchSheet('Instituições!A2:G', HOME_SHEET_ID);
    const items = rows
      .filter((row) => cell(row, 0))
      .map((row, index) => ({
        name: cell(row, 0),
        summary: cell(row, 1),
        year: cell(row, 2),
        history: (row[3] ?? '').toString().trim(),
        site: cell(row, 4),
        logo: cell(row, 5),
        order: Number(cell(row, 6)) || index + 1,
        profile: profileFor(cell(row, 0)),
      }))
      .sort((a, b) => a.order - b.order);
    return withKnownProfiles(items.length > 0 ? items : FALLBACK);
  } catch {
    return withKnownProfiles(FALLBACK);
  }
};
