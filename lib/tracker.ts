import { TRACKER_ANON_KEY, TRACKER_URL as CONFIGURED_URL } from './trackerConfig';

// Aceita o endereço com barra no fim ou com /rest/v1 colado (erro comum ao copiar do painel).
const TRACKER_URL = CONFIGURED_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

type EventType = 'session_start' | 'pageview' | 'click' | 'change' | 'action' | 'leave' | 'logout';

interface TrackEvent {
  ts: string;
  session_id: string;
  pv_id: string;
  login: string;
  role: string | null;
  type: EventType;
  route: string;
  prev_route: string | null;
  selector: string | null;
  label: string | null;
  x: number | null;
  y: number | null;
  vw: number | null;
  vh: number | null;
  doc_h: number | null;
  duration_s: number | null;
  scroll_pct: number | null;
  device: string;
  browser: string;
  os: string;
}

const OPT_OUT_KEY = 'saeTrackOptOut';
const SESSION_KEY = 'saeTrackSession';
const FLUSH_MS = 5000;
const FLUSH_SIZE = 15;
const MAX_BATCH = 100;
const MAX_QUEUE = 500;
const MAX_STAY_S = 1800;

// Telas em que só a visita é registrada (nada de posição de clique nem texto): contêm dados pessoais ou senha.
const VISIT_ONLY_ROUTES = ['/login', '/primeiro-acesso', '/usuarios/novo'];

interface Visit {
  id: string;
  route: string;
  prevRoute: string | null;
  maxScroll: number;
  visibleMs: number;
  visibleSince: number | null;
  startedAt: number;
}

let queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let visit: Visit | null = null;
let lastRoute: string | null = null;
let sessionStarted = false;

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const read = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

export const isTrackerConfigured = (): boolean => Boolean(TRACKER_URL && TRACKER_ANON_KEY);

export const isOptedOut = (): boolean => read(OPT_OUT_KEY) === '1';

export const setOptOut = (value: boolean): void => {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // armazenamento indisponível
  }
  if (value) {
    queue = [];
    visit = null;
  }
};

// O painel mostra as páginas do SAE dentro de um iframe: o uso feito ali (do próprio administrativo) não conta.
const inFrame = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const currentLogin = (): string => (read('usuarioAutenticado') === 'true' ? read('userLogin') : '');

const enabled = (): boolean => isTrackerConfigured() && !isOptedOut() && !inFrame() && Boolean(currentLogin());

const deviceInfo = () => {
  const ua = navigator.userAgent;
  const width = window.innerWidth;
  const browser = ua.includes('Firefox')
    ? 'Firefox'
    : ua.includes('SamsungBrowser')
      ? 'Samsung Browser'
      : ua.includes('OPR') || ua.includes('Opera')
        ? 'Opera'
        : ua.includes('Edg')
          ? 'Edge'
          : ua.includes('Chrome')
            ? 'Chrome'
            : ua.includes('Safari')
              ? 'Safari'
              : 'Outro';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : ua.includes('Win')
        ? 'Windows'
        : ua.includes('Mac')
          ? 'MacOS'
          : ua.includes('Linux')
            ? 'Linux'
            : 'Outro';
  return { device: width < 768 ? 'Mobile' : width < 1024 ? 'Tablet' : 'Desktop', browser, os };
};

const sessionId = (): string => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const created = randomId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return 'sem-sessao';
  }
};

const documentHeight = (): number => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);

