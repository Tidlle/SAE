import React from 'react';
import { Card } from '../UI';
import { Period } from '../../lib/analytics';
import { OBJECTIONS } from '../../lib/assistant/objections';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import { Bar, QueryState, StatCard } from './Shared';

const objectionName = (id: string): string => OBJECTIONS.find((item) => item.id === id)?.title ?? (id === 'outro' ? 'Outro motivo' : id);

const BreakdownTable: React.FC<{ title: string; rows: { key: string; n: number }[]; empty: string }> = ({ title, rows, empty }) => {
  const max = Math.max(0, ...rows.map((row) => row.n));
  return (
    <Card className="p-5">
      <h2 className="text-lg font-heading font-bold text-sae-text mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-sae-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-sae-text">{objectionName(row.key)}</span>
                <span className="tabular-nums text-sae-muted">{row.n}</span>
              </div>
              <Bar value={row.n} max={max} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

// Atendimentos consultivos do Meu Assistente: recomendações, objeções, mensagens, e como terminaram (venda fechada ou não).
export const AssistantStats: React.FC<{ period: Period }> = ({ period }) => {
  const { data, loading, error, reload } = useAnalyticsQuery('assistant', period);
  const empty = !!data && data.totals.recommended === 0 && data.totals.won === 0 && data.totals.lost === 0 && data.totals.objections === 0;
  const closed = data ? data.totals.won + data.totals.lost : 0;

  return (
    <div className="space-y-6">
      <QueryState loading={loading} error={error} empty={empty} emptyText="Ainda não há atendimentos do assistente neste período." onRetry={reload} />
      {data && !empty && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Recomendações" value={data.totals.recommended} />
            <StatCard label="Mensagens ao aluno" value={data.totals.messages} />
            <StatCard label="Vendas fechadas" value={data.totals.won} />
            <StatCard label="Taxa de fechamento" value={closed > 0 ? `${Math.round((data.totals.won / closed) * 100)}%` : '-'} />
          </div>
          <p className="text-xs text-sae-muted">
            A taxa de fechamento considera só os atendimentos em que o vendedor registrou o resultado ("Venda fechada" ou "Não fechou"): {data.totals.won} fechadas e {data.totals.lost} não fechadas.
            Cada recomendação conta uma vez, inclusive quando o vendedor pede os mais rápidos ou os mais baratos.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownTable title="Objeções trabalhadas" rows={data.objections.map((item) => ({ key: item.id, n: item.n }))} empty="Nenhuma objeção consultada no período." />
            <BreakdownTable title="Por que a venda não fechou" rows={data.lost.map((item) => ({ key: item.id, n: item.n }))} empty="Nenhuma venda perdida registrada no período." />
          </div>

          <Card className="p-5 overflow-x-auto">
            <h2 className="text-lg font-heading font-bold text-sae-text mb-3">Por vendedor</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-sae-muted">
                  <th className="py-1.5 pr-4">Usuário</th>
                  <th className="py-1.5 pr-4 text-right">Recomendações</th>
                  <th className="py-1.5 pr-4 text-right">Objeções</th>
                  <th className="py-1.5 pr-4 text-right">Mensagens</th>
                  <th className="py-1.5 pr-4 text-right">Fechadas</th>
                  <th className="py-1.5 text-right">Não fechadas</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((row) => (
                  <tr key={row.login} className="border-t border-sae-border">
                    <td className="py-1.5 pr-4 font-medium text-sae-text break-all">{row.login}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{row.recommended}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{row.objections}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{row.messages}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{row.won}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
};
