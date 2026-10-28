import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Calendar, FilePlus, History, Info, Tags } from 'lucide-react';
import { Badge, Button, Card } from './UI';
import { FACET_GROUPS, Facet, FacetGroup } from '../lib/courses';

const PAGE_SIZE = 25;

const GROUP_LABELS: Record<FacetGroup, string> = {
  ies: 'Instituição',
  area: 'Área',
  tipo: 'Tipo',
  modalidade: 'Modalidade',
};

const SHORTCUTS = [
  { label: 'Combos', text: 'Pacotes de matrícula com valores', path: '/cursos/combos', icon: Tags },
  { label: 'Simulador', text: 'Cursos de destino e prazos', path: '/simulador', icon: Calculator },
  { label: 'Calendário de aulas', text: 'Datas e horários das aulas', path: '/cursos/calendario', icon: Calendar },
  { label: 'Solicitar novo curso', text: 'Sugira um curso que falta', path: '/cursos/criacao', icon: FilePlus },
];

interface CoursesOverviewProps {
  total: number;
  institutionCount: number;
  facets: Record<FacetGroup, Facet[]>;
  filters: Record<FacetGroup, string>;
  onFilterChange: (group: FacetGroup, key: string) => void;
  onClearFilters: () => void;
  filteredRows: any[][];
  nameIndex: number;
  iesIndex: number;
  tipoIndex: number;
  modalidadeIndex: number;
  recentRows: any[][];
  onSelect: (row: any[]) => void;
  onClearRecents: () => void;
}

export const CoursesOverview: React.FC<CoursesOverviewProps> = ({
  total,
  institutionCount,
  facets,
  filters,
  onFilterChange,
  onClearFilters,
  filteredRows,
  nameIndex,
  iesIndex,
  tipoIndex,
  modalidadeIndex,
  recentRows,
  onSelect,
  onClearRecents,
}) => {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const hasFilters = FACET_GROUPS.some((group) => filters[group]);
  const signature = FACET_GROUPS.map((group) => filters[group]).join('|');

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [signature]);

  const cellText = (row: any[], index: number) => (index === -1 ? '' : (row[index] ?? '').toString().trim());

  return (
    <div className="space-y-8 animate-fadeIn">
      {recentRows.length > 0 && (
        <section aria-labelledby="recent-title">
          <div className="flex items-center justify-between mb-3">
            <h3 id="recent-title" className="text-lg font-heading font-bold text-sae-text flex items-center gap-2">
              <History size={20} className="text-sae-accentText" /> Consultados recentemente
            </h3>
            <button type="button" onClick={onClearRecents} className="text-sm text-sae-muted hover:text-sae-accentText transition-colors">
              Limpar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentRows.map((row, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelect(row)}
                className="max-w-full flex items-center gap-2 px-3 py-2 rounded-full border border-sae-border bg-sae-card text-sm text-sae-text hover:border-sae-accent transition-colors"
              >
                <span className="truncate">{cellText(row, nameIndex)}</span>
                {cellText(row, iesIndex) && <Badge variant="primary">{cellText(row, iesIndex)}</Badge>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="overview-title">
        <h3 id="overview-title" className="text-2xl font-heading font-bold text-sae-text">
          {total} cursos em {institutionCount} {institutionCount === 1 ? 'instituição' : 'instituições'}
        </h3>
        <p className="text-sae-muted mt-1 mb-5">Digite o nome do curso acima ou explore pelos filtros abaixo.</p>

        <div className="space-y-4">
          {FACET_GROUPS.map((group) => (
            <div key={group}>
              <div className="text-xs font-bold uppercase tracking-wide text-sae-muted mb-2">{GROUP_LABELS[group]}</div>
              <div className="flex flex-wrap gap-2">
                {facets[group].map((facet) => {
                  const active = filters[group] === facet.key;
                  return (
                    <button
                      key={facet.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onFilterChange(group, active ? '' : facet.key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-sae-accent text-white border-sae-accent'
                          : facet.count === 0
                            ? 'bg-sae-card text-sae-muted border-sae-border opacity-60'
                            : 'bg-sae-card text-sae-text border-sae-border hover:border-sae-accent'
                      }`}
                    >
                      {facet.label} <span className={active ? 'text-white/80' : 'text-sae-muted'}>({facet.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {hasFilters && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold text-sae-text" aria-live="polite">
                {filteredRows.length} {filteredRows.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
              </p>
              <button type="button" onClick={onClearFilters} className="text-sm font-semibold text-sae-accentText hover:text-sae-accentHover">
                Limpar filtros
              </button>
            </div>
            {filteredRows.length === 0 ? (
              <Card className="p-6 text-center text-sae-muted text-sm">Nenhum curso com essa combinação de filtros.</Card>
            ) : (
              <Card className="divide-y divide-sae-border">
                {filteredRows.slice(0, visible).map((row, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelect(row)}
                    className="w-full text-left px-5 py-3 hover:bg-sae-accent/10 text-sae-text transition-colors flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  >
                    <span className="min-w-0 break-words">{cellText(row, nameIndex)}</span>
                    <span className="flex flex-wrap items-center gap-2 shrink-0">
                      {cellText(row, iesIndex) && <Badge variant="primary">{cellText(row, iesIndex)}</Badge>}
                      {cellText(row, tipoIndex) && <Badge variant="secondary">{cellText(row, tipoIndex)}</Badge>}
                      {cellText(row, modalidadeIndex) && <Badge variant="secondary">{cellText(row, modalidadeIndex)}</Badge>}
                    </span>
                  </button>
                ))}
              </Card>
            )}
            {filteredRows.length > visible && (
              <div className="text-center mt-4">
                <Button variant="outline" size="sm" onClick={() => setVisible(visible + PAGE_SIZE)}>
                  Ver mais cursos ({filteredRows.length - visible} restantes)
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <Card className="p-5">
        <h3 className="text-lg font-heading font-bold text-sae-text flex items-center gap-2 mb-3">
          <Info size={20} className="text-sae-accentText" /> Como ler os valores
        </h3>
        <ul className="space-y-2 text-sm text-sae-text leading-relaxed">
          <li>
            <strong>(D10)</strong>: valor com desconto de pontualidade.
          </li>
          <li>
            <strong>(D30)</strong>: valor integral do curso.
          </li>
          <li>
            <strong>Copiar resumo</strong>: copia os dados do curso, sem valores, numa mensagem pronta para enviar ao aluno.
          </li>
          <li>
            <strong>Copiar resumo com valores</strong>: faz o mesmo e acrescenta a taxa de inscrição e os valores.
          </li>
        </ul>
      </Card>

      <section aria-label="Atalhos">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SHORTCUTS.map(({ label, text, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="group flex items-start gap-3 p-4 rounded-xl bg-sae-card border border-sae-border shadow-sm hover:border-sae-accent hover:shadow-md transition-all"
            >
              <span className="w-10 h-10 shrink-0 rounded-full bg-sae-accentSoft text-sae-accentText flex items-center justify-center group-hover:bg-sae-accent group-hover:text-white transition-colors">
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-semibold text-sae-text">{label}</span>
                <span className="block text-sm text-sae-muted">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
