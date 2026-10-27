import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '../UI';
import { JourneyEvent, Period, formatDuration, routeName } from '../../lib/analytics';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import { QueryState, inputClass } from './Shared';

interface Step {
  pvId: string;
  route: string;
  at: string;
  duration: number | null;
  scroll: number | null;
  actions: JourneyEvent[];
}

interface Session {
  id: string;
  start: string;
  device: string;
  steps: Step[];
  ended: boolean;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

// Junta os eventos de cada sessão: uma etapa por página visitada, com os cliques dentro dela e o tempo/rolagem finais.
const buildSessions = (events: JourneyEvent[]): Session[] => {
  const sessions = new Map<string, Session>();
  const steps = new Map<string, Step>();
  events.forEach((event) => {
    let session = sessions.get(event.session_id);
    if (!session) {
      session = { id: event.session_id, start: event.ts, device: [event.device, event.browser].filter(Boolean).join(' - '), steps: [], ended: false };
      sessions.set(event.session_id, session);
    }
    if (event.type === 'logout') session.ended = true;
    if (event.type === 'session_start') return;
    let step = steps.get(event.pv_id);
    if (!step) {
      if (event.type !== 'pageview') return; // clique de uma visita cujo início não veio: ignora
      step = { pvId: event.pv_id, route: event.route, at: event.ts, duration: null, scroll: null, actions: [] };
      steps.set(event.pv_id, step);
      session.steps.push(step);
      return;
    }
    if (event.type === 'leave') {
      step.duration = Math.max(step.duration ?? 0, event.duration_s ?? 0);
      step.scroll = Math.max(step.scroll ?? 0, event.scroll_pct ?? 0);
    } else if (event.type === 'click' || event.type === 'change' || event.type === 'action') {
      step.actions.push(event);
    }
  });
  return [...sessions.values()].filter((session) => session.steps.length > 0).sort((a, b) => b.start.localeCompare(a.start));
};

const chain = (session: Session): string[] =>
  session.steps.map((step) => routeName(step.route)).filter((name, index, all) => index === 0 || name !== all[index - 1]);

const ACTION_LABEL: Record<string, string> = { click: 'Clicou em', change: 'Alterou', action: 'Ação' };

export const Journey: React.FC<{ period: Period }> = ({ period }) => {
  const users = useAnalyticsQuery('users', period);
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (!users.data) return;
    if (!users.data.some((row) => row.login === target)) setTarget(users.data[0]?.login ?? '');
  }, [users.data, target]);

  const journey = useAnalyticsQuery('journey', target ? { ...period, target } : null);
  const sessions = useMemo(() => buildSessions(journey.data ?? []), [journey.data]);

  return (
    <div className="space-y-4">
      <label className="block text-xs font-bold uppercase tracking-wide text-sae-muted">
        Usuário
        <select className={`${inputClass} block mt-1 min-w-[260px] normal-case font-normal`} value={target} onChange={(event) => setTarget(event.target.value)}>
          {(users.data ?? []).map((row) => (
            <option key={row.login} value={row.login}>
              {row.login} ({row.views} páginas, {row.sessions} sessões)
            </option>
          ))}
        </select>
      </label>

      <QueryState loading={users.loading} error={users.error} empty={!!users.data && users.data.length === 0} onRetry={users.reload} />
      <QueryState loading={journey.loading} error={journey.error} empty={!!journey.data && sessions.length === 0} onRetry={journey.reload} />

      {journey.data && journey.data.length >= 3000 && (
        <p className="text-xs text-sae-muted">Mostrando os primeiros 3000 passos do período. Reduza o período para ver o restante.</p>
      )}

      <div className="space-y-4">
        {sessions.map((session) => (
          <Card key={session.id} className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-heading font-bold text-sae-text">
                {day(session.start)} às {time(session.start)}
              </h3>
              <span className="text-xs text-sae-muted">
                {session.device || 'Dispositivo desconhecido'} - {session.steps.length} {session.steps.length === 1 ? 'página' : 'páginas'}
                {session.ended ? ' - saiu do sistema' : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 mt-3 text-sm" aria-label="Caminho percorrido">
              {chain(session).map((name, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <ChevronRight size={14} className="text-sae-muted" />}
                  <span className="px-2 py-0.5 rounded-full bg-sae-accentSoft text-sae-accentText font-medium">{name}</span>
                </React.Fragment>
              ))}
            </div>

            <ol className="mt-4 space-y-3 border-l-2 border-sae-border pl-4">
              {session.steps.map((step) => (
                <li key={step.pvId} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 w-2.5 h-2.5 rounded-full bg-sae-accent" />
                  <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="text-sae-muted tabular-nums">{time(step.at)}</span>
                    <span className="font-semibold text-sae-text">{routeName(step.route)}</span>
                    <span className="text-xs text-sae-muted">
                      {formatDuration(step.duration)} na página{step.scroll !== null ? `, rolou ${step.scroll}%` : ''}
                    </span>
                  </div>
                  {step.actions.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm text-sae-muted">
                      {step.actions.map((action) => (
                        <li key={action.id}>
                          <span className="tabular-nums text-xs">{time(action.ts)}</span> {ACTION_LABEL[action.type]}{' '}
                          <span className="text-sae-text">{action.label || '(área sem botão)'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
};
