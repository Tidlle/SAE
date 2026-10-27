export const SHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
// Planilha nova com as abas Feed e Instituições (a planilha acima continua com Cadastros, Avisos, Cursos...).
// Cole aqui o ID dela (trecho entre /d/ e /edit na URL). Vazio = Feed e Instituições não configurados.
export const HOME_SHEET_ID = '1avQ4NQDDxjKVmhSjLcVG_tmgbp-IMHXtAlCpaivXVas';

export const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';

export const cell = (row: string[] | undefined, index: number): string => (row?.[index] ?? '').toString().trim();

export const fetchSheet = async (range: string, spreadsheetId: string = SHEET_ID): Promise<string[][]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao ler a planilha (${response.status})`);
  const data = await response.json();
  return (data.values ?? []) as string[][];
};

// Lê vários intervalos de uma vez e devolve os valores de cada um, na mesma ordem.
export const fetchSheetRanges = async (ranges: string[], spreadsheetId: string = SHEET_ID): Promise<string[][][]> => {
  const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}&key=${API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao ler a planilha (${response.status})`);
  const data = await response.json();
  return (data.valueRanges ?? []).map((item: { values?: string[][] }) => item.values ?? []);
};
