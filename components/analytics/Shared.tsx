import React from 'react';
import { Button, Card } from '../UI';

export const inputClass =
  'bg-sae-darker border border-sae-border rounded-lg px-3 py-2 text-sm text-sae-text focus:border-sae-accent outline-none';

export const StatCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Card className="p-4">
    <div className="text-xs font-bold uppercase tracking-wide text-sae-muted">{label}</div>
    <div className="text-2xl font-heading font-bold text-sae-text mt-1">{value}</div>
  </Card>
);

// Barra horizontal proporcional (largura em % do maior valor).
export const Bar: React.FC<{ value: number; max: number }> = ({ value, max }) => (
  <div className="h-2 rounded-full bg-sae-soft overflow-hidden">
    <div className="h-full rounded-full bg-sae-accent" style={{ width: `${max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0}%` }} />
  </div>
);

export const QueryState: React.FC<{ loading: boolean; error: string; empty?: boolean; emptyText?: string; onRetry?: () => void }> = ({
  loading,
  error,
  empty,
  emptyText = 'Ainda não há dados neste período.',
  onRetry,
}) => {
  if (loading) return <p className="text-sm text-sae-muted py-6">Carregando...</p>;
  if (error) {
    return (
      <div role="alert" className="text-sm text-sae-danger py-4 flex flex-wrap items-center gap-3">
        {error}
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }
  if (empty) return <p className="text-sm text-sae-muted py-6">{emptyText}</p>;
  return null;
};
