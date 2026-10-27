import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '../UI';
import { Period, TimeRow, formatDuration, routeName } from '../../lib/analytics';
import { foldText } from '../../lib/courses';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import { Bar, QueryState, StatCard, inputClass } from './Shared';

type Mode = 'user' | 'page';

interface Child {
  key: string;
  label: string;
  visits: number;
  timed: number;
  total_s: number;
}

interface Group {
  key: string;
  label: string;
  sub: string;
  visits: number;
  timed: number;
  total_s: number;
  children: Child[];
}

const average = (total: number, timed: number): number | null => (timed > 0 ? Math.round(total / timed) : null);

// Agrupa as linhas (login, página) por usuário ou por página; os filhos são o outro lado.
const group = (rows: TimeRow[], mode: Mode): Group[] => {
  const groups = new Map<string, Group>();
  rows.forEach((row) => {
    const key = mode === 'user' ? row.login : row.route;
    const childKey = mode === 'user' ? row.route : row.login;
    const found = groups.get(key) ?? {
      key,
      label: mode === 'user' ? row.login : routeName(row.route),
      sub: mode === 'user' ? row.role ?? '' : '',
      visits: 0,
      timed: 0,
      total_s: 0,
      children: [],
    };
    found.visits += row.visits;
    found.timed += row.timed;
    found.total_s += row.total_s;
    found.children.push({ key: childKey, label: mode === 'user' ? routeName(row.route) : row.login, visits: row.visits, timed: row.timed, total_s: row.total_s });
    groups.set(key, found);
  });
  return [...groups.values()]
    .map((entry) => ({ ...entry, children: entry.children.sort((a, b) => b.total_s - a.total_s || b.visits - a.visits) }))
    .sort((a, b) => b.total_s - a.total_s || b.visits - a.visits);
};

const GroupRow: React.FC<{ entry: Group; mode: Mode; open: boolean; onToggle: () => void }> = ({ entry, mode, open, onToggle }) => {
  const top = entry.children[0];
  const maxChild = Math.max(0, ...entry.children.map((child) => child.total_s));
  return (
    <li className="border-t border-sae-border first:border-t-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left py-3 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-sae-soft/60 transition-colors px-2 rounded-lg">
        <ChevronDown size={18} className={`shrink-0 text-sae-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        <span className="flex-1 min-w-[10rem]">
          <span className="font-semibold text-sae-text break-all">{entry.label}</span>
          {entry.sub && <span className="ml-2 text-xs text-sae-muted">{entry.sub}</span>}
        </span>
        <span className="text-sm tabular-nums text-sae-text font-semibold w-24 text-right">{formatDuration(entry.total_s)}</span>
        <span className="text-xs text-sae-muted w-24 text-right">
          {entry.visits} {entry.visits === 1 ? 'visita' : 'visitas'}
        </span>
        <span className="text-xs text-sae-muted flex-1 min-w-[9rem] hidden md:block truncate">
          {mode === 'user' ? 'Mais tempo em' : 'Quem mais ficou'}: <span className="text-sae-text">{top?.label ?? '-'}</span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto pb-3 pl-9 pr-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-sae-muted">
                <th className="py-1.5 pr-4">{mode === 'user' ? 'Página' : 'Usuário'}</th>
                <th className="py-1.5 pr-4 w-1/3">Tempo</th>
                <th className="py-1.5 pr-4 text-right">Visitas</th>
                <th className="py-1.5 text-right">Médio por visita</th>
              </tr>
            </thead>
            <tbody>
              {entry.children.map((child) => (
                <tr key={child.key} className="border-t border-sae-border">
                  <td className="py-1.5 pr-4 font-medium text-sae-text break-all">{child.label}</td>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-[4rem]">
                        <Bar value={child.total_s} max={maxChild} />
                      </div>
                      <span className="w-20 text-right tabular-nums whitespace-nowrap">{formatDuration(child.total_s)}</span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{child.visits}</td>
                  <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{formatDuration(average(child.total_s, child.timed))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
};

// Resumo do tempo que cada usuário passa em cada página (ou, ao contrário, quem passa mais tempo em cada página).
export const TimeByUser: React.FC<{ period: Period }> = ({ period }) => {
  const { data, loading, error, reload } = useAnalyticsQuery('time', period);
  const [mode, setMode] = useState<Mode>('user');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => group(data ?? [], mode), [data, mode]);
  const term = foldText(search.trim());
  const shown = term ? groups.filter((entry) => foldText(entry.label).includes(term)) : groups;
  const users = useMemo(() => new Set((data ?? []).map((row) => row.login)).size, [data]);
  const total = (data ?? []).reduce((sum, row) => sum + row.total_s, 0);
  const empty = !!data && data.length === 0;

  const changeMode = (next: Mode) => {
    setMode(next);
    setOpen(null);
  };

  return (
    <div className="space-y-6">
      <QueryState loading={loading} error={error} empty={empty} onRetry={reload} />
      {data && !empty && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Usuários" value={users} />
            <StatCard label="Tempo total no SAE" value={formatDuration(total)} />
            <StatCard label="Tempo médio por usuário" value={formatDuration(users > 0 ? Math.round(total / users) : null)} />
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-sae-text">Tempo {mode === 'user' ? 'por usuário' : 'por página'}</h2>
                <p className="text-sm text-sae-muted">Clique em {mode === 'user' ? 'um usuário' : 'uma página'} para ver o detalhe. Conta só o tempo com a aba aberta e visível.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Agrupar por" className="flex rounded-full border border-sae-border overflow-hidden text-sm">
                  {(['user', 'page'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={mode === item}
                      onClick={() => changeMode(item)}
                      className={`px-3 py-1.5 font-semibold transition-colors ${mode === item ? 'bg-sae-accent text-white' : 'text-sae-muted hover:text-sae-text'}`}
                    >
                      {item === 'user' ? 'Por usuário' : 'Por página'}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={mode === 'user' ? 'Buscar usuário' : 'Buscar página'}
                  aria-label={mode === 'user' ? 'Buscar usuário' : 'Buscar página'}
                  className={`${inputClass} w-48`}
                />
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="text-sm text-sae-muted py-4">Nada encontrado para essa busca.</p>
            ) : (
              <ul>
                {shown.map((entry) => (
                  <GroupRow key={entry.key} entry={entry} mode={mode} open={open === entry.key} onToggle={() => setOpen(open === entry.key ? null : entry.key)} />
                ))}
              </ul>
            )}
            <p className="text-xs text-sae-muted mt-4">
              Visitas em que a aba foi fechada de repente contam como visita, mas ficam sem tempo; por isso o tempo médio considera só as visitas com tempo registrado.
            </p>
          </Card>
        </>
      )}
    </div>
  );
};
