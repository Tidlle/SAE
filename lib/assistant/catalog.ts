import { findColumn, foldText, parseCurrency } from '../courses';
import { fetchSheetRanges } from '../sheets';

// Dados que o assistente consulta: cursos, valores da UNICIVE e combos, lidos da planilha do SAE.

export interface PriceCell {
  d30: number | null; // valor integral (D30)
  punctual: number | null; // valor com desconto de pontualidade
}

export interface UniciveValues {
  fee: number | null;
  total: number | null;
  installment: number | null;
  installments: number | null;
  cash: number | null;
}

export interface Course {
  id: number;
  name: string;
  words: string[]; // palavras do nome, sem acento
  ies: string;
  tipo: string;
  tipoKey: string;
  modalidade: string;
  modalidadeKey: string;
  eixo: string;
  carga: string;
  duracao: string;
  duracaoMax: string;
  preReq: string;
  docs: string;
  artigo: string;
  estagio: string;
  titulacao: string;
  emissao: string;
  prazoEmissao: string;
  emec: string;
  informativo: string;
  fee: number | null;
  boleto: PriceCell;
  pix: PriceCell;
  cartao: PriceCell;
  parcelado: number | null;
  parcelasBoleto: number | null;
  parcelasCartao: number | null;
  unicive: UniciveValues | null;
}

export interface ComboLine {
  method: string;
  day10: string;
  day30: string;
  installments: string;
}

export interface Combo {
  id: number;
  name: string;
  words: string[];
  area: string;
  lines: ComboLine[];
}

// Turma de um curso presencial (aba Cursos-Presenciais).
export interface PresentialClass {
  id: number;
  name: string;
  words: string[]; // nome + tipo + polo, sem acento
  tipo: string;
  turma: string;
  area: string;
  polo: string;
  artigo: string;
  estagio: string;
  students: string;
  start: string;
  status: string;
  statusKind: 'open' | 'waiting' | 'closed' | 'other';
  note: string;
  schedule: string; // link do cronograma
  calendar: string; // link do calendário (só para tipos que têm calendário)
}

// Origem do Simulador e os cursos de destino que ela permite.
export interface SimulatorRow {
  id: number;
  origin: string;
  words: string[];
  destinations: { name: string; prazo: string }[];
}

// Memorando ou aviso (abas Memorandos e Avisos): título, setor, data, resumo e o link do documento.
export interface Notice {
  title: string;
  summary: string;
  date: string;
  sector: string;
  link: string;
}

export interface Catalog {
  courses: Course[];
  combos: Combo[];
  presential: PresentialClass[];
  simulator: SimulatorRow[];
  memos: Notice[];
  notices: Notice[];
  loadedAt: Date;
}

export const tokenize = (value: string): string[] =>
  foldText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

const text = (row: string[], index: number): string => (index < 0 ? '' : (row[index] ?? '').toString().trim());

// Dinheiro da planilha: vazio, 0 ou texto ("Em atualização") significa "sem valor cadastrado".
const money = (value: string): number | null => {
  const parsed = parseCurrency(value);
  return parsed > 0 ? parsed : null;
};

