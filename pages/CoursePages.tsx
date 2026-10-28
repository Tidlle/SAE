import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button, SectionTitle, Card, Badge, Breadcrumb } from '../components/UI';
import { Search, Filter, Calendar, MapPin, Clock, CheckCircle, SlidersHorizontal, ChevronRight, Star, GraduationCap, BookOpen, Copy, Info, FileText } from 'lucide-react';
import { Chatbot } from '../components/Chatbot';
import { CopyButton } from '../components/CopyButton';
import { fetchSheet } from '../lib/sheets';
import { FACET_GROUPS, Facet, FacetGroup, areaLabelOf, buildFacet, facetKey, findColumn, findInformativo, informativoCandidates, formatCurrency, normalizeText, parseCurrency, safeHttpUrl, splitList } from '../lib/courses';
import { CoursesOverview } from '../components/CoursesOverview';
import { RecentCourse, clearRecents, loadRecents, saveRecent } from '../lib/recentCourses';
import { highlightMatch } from '../lib/text';
import { AgendaEvent, loadAgenda } from '../lib/assistant/calendar';

const MAX_SUGGESTIONS = 50;

// --- COURSES INFO (LIST) ---
export const CoursesInfo: React.FC = () => {
  const [data, setData] = React.useState<any[]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCourse, setSelectedCourse] = React.useState<any[] | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [showDocs, setShowDocs] = React.useState(false);
  const [showPreReq, setShowPreReq] = React.useState(false);
  const [selectedParcels, setSelectedParcels] = React.useState(1);
  const [uniciveData, setUniciveData] = React.useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = React.useState('');
  const [filters, setFilters] = React.useState<Record<FacetGroup, string>>({ ies: '', area: '', tipo: '', modalidade: '' });
  const [recents, setRecents] = React.useState<RecentCourse[]>(loadRecents);

  // Constants
  const SHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
  const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';
  const RANGE = 'Cursos!A1:AJ'; // Fetching A1 to get headers too (extended to AJ for Valor Parcelado)

  // Fetch data
  const loadCourses = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const values = await fetchSheet(RANGE);
      if (values.length < 2) throw new Error('A planilha de cursos veio vazia.');

      // Altera dinamicamente o título das colunas vindas da planilha
      const fetchedHeaders = values[0].map((header: string) => {
        const trimmed = header?.trim();
        if (trimmed === "Carga Horária") return "Carga Horária Total do Curso";
        if (trimmed === "Prazo de Conclusão") return "Duração Mínima do Curso";
        if (trimmed === "Prazo Médio de Certificação") return "Prazo Médio de Emissão Após Colação de Grau";
        return header;
      });

      // Colunas sem título na planilha ganham um nome. Só mexe nas que estão em branco (ou "Pacotes"),
      // para não rotular a coluna errada caso a planilha mude de posição.
      while (fetchedHeaders.length <= 28) fetchedHeaders.push('');
      const relabel = (index: number, label: string, onlyIf: RegExp) => {
        if (onlyIf.test((fetchedHeaders[index] || '').trim())) fetchedHeaders[index] = label;
      };
      relabel(24, 'Curso entra nos combos:', /^$|^Pacotes$/i);
      relabel(25, 'Carga Horária (A cursar)', /^$/);
      relabel(26, 'Qntd. Semestre ou Módulo Mínimo do Curso', /^$/);
      relabel(27, 'Duração Máxima do Curso', /^$/);
      relabel(28, 'Qntd. Semestre ou Módulo Máximo do Curso', /^$/);

      setHeaders(fetchedHeaders); // First row is headers
      setData(values.slice(1)); // Rest is data
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setLoadError('Não foi possível carregar os cursos agora. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Fetch Valores UNICIVE tab in parallel
  React.useEffect(() => {
    const fetchUnicive = async () => {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Valores%20UNICIVE!A1:Z?key=${API_KEY}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.values && result.values.length > 1) {
          const map: Record<string, string[]> = {};
          // row 0 = headers, skip it; col A = course name key
          result.values.slice(1).forEach((row: string[]) => {
            const key = (row[0] || '').trim().toUpperCase();
            if (key) map[key] = row;
          });
          setUniciveData(map);
        }
      } catch (error) {
        console.error('Erro ao buscar Valores UNICIVE:', error);
      }
    };
    fetchUnicive();
  }, []);

  // Colunas localizadas pelo título, para não depender da posição na planilha
  const nameIndex = React.useMemo(() => Math.max(0, findColumn(headers, /^Nome d/i)), [headers]);
  const iesIndex = React.useMemo(() => findColumn(headers, /^IES/i), [headers]);
  const eixoIndex = React.useMemo(() => findColumn(headers, /^Eixo/i), [headers]);
  const tipoIndex = React.useMemo(() => findColumn(headers, /^Tipo/i), [headers]);
  const modalidadeIndex = React.useMemo(() => findColumn(headers, /^Modalidade/i), [headers]);

  const normalizedNames = React.useMemo(() => data.map((row) => normalizeText(row[nameIndex] || '')), [data, nameIndex]);

  // Filtros por instituição, tipo e modalidade (mesmo valor com grafias diferentes conta como um só)
  const facetIndex = React.useCallback(
    (group: FacetGroup) => (group === 'ies' ? iesIndex : group === 'area' ? eixoIndex : group === 'tipo' ? tipoIndex : modalidadeIndex),
    [iesIndex, eixoIndex, tipoIndex, modalidadeIndex],
  );

  // A área junta os eixos da planilha que são o mesmo assunto ("Saúde" e "Saúde e Bem-Estar")
  const facetTransform = React.useCallback((group: FacetGroup) => (group === 'area' ? areaLabelOf : undefined), []);

  const rowPasses = React.useCallback(
    (row: any[], skip?: FacetGroup) =>
      FACET_GROUPS.every((group) => {
        if (group === skip || !filters[group]) return true;
        const cell = row[facetIndex(group)];
        return facetKey(group === 'area' ? areaLabelOf(cell) : cell) === filters[group];
      }),
    [filters, facetIndex],
  );

  const hasFilters = FACET_GROUPS.some((group) => filters[group]);

  const allFacets = React.useMemo(
    () => ({
      ies: buildFacet(data, iesIndex),
      area: buildFacet(data, eixoIndex, areaLabelOf),
      tipo: buildFacet(data, tipoIndex),
      modalidade: buildFacet(data, modalidadeIndex),
    }),
    [data, iesIndex, eixoIndex, tipoIndex, modalidadeIndex],
  );

  // Contagens de cada grupo respeitando os filtros dos outros grupos
  const facets = React.useMemo(() => {
    const result = {} as Record<FacetGroup, Facet[]>;
    FACET_GROUPS.forEach((group) => {
      const built = buildFacet(data.filter((row) => rowPasses(row, group)), facetIndex(group), facetTransform(group));
      const selected = filters[group];
      if (selected && !built.some((facet) => facet.key === selected)) {
        const known = allFacets[group].find((facet) => facet.key === selected);
        if (known) built.push({ ...known, count: 0 });
      }
      result[group] = built;
    });
    return result;
  }, [data, filters, allFacets, rowPasses, facetIndex, facetTransform]);

  const filteredRows = React.useMemo(() => (hasFilters ? data.filter((row) => rowPasses(row)) : []), [data, hasFilters, rowPasses]);

  // Filter logic for autocomplete (ignora acentos e maiúsculas e respeita os filtros ativos)
  const searchResults = React.useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term || selectedCourse) return { items: [] as any[][], total: 0 };
    const matches = data.filter((row, index) => normalizedNames[index].includes(term) && rowPasses(row));
    return { items: matches.slice(0, MAX_SUGGESTIONS), total: matches.length };
  }, [data, normalizedNames, searchTerm, selectedCourse, rowPasses]);

  // Cursos consultados recentemente que ainda existem na planilha
  const recentRows = React.useMemo(
    () =>
      recents
        .map((recent) =>
          data.find(
            (row) =>
              (row[nameIndex] || '').toString().trim() === recent.name &&
              (!recent.ies || (row[iesIndex] || '').toString().trim() === recent.ies),
          ),
        )
        .filter((row): row is any[] => Boolean(row)),
    [recents, data, nameIndex, iesIndex],
  );

  // Handlers
  const handleSelectCourse = (course: any[]) => {
    setSelectedCourse(course);
    setSearchTerm(course[nameIndex]); // Set name to input
    setIsDropdownOpen(false);
    setShowDocs(false);
    setShowPreReq(false);
    setSelectedParcels(1);
    setRecents(
      saveRecent({
        name: (course[nameIndex] || '').toString().trim(),
        ies: iesIndex === -1 ? '' : (course[iesIndex] || '').toString().trim(),
      }),
    );
  };

  const handleFilterChange = (group: FacetGroup, key: string) => setFilters((current) => ({ ...current, [group]: key }));
  const clearFilters = () => setFilters({ ies: '', area: '', tipo: '', modalidade: '' });

  // Abre direto o curso pedido por outra página (ex.: lista de recentes do perfil): /cursos/info?curso=NOME&ies=IES
  const [searchParams, setSearchParams] = useSearchParams();
  React.useEffect(() => {
    const wanted = searchParams.get('curso');
    if (!wanted || data.length === 0) return;
    const wantedIes = searchParams.get('ies') || '';
    const row = data.find(
      (r) =>
        (r[nameIndex] || '').toString().trim() === wanted &&
        (!wantedIes || (r[iesIndex] || '').toString().trim() === wantedIes),
    );
    if (row) handleSelectCourse(row);
    setSearchParams({}, { replace: true });
  }, [data, searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSelectedCourse(null); // Clear selection when typing
    setIsDropdownOpen(true);
    setShowDocs(false);
    setShowPreReq(false);
    setSelectedParcels(1);
  };

  const orderedIndices = React.useMemo(() => {
    const indices = headers.map((_, i) => i);
    const targetIdx = headers.indexOf("Carga Horária (Histórico Total)");
    const zIdx = findColumn(headers, /Carga Horária.*Cursar/i);
    
    if (targetIdx !== -1 && zIdx !== -1) {
      const pos = indices.indexOf(zIdx);
      if (pos !== -1) indices.splice(pos, 1);
      
      const insertPos = indices.indexOf(targetIdx);
      if (insertPos !== -1) {
        indices.splice(insertPos + 1, 0, zIdx);
      }
    }
    return indices;
  }, [headers]);

  const financeiroKeywords = /valor|preço|mensalidade|matrícula|financeiro|pagamento|boleto|cartão|desconto|investimento|taxa/i;

  const financeiroIndices = React.useMemo(() => {
     const financeiroFieldsOrder = [
         /Taxa de Inscrição/i,
         /Valor Integral.*Pix.*\(D30\)/i,
         /Valor Integral.*Boleto.*\(D30\)/i,
         /Valor Integral.*Cartão.*\(D30\)/i,
         /Valor Integral.*Pix.*\(D10\)/i,
         /Valor Integral.*Boleto.*\(D10\)/i,
         /Valor Integral.*Cartão.*\(D10\)/i,
         /parcelas BOLETO/i,
         /parcelas CARTÃO/i
     ];
     
     const explicitIndices = financeiroFieldsOrder.map(regex => {
         return orderedIndices.find(i => (headers[i] || '').match(regex));
     }).filter(i => i !== undefined) as number[];

     const otherFinanceiro = orderedIndices.filter(i => {
         if (explicitIndices.includes(i)) return false;
         const h = headers[i] || '';
         if (h.match(/Pré.*Req/i)) return false;
         return h.match(financeiroKeywords);
     });

     return [...explicitIndices, ...otherFinanceiro];
  }, [orderedIndices, headers]);

  const pedagogicoIndices = React.useMemo(() => {
     const pedagogicoFieldsOrder = [
         /^Tipo/i,
         /^Modalidade/i,
         /^IES/i,
         /Carga Horária Total/i,
         /Carga Horária.*Cursar/i,
         /^Eixo/i,
         /Duração Mínima/i,
         /Duração Máxima/i,
         /Pré.*Req/i,
         /Artigo/i,
         /Estágio/i,
         /Titulação/i,
         /Link e-MEC/i,
         /Informativo/i,
         /^Polo/i,
         /Documentos/i,
         /^Emissão de/i,
         /Prazo Médio de Emissão/i,
         /Subcategoria/i
     ];
     
     const explicitIndices = pedagogicoFieldsOrder.map(regex => {
         return orderedIndices.find(i => (headers[i] || '').match(regex));
     }).filter(i => i !== undefined) as number[];

     const otherPedagogico = orderedIndices.filter(i => {
         if (explicitIndices.includes(i)) return false;
         const h = headers[i] || '';
         if (h.match(/Observaç/i)) return false;
         return !financeiroIndices.includes(i);
     });

     return [...explicitIndices, ...otherPedagogico];
  }, [orderedIndices, financeiroIndices, headers]);

  const observacoesIndices = React.useMemo(() => {
     return orderedIndices.filter(i => (headers[i] || '').match(/Observaç/i));
  }, [orderedIndices, headers]);

  const renderSection = (indices: number[], title: string) => {
    if (indices.length === 0) return null;

    const taxaIndex = indices.find(i => (headers[i] || '').match(/Taxa de Inscrição/i));
    const gridIndices = indices.filter(i => i !== taxaIndex);

    return (
      <div className="mb-10 last:mb-0">
        {title && (
            <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-sae-border/50"></div>
                <h3 className="text-lg font-bold text-sae-accentText uppercase tracking-widest">{title}</h3>
                <div className="h-px flex-1 bg-sae-border/50"></div>
            </div>
        )}

        {/* Centralized Taxa de Inscrição */}
        {taxaIndex !== undefined && (
           <div className="flex justify-center mb-8">
              <div className="w-full max-w-sm text-center bg-sae-darker border border-sae-border/50 rounded-lg p-6 shadow-md relative overflow-hidden transform hover:scale-105 transition-transform">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sae-accent to-transparent"></div>
                 <label className="block text-xs font-bold text-sae-muted mb-3 uppercase tracking-widest">
                    {headers[taxaIndex]}
                 </label>
                 <div className="text-3xl font-black text-sae-text">
                    {selectedCourse![taxaIndex] || ''}
                 </div>
              </div>
           </div>
        )}
        
        {/* Small Fields (Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {gridIndices.map((index) => {
                const header = headers[index];
                if (!header) return null;

                // Ocultar campos específicos solicitados pelo usuário
                if (header.match(/Nome d(?:o|os) curso|Quantidade de Alunos|Data In[ií]cio|Curso entra nos combos|Qntd\. Semestre|Valor Parcelado no Boleto/i)) {
                    return null;
                }

                const value = selectedCourse![index] || '';
                
                // Force specific fields to be Large regardless of length
                const isForcedLarge = header.match(/Curso entra nos combos:|Ementa|Observaç/i);
                const isForcedSmall = header.match(/Link e-MEC|Informativo|Documentos|Pré.*Req|Valor Integral|parcelas/i);
                
                if ((value.length > 60 && !isForcedSmall) || isForcedLarge) return null; // Skip large fields here

                const isLink = header.match(/Link e-MEC|Ementa|Informativo/i);
                const isDocumentos = header.match(/Documentos/i);
                const isPreReq = header.match(/Pré.*Req/i);
                const isSubcategoria = header.match(/Subcategoria/i);
                const isParcelasBoleto = header.match(/parcelas BOLETO/i);

                return (
                  <div key={index} className={isSubcategoria || isParcelasBoleto ? "lg:col-start-2" : ""}>
                    <label className="block text-xs font-bold text-sae-text mb-1 uppercase tracking-wide opacity-80">
                      {header}
                    </label>
                    {isDocumentos ? (
                        <div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowDocs(!showDocs)}
                                    className="flex-1 bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText hover:text-sae-accentAlt hover:border-sae-accent transition-colors min-h-[40px] text-sm shadow-inner text-left flex justify-between items-center"
                                >
                                    <span>Ver Lista de Documentos</span>
                                    <ChevronRight className={`transform transition-transform ${showDocs ? 'rotate-90' : ''}`} size={16} />
                                </button>
                                <CopyButton title="Copiar documentos" getText={() => splitList(value).join('\n')} />
                            </div>
                            {showDocs && (
                                <ul className="mt-2 bg-sae-darker border border-sae-border/50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                                    {value.split('/').map((doc: string, idx: number) => {
                                        if (!doc.trim()) return null;
                                        return (
                                            <li key={idx} className="text-sae-text text-sm flex items-start gap-2">
                                                <span className="text-sae-accentText mt-0.5">•</span>
                                                <span>{doc.trim()}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : isPreReq ? (
                        <div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowPreReq(!showPreReq)}
                                    className="flex-1 bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText hover:text-sae-accentAlt hover:border-sae-accent transition-colors min-h-[40px] text-sm shadow-inner text-left flex justify-between items-center"
                                >
                                    <span>Ver Pré-requisitos</span>
                                    <ChevronRight className={`transform transition-transform ${showPreReq ? 'rotate-90' : ''}`} size={16} />
                                </button>
                                <CopyButton title="Copiar pré-requisitos" getText={() => splitList(value).join('\n') || value} />
                            </div>
                            {showPreReq && (
                                <ul className="mt-2 bg-sae-darker border border-sae-border/50 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                                    {(value.includes('/') ? value.split('/') : value.split('\n')).map((req: string, idx: number) => {
                                        if (!req.trim()) return null;
                                        return (
                                            <li key={idx} className="text-sae-text text-sm flex items-start gap-2">
                                                <span className="text-sae-accentText mt-0.5">•</span>
                                                <span>{req.trim()}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : isLink ? (
                        safeHttpUrl(value) ? (
                          <div className="flex gap-2">
                            <a
                                href={safeHttpUrl(value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center flex-1 bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText hover:text-sae-accentAlt hover:border-sae-accent transition-colors min-h-[40px] text-sm shadow-inner underline break-all whitespace-normal"
                                title={value}
                            >
                                {header.match(/Link e-MEC/i) ? "Link do e-mec" :
                                 header.match(/Informativo/i) ? "Informativo do curso" : value}
                            </a>
                            <CopyButton title="Copiar link" getText={() => safeHttpUrl(value)} />
                          </div>
                        ) : (
                          <div className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-text min-h-[40px] flex items-center text-sm shadow-inner break-words whitespace-pre-wrap">
                              {value}
                          </div>
                        )
                    ) : (
                        <div 
                            className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-text min-h-[40px] flex items-center text-sm shadow-inner break-words whitespace-pre-wrap"
                        >
                            {value}
                        </div>
                    )}
                  </div>
                );
            })}
        </div>

        {/* Large Fields (Full Width) */}
        <div className="space-y-6">
            {gridIndices.map((index) => {
                const header = headers[index];
                if (!header) return null;

                // Ocultar campos específicos solicitados pelo usuário
                if (header.match(/Nome d(?:o|os) curso|Quantidade de Alunos|Data In[ií]cio|Curso entra nos combos|Valor Parcelado no Boleto/i)) {
                    return null;
                }

                const value = selectedCourse![index] || '';
                
                // Force specific fields to be Large regardless of length
                const isForcedLarge = header.match(/Curso entra nos combos:|Ementa|Observaç/i);
                const isForcedSmall = header.match(/Link e-MEC|Informativo|Documentos|Pré.*Req|Valor Integral|parcelas/i);

                if ((value.length <= 60 || isForcedSmall) && !isForcedLarge) return null; // Skip small fields here

                const isLink = header.match(/Ementa/i);

                return (
                  <div key={index}>
                    <label className="block text-sm font-bold text-sae-text mb-2 uppercase tracking-wide">
                      {header}
                    </label>
                     {isLink ? (
                        <div className="p-4 bg-sae-darker border border-sae-border/50 rounded-lg">
                            {safeHttpUrl(value) ? (
                              <a
                                  href={safeHttpUrl(value)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sae-accentText hover:text-sae-accentAlt hover:underline break-all"
                              >
                                  {value}
                              </a>
                            ) : (
                              <span className="text-sae-text break-words whitespace-pre-wrap">{value}</span>
                            )}
                        </div>
                    ) : (
                        <textarea 
                            readOnly 
                            value={value} 
                            // Row logic: smaller for docs/obs (2-3), larger for others (4-6)
                            rows={header.match(/Documentos|Observaç|Curso entra nos combos:/i) ? 2 : (header.match(/Ementa|Link e-MEC|Informativo/i) ? 4 : 6)}
                            className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-3 text-sae-text focus:outline-none focus:border-sae-accent/50 resize-none shadow-inner leading-relaxed"
                        />
                    )}
                  </div>
                );
            })}
        </div>
      </div>
    );
  };

  // --- UNICIVE exclusive financial renderer ---
  const renderFinanceiroUnicive = (row: string[]) => {
    // row indices: 0=Cursos, 1=Taxa de Inscrição, 2=Valor Integral do curso,
    //             3=Parcelamento regular com desconto de parceria, 4=Total de mensalidades,
    //             5=Pagamento a vista
    const taxa          = row[1] || '';
    const valorIntegral = row[2] || '';
    const parcelamento  = row[3] || '';
    const totalMensal   = row[4] || '';
    const aVista        = row[5] || '';

    const Field = ({ label, value }: { label: string; value: string }) => (
      <div>
        <label className="block text-xs font-bold text-sae-text mb-1 uppercase tracking-wide opacity-80">
          {label}
        </label>
        <div className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText min-h-[40px] flex items-center shadow-inner font-bold text-sm">
          {value || '—'}
        </div>
      </div>
    );

    return (
      <div className="mb-10 last:mb-0">
        {/* Section header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-sae-border/50"></div>
          <h3 className="text-lg font-bold text-sae-accentText uppercase tracking-widest">Financeiro</h3>
          <div className="h-px flex-1 bg-sae-border/50"></div>
        </div>

        {/* Taxa de Inscrição – destaque centralizado */}
        {taxa && (
          <div className="flex justify-center mb-8">
            <div className="w-full max-w-sm text-center bg-sae-darker border border-sae-border/50 rounded-lg p-6 shadow-md relative overflow-hidden transform hover:scale-105 transition-transform">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sae-accent to-transparent"></div>
              <label className="block text-xs font-bold text-sae-muted mb-3 uppercase tracking-widest">Taxa de Inscrição</label>
              <div className="text-3xl font-black text-sae-text">{taxa}</div>
            </div>
          </div>
        )}

        {/* Campos Financeiros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Field label="Valor Integral do curso" value={valorIntegral} />
          <Field label="Parcelamento regular com desconto de parceria" value={parcelamento} />
          <Field label="Total de mensalidades" value={totalMensal} />
        </div>

        {/* Pagamento a vista – destaque */}
        {aVista && (
          <div className="flex justify-center">
            <div className="w-full max-w-sm text-center bg-sae-darker border border-sae-accent/40 rounded-lg p-6 shadow-md relative overflow-hidden transform hover:scale-105 transition-transform">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sae-success to-transparent"></div>
              <label className="block text-xs font-bold text-sae-muted mb-3 uppercase tracking-widest">Pagamento a vista</label>
              <div className="text-3xl font-black text-sae-success">{aVista}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSimulacao = () => {
      const rIndex = headers.findIndex(h => h && h.match(/Valor Integral.*Boleto.*\(D10\)/i));
      const ahIndex = headers.findIndex(h => h && h.match(/Valor Integral.*Cartão.*\(D10\)/i));
      const adIndex = headers.findIndex(h => h && h.match(/parcelas BOLETO/i));
      const aeIndex = headers.findIndex(h => h && h.match(/parcelas CARTÃO/i));

      if (rIndex === -1 || ahIndex === -1 || adIndex === -1 || aeIndex === -1) return null;

      const valR_str = selectedCourse![rIndex] || '0';
      const valAH_str = selectedCourse![ahIndex] || '0';
      const valAD_str = selectedCourse![adIndex] || '1';
      const valAE_str = selectedCourse![aeIndex] || '1';

      const parceladoIndex = headers.findIndex(h => h && h.match(/Valor Parcelado.*Boleto/i));

      const valorTotalR = parseCurrency(valR_str);
      const valorTotalCartao = parseCurrency(valAH_str);
      const maxBoleto = parseInt(valAD_str, 10) || 1;
      const maxCartao = parseInt(valAE_str, 10) || 1;

      const currentParcels = Math.min(Math.max(1, selectedParcels), maxBoleto);
      const isMaxBoleto = currentParcels === maxBoleto;
      const cartaoParcels = isMaxBoleto ? maxCartao : Math.min(currentParcels, maxCartao);

      return (
        <div className="mb-10 last:mb-0">
          <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-sae-border/50"></div>
              <h3 className="text-lg font-bold text-sae-accentText uppercase tracking-widest">Simulação de Vendas</h3>
              <div className="h-px flex-1 bg-sae-border/50"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <label className="block text-xs font-bold text-sae-text mb-2 uppercase tracking-wide opacity-80">Quantidade de Parcelas</label>
                 <div className="relative">
                     <select
                        value={currentParcels}
                        onChange={(e) => setSelectedParcels(parseInt(e.target.value, 10))}
                        className="w-full bg-sae-darker border border-sae-border/50 rounded-lg pl-4 pr-10 py-2 text-sae-text focus:outline-none focus:border-sae-accent/50 shadow-inner h-[40px] appearance-none cursor-pointer"
                     >
                        {Array.from({length: maxBoleto}, (_, i) => i + 1).map(num => (
                           <option key={num} value={num}>{num}x</option>
                        ))}
                     </select>
                     <ChevronRight className="absolute right-3 top-3 text-sae-muted pointer-events-none transform rotate-90" size={16} />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-sae-text mb-2 uppercase tracking-wide opacity-80">Valor da Parcela no Boleto</label>
                 <div className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText min-h-[40px] flex items-center shadow-inner font-bold">
                    {formatCurrency(valorTotalR / currentParcels)} <span className="text-sae-muted text-xs ml-2 font-normal">({currentParcels}x)</span>
                 </div>
              </div>
              {parceladoIndex !== -1 && (
                <div>
                    <label className="block text-xs font-bold text-sae-text mb-2 uppercase tracking-wide opacity-80">Valor Parcelado no Boleto (D30)</label>
                    <div className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText min-h-[40px] flex items-center shadow-inner font-bold">
                        {formatCurrency(parseCurrency(selectedCourse![parceladoIndex] || '0') / currentParcels)} <span className="text-sae-muted text-xs ml-2 font-normal">({currentParcels}x)</span>
                    </div>
                </div>
              )}
              <div>
                 <label className="block text-xs font-bold text-sae-text mb-2 uppercase tracking-wide opacity-80">Valor da Parcela no Cartão</label>
                 <div className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-sae-accentText min-h-[40px] flex items-center shadow-inner font-bold">
                    {formatCurrency(valorTotalCartao / cartaoParcels)} <span className="text-sae-muted text-xs ml-2 font-normal">({cartaoParcels}x{cartaoParcels !== currentParcels ? ' máx' : ''})</span>
                 </div>
              </div>
          </div>
        </div>
      );
  };


  const isUnicive = selectedCourse ? (selectedCourse[iesIndex] || '').toString().trim().toUpperCase() === 'UNICIVE' : false;
  const uniciveRow = selectedCourse && isUnicive ? uniciveData[(selectedCourse[nameIndex] || '').toString().trim().toUpperCase()] : undefined;

  // Valor da linha do curso pelo título da coluna
  const cellOf = (pattern: RegExp): string => {
    const index = findColumn(headers, pattern);
    return index === -1 || !selectedCourse ? '' : (selectedCourse[index] || '').toString().trim();
  };

  // Mensagem pronta para colar no WhatsApp, com os mesmos campos exibidos na tela
  const buildSummary = (includeValues: boolean): string => {
    if (!selectedCourse) return '';
    const hidden = /Nome d(?:o|os) curso|Quantidade de Alunos|Data In[ií]cio|Curso entra nos combos|Qntd\. Semestre|Valor Parcelado no Boleto|Observaç/i;
    const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim();
    const lines: string[] = [`*${(selectedCourse[nameIndex] || '').toString().trim()}*`, ''];

    pedagogicoIndices.forEach((i) => {
      const label = (headers[i] || '').trim();
      const raw = (selectedCourse[i] || '').toString().trim();
      if (!label || !raw || hidden.test(label)) return;
      if (/Documentos|Pré.*Req/i.test(label)) lines.push(`${label}: ${splitList(raw).join(', ')}`);
      else if (/Link e-MEC|Informativo|Ementa/i.test(label)) lines.push(`${label}: ${safeHttpUrl(raw) || oneLine(raw)}`);
      else lines.push(`${label}: ${oneLine(raw)}`);
    });

    if (includeValues) {
      const valueLines: string[] = [];
      if (uniciveRow) {
        const unicive: [string, string][] = [
          ['Taxa de inscrição', uniciveRow[1]],
          ['Valor integral do curso', uniciveRow[2]],
          ['Parcelamento regular com desconto de parceria', uniciveRow[3]],
          ['Total de mensalidades', uniciveRow[4]],
          ['Pagamento à vista', uniciveRow[5]],
        ];
        unicive.forEach(([label, value]) => {
          if ((value || '').trim()) valueLines.push(`${label}: ${value.trim()}`);
        });
      } else {
        financeiroIndices.forEach((i) => {
          const label = (headers[i] || '').trim();
          const raw = (selectedCourse[i] || '').toString().trim();
          if (label && raw && !hidden.test(label)) valueLines.push(`${label}: ${oneLine(raw)}`);
        });
      }
      if (valueLines.length > 0) lines.push('', '*Valores*', ...valueLines);
    }

    return lines.join('\n');
  };

  const renderCourseHeader = () => {
    if (!selectedCourse) return null;
    const name = (selectedCourse[nameIndex] || '').toString().trim();
    const ies = cellOf(/^IES/i);
    const tipo = cellOf(/^Tipo/i);
    const modalidade = cellOf(/^Modalidade/i);
    const tiles = [
      { label: 'Carga horária', value: cellOf(/Carga Horária Total/i) },
      { label: 'Duração mínima', value: cellOf(/Duração Mínima/i) },
      { label: 'Taxa de inscrição', value: uniciveRow ? (uniciveRow[1] || '').trim() : cellOf(/Taxa de Inscrição/i) },
      uniciveRow
        ? { label: 'Pagamento à vista', value: (uniciveRow[5] || '').trim() }
        : { label: 'Pix com pontualidade (D10)', value: cellOf(/Valor Integral.*Pix.*\(D10\)/i) },
    ].filter((tile) => tile.value);

    return (
      <div className="mb-8 pb-8 border-b border-sae-border">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-2xl font-heading font-bold text-sae-text break-words">{name}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              {ies && <Badge variant="primary">{ies}</Badge>}
              {tipo && <Badge variant="secondary">{tipo}</Badge>}
              {modalidade && <Badge variant="secondary">{modalidade}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              label="Copiar resumo"
              title="Copiar o resumo do curso, sem valores, para enviar ao aluno"
              getText={() => buildSummary(false)}
            />
            <CopyButton
              label="Copiar resumo com valores"
              title="Copiar o resumo do curso, com os valores, para enviar ao aluno"
              getText={() => buildSummary(true)}
            />
          </div>
        </div>
        {tiles.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-lg border border-sae-border bg-sae-darker p-3">
                <div className="text-xs uppercase tracking-wide text-sae-muted">{tile.label}</div>
                <div className="font-bold text-sae-text mt-1 break-words">{tile.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-8">
         <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'Consulta Detalhada' }]} />
         <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-sae-text mb-6">Informações do Curso</h2>
            {/* Search Bar */}
            <div className="relative mb-8">
               <div className="relative">
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={handleSearchChange}
                   onFocus={() => setIsDropdownOpen(true)}
                   placeholder="Digite para pesquisar as informações do curso..." 
                   className="w-full bg-sae-darker border border-sae-border rounded-lg pl-12 pr-4 py-4 text-sae-text placeholder-sae-muted focus:border-sae-accent focus:ring-1 focus:ring-sae-accent outline-none text-lg shadow-lg"
                 />
                 <Search size={24} className="absolute left-4 top-4 text-sae-muted"/>
               </div>
               {isDropdownOpen && !loading && !selectedCourse && searchTerm.trim() !== '' && (
                 <div className="absolute top-full left-0 w-full bg-sae-card border border-sae-border rounded-b-lg shadow-2xl z-50 max-h-72 overflow-y-auto">
                    {searchResults.items.length === 0 ? (
                      <p className="px-6 py-4 text-sae-muted text-sm">Nenhum curso encontrado para "{searchTerm.trim()}".</p>
                    ) : (
                      <>
                        {searchResults.items.map((row, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectCourse(row)}
                            className="w-full text-left px-6 py-3 hover:bg-sae-accent/10 border-b border-sae-border/50 text-sae-text transition-colors flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                          >
                            <span className="min-w-0 break-words">{highlightMatch((row[nameIndex] || '').toString(), searchTerm)}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              {iesIndex !== -1 && row[iesIndex] && <Badge variant="primary">{row[iesIndex]}</Badge>}
                              {tipoIndex !== -1 && row[tipoIndex] && <Badge variant="secondary">{row[tipoIndex]}</Badge>}
                              {modalidadeIndex !== -1 && row[modalidadeIndex] && <Badge variant="secondary">{row[modalidadeIndex]}</Badge>}
                            </span>
                          </button>
                        ))}
                        {searchResults.total > searchResults.items.length && (
                          <p className="px-6 py-3 text-xs text-sae-muted bg-sae-soft">
                            Mostrando {searchResults.items.length} de {searchResults.total} cursos. Continue digitando para refinar a busca.
                          </p>
                        )}
                      </>
                    )}
                 </div>
               )}
            </div>
            {hasFilters && (
               <div className="flex flex-wrap items-center gap-2 -mt-4 mb-6 text-sm text-sae-muted">
                 <span>Filtros ativos:</span>
                 {FACET_GROUPS.filter((group) => filters[group]).map((group) => (
                   <Badge key={group} variant="primary">{allFacets[group].find((facet) => facet.key === filters[group])?.label ?? filters[group]}</Badge>
                 ))}
                 <button type="button" onClick={clearFilters} className="font-semibold text-sae-accentText hover:text-sae-accentHover">Limpar filtros</button>
               </div>
            )}
            {loading && (
               <div className="text-center py-12">
                 <div className="animate-spin w-8 h-8 border-2 border-sae-accent border-t-transparent rounded-full mx-auto mb-2"></div>
                 <p className="text-sae-muted">Carregando dados...</p>
               </div>
            )}
            {!loading && loadError && (
               <Card className="p-6 text-center">
                 <p role="alert" className="text-sae-danger mb-4">{loadError}</p>
                 <Button variant="outline" onClick={loadCourses}>Tentar novamente</Button>
               </Card>
            )}
            {!loading && !loadError && !selectedCourse && searchTerm.trim() === '' && (
               <CoursesOverview
                 total={data.length}
                 institutionCount={allFacets.ies.length}
                 facets={facets}
                 filters={filters}
                 onFilterChange={handleFilterChange}
                 onClearFilters={clearFilters}
                 filteredRows={filteredRows}
                 nameIndex={nameIndex}
                 iesIndex={iesIndex}
                 tipoIndex={tipoIndex}
                 modalidadeIndex={modalidadeIndex}
                 recentRows={recentRows}
                 onSelect={handleSelectCourse}
                 onClearRecents={() => setRecents(clearRecents())}
               />
            )}
            {selectedCourse && (
               <div className="bg-sae-card/50 backdrop-blur-sm border border-sae-border rounded-xl p-8 animate-fadeIn">
                  {renderCourseHeader()}
                  {renderSection(pedagogicoIndices, "Pedagógico")}
                  {isUnicive && uniciveRow ? (
                    renderFinanceiroUnicive(uniciveRow)
                  ) : (
                    <>
                      {renderSection(financeiroIndices, "Financeiro")}
                      {renderSimulacao()}
                    </>
                  )}
                  {renderSection(observacoesIndices, "")}
                 <div className="mt-8 pt-6 border-t border-sae-border flex justify-end gap-4">
                   <Button variant="outline" onClick={() => {
                       setSearchTerm('');
                       setSelectedCourse(null);
                       setShowDocs(false);
                       setSelectedParcels(1);
                   }}>Nova Pesquisa</Button>
                 </div>
               </div>
            )}
         </div>
      </div>
      <Chatbot 
        courseName={selectedCourse ? selectedCourse[nameIndex] : undefined} 
        courseDescription={selectedCourse ? `Curso: ${selectedCourse[nameIndex]}. Categoria: ${cellOf(/^Tipo/i)}. Modulo: ${cellOf(/^Modalidade/i)}. Info: ${cellOf(/Duração Mínima/i) || 'N/A'}` : undefined}
        itemData={selectedCourse || undefined}
        headers={headers}
      />
    </Layout>
  );
};


// --- COURSES PRESENCIAL ---
export const CoursesPresencial: React.FC = () => {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  // Informativos da aba Cursos (a aba Cursos-Presenciais não tem esse link); sem eles, o card só não mostra o link
  const [informativos, setInformativos] = React.useState<ReturnType<typeof informativoCandidates>>([]);
  
  // Filter States
  const [filters, setFilters] = React.useState({
    tipo: '',
    area: '',
    curso: '',
    polo: '',
    turma: ''
  });

  // Constants
  const SHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
  const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';
  const RANGE = 'Cursos-Presenciais!A2:AC'; // Fetching data (a coluna AC, opcional, traz o link do informativo)

  // Column Indices
  const COLUMNS = {
    NOME_CURSO: 0,    // A
    TIPO: 1,          // B
    TURMA: 2,         // C
    AREA: 5,          // F
    NECESSARIO_ARTIGO: 7, // H
    NECESSARIO_ESTAGIO: 8, // I
    POLO: 19,         // T
    QTD_ALUNOS: 21,   // V
    DATA_INICIO: 22,  // W
    SITUACAO: 23,     // X
    CRONOGRAMA: 25,   // Z
    CALENDARIO: 26,   // AA
    OBSERVACAO: 27,   // AB
    INFORMATIVO: 28   // AC (opcional)
  };

  // Fetch Data
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.values) {
          setData(result.values);
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    fetchSheet('Cursos!A1:AJ')
      .then((values) => {
        const headers = (values[0] ?? []).map((header) => (header ?? '').toString());
        const nameIndex = Math.max(0, findColumn(headers, /^Nome d/i));
        const linkIndex = findColumn(headers, /^Informativo/i);
        if (linkIndex !== -1) setInformativos(informativoCandidates(values.slice(1), nameIndex, linkIndex));
      })
      .catch(() => undefined);
  }, []);

  // Filter Logic
  const filteredData = React.useMemo(() => {
    // Only return data if ALL filters are selected (as per user request logic)
    const { tipo, area, curso, polo, turma } = filters;
    if (!tipo || !area || !curso || !polo || !turma) return [];

    return data.filter(row => {
      const tipoVal = row[COLUMNS.TIPO];
      const areaVal = row[COLUMNS.AREA];
      const cursoVal = row[COLUMNS.NOME_CURSO];
      const poloVal = row[COLUMNS.POLO];
      const turmaVal = row[COLUMNS.TURMA];

      return (
        tipoVal === tipo &&
        areaVal === area &&
        cursoVal === curso &&
        poloVal === polo &&
        turmaVal === turma
      );
    });
  }, [data, filters, COLUMNS]);

  // Dependent Options Logic
  const options = React.useMemo(() => {
    const getUnique = (dataset: any[], index: number) => 
      [...new Set(dataset.map(row => row[index]).filter(Boolean))].sort();

    // 1. Tipo (Always valid)
    const tipoOptions = getUnique(data, COLUMNS.TIPO);

    // 2. Area (Depends on Tipo)
    let areaOptions: string[] = [];
    if (filters.tipo) {
      if (filters.tipo === '2ª Licenciatura' || filters.tipo === 'R2') {
        areaOptions = ['Educação'];
      } else {
        areaOptions = getUnique(data.filter(r => r[COLUMNS.TIPO] === filters.tipo), COLUMNS.AREA);
      }
    }

    // 3. Curso (Depends on Tipo & Area)
    let cursoOptions: string[] = [];
    if (filters.tipo && filters.area) {
      cursoOptions = getUnique(
        data.filter(r => r[COLUMNS.TIPO] === filters.tipo && r[COLUMNS.AREA] === filters.area), 
        COLUMNS.NOME_CURSO
      );
    }

    // 4. Polo (Depends on Tipo, Area & Curso)
    let poloOptions: string[] = [];
    if (filters.tipo && filters.area && filters.curso) {
      poloOptions = getUnique(
        data.filter(r => r[COLUMNS.TIPO] === filters.tipo && r[COLUMNS.AREA] === filters.area && r[COLUMNS.NOME_CURSO] === filters.curso), 
        COLUMNS.POLO
      );
    }

    // 5. Turma (Depends on Tipo, Area, Curso & Polo)
    let turmaOptions: string[] = [];
    if (filters.tipo && filters.area && filters.curso && filters.polo) {
      turmaOptions = getUnique(
        data.filter(r => r[COLUMNS.TIPO] === filters.tipo && r[COLUMNS.AREA] === filters.area && r[COLUMNS.NOME_CURSO] === filters.curso && r[COLUMNS.POLO] === filters.polo), 
        COLUMNS.TURMA
      );
    }

    return { tipoOptions, areaOptions, cursoOptions, poloOptions, turmaOptions };
  }, [data, filters, COLUMNS]);

  // Handlers
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      
      // Reset dependent filters
      if (key === 'tipo') {
        next.area = ''; next.curso = ''; next.polo = ''; next.turma = '';
        if (value === '2ª Licenciatura' || value === 'R2') next.area = 'Educação';
      }
      if (key === 'area') { next.curso = ''; next.polo = ''; next.turma = ''; }
      if (key === 'curso') { next.polo = ''; next.turma = ''; }
      if (key === 'polo') { next.turma = ''; }

      return next;
    });
  };

  const clearFilters = () => {
    setFilters({ tipo: '', area: '', curso: '', polo: '', turma: '' });
  };

  // Helper for status colors
  const getStatusColor = (text: string) => {
    if (!text) return 'text-sae-text';
    const lower = text.toLowerCase();
    if (lower === 'sim' || lower === 'turma em formação') return 'text-sae-success font-bold';
    if (lower.includes('não') || lower.includes('nao')) return 'text-sae-danger font-bold';
    if (lower === 'opcional' || lower.includes('aberta')) return 'text-amber-600 font-bold';
    return 'text-sae-text';
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'Presenciais' }]} />
        <SectionTitle title="Consulta de Cursos Presenciais" subtitle="Selecione os filtros abaixo para encontrar sua turma." />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Filters Sidebar */}
           <div className="lg:col-span-1 space-y-6">
             <Card className="p-6 sticky top-24 bg-sae-darker border-sae-accent/20">
               <div className="space-y-4">
                 <Button variant="outline" className="w-full" onClick={clearFilters}>Limpar</Button>

                 {/* Tipo */}
                 <div>
                   <label className="block text-sm font-medium text-sae-muted mb-1">Tipo</label>
                   <select 
                      value={filters.tipo} 
                      onChange={e => handleFilterChange('tipo', e.target.value)}
                      className="w-full bg-sae-card border border-sae-border rounded-lg p-2 text-sae-text focus:border-sae-accent outline-none"
                   >
                     <option value="">Selecione o Tipo</option>
                     {options.tipoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>

                 {/* Area */}
                 <div>
                   <label className="block text-sm font-medium text-sae-muted mb-1">Área</label>
                   <select 
                      value={filters.area} 
                      onChange={e => handleFilterChange('area', e.target.value)}
                      disabled={!filters.tipo || filters.tipo === '2ª Licenciatura' || filters.tipo === 'R2'}
                      className="w-full bg-sae-card border border-sae-border rounded-lg p-2 text-sae-text focus:border-sae-accent outline-none disabled:opacity-50"
                   >
                     <option value="">Selecione a Área</option>
                     {options.areaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>

                 {/* Curso */}
                 <div>
                   <label className="block text-sm font-medium text-sae-muted mb-1">Curso</label>
                   <select 
                      value={filters.curso} 
                      onChange={e => handleFilterChange('curso', e.target.value)}
                      disabled={!filters.area}
                      className="w-full bg-sae-card border border-sae-border rounded-lg p-2 text-sae-text focus:border-sae-accent outline-none disabled:opacity-50"
                   >
                     <option value="">Selecione o Curso</option>
                     {options.cursoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>

                 {/* Polo */}
                 <div>
                   <label className="block text-sm font-medium text-sae-muted mb-1">Polo</label>
                   <select 
                      value={filters.polo} 
                      onChange={e => handleFilterChange('polo', e.target.value)}
                      disabled={!filters.curso}
                      className="w-full bg-sae-card border border-sae-border rounded-lg p-2 text-sae-text focus:border-sae-accent outline-none disabled:opacity-50"
                   >
                     <option value="">Selecione o Polo</option>
                     {options.poloOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>

                 {/* Turma */}
                 <div>
                   <label className="block text-sm font-medium text-sae-muted mb-1">Turma</label>
                   <select 
                      value={filters.turma} 
                      onChange={e => handleFilterChange('turma', e.target.value)}
                      disabled={!filters.polo}
                      className="w-full bg-sae-card border border-sae-border rounded-lg p-2 text-sae-text focus:border-sae-accent outline-none disabled:opacity-50"
                   >
                     <option value="">Selecione a Turma</option>
                     {options.turmaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 </div>
               </div>
             </Card>
           </div>

           {/* Results Area */}
           <div className="lg:col-span-3">
              {loading ? (
                <div className="text-center py-12">
                   <div className="animate-spin w-8 h-8 border-2 border-sae-accent border-t-transparent rounded-full mx-auto mb-2"></div>
                   <p className="text-sae-muted">Carregando dados...</p>
                </div>
              ) : filteredData.length > 0 ? (
                <div className="space-y-6">
                  {filteredData.map((row, idx) => {
                     const tipo = row[COLUMNS.TIPO];
                     const nome = row[COLUMNS.NOME_CURSO];
                     const cronograma = row[COLUMNS.CRONOGRAMA];
                     const calendario = row[COLUMNS.CALENDARIO];
                     const artigo = row[COLUMNS.NECESSARIO_ARTIGO];
                     const estagio = row[COLUMNS.NECESSARIO_ESTAGIO];
                     const qtdAlunos = row[COLUMNS.QTD_ALUNOS];
                     const dataInicio = row[COLUMNS.DATA_INICIO];
                     const situacao = row[COLUMNS.SITUACAO];
                     const observacao = row[COLUMNS.OBSERVACAO];
                     // O link escrito na própria linha (coluna AC) vale primeiro; senão, o do mesmo curso na aba Cursos
                     const informativo = safeHttpUrl(row[COLUMNS.INFORMATIVO]) || findInformativo(informativos, nome, tipo, row[COLUMNS.POLO]);

                     // Logic for button visibility
                     // Calendário: Enabled/Visible ONLY if Tipo is "Licenciatura", "Bacharelado", "Tecnológico" or "UNICV"
                     const allowedTypesForCalendario = ['Licenciatura', 'Bacharelado', 'Tecnológico', 'UNICV'];
                     // We also check "2ª Licenciatura" just in case, but strictly following user list usually means exact match.
                     // However, given the context of "Licenciatura", it's safer to include exact matches for now.
                     // To be safe regarding casing, we can normalize.
                     const showCalendario = calendario && allowedTypesForCalendario.some(t => tipo && tipo.includes(t)); 

                     return (
                       <Card key={idx} className="p-6 border-l-4 border-l-sae-accent flex flex-col md:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                             <div className="flex justify-between items-start">
                                <h3 className="text-2xl font-bold text-sae-text">{nome}</h3>
                                <Badge variant="secondary">{tipo}</Badge>
                             </div>
                             
                             {/* Links */}
                             <div className="flex gap-4 text-sae-accentAlt text-sm font-semibold">
                                {cronograma && (
                                  <a href={cronograma} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                                    <Calendar size={16}/> Cronograma
                                  </a>
                                )}
                                {showCalendario && (
                                  <a href={calendario} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                                    <Clock size={16}/> Calendário
                                  </a>
                                )}
                                {informativo && (
                                  <a href={informativo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                                    <FileText size={16}/> Informativo do curso
                                  </a>
                                )}
                             </div>

                             {/* Grid Details */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm text-sae-text">
                                {artigo && <p>Necessário Artigo? <span className={getStatusColor(artigo)}>{artigo}</span></p>}
                                {estagio && <p>Necessário Estágio? <span className={getStatusColor(estagio)}>{estagio}</span></p>}
                                {qtdAlunos && <p>Alunos Cadastrados: <span className="text-sae-text font-mono">{qtdAlunos}</span></p>}
                                {dataInicio && <p>Início/Limite: <span className="text-sae-text font-mono">{dataInicio}</span></p>}
                                {observacao && <p>Observação: <span className="text-sae-text">{observacao}</span></p>}
                                {situacao && <p>Situação: <span className={getStatusColor(situacao)}>{situacao}</span></p>}
                             </div>
                          </div>
                       </Card>
                     );
                  })}
                </div>
              ) : (
                <div className="bg-sae-card border border-sae-border rounded-xl p-12 text-center h-full flex flex-col justify-center items-center opacity-70">
                   <Filter size={48} className="text-sae-muted mb-4"/>
                   <h3 className="text-xl font-bold text-sae-text mb-2">Aguardando Filtros</h3>
                   <p className="text-sae-muted max-w-md mx-auto">
                     Selecione todas as opções no menu ao lado (Tipo, Área, Curso, Polo e Turma) para visualizar os resultados disponíveis.
                   </p>
                </div>
              )}
           </div>
        </div>
      </div>
    </Layout>
  );
};

// --- COMBOS ---
export const Combos: React.FC = () => {
    const [data, setData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedArea, setSelectedArea] = React.useState('');
    const [areas, setAreas] = React.useState<string[]>([]);
    const [displayedData, setDisplayedData] = React.useState<any[]>([]);
  
    // Constants
    const SHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
    const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';
    const RANGE = 'Combos!A:F'; 
  
    // Fetch Data
    React.useEffect(() => {
      const fetchData = async () => {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
          const response = await fetch(url);
          const result = await response.json();
          if (result.values) {
             const rows = result.values.slice(1);
             setData(rows);
             
             // Extract unique areas from column F (index 5)
             const uniqueAreas = Array.from(new Set(rows.map((row: any[]) => row[5]?.trim()).filter(Boolean))).sort();
             setAreas(uniqueAreas as string[]);
          }
        } catch (error) {
          console.error('Erro ao buscar dados:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, []);
  
    // Apply Filters (Search & Area)
    React.useEffect(() => {
        if (data.length === 0) return;

        // Group rows into combo blocks (a block starts when column A is not empty)
        const comboBlocks: { startIndex: number; endIndex: number; area: string }[] = [];
        let currentStart = -1;
        let currentArea = '';

        data.forEach((row, index) => {
            if (row[0] && row[0].toString().trim() !== '') {
                if (currentStart !== -1) {
                    comboBlocks.push({ startIndex: currentStart, endIndex: index - 1, area: currentArea });
                }
                currentStart = index;
                currentArea = row[5] ? row[5].toString().trim() : '';
            }
        });
        if (currentStart !== -1) {
            comboBlocks.push({ startIndex: currentStart, endIndex: data.length - 1, area: currentArea });
        }

        let validBlocks = comboBlocks;
        if (selectedArea) {
            validBlocks = comboBlocks.filter(block => block.area === selectedArea);
        }

        const visibleIndices = new Set<number>();

        if (!searchTerm) {
            validBlocks.forEach(block => {
                for (let i = block.startIndex; i <= block.endIndex; i++) {
                    visibleIndices.add(i);
                }
            });
        } else {
            const lowerTerm = searchTerm.toLowerCase();
            const matchingIndices = new Set<number>();
            
            data.forEach((row, index) => {
                // Ignore column F for search (only search A-E)
                const matches = row.slice(0, 5).some((cell: string) => String(cell || '').toLowerCase().includes(lowerTerm));
                if (matches) {
                    matchingIndices.add(index);
                }
            });

            validBlocks.forEach(block => {
                // If any row in the block matches, show the block up to 6 rows to mimic old context behavior
                let blockHasMatch = false;
                for (let i = block.startIndex; i <= block.endIndex; i++) {
                    if (matchingIndices.has(i)) {
                        blockHasMatch = true; break;
                    }
                }
                if (blockHasMatch) {
                    for (let i = block.startIndex; i <= Math.min(block.startIndex + 5, block.endIndex); i++) {
                        visibleIndices.add(i);
                    }
                }
            });
        }

        const filtered = data.filter((_, index) => visibleIndices.has(index));
        setDisplayedData(filtered);
    }, [data, searchTerm, selectedArea]);

    const handleLimpar = () => {
        setSearchTerm('');
        setSelectedArea('');
    };

    const hasActiveFilter = selectedArea !== '' || searchTerm.trim() !== '';

    return (
      <Layout>
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'Combos & Ofertas' }]} />
          <SectionTitle title="Combos para Matrícula" subtitle="Confira nossos pacotes especiais." />
  
          <div className="max-w-4xl mx-auto">
             {/* Search Area */}
             <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center items-stretch">
                 <div className="flex-1 sm:max-w-[200px]">
                     <select 
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="w-full bg-sae-darker border border-sae-border rounded-lg px-4 py-3 text-sae-text focus:border-sae-accent outline-none font-medium h-full min-h-[46px]"
                     >
                         <option value="">Todas as Áreas</option>
                         {areas.map(area => (
                             <option key={area} value={area}>{area}</option>
                         ))}
                     </select>
                 </div>
                 <div className="relative flex-1 max-w-lg">
                     <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por palavra-chave" 
                        className="w-full bg-sae-darker border border-sae-border rounded-lg pl-10 pr-4 py-3 text-sae-text focus:border-sae-accent outline-none font-medium h-full min-h-[46px]" 
                     />
                     <Search size={18} className="absolute left-3 top-3.5 text-sae-muted" />
                 </div>
                 <Button variant="outline" onClick={handleLimpar} className="w-full sm:w-auto h-full min-h-[46px]">Limpar</Button>
             </div>

             {!hasActiveFilter && !loading && (
                <div className="flex items-center justify-center gap-3 bg-sae-accent border border-white/30 rounded-lg px-5 py-4 mb-6 shadow-lg shadow-sae-accent/30">
                   <Info size={24} className="text-white flex-shrink-0" />
                   <p className="text-center text-white text-base font-bold">Selecione uma área ou busque por palavra-chave para ver valores, parcelamento e detalhes.</p>
                </div>
             )}

             {/* Table */}
             {loading ? (
                <div className="text-center py-12">
                   <div className="animate-spin w-8 h-8 border-2 border-sae-accent border-t-transparent rounded-full mx-auto mb-2"></div>
                   <p className="text-sae-muted">Carregando ofertas...</p>
                </div>
             ) : (
                <div className="bg-sae-card border border-sae-border rounded-xl overflow-hidden shadow-xl">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-sae-accent text-white border-b border-white/20">
                              <th className="p-4 border border-white/20">Curso / Item</th>
                              <th className="p-4 border border-white/20">Método de Pagamento</th>
                              {hasActiveFilter && (
                                <>
                                  <th className="p-4 border border-white/20">Dia 10</th>
                                  <th className="p-4 border border-white/20">Dia 30</th>
                                  <th className="p-4 border border-white/20">Parcelamento</th>
                                </>
                              )}
                           </tr>
                        </thead>
                        <tbody>
                           {displayedData.length > 0 ? displayedData.map((row, idx) => {
                               const columnEValue = row[4] ? row[4].trim().toLowerCase() : "";
                               const isHighlight = hasActiveFilter && columnEValue === "parcelamento";

                               // Styling classes based on user CSS + Tailwind
                               // Highlight: label row of each combo. Normal: alternating surfaces.
                               let rowClass = "text-sae-text";
                               if (isHighlight) {
                                   rowClass = "bg-sae-accentSoft text-sae-text font-bold border-2 border-sae-accent/30";
                               } else {
                                   rowClass = idx % 2 === 0 ? "bg-sae-card text-sae-text" : "bg-sae-soft text-sae-text";
                               }

                               const visibleColumns = hasActiveFilter ? 5 : 2;

                               return (
                                   <tr key={idx} className={`${rowClass} hover:opacity-90 transition-opacity`}>
                                       {Array.from({ length: visibleColumns }).map((_, colIdx) => (
                                           <td key={colIdx} className={`p-3 border ${isHighlight ? 'border-sae-accent/30' : 'border-sae-border'} ${colIdx === 0 ? 'font-medium' : ''}`}>
                                               {row[colIdx] || ''}
                                           </td>
                                       ))}
                                   </tr>
                               );
                           }) : (
                             <tr>
                                 <td colSpan={hasActiveFilter ? 5 : 2} className="p-8 text-center text-sae-muted">Nenhum combo encontrado.</td>
                             </tr>
                           )}
                        </tbody>
                     </table>
                   </div>
                </div>
             )}
          </div>
        </div>
      </Layout>
    );
};

// --- FILTER PAGE ---
export const CourseFilter: React.FC = () => {
    const [data, setData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filteredResults, setFilteredResults] = React.useState<any[]>([]);
    const [hasSearched, setHasSearched] = React.useState(false);

    const [filters, setFilters] = React.useState({
      tipo: '',
      area: '',
      subcategoria: '',
      modalidade: '',
      polo: '',
      horas: ''
    });
  
    // Constants
    const SHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
    const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';
    const RANGE = 'Cursos!A2:U'; // Using the 'Cursos' sheet as requested in snippet
  
    // Column Indices based on snippet
    const COLUMNS = {
      CURSO: 0,         // A
      TIPO: 1,          // B
      MODALIDADE: 2,    // C
      HORAS: 3,         // D
      AREA: 5,          // F
      POLO: 19,         // T
      SUBCATEGORIA: 20  // U
    };
  
    // Fetch Data
    React.useEffect(() => {
      const fetchData = async () => {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
          const response = await fetch(url);
          const result = await response.json();
          if (result.values) {
            setData(result.values);
          }
        } catch (error) {
          console.error('Erro ao buscar dados:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, []);
  
    // Dependent Options Logic (Replicating the snippet's event listeners logic)
    const options = React.useMemo(() => {
        const getUnique = (dataset: any[], index: number) => 
            [...new Set(dataset.map(row => row[index]).filter(Boolean))].sort();
  
        // 1. Tipo (Always all available)
        const tipoOptions = getUnique(data, COLUMNS.TIPO);
  
        // 2. Area (Depends on Tipo)
        let areaOptions: string[] = [];
        if (filters.tipo === '2ª Licenciatura' || filters.tipo === 'R2') {
             // Rule: If '2ª Licenciatura' or 'R2', Area is fixed to 'Educação' (Handled in change handler, but options restricted here too)
             areaOptions = ['Educação'];
        } else {
            const dataForArea = filters.tipo ? data.filter(row => row[COLUMNS.TIPO] === filters.tipo) : data;
            areaOptions = getUnique(dataForArea, COLUMNS.AREA);
        }

        // 3. Subcategoria (Depends on Tipo? Snippet calls `updateSubcategoriaOptions` on Tipo change)
        // Snippet logic implies it might filter by Tipo, but implementation details were vague in snippet (`updateSubcategoriaOptions` definition wasn't fully shown but called).
        // Let's assume standard cascading: Depends on Tipo and/or Area. Let's make it dependent on Area for better filtering if available, or just Tipo.
        // Given snippet structure: 'Tipo' change updates 'Subcategoria'.
        const dataForSub = filters.tipo ? data.filter(row => row[COLUMNS.TIPO] === filters.tipo) : data;
        const subcategoriaOptions = getUnique(dataForSub, COLUMNS.SUBCATEGORIA);

  
        // 4. Modalidade (Depends on Area)
        const dataForModalidade = filters.area ? data.filter(row => row[COLUMNS.AREA] === filters.area) : data;
        const modalidadeOptions = getUnique(dataForModalidade, COLUMNS.MODALIDADE);
  
        // 5. Polo (Depends on Area AND Modalidade)
        const dataForPolo = data.filter(row => {
            const areaMatch = filters.area ? row[COLUMNS.AREA] === filters.area : true;
            const modalidadeMatch = filters.modalidade ? row[COLUMNS.MODALIDADE] === filters.modalidade : true;
            return areaMatch && modalidadeMatch;
        });
        const poloOptions = getUnique(dataForPolo, COLUMNS.POLO);
  
        // 6. Horas (Depends on Tipo, Area, Modalidade, Polo)
        const dataForHoras = data.filter(row => {
            const tipoMatch = filters.tipo ? row[COLUMNS.TIPO] === filters.tipo : true;
            const areaMatch = filters.area ? row[COLUMNS.AREA] === filters.area : true;
            const modalidadeMatch = filters.modalidade ? row[COLUMNS.MODALIDADE] === filters.modalidade : true;
            const poloMatch = filters.polo ? row[COLUMNS.POLO] === filters.polo : true;
            return tipoMatch && areaMatch && modalidadeMatch && poloMatch;
        });
        const horasOptions = getUnique(dataForHoras, COLUMNS.HORAS);
  
        return { tipoOptions, areaOptions, subcategoriaOptions, modalidadeOptions, poloOptions, horasOptions };
    }, [data, filters, COLUMNS]);
  
    // Handlers
    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
  
            // Apply cascades (clearing downstream filters)
            if (key === 'tipo') {
                next.area = ''; next.subcategoria = ''; next.modalidade = ''; next.polo = ''; next.horas = '';
                if (value === '2ª Licenciatura' || value === 'R2') {
                    next.area = 'Educação';
                }
            }


            if (key === 'area') {
                next.modalidade = ''; next.polo = ''; next.horas = '';
            }
            if (key === 'modalidade') {
                next.polo = ''; next.horas = '';
            }
            // Snippet implies Polo change updates Horas
            if (key === 'polo') {
                next.horas = '';
            }
            
            return next;
        });
    };
  
    const handleConsultar = () => {
        const results = data.filter(row => {
            const tipoMatch = !filters.tipo || row[COLUMNS.TIPO] === filters.tipo;
            const areaMatch = !filters.area || row[COLUMNS.AREA] === filters.area;
            const subMatch = !filters.subcategoria || row[COLUMNS.SUBCATEGORIA] === filters.subcategoria;
            const modMatch = !filters.modalidade || row[COLUMNS.MODALIDADE] === filters.modalidade;
            const poloMatch = !filters.polo || row[COLUMNS.POLO] === filters.polo;
            const horasMatch = !filters.horas || row[COLUMNS.HORAS] === filters.horas;
            
            return tipoMatch && areaMatch && subMatch && modMatch && poloMatch && horasMatch;
        });
        setFilteredResults(results);
        setHasSearched(true);
    };
  
    const handleLimpar = () => {
        setFilters({ tipo: '', area: '', subcategoria: '', modalidade: '', polo: '', horas: '' });
        setFilteredResults([]);
        setHasSearched(false);
    };
  
    return (
      <Layout>
        <div className="container mx-auto px-4 lg:px-8 py-12">
            <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'Filtro Avançado' }]} />
            <SectionTitle title="Filtro de Cursos" subtitle="Utilize as opções abaixo para uma busca detalhada." />
  
            <Card className="p-8 mb-8 bg-sae-darker border-sae-accent/20">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Tipo */}
                      <div>
                          <label className="block text-sm font-medium text-sae-muted mb-2">Tipo</label>
                          <select value={filters.tipo} onChange={e => handleFilterChange('tipo', e.target.value)} className="w-full bg-sae-card border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none">
                              <option value="">Selecione o Tipo</option>
                              {options.tipoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
  
                      {/* Area */}
                      <div>
                          <label className="block text-sm font-medium text-sae-muted mb-2">Área</label>
                          <select 
                            value={filters.area} 
                            onChange={e => handleFilterChange('area', e.target.value)} 
                            disabled={filters.tipo === '2ª Licenciatura' || filters.tipo === 'R2'}
                            className="w-full bg-sae-card border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none disabled:opacity-50"
                           >
                              <option value="">Selecione a Área</option>
                              {options.areaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
  
                      {/* Subcategoria */}
                      <div>
                          <label className="block text-sm font-medium text-sae-muted mb-2">Subcategoria</label>
                          <select value={filters.subcategoria} onChange={e => handleFilterChange('subcategoria', e.target.value)} className="w-full bg-sae-card border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none">
                              <option value="">Selecione a Subcategoria</option>
                              {options.subcategoriaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
  
                      {/* Modalidade */}
                      <div>
                          <label className="block text-sm font-medium text-sae-muted mb-2">Modalidade</label>
                          <select value={filters.modalidade} onChange={e => handleFilterChange('modalidade', e.target.value)} className="w-full bg-sae-card border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none">
                              <option value="">Selecione a Modalidade</option>
                              {options.modalidadeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
  
                      {/* Polo */}
                      <div>
                          <label className="block text-sm font-medium text-sae-muted mb-2">Polo</label>
                          <select value={filters.polo} onChange={e => handleFilterChange('polo', e.target.value)} className="w-full bg-sae-card border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none">
                              <option value="">Selecione o Polo</option>
                              {options.poloOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
  
                      {/* Horas */}
                      <div>
                          <label className="block text-sm font-medium text-sae-muted mb-2">Carga Horária</label>
                          <select value={filters.horas} onChange={e => handleFilterChange('horas', e.target.value)} className="w-full bg-sae-card border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none">
                              <option value="">Selecione a Carga Horária</option>
                              {options.horasOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
                 </div>
  
                 <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-sae-border/50">
                      <Button variant="outline" onClick={handleLimpar}>Limpar</Button>
                      <Button onClick={handleConsultar}>Consultar</Button>
                 </div>
            </Card>
  
            {/* Results */}
            {hasSearched && (
                <div className="animate-fadeIn">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-sae-text">Resultados da Consulta</h3>
                        <Badge variant="secondary">{filteredResults.length} cursos encontrados</Badge>
                    </div>
  
                    {filteredResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredResults.map((row, idx) => (
                                <Card key={idx} hoverEffect className="p-5 flex flex-col justify-between">
                                    <h4 className="font-bold text-sae-text text-lg mb-2">{row[COLUMNS.CURSO]}</h4>
                                    <div className="space-y-1 text-sm text-sae-muted">
                                        <div className="flex justify-between"><span>Tipo:</span> <span className="text-sae-text">{row[COLUMNS.TIPO]}</span></div>
                                        <div className="flex justify-between"><span>Area:</span> <span className="text-sae-text">{row[COLUMNS.AREA]}</span></div>
                                        <div className="flex justify-between"><span>Modalidade:</span> <span className="text-sae-text">{row[COLUMNS.MODALIDADE]}</span></div>
                                        <div className="flex justify-between"><span>Horas:</span> <span className="text-sae-text">{row[COLUMNS.HORAS]}</span></div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-sae-card border border-sae-border rounded-xl p-8 text-center">
                            <p className="text-sae-muted">Nenhum curso encontrado com os filtros selecionados.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </Layout>
    );
};

// --- COURSE CREATION (BITRIX FORM) ---
export const CourseCreation: React.FC = () => {
    const formRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const container = formRef.current;
        if (!container) return;

        // Clean up any existing content before appending (handling StrictMode)
        container.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://cdn.bitrix24.com.br/b17708775/crm/form/loader_698.js?' + ((Date.now()/180000|0));
        script.async = true;
        script.setAttribute('data-b24-form', 'inline/698/xa85oi');
        script.setAttribute('data-skip-moving', 'true');
        container.appendChild(script);
        
        return () => {
            container.innerHTML = '';
        };
    }, []);

    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12">
                <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'Solicitação de Novos Cursos' }]} />
                <SectionTitle title="Solicitação de Novos Cursos" subtitle="Preencha o formulário abaixo para sugerir um novo curso." />
                
                <div className="bg-sae-darker border border-sae-border rounded-xl p-8 max-w-4xl mx-auto flex justify-center">
                    <div ref={formRef} className="w-full"></div>
                </div>
            </div>
        </Layout>
    );
};

// --- COURSE CALENDAR ---
const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string): string => {
    const [year, month] = key.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};
const dayHeading = (date: Date): string => {
    const label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};
const timeRange = (event: AgendaEvent): string => {
    if (event.allDay) return 'Dia inteiro';
    const format = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return event.endTime ? `${format(event.start)} às ${format(event.endTime)}` : format(event.start);
};

// Lista das aulas por dia: o calendário do Google esconde parte delas em "Mais N" e corta os títulos
const AgendaList: React.FC = () => {
    const [events, setEvents] = React.useState<AgendaEvent[] | null>(null);
    const [failed, setFailed] = React.useState(false);
    const [month, setMonth] = React.useState('');

    React.useEffect(() => {
        let active = true;
        loadAgenda()
            .then((agenda) => {
                if (!active) return;
                setEvents(agenda.events);
                setMonth(agenda.events[0] ? monthKey(agenda.events[0].start) : '');
            })
            .catch(() => active && setFailed(true));
        return () => {
            active = false;
        };
    }, []);

    if (failed) return <p className="text-sm text-sae-muted text-center">Não foi possível carregar a lista de aulas agora. Use o calendário acima.</p>;
    if (!events) return <p className="text-sm text-sae-muted text-center">Carregando a lista de aulas...</p>;
    if (events.length === 0) return <p className="text-sm text-sae-muted text-center">Nenhuma aula cadastrada na agenda para os próximos meses.</p>;

    const months: string[] = Array.from(new Set(events.map((event) => monthKey(event.start))));
    const days = new Map<string, AgendaEvent[]>();
    events
        .filter((event) => monthKey(event.start) === month)
        .forEach((event) => {
            const key = event.start.toDateString();
            days.set(key, [...(days.get(key) ?? []), event]);
        });

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-6" aria-label="Mês">
                {months.map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setMonth(key)}
                        aria-pressed={key === month}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                            key === month ? 'bg-sae-accent text-white border-sae-accent' : 'bg-sae-card text-sae-text border-sae-border hover:border-sae-accent'
                        }`}
                    >
                        {monthLabel(key)}
                    </button>
                ))}
            </div>

            <div className="space-y-6">
                {[...days.values()].map((list) => (
                    <section key={list[0].start.toDateString()} aria-label={dayHeading(list[0].start)}>
                        <h3 className="text-sm font-bold text-sae-accentText uppercase tracking-wide mb-2">
                            {dayHeading(list[0].start)} <span className="text-sae-muted font-normal normal-case">({list.length} {list.length === 1 ? 'aula' : 'aulas'})</span>
                        </h3>
                        <ul className="space-y-2">
                            {list.map((event) => (
                                <li key={event.id} className="bg-sae-card border border-sae-border rounded-lg px-4 py-3">
                                    <p className="font-semibold text-sae-text leading-snug break-words">{event.title}</p>
                                    <p className="text-xs text-sae-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {timeRange(event)}</span>
                                        {event.polo && <span>{event.polo}</span>}
                                        {event.turma && <span>Turma {event.turma}</span>}
                                        {event.place && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {event.place}</span>}
                                    </p>
                                    {(event.tema || event.professor) && (
                                        <p className="text-xs text-sae-muted mt-1 break-words">
                                            {event.tema && <>Tema: {event.tema}</>}
                                            {event.tema && event.professor && ' · '}
                                            {event.professor && <>Professor(a): {event.professor}</>}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
};

export const CourseCalendar: React.FC = () => {
    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12">
                <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'Calendário de Aulas' }]} />
                <SectionTitle title="Calendário de Aulas" subtitle="Acompanhe as datas e horários das próximas aulas." />

                <div className="bg-sae-darker border border-sae-border rounded-xl p-4 max-w-5xl mx-auto w-full overflow-hidden">
                    <iframe
                        title="Calendário de Aulas (Google Agenda)"
                        src="https://calendar.google.com/calendar/embed?height=700&wkst=1&ctz=America%2FSao_Paulo&showPrint=0&title=Agenda%20de%20Aulas&src=Y29vcmRlbmFjYW9nZXJhbEBmYWN1bGRhZGVhbHBoYWNoYW5uZWwuY29t&src=cHQtYnIuYnJhemlsaWFuI2hvbGlkYXlAZ3JvdXAudi5jYWxlbmRhci5nb29nbGUuY29t&color=%23039be5&color=%230b8043"
                        style={{ border: 'solid 1px #777', width: '100%', minWidth: 0 }}
                        height="700"
                        frameBorder="0"
                        scrolling="no"
                    ></iframe>
                    <p className="text-xs text-sae-muted mt-3">No calendário, cada dia mostra poucas aulas e o restante fica em "Mais". A lista abaixo traz todas as aulas, com horário, polo e turma.</p>
                </div>

                <div className="max-w-5xl mx-auto w-full mt-10">
                    <h2 className="text-2xl font-heading font-bold text-sae-text mb-5">Aulas por dia</h2>
                    <AgendaList />
                </div>
            </div>
        </Layout>
    );
};
