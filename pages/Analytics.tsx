import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Breadcrumb, SectionTitle } from '../components/UI';
import { Overview } from '../components/analytics/Overview';
import { Heatmap } from '../components/analytics/Heatmap';
import { Journey } from '../components/analytics/Journey';
import { Flow } from '../components/analytics/Flow';
import { TimeByUser } from '../components/analytics/TimeByUser';
import { inputClass } from '../components/analytics/Shared';
import { Period, lastDays } from '../lib/analytics';
import { can } from '../lib/permissions';
import { isOptedOut, isTrackerConfigured, setOptOut } from '../lib/tracker';

const TABS = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'heatmap', label: 'Mapa de calor' },
  { id: 'journey', label: 'Jornada do usuário' },
  { id: 'time', label: 'Tempo por usuário' },
  { id: 'flow', label: 'Fluxo' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

// Painel de análises de uso (só Administrativo): onde as pessoas clicam, por onde navegam e quanto tempo ficam.
export const Analytics: React.FC = () => {
  const [tab, setTab] = useState<TabId>('overview');
  const [period, setPeriod] = useState<Period>(() => lastDays(30));
  const [optedOut, setOptedOutState] = useState(isOptedOut());

  if (!can('viewAnalytics')) return <Navigate to="/" replace />;

  const updatePeriod = (patch: Partial<Period>) => {
    setPeriod((current) => {
      const next = { ...current, ...patch };
      return next.from && next.to && next.from <= next.to ? next : current;
    });
  };

  const handleOptOut = (value: boolean) => {
    setOptOut(value);
    setOptedOutState(value);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Análises de uso' }]} />
        <SectionTitle title="Análises de uso" subtitle="Veja por onde as pessoas navegam no SAE, onde clicam e quanto tempo ficam em cada página." />

        {!isTrackerConfigured() && (
          <p role="status" className="mb-6 rounded-lg border border-sae-border bg-sae-soft p-4 text-sm text-sae-text">
            O registro de uso ainda não está ligado: preencha o endereço e a chave do Supabase em <code>lib/trackerConfig.ts</code>. Veja o passo a passo no README.
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold uppercase tracking-wide text-sae-muted">
              De
              <input type="date" className={`${inputClass} block mt-1`} value={period.from} max={period.to} onChange={(event) => updatePeriod({ from: event.target.value })} />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-sae-muted">
              Até
              <input type="date" className={`${inputClass} block mt-1`} value={period.to} min={period.from} onChange={(event) => updatePeriod({ to: event.target.value })} />
            </label>
            <div className="flex gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setPeriod(lastDays(preset.days))}
                  className="px-3 py-2 rounded-full border border-sae-border text-sm text-sae-muted hover:text-sae-accentText hover:border-sae-accent transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-sae-muted cursor-pointer">
            <input type="checkbox" checked={optedOut} onChange={(event) => handleOptOut(event.target.checked)} className="w-4 h-4 accent-[#a02d32]" />
            Não registrar meu uso neste navegador
          </label>
        </div>

        <div role="tablist" aria-label="Seções das análises" className="flex flex-wrap gap-2 border-b border-sae-border mb-6">
          {TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                tab === item.id ? 'border-sae-accent text-sae-accentText' : 'border-transparent text-sae-muted hover:text-sae-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview period={period} />}
        {tab === 'heatmap' && <Heatmap period={period} />}
        {tab === 'journey' && <Journey period={period} />}
        {tab === 'time' && <TimeByUser period={period} />}
        {tab === 'flow' && <Flow period={period} />}
      </div>
    </Layout>
  );
};
