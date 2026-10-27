import { API_KEY } from '../sheets';
import { foldText } from '../courses';
import { tokenize } from './catalog';
import { Answer, Block, Chip, Context, STOP, rank, set, textReply } from './shared';

// Calendário de Aulas: lê a agenda pública do Google (a mesma da página Calendário de Aulas) e responde por data, polo e curso.

export const AGENDA_CALENDAR_ID = 'coordenacaogeral@faculdadealphachannel.com';
const WINDOW_DAYS = 150;

export interface AgendaEvent {
  id: string;
  title: string;
  course: string; // título sem o polo
  polo: string;
  words: string[];
  start: Date;
  allDay: boolean;
  endTime: Date | null; // só quando tem horário
  turma: string;
  tema: string;
  professor: string;
  place: string;
  link: string; // primeiro link do texto do evento (ex.: material no Drive)
}

export interface Agenda {
  events: AgendaEvent[];
  loadedAt: Date;
}

// ---------------------------------------------------------------- leitura

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeEntities = (value: string): string =>
  value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

const htmlToText = (html: string): string =>
  decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

const POLOS = ['itaquera', 'santos', 'aracatuba'];
const POLO_LABEL: Record<string, string> = { itaquera: 'Itaquera', santos: 'Santos', aracatuba: 'Araçatuba' };

interface RawEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

const localDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const field = (text: string, label: RegExp, stop: RegExp): string => {
  const match = label.exec(text);
  if (!match) return '';
  const rest = text.slice(match.index + match[0].length).split('\n')[0];
  return rest.split(stop)[0].replace(/^[\s\-–:·.]+|[\s\-–:·.,;/]+$/g, '').trim();
};

