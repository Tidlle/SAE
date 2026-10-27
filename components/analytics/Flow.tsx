import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '../UI';
import { Period, routeName } from '../../lib/analytics';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import { Bar, QueryState } from './Shared';

export const Flow: React.FC<{ period: Period }> = ({ period }) => {
  const { data, loading, error, reload } = useAnalyticsQuery('flow', period);
  const empty = !!data && data.transitions.length === 0 && data.paths.length === 0;
  const maxTransition = Math.max(0, ...(data?.transitions ?? []).map((item) => item.n));
  const maxPath = Math.max(0, ...(data?.paths ?? []).map((item) => item.n));

  return (
    <div className="space-y-6">
      <QueryState loading={loading} error={error} empty={empty} emptyText="Ainda não há navegação entre páginas neste período." onRetry={reload} />
      {data && !empty && (
        <>
          <Card className="p-5">
            <h2 className="text-lg font-heading font-bold text-sae-text">Caminhos mais comuns</h2>
            <p className="text-sm text-sae-muted mb-4">Sequência de páginas por sessão (até 6 passos).</p>
            <ul className="space-y-4">
              {data.paths.map((item) => (
                <li key={item.path}>
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    {item.path.split(' > ').map((route, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <ChevronRight size={14} className="text-sae-muted" />}
                        <span className="px-2 py-0.5 rounded-full bg-sae-accentSoft text-sae-accentText font-medium">{routeName(route)}</span>
                      </React.Fragment>
                    ))}
                    <span className="ml-2 text-sae-muted tabular-nums">{item.n}x</span>
                  </div>
                  <div className="mt-1.5 max-w-md">
                    <Bar value={item.n} max={maxPath} />
                  </div>
                </li>
              ))}
              {data.paths.length === 0 && <li className="text-sm text-sae-muted">Nenhuma sessão passou por mais de uma página.</li>}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-heading font-bold text-sae-text mb-3">Para onde as pessoas vão</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-sae-muted">
                    <th className="py-2 pr-4">De</th>
                    <th className="py-2 pr-4">Para</th>
                    <th className="py-2 w-1/3">Vezes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transitions.map((item) => (
                    <tr key={`${item.from}>${item.to}`} className="border-t border-sae-border">
                      <td className="py-2 pr-4 text-sae-text">{routeName(item.from)}</td>
                      <td className="py-2 pr-4 text-sae-text">{routeName(item.to)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Bar value={item.n} max={maxTransition} />
                          </div>
                          <span className="w-10 text-right tabular-nums">{item.n}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
