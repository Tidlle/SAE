import React from 'react';
import { Card } from '../UI';
import { Period, formatDuration, routeName } from '../../lib/analytics';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import { Bar, QueryState, StatCard } from './Shared';

export const Overview: React.FC<{ period: Period }> = ({ period }) => {
  const { data, loading, error, reload } = useAnalyticsQuery('overview', period);
  const empty = !!data && data.views === 0;
  const maxViews = Math.max(0, ...(data?.pages ?? []).map((page) => page.views));
  const hours = Array.from({ length: 24 }, (_, hour) => (data?.by_hour ?? []).find((row) => row.hour === hour)?.views ?? 0);
  const maxHour = Math.max(0, ...hours);

  return (
    <div className="space-y-6">
      <QueryState loading={loading} error={error} empty={empty} onRetry={reload} />
      {data && !empty && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Páginas vistas" value={data.views} />
            <StatCard label="Sessões" value={data.sessions} />
            <StatCard label="Usuários" value={data.users} />
            <StatCard label="Cliques" value={data.clicks} />
            <StatCard label="Tempo médio na página" value={formatDuration(data.avg_s)} />
          </div>

          <Card className="p-5">
            <h2 className="text-lg font-heading font-bold text-sae-text mb-3">Páginas mais vistas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sae-muted">
                    <th className="py-2 pr-4">Página</th>
                    <th className="py-2 pr-4 w-1/3">Visitas</th>
                    <th className="py-2 pr-4 text-right">Usuários</th>
                    <th className="py-2 text-right">Tempo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.map((page) => (
                    <tr key={page.route} className="border-t border-sae-border">
                      <td className="py-2 pr-4 font-medium text-sae-text">{routeName(page.route)}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Bar value={page.views} max={maxViews} />
                          </div>
                          <span className="w-10 text-right tabular-nums">{page.views}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{page.users}</td>
                      <td className="py-2 text-right tabular-nums">{formatDuration(page.avg_s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-heading font-bold text-sae-text mb-1">Horários de pico</h2>
            <p className="text-sm text-sae-muted mb-4">Páginas vistas por hora do dia (horário de Brasília).</p>
            <div className="flex items-end gap-1 h-32" role="img" aria-label="Páginas vistas por hora do dia">
              {hours.map((views, hour) => (
                <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full" title={`${hour}h: ${views} páginas`}>
                  <div className="w-full rounded-t bg-sae-accent" style={{ height: `${maxHour > 0 ? Math.max(views > 0 ? 3 : 0, Math.round((views / maxHour) * 100)) : 0}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-1 text-[10px] text-sae-muted">
              {hours.map((_, hour) => (
                <span key={hour} className="flex-1 text-center">
                  {hour % 3 === 0 ? hour : ''}
                </span>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
