import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../UI';
import { Period, routeName } from '../../lib/analytics';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import { Bar, QueryState, inputClass } from './Shared';

const FALLBACK_WIDTH = 1440;
const RADIUS = 35;

// Mostra a própria página do SAE num iframe (mesma origem, então a sessão do administrativo já vale) e desenha
// os pontos de clique num canvas por cima, igual ao mapa de calor do ITEQ.
const HeatCanvas: React.FC<{ route: string; width: number; points: [number, number][] }> = ({ route, width, points }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(900);
  const [scale, setScale] = useState(1);

  const src = `${window.location.origin}${window.location.pathname}#${route}`;

  useEffect(() => setLoaded(false), [route, width]);

  // Reduz a visualização para caber na área disponível (sem rolagem lateral).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(Math.min(1, box.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [width]);

  // Acompanha a altura real da página (imagens e listas carregam depois) e redesenha os pontos.
  useEffect(() => {
    if (!loaded) return;
    const draw = () => {
      const frame = frameRef.current;
      const canvas = canvasRef.current;
      if (!frame || !canvas) return;
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        const full = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 600);
        if (full !== height) setHeight(full);
        if (canvas.width !== width || canvas.height !== full) {
          canvas.width = width;
          canvas.height = full;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        points.forEach(([x, y]) => {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, RADIUS);
          gradient.addColorStop(0, 'rgba(255, 0, 0, 0.55)');
          gradient.addColorStop(0.4, 'rgba(255, 165, 0, 0.35)');
          gradient.addColorStop(0.8, 'rgba(255, 255, 0, 0.15)');
          gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');
          ctx.beginPath();
          ctx.arc(x, y, RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = gradient;
          ctx.fill();
        });
      } catch {
        // página de outra origem: não dá para medir
      }
    };
    const first = setTimeout(draw, 600);
    const again = setInterval(draw, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  }, [loaded, points, width, height]);

  return (
    <div ref={boxRef} className="w-full bg-sae-soft rounded-lg overflow-hidden border border-sae-border">
      <div style={{ height: height * scale }}>
        <div className="relative bg-white" style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <iframe
            ref={frameRef}
            title={`Página ${routeName(route)}`}
            src={src}
            scrolling="no"
            onLoad={() => setLoaded(true)}
            className="border-0 block"
            style={{ width, height, pointerEvents: 'none' }}
          />
          <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" style={{ width, height, mixBlendMode: 'multiply' }} />
          {!loaded && <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sae-muted text-sm">Carregando a página...</div>}
        </div>
      </div>
    </div>
  );
};

export const Heatmap: React.FC<{ period: Period }> = ({ period }) => {
  const routes = useAnalyticsQuery('routes', period);
  const users = useAnalyticsQuery('users', period);
  const [route, setRoute] = useState('');
  const [target, setTarget] = useState('');
  const [width, setWidth] = useState<number | null>(null);

  // Escolhe a página mais vista quando a lista chega (ou quando a escolhida some do período).
  useEffect(() => {
    if (!routes.data) return;
    if (!routes.data.some((row) => row.route === route)) setRoute(routes.data[0]?.route ?? '');
  }, [routes.data, route]);

  const heat = useAnalyticsQuery('heatmap', route ? { ...period, route, target: target || undefined, vw: width ?? undefined } : null);
  const data = heat.data;
  const shownWidth = data?.width ?? width ?? FALLBACK_WIDTH;
  const maxClicks = Math.max(0, ...(data?.elements ?? []).map((item) => item.clicks));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs font-bold uppercase tracking-wide text-sae-muted">
          Página
          <select className={`${inputClass} block mt-1 min-w-[220px] normal-case font-normal`} value={route} onChange={(event) => {
              setRoute(event.target.value);
              setWidth(null); // volta para a largura mais comum dos dados
            }}>
            {(routes.data ?? []).map((row) => (
              <option key={row.route} value={row.route}>
                {routeName(row.route)} ({row.clicks} cliques)
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-sae-muted">
          Usuário
          <select className={`${inputClass} block mt-1 min-w-[200px] normal-case font-normal`} value={target} onChange={(event) => {
              setTarget(event.target.value);
              setWidth(null);
            }}>
            <option value="">Todos</option>
            {(users.data ?? []).map((row) => (
              <option key={row.login} value={row.login}>
                {row.login}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-sae-muted">
          Largura da tela
          <select
            className={`${inputClass} block mt-1 min-w-[200px] normal-case font-normal`}
            value={data?.width ?? ''}
            onChange={(event) => setWidth(Number(event.target.value) || null)}
            disabled={!data || data.widths.length === 0}
          >
            {(data?.widths ?? []).map((item) => (
              <option key={item.vw} value={item.vw}>
                {item.vw}px ({item.n} cliques)
              </option>
            ))}
          </select>
        </label>
      </div>

      <QueryState loading={routes.loading} error={routes.error} empty={!!routes.data && routes.data.length === 0} onRetry={routes.reload} />

      {route && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-6 items-start">
          <div className="min-w-0">
            <QueryState loading={heat.loading} error={heat.error} onRetry={heat.reload} />
            {data && data.points.length === 0 && !heat.loading && (
              <p className="text-sm text-sae-muted mb-3">Nenhum clique registrado nesta página, com esse filtro e essa largura de tela.</p>
            )}
            {data && <HeatCanvas route={route} width={shownWidth} points={data.points} />}
          </div>

          {data && (
            <aside className="space-y-4">
              <Card className="p-4">
                <h3 className="font-heading font-bold text-sae-text">Resumo</h3>
                <p className="text-sm text-sae-muted mt-1">
                  {data.views} visitas e {data.points.length} cliques na largura de {shownWidth}px.
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-heading font-bold text-sae-text mb-3">Elementos mais clicados</h3>
                {data.elements.length === 0 ? (
                  <p className="text-sm text-sae-muted">Sem cliques.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.elements.map((item) => (
                      <li key={item.label}>
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="truncate text-sae-text" title={item.label}>
                            {item.label}
                          </span>
                          <span className="tabular-nums text-sae-muted">{item.clicks}</span>
                        </div>
                        <Bar value={item.clicks} max={maxClicks} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="font-heading font-bold text-sae-text mb-1">Até onde rolam a página</h3>
                <p className="text-xs text-sae-muted mb-3">Parte das visitas que chegou a cada ponto da página.</p>
                {data.scroll.length === 0 ? (
                  <p className="text-sm text-sae-muted">Sem dados de rolagem.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.scroll.map((band) => {
                      const share = band.total > 0 ? Math.round((band.visits / band.total) * 100) : 0;
                      return (
                        <li key={band.pct} className="flex items-center gap-2 text-xs">
                          <span className="w-9 text-right text-sae-muted tabular-nums">{band.pct}%</span>
                          <div className="flex-1">
                            <Bar value={share} max={100} />
                          </div>
                          <span className="w-9 tabular-nums text-sae-text">{share}%</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