export const parseEvent = (raw: RawEvent): AgendaEvent | null => {
  if (!raw.id || raw.status === 'cancelled' || !raw.start) return null;
  const allDay = Boolean(raw.start.date && !raw.start.dateTime);
  const start = allDay ? localDate(raw.start.date as string) : new Date(raw.start.dateTime as string);
  if (Number.isNaN(start.getTime())) return null;
  const title = (raw.summary ?? '').replace(/[^\p{L}\p{N}\s\-–:/().,+&ºª°]/gu, '').replace(/\s+/g, ' ').trim();
  const text = htmlToText(raw.description ?? '');

  // O título começa pelo polo: "ITAQUERA- Curso ...", "SANTOS- Curso: ..."
  const poloMatch = new RegExp(`^(${POLOS.join('|')})\\b[\\s\\-–:]*`, 'i').exec(foldText(title));
  const polo = poloMatch ? POLO_LABEL[poloMatch[1].toLowerCase()] : '';
  const course = (poloMatch ? title.slice(poloMatch[0].length) : title).replace(/^(curso|ao vivo)\s*[:\-–]?\s*/i, '').trim();

  const link = /https?:\/\/[^\s)"<]+/.exec(text)?.[0] ?? '';
  return {
    id: raw.id,
    title,
    course: course || title,
    polo,
    words: tokenize(`${course || title} ${polo}`),
    start,
    allDay,
    endTime: !allDay && raw.end?.dateTime ? new Date(raw.end.dateTime) : null,
    turma: field(text, /Turmas?\s*:?\s*/i, /\s{2,}|\bTema\b|\bProfessor|\bTe[oó]rica|\bPr[aá]tica|\bNova\b|\(/i),
    tema: field(text, /Tema\s*:?\s*/i, /\bProfessor|\bObs/i),
    professor: field(text, /Professor(?:a)?\s*:?\s*/i, /\bO aluno|\bObs|\s{2,}/i),
    place: (raw.location ?? '').trim(),
    link,
  };
};

let agendaCache: Promise<Agenda> | null = null;

export const loadAgenda = (force = false): Promise<Agenda> => {
  if (!agendaCache || force) {
    agendaCache = (async () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + WINDOW_DAYS * 86400000);
      const events: AgendaEvent[] = [];
      let pageToken = '';
      for (let page = 0; page < 4; page++) {
        const params = new URLSearchParams({
          key: API_KEY,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
        });
        if (pageToken) params.set('pageToken', pageToken);
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(AGENDA_CALENDAR_ID)}/events?${params}`);
        if (!response.ok) throw new Error(`Falha ao ler a agenda (${response.status})`);
        const data = (await response.json()) as { items?: RawEvent[]; nextPageToken?: string };
        (data.items ?? []).forEach((item) => {
          const parsed = parseEvent(item);
          if (parsed) events.push(parsed);
        });
        pageToken = data.nextPageToken ?? '';
        if (!pageToken) break;
      }
      return { events, loadedAt: new Date() };
    })().catch((error) => {
      agendaCache = null;
      throw error;
    });
  }
  return agendaCache;
};

// ---------------------------------------------------------------- pergunta

export const AGENDA_WORDS = set('aula aulas agenda calendario');
const DATE_WORDS = set('hoje amanha semana proxima proximas proximo proximos esta essa este esse dia mes');
const WEEKDAYS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const MONTHS: Record<string, number> = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
const NOISE = set('professor professora prof ao vivo agenda calendario aula aulas ha tem tera ter quando qual quais onde horario horarios');

export const wantsAgenda = (all: string[], hasCourseIntent: boolean): boolean =>
  !hasCourseIntent && all.some((token) => AGENDA_WORDS.has(token)) && !all.includes('academico');

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

interface Window {
  from: Date;
  to: Date; // exclusivo
  label: string;
  explicit: boolean;
}

const dayLabel = (date: Date): string => date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

const parseWindow = (all: string[], question: string, now: Date): Window => {
  const today = startOfDay(now);
  const folded = foldText(question);
  if (all.includes('hoje')) return { from: today, to: addDays(today, 1), label: 'hoje', explicit: true };
  if (all.includes('amanha')) return { from: addDays(today, 1), to: addDays(today, 2), label: 'amanhã', explicit: true };

  const full = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(folded);
  if (full) {
    const year = full[3] ? (full[3].length === 2 ? 2000 + Number(full[3]) : Number(full[3])) : today.getFullYear();
    const date = new Date(year, Number(full[2]) - 1, Number(full[1]));
    return { from: date, to: addDays(date, 1), label: dayLabel(date), explicit: true };
  }
  const dayOnly = /\bdia (\d{1,2})\b/.exec(folded);
  const monthName = all.find((token) => token in MONTHS);
  if (dayOnly) {
    let date = new Date(today.getFullYear(), monthName ? MONTHS[monthName] : today.getMonth(), Number(dayOnly[1]));
    if (!monthName && date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, Number(dayOnly[1]));
    return { from: date, to: addDays(date, 1), label: dayLabel(date), explicit: true };
  }
  if (monthName) {
    let year = today.getFullYear();
    if (MONTHS[monthName] < today.getMonth()) year += 1;
    const from = new Date(year, MONTHS[monthName], 1);
    return { from, to: new Date(year, MONTHS[monthName] + 1, 1), label: `${monthName}`, explicit: true };
  }
  const weekday = all.find((token) => token in WEEKDAYS);
  if (weekday) {
    const wanted = WEEKDAYS[weekday];
    const delta = (wanted - today.getDay() + 7) % 7;
    const date = addDays(today, all.includes('proxima') || all.includes('proximo') ? (delta === 0 ? 7 : delta) : delta);
    return { from: date, to: addDays(date, 1), label: dayLabel(date), explicit: true };
  }
  if (all.includes('semana')) {
    if (all.includes('proxima')) {
      const mondayDelta = ((8 - today.getDay()) % 7) || 7;
      const from = addDays(today, mondayDelta);
      return { from, to: addDays(from, 7), label: 'próxima semana', explicit: true };
    }
    const sundayDelta = (7 - today.getDay()) % 7;
    return { from: today, to: addDays(today, sundayDelta + 1), label: 'esta semana', explicit: true };
  }
  return { from: today, to: addDays(today, WINDOW_DAYS), label: 'próximas', explicit: false };
};

const timeOf = (event: AgendaEvent): string => {
  if (event.allDay) return 'dia inteiro';
  const format = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return event.endTime ? `${format(event.start)} às ${format(event.endTime)}` : format(event.start);
};

const shortDay = (date: Date): string => date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

const eventBlocks = (event: AgendaEvent): Block[] => {
  const facts: [string, string][] = [['Data', `${dayLabel(event.start)}, ${timeOf(event)}`]];
  if (event.polo) facts.push(['Polo', event.polo]);
  if (event.place) facts.push(['Local', event.place]);
  if (event.turma) facts.push(['Turma', event.turma]);
  if (event.tema) facts.push(['Tema', event.tema]);
  if (event.professor) facts.push(['Professor(a)', event.professor]);
  const blocks: Block[] = [{ type: 'course', title: event.course, meta: [event.polo].filter(Boolean) }, { type: 'facts', items: facts }];
  if (/^https?:\/\//.test(event.link)) blocks.push({ type: 'links', items: [{ label: 'Material da aula', href: event.link }] });
  return blocks;
};

const AGENDA_LINK: Block = { type: 'links', items: [{ label: 'Abrir Calendário de Aulas', href: '/cursos/calendario' }] };

const AGENDA_CHIPS: Chip[] = [
  { label: 'Aulas desta semana', query: 'aulas desta semana' },
  { label: 'Aulas em Santos', query: 'aulas em Santos' },
  { label: 'Próximas aulas de Enfermagem Obstétrica', query: 'próximas aulas de Enfermagem Obstétrica' },
];

export const answerAgenda = (agenda: Agenda, all: string[], question: string, ctx: Context, now: Date = new Date()): Answer => {
  const sources = ['Calendário de Aulas (Google Agenda)'];
  const window = parseWindow(all, question, now);
  const polo = all.find((token) => POLOS.includes(token));
  const byTeacher = all.some((token) => ['professor', 'professora', 'prof'].includes(token));

  const used = new Set<string>(Object.keys(WEEKDAYS).concat(Object.keys(MONTHS), POLOS));
  const nameTokens = all.filter((token) => !STOP.has(token) && !NOISE.has(token) && !DATE_WORDS.has(token) && !used.has(token) && !/^\d+$/.test(token));

  let events = agenda.events.filter((event) => event.start >= window.from && event.start < window.to);
  if (polo) events = events.filter((event) => foldText(event.polo) === polo);

  if (nameTokens.length > 0) {
    if (byTeacher) {
      events = events.filter((event) => nameTokens.every((token) => foldText(event.professor).includes(token)));
    } else {
      const ranked = rank(events, nameTokens, true);
      events = ranked.map((entry) => entry.item).sort((a, b) => a.start.getTime() - b.start.getTime());
    }
  }

  const range = `${window.from.toLocaleDateString('pt-BR')}${window.to.getTime() - window.from.getTime() > 86400000 * 2 ? ' a ' + addDays(window.to, -1).toLocaleDateString('pt-BR') : ''}`;
  const scope = [polo ? `em ${POLO_LABEL[polo]}` : '', nameTokens.length > 0 ? `de "${nameTokens.join(' ')}"` : ''].filter(Boolean).join(' ');

  if (events.length === 0) {
    const past = window.explicit && window.to <= startOfDay(now) ? ' Essa data já passou.' : '';
    const later = window.explicit ? '' : ' nos próximos meses';
    return {
      reply: textReply(
        'agenda:vazio',
        `Não há aulas na agenda${scope ? ' ' + scope : ''}${window.explicit ? ` (${window.label})` : later}.${past || ' A agenda é preenchida pela coordenação e pode ainda não ter essa data.'}`,
        AGENDA_CHIPS,
        [AGENDA_LINK],
      ),
      ctx,
    };
  }

  const shown = events.slice(0, window.explicit ? 15 : 8);
  const WHEN: Record<string, string> = { hoje: 'de hoje', 'amanhã': 'de amanhã', 'esta semana': 'desta semana', 'próxima semana': 'da próxima semana' };
  const when = WHEN[window.label] ?? `em ${window.label}`;
  const heading = window.explicit ? `Aulas ${when}${scope ? ' ' + scope : ''}:` : `Próximas aulas${scope ? ' ' + scope : ''}:`;
  const blocks: Block[] = [{ type: 'text', text: heading }];
  if (shown.length <= 3) {
    shown.forEach((event) => blocks.push(...eventBlocks(event)));
  } else {
    blocks.push({
      type: 'table',
      columns: ['Data', 'Horário', 'Polo', 'Curso', 'Turma'],
      rows: shown.map((event) => [shortDay(event.start), timeOf(event), event.polo || '-', event.course.length > 70 ? `${event.course.slice(0, 69)}…` : event.course, event.turma || '-']),
    });
    if (events.length > shown.length) blocks.push({ type: 'text', tone: 'muted', text: `Mostrando ${shown.length} de ${events.length}. Filtre por polo, curso ou data para ver o restante.` });
    else blocks.push({ type: 'text', tone: 'muted', text: 'Diga o nome do curso para ver tema, professor e material de uma aula.' });
  }
  blocks.push(AGENDA_LINK);
  return { reply: { tag: 'agenda', blocks, chips: events.length > 3 ? AGENDA_CHIPS.slice(0, 2) : [], sources }, ctx };
};