const count = (value: string): number | null => {
  const parsed = parseInt(value.replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const col = (headers: string[], pattern: RegExp): number => findColumn(headers, pattern);

export const buildCourses = (courseRows: string[][], uniciveRows: string[][]): Course[] => {
  if (courseRows.length < 2) return [];
  const headers = courseRows[0].map((header) => (header ?? '').toString());
  const idx = {
    name: Math.max(0, col(headers, /^Nome d/i)),
    tipo: col(headers, /^Tipo/i),
    modalidade: col(headers, /^Modalidade/i),
    carga: col(headers, /^Carga Hor[aá]ria\s*$/i),
    duracao: col(headers, /^Dura[cç][aã]o M[ií]nima/i),
    duracaoMax: col(headers, /^Dura[cç][aã]o M[aá]xima/i),
    eixo: col(headers, /^Eixo/i),
    preReq: col(headers, /^Pr[eé].*Req/i),
    artigo: col(headers, /Necess[aá]rio Artigo/i),
    estagio: col(headers, /Necess[aá]rio Est[aá]gio/i),
    ies: col(headers, /^IES/i),
    titulacao: col(headers, /^Titula/i),
    emec: col(headers, /Link e-MEC/i),
    emissao: col(headers, /^Emiss[aã]o de/i),
    prazoEmissao: col(headers, /^Prazo M[eé]dio de Emiss/i),
    informativo: col(headers, /^Informativo/i),
    fee: col(headers, /^Taxa de Inscri/i),
    docs: col(headers, /^Documentos Para Ingresso/i),
    boletoD30: col(headers, /Curso no Boleto \(D30\)/i),
    pixD30: col(headers, /Curso no Pix \(D30\)/i),
    cartaoD30: col(headers, /Curso no Cart[aã]o \(D30\)/i),
    boletoPunctual: col(headers, /Pontualidade no Boleto/i),
    pixPunctual: col(headers, /Pontualidade no Pix/i),
    cartaoPunctual: col(headers, /Pontualidade no Cart[aã]o/i),
    parcelado: col(headers, /^Valor Parcelado no Boleto/i),
    parcelasBoleto: col(headers, /parcelas BOLETO/i),
    parcelasCartao: col(headers, /parcelas CART/i),
  };

  // Valores UNICIVE: a aba Cursos traz R$ 0,00 para eles; o preço de verdade está nesta aba (chave: nome em maiúsculas).
  const unicive = new Map<string, UniciveValues>();
  uniciveRows.slice(1).forEach((row) => {
    const key = text(row, 0).toUpperCase();
    if (!key) return;
    unicive.set(key, {
      fee: money(text(row, 1)),
      total: money(text(row, 2)),
      installment: money(text(row, 3)),
      installments: count(text(row, 4)),
      cash: money(text(row, 5)),
    });
  });

  const courses: Course[] = [];
  courseRows.slice(1).forEach((row) => {
    const name = text(row, idx.name);
    if (!name) return;
    const ies = text(row, idx.ies);
    const tipo = text(row, idx.tipo);
    const modalidade = text(row, idx.modalidade);
    courses.push({
      id: courses.length,
      name,
      words: tokenize(name),
      ies,
      tipo,
      tipoKey: foldText(tipo).trim(),
      modalidade,
      modalidadeKey: foldText(modalidade).trim(),
      eixo: text(row, idx.eixo),
      carga: text(row, idx.carga),
      duracao: text(row, idx.duracao),
      duracaoMax: text(row, idx.duracaoMax),
      preReq: text(row, idx.preReq),
      docs: text(row, idx.docs),
      artigo: text(row, idx.artigo),
      estagio: text(row, idx.estagio),
      titulacao: text(row, idx.titulacao),
      emissao: text(row, idx.emissao),
      prazoEmissao: text(row, idx.prazoEmissao),
      emec: text(row, idx.emec),
      informativo: text(row, idx.informativo),
      fee: money(text(row, idx.fee)),
      boleto: { d30: money(text(row, idx.boletoD30)), punctual: money(text(row, idx.boletoPunctual)) },
      pix: { d30: money(text(row, idx.pixD30)), punctual: money(text(row, idx.pixPunctual)) },
      cartao: { d30: money(text(row, idx.cartaoD30)), punctual: money(text(row, idx.cartaoPunctual)) },
      parcelado: money(text(row, idx.parcelado)),
      parcelasBoleto: count(text(row, idx.parcelasBoleto)),
      parcelasCartao: count(text(row, idx.parcelasCartao)),
      unicive: ies.toUpperCase() === 'UNICIVE' ? unicive.get(name.toUpperCase()) ?? null : null,
    });
  });
  return courses;
};

// Combos: a linha com o nome do combo abre um bloco; as linhas seguintes (coluna B preenchida) são as formas de pagamento.
export const buildCombos = (rows: string[][]): Combo[] => {
  const combos: Combo[] = [];
  let current: Combo | null = null;
  rows.forEach((row) => {
    const name = text(row, 0);
    if (name) {
      current = { id: combos.length, name, words: tokenize(name), area: text(row, 5), lines: [] };
      combos.push(current);
      return;
    }
    const method = text(row, 1);
    if (current && method) {
      current.lines.push({ method, day10: text(row, 2), day30: text(row, 3), installments: text(row, 4) });
    }
  });
  return combos.filter((combo) => combo.lines.length > 0);
};

// Mesmas colunas usadas pela página Presenciais (A2:AB, sem cabeçalho).
const PRESENTIAL = { name: 0, tipo: 1, turma: 2, area: 5, artigo: 7, estagio: 8, polo: 19, students: 21, start: 22, status: 23, schedule: 25, calendar: 26, note: 27 };
const CALENDAR_TYPES = ['licenciatura', 'bacharelado', 'tecnologico', 'unicv'];

const cleanSpaces = (value: string): string => value.replace(/\s+/g, ' ').trim(); // \s já cobre o espaço sem quebra (nbsp)

const httpUrl = (value: string): string => (/^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : '');

export const buildPresential = (rows: string[][]): PresentialClass[] => {
  const classes: PresentialClass[] = [];
  rows.forEach((row) => {
    const name = text(row, PRESENTIAL.name);
    if (!name) return;
    const tipo = text(row, PRESENTIAL.tipo);
    const polo = text(row, PRESENTIAL.polo);
    const status = cleanSpaces(text(row, PRESENTIAL.status));
    const statusKey = foldText(status);
    const hasCalendar = CALENDAR_TYPES.some((type) => foldText(tipo).includes(type));
    classes.push({
      id: classes.length,
      name,
      words: tokenize(`${name} ${tipo} ${polo}`),
      tipo,
      turma: text(row, PRESENTIAL.turma),
      area: text(row, PRESENTIAL.area),
      polo,
      artigo: text(row, PRESENTIAL.artigo),
      estagio: text(row, PRESENTIAL.estagio),
      students: text(row, PRESENTIAL.students),
      start: text(row, PRESENTIAL.start),
      status,
      statusKind: statusKey.startsWith('aberta') ? 'open' : statusKey.startsWith('aguardando') ? 'waiting' : statusKey.startsWith('nao') ? 'closed' : 'other',
      note: text(row, PRESENTIAL.note),
      schedule: httpUrl(text(row, PRESENTIAL.schedule)),
      calendar: hasCalendar ? httpUrl(text(row, PRESENTIAL.calendar)) : '',
    });
  });
  return classes;
};

// Simulador: colunas A (origem), B (destinos separados por vírgula) e C (prazos, na mesma ordem).
export const buildSimulator = (rows: string[][]): SimulatorRow[] => {
  const result: SimulatorRow[] = [];
  rows.forEach((row) => {
    const origin = text(row, 0);
    if (!origin) return;
    const names = text(row, 1).split(',').map((item) => item.trim()).filter(Boolean);
    const prazos = text(row, 2).split(',').map((item) => item.trim());
    result.push({
      id: result.length,
      origin,
      words: tokenize(origin),
      destinations: names.map((name, index) => ({ name, prazo: prazos[index] ?? '' })),
    });
  });
  return result;
};

// Abas Memorandos e Avisos (A2:D): título | mensagem (resumo e link do documento) | data | setor.
export const buildNotices = (rows: string[][]): Notice[] =>
  rows
    .map((row) => {
      const message = text(row, 1);
      const link = /https?:\/\/[^\s)"<]+/.exec(message)?.[0] ?? '';
      return { title: text(row, 0), summary: message.replace(/https?:\/\/[^\s)"<]+/g, '').replace(/\s+/g, ' ').trim(), date: text(row, 2), sector: text(row, 3), link };
    })
    .filter((item) => item.title);

let cache: Promise<Catalog> | null = null;

export const loadCatalog = (force = false): Promise<Catalog> => {
  if (!cache || force) {
    cache = fetchSheetRanges(['Cursos!A1:AJ', 'Valores UNICIVE!A1:F', 'Combos!A:F', 'Cursos-Presenciais!A2:AB', 'Simulador!A2:C', 'Memorandos!A2:D', 'Avisos!A2:D'])
      .then(([courseRows, uniciveRows, comboRows, presentialRows, simulatorRows, memoRows, noticeRows]) => {
        const courses = buildCourses(courseRows, uniciveRows);
        if (courses.length === 0) throw new Error('A planilha de cursos veio vazia.');
        return {
          courses,
          combos: buildCombos(comboRows),
          presential: buildPresential(presentialRows),
          simulator: buildSimulator(simulatorRows),
          memos: buildNotices(memoRows),
          notices: buildNotices(noticeRows),
          loadedAt: new Date(),
        };
      })
      .catch((error) => {
        cache = null; // tenta de novo na próxima pergunta
        throw error;
      });
  }
  return cache;
};
