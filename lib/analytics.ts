import { callScript } from './feed';

export interface Period {
  from: string; // aaaa-mm-dd
  to: string;
}

export interface OverviewData {
  views: number;
  sessions: number;
  users: number;
  clicks: number;
  avg_s: number | null;
  pages: { route: string; views: number; users: number; avg_s: number | null }[];
  by_hour: { hour: number; views: number }[];
}

export interface RouteRow {
  route: string;
  views: number;
  clicks: number;
}

export interface UserRow {
  login: string;
  role: string | null;
  views: number;
  sessions: number;
  last_ts: string;
}

export interface HeatmapData {
  width: number | null;
  widths: { vw: number; n: number }[];
  points: [number, number][];
  views: number;
  scroll: { pct: number; visits: number; total: number }[];
  elements: { label: string; clicks: number; users: number }[];
}

export interface JourneyEvent {
  id: number;
  ts: string;
  session_id: string;
  pv_id: string;
  type: 'session_start' | 'pageview' | 'click' | 'change' | 'action' | 'leave' | 'logout';
  route: string;
  prev_route: string | null;
  label: string | null;
  duration_s: number | null;
  scroll_pct: number | null;
  device: string | null;
  browser: string | null;
}

export interface TimeRow {
  login: string;
  role: string | null;
  route: string;
  visits: number;
  timed: number; // visitas com tempo registrado
  total_s: number;
}

export interface FlowData {
  transitions: { from: string; to: string; n: number }[];
  paths: { path: string; n: number }[];
}

export interface AssistantStatsData {
  totals: { recommended: number; messages: number; sheets: number; objections: number; won: number; lost: number };
  objections: { id: string; n: number }[];
  lost: { id: string; n: number }[];
  users: { login: string; recommended: number; objections: number; messages: number; won: number; lost: number }[];
}

interface QueryMap {
  overview: { params: Period; data: OverviewData };
  routes: { params: Period & { target?: string }; data: RouteRow[] };
  users: { params: Period; data: UserRow[] };
  heatmap: { params: Period & { route: string; target?: string; vw?: number }; data: HeatmapData };
  journey: { params: Period & { target: string }; data: JourneyEvent[] };
  flow: { params: Period; data: FlowData };
  time: { params: Period; data: TimeRow[] };
  assistant: { params: Period; data: AssistantStatsData };
}

// Consulta o painel de análises pelo Apps Script (só responde para Administrativo).
export const queryAnalytics = async <K extends keyof QueryMap>(query: K, params: QueryMap[K]['params']): Promise<QueryMap[K]['data']> => {
  const body: Record<string, string> = { action: 'analyticsQuery', login: localStorage.getItem('userLogin') ?? '', query };
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body[key] = String(value);
  });
  const result = await callScript(body);
  return result.data as QueryMap[K]['data'];
};

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateInput = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const lastDays = (days: number): Period => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: toDateInput(from), to: toDateInput(to) };
};

const ROUTE_NAMES: Record<string, string> = {
  '/': 'Início',
  '/sobre': 'Sobre SAE',
  '/videos': 'Vídeos',
  '/videos/tutoriais': 'Vídeos: Tutoriais da plataforma',
  '/videos/aulas': 'Vídeos: Conteúdo das aulas',
  '/videos/instagram': 'Vídeos: Conteúdos do Instagram',
  '/videos/flyers': 'Vídeos: Flyers',
  '/cursos/info': 'Cursos: Informações',
  '/cursos/presenciais': 'Cursos: Presenciais',
  '/cursos/filtro': 'Cursos: Filtro Avançado',
  '/cursos/combos': 'Cursos: Combos',
  '/cursos/criacao': 'Solicitação de Novos Cursos',
  '/cursos/calendario': 'Calendário de Aulas',
  '/quiz': 'O que estudar?',
  '/evolucao': 'Evolução',
  '/contatos': 'Contatos',
  '/avisos': 'Avisos',
  '/cadastros': 'Cadastros',
  '/memorandos': 'Memorandos',
  '/assistente': 'Meu Assistente',
  '/simulador': 'Simulador',
  '/perfil': 'Perfil',
  '/usuarios/novo': 'Novo usuário',
  '/primeiro-acesso': 'Primeiro acesso',
  '/analises': 'Análises de uso',
  '/login': 'Login',
};

export const routeName = (route: string): string => ROUTE_NAMES[route] ?? route;

export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return minutes % 60 ? `${hours}h ${minutes % 60}min` : `${hours}h`;
  }
  const rest = seconds % 60;
  return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
};