const scrollPercent = (): number => {
  const scrollable = documentHeight() - window.innerHeight;
  if (scrollable <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
};

const clip = (value: string | null | undefined, max: number): string | null => {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.substring(0, max) : null;
};

const push = (partial: Partial<TrackEvent> & { type: EventType }, route: string, pvId: string, prevRoute: string | null): void => {
  const login = currentLogin();
  if (!login) return;
  const info = deviceInfo();
  queue.push({
    ts: new Date().toISOString(),
    session_id: sessionId(),
    pv_id: pvId,
    login,
    role: read('userPerfil') || null,
    route,
    prev_route: prevRoute,
    selector: null,
    label: null,
    x: null,
    y: null,
    vw: window.innerWidth,
    vh: window.innerHeight,
    doc_h: null,
    duration_s: null,
    scroll_pct: null,
    ...info,
    ...partial,
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
  if (queue.length >= FLUSH_SIZE) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
};

// Envia a fila ao Supabase. Com `keepalive` a requisição sobrevive ao fechamento da aba.
export const flush = async (keepalive = false): Promise<void> => {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  while (queue.length > 0 && isTrackerConfigured()) {
    const batch = queue.splice(0, MAX_BATCH);
    try {
      const response = await fetch(`${TRACKER_URL}/rest/v1/sae_events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: TRACKER_ANON_KEY,
          Authorization: `Bearer ${TRACKER_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(batch),
        keepalive,
      });
      // erro 4xx (exceto limite de uso) é recusa definitiva: descarta o lote para não travar a fila
      if (!response.ok && !(response.status >= 400 && response.status < 500 && response.status !== 429)) throw new Error(String(response.status));
    } catch {
      // volta para a fila (no começo) e tenta de novo no próximo envio
      queue = [...batch, ...queue].slice(-MAX_QUEUE);
      timer = setTimeout(() => void flush(), FLUSH_MS * 3);
      return;
    }
    if (keepalive) break; // keepalive aceita ~64 KB por vez: o resto sai no próximo envio
  }
};

const visibleMs = (v: Visit): number => v.visibleMs + (v.visibleSince !== null ? Date.now() - v.visibleSince : 0);

const pushLeave = (): void => {
  if (!visit) return;
  push(
    {
      type: 'leave',
      duration_s: Math.min(MAX_STAY_S, Math.round(visibleMs(visit) / 1000)),
      scroll_pct: Math.max(visit.maxScroll, scrollPercent()),
      doc_h: documentHeight(),
    },
    visit.route,
    visit.id,
    visit.prevRoute,
  );
};

// Chamado a cada mudança de rota: fecha a visita anterior e abre a nova.
export const trackPageEnter = (route: string): void => {
  if (!enabled()) {
    visit = null;
    return;
  }
  // o modo estrito do React (só em desenvolvimento) executa o efeito duas vezes: ignora a entrada repetida
  if (visit && visit.route === route && Date.now() - visit.startedAt < 1000) return;
  if (visit) pushLeave();
  const prevRoute = lastRoute;
  lastRoute = route;
  if (!sessionStarted) {
    sessionStarted = true;
    push({ type: 'session_start' }, route, 'sessao', null);
  }
  visit = {
    id: randomId(),
    route,
    prevRoute,
    maxScroll: 0,
    visibleMs: 0,
    visibleSince: document.visibilityState === 'visible' ? Date.now() : null,
    startedAt: Date.now(),
  };
  push({ type: 'pageview', doc_h: documentHeight() }, route, visit.id, prevRoute);
};

// Fecha a visita atual e envia tudo (aba fechando ou indo para o segundo plano).
export const trackPageHide = (): void => {
  if (visit) {
    pushLeave();
    // a visita segue aberta se a pessoa voltar: o tempo conta só com a aba visível
    if (visit.visibleSince !== null) {
      visit.visibleMs += Date.now() - visit.visibleSince;
      visit.visibleSince = null;
    }
  }
  void flush(true);
};

export const trackPageShow = (): void => {
  if (visit && visit.visibleSince === null) visit.visibleSince = Date.now();
};

export const trackScroll = (): void => {
  if (visit) visit.maxScroll = Math.max(visit.maxScroll, scrollPercent());
};

const interactiveSelector = 'a[href], button, [role="button"], summary, label, select, input, textarea';

// Descreve o elemento sem nunca ler o que a pessoa digitou (valor de campos fica de fora).
const describe = (el: Element): { selector: string; label: string | null } => {
  const tag = el.tagName.toLowerCase();
  let selector = tag;
  if (el.id) selector += `#${el.id}`;
  const track = el.getAttribute('data-track');
  if (track) selector += `[data-track="${track}"]`;
  const href = tag === 'a' ? el.getAttribute('href') : null;
  if (href) selector += `[href="${href}"]`;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    const field = el as HTMLInputElement;
    const named = field.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('id');
    return { selector: selector.substring(0, 300), label: clip(named, 120) };
  }
  const text = el.getAttribute('aria-label') || el.getAttribute('title') || (el as HTMLElement).innerText;
  return { selector: selector.substring(0, 300), label: clip(text, 80) };
};

export const trackClick = (event: MouseEvent): void => {
  if (!enabled() || !visit || VISIT_ONLY_ROUTES.includes(visit.route)) return;
  const target = event.target as Element | null;
  if (!target || !target.closest) return;
  const interactive = target.closest(interactiveSelector);
  const described = interactive
    ? describe(interactive)
    : { selector: target.tagName.toLowerCase() + (target.id ? `#${target.id}` : ''), label: null };
  push(
    {
      type: 'click',
      selector: described.selector,
      label: described.label,
      x: Math.round(event.pageX),
      y: Math.round(event.pageY),
      doc_h: documentHeight(),
    },
    visit.route,
    visit.id,
    visit.prevRoute,
  );
};

// Mudança em lista de seleção ou caixa de marcar: guarda o campo e a opção escolhida (nunca texto digitado).
export const trackChange = (event: Event): void => {
  if (!enabled() || !visit || VISIT_ONLY_ROUTES.includes(visit.route)) return;
  const target = event.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target || !target.tagName) return;
  const tag = target.tagName.toLowerCase();
  const isSelect = tag === 'select';
  const isChoice = tag === 'input' && ['checkbox', 'radio'].includes((target as HTMLInputElement).type);
  if (!isSelect && !isChoice) return;
  const field = clip(target.labels?.[0]?.textContent || target.getAttribute('aria-label') || target.getAttribute('placeholder') || target.getAttribute('name') || target.id, 60) ?? 'campo';
  let value = '';
  if (isSelect) value = (target as HTMLSelectElement).selectedOptions?.[0]?.text ?? '';
  else value = (target as HTMLInputElement).checked ? 'marcado' : 'desmarcado';
  push(
    { type: 'change', selector: describe(target).selector, label: clip(`${field}: ${value}`, 120) },
    visit.route,
    visit.id,
    visit.prevRoute,
  );
};

// Ação nomeada (filtro aplicado, texto copiado, simulação feita...). O rótulo nunca deve conter dado pessoal.
export const trackAction = (label: string): void => {
  if (!enabled() || !visit) return;
  push({ type: 'action', label: clip(label, 120) }, visit.route, visit.id, visit.prevRoute);
};

// Saída do sistema: registra, envia e zera a sessão para a próxima pessoa que entrar neste navegador.
export const trackLogout = (): void => {
  if (enabled() && visit) {
    pushLeave();
    push({ type: 'logout' }, visit.route, visit.id, visit.prevRoute);
    void flush(true);
  }
  visit = null;
  lastRoute = null;
  sessionStarted = false;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // armazenamento indisponível
  }
};
