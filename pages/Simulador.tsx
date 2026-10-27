import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button, SectionTitle, Breadcrumb, Badge } from '../components/UI';
import { Search, ChevronDown, GraduationCap, BookOpen, Sparkles, CheckCircle, ArrowRight, AlertCircle, RefreshCw, Clock } from 'lucide-react';

interface Destination {
    nome: string;
    prazo: string;
}

interface MappingRow {
    origem: string;
    destinos: Destination[];
}

export const Simulador: React.FC = () => {
    // ============================================================
    // REGRAS DE CÓDIGO MANDATÓRIAS — GERENCIAMENTO DE ESTADOS
    // ============================================================
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cursosOrigem, setCursosOrigem] = useState<string[]>([]);
    const [cursoSelecionado, setCursoSelecionado] = useState<string | null>(null);
    const [cursosDestino, setCursosDestino] = useState<Destination[]>([]);
    // ============================================================

    // Estados auxiliares da interface
    const [dataRows, setDataRows] = useState<MappingRow[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const SHEET_ID = "1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI";
    const API_KEY = "AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0";

    // Busca os dados na planilha na aba 'Simulador'
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Simulador!A2:C?key=${API_KEY}`);
                
                if (!response.ok) {
                    throw new Error("Falha ao carregar os dados da planilha de simulação.");
                }

                const result = await response.json();
                
                if (result.values) {
                    const rows: MappingRow[] = [];
                    const originsSet = new Set<string>();

                    result.values.forEach((row: string[]) => {
                        const origem = row[0]?.trim();
                        const destinoStr = row[1]?.trim() || '';
                        const prazoStr = row[2]?.trim() || '';
                        
                        if (origem) {
                            originsSet.add(origem);
                            
                            // Separa os nomes e prazos
                            const destinoNames = destinoStr.split(',').map(d => d.trim()).filter(Boolean);
                            const prazoValues = prazoStr.split(',').map(p => p.trim());
                            
                            // Mapeia os pares nome/prazo respeitando a ordem
                            const destinos: Destination[] = destinoNames.map((nome, index) => ({
                                nome,
                                prazo: prazoValues[index] || ''
                            }));
                            
                            rows.push({ origem, destinos });
                        }
                    });

                    setDataRows(rows);
                    setCursosOrigem(Array.from(originsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')));
                } else {
                    setDataRows([]);
                    setCursosOrigem([]);
                }
            } catch (err: any) {
                console.error("Erro no Simulador:", err);
                setError(err.message || "Erro ao conectar com a base de dados do simulador.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Fecha o dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtra os cursos de origem conforme o usuário digita
    const filteredOrigins = useMemo(() => {
        if (!searchTerm.trim()) return cursosOrigem;
        const term = searchTerm.toLowerCase().trim();
        return cursosOrigem.filter(c => c.toLowerCase().includes(term));
    }, [cursosOrigem, searchTerm]);

    // Manipula a seleção de um curso de origem
    const handleSelectOrigin = (origem: string) => {
        setCursoSelecionado(origem);
        setSearchTerm(origem);
        setIsDropdownOpen(false);

        // Busca todas as linhas de destino associadas a esta origem e empilha
        const matchingRows = dataRows.filter(r => r.origem.toLowerCase() === origem.toLowerCase());
        const allDestinations: Destination[] = [];
        
        matchingRows.forEach(row => {
            allDestinations.push(...row.destinos);
        });

        // Remove duplicidades de nome mantendo o primeiro encontrado
        const uniqueDestinations: Destination[] = [];
        const seenNames = new Set<string>();
        
        allDestinations.forEach(dest => {
            if (!seenNames.has(dest.nome.toLowerCase())) {
                seenNames.add(dest.nome.toLowerCase());
                uniqueDestinations.push(dest);
            }
        });

        setCursosDestino(uniqueDestinations);
    };

    // Limpa a busca e seleção
    const handleClear = () => {
        setCursoSelecionado(null);
        setSearchTerm('');
        setCursosDestino([]);
        setIsDropdownOpen(false);
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12 max-w-5xl">
                <Breadcrumb items={[{ label: 'Simulador' }]} />
                <SectionTitle 
                    title="Simulador de Cursos" 
                    subtitle="Descubra quais cursos ou aproveitamentos estão disponíveis com base na sua formação de origem." 
                />

                {/* Banner de Erro */}
                {error && (
                    <div className="mb-6 p-4 bg-sae-danger/10 border border-sae-danger/30 rounded-xl flex items-center gap-3 text-sae-danger animate-fadeIn">
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                            <span className="font-bold">Erro:</span> {error}
                        </div>
                    </div>
                )}

                {/* Container do Autocomplete / Busca Iterativa (usamos div ao invés de Card para remover o overflow-hidden nativo do Card) */}
                <div className="p-6 sm:p-8 mb-8 bg-sae-card border border-sae-border rounded-xl backdrop-blur-md shadow-2xl bg-sae-darker/90 relative z-50">
                    <div className="max-w-4xl mx-auto">
                        <label className="block text-xs font-bold text-sae-accentAlt uppercase tracking-wider mb-2">
                            Selecione o seu Curso de Origem
                        </label>
                        
                        <div className="relative" ref={dropdownRef}>
                            {/* Input com ícones */}
                            <div className="relative flex items-center">
                                <Search size={18} className="absolute left-4 text-sae-muted" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onClick={() => setIsDropdownOpen(true)}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setIsDropdownOpen(true);
                                        // Se alterar o texto, desmarca o selecionado
                                        if (cursoSelecionado && e.target.value !== cursoSelecionado) {
                                            setCursoSelecionado(null);
                                            setCursosDestino([]);
                                        }
                                    }}
                                    placeholder={loading ? "Carregando cursos..." : "Digite ou clique para buscar seu curso..."}
                                    disabled={loading}
                                    className="w-full bg-sae-darker border border-sae-border rounded-xl py-3.5 pl-11 pr-20 text-sae-text placeholder-sae-muted focus:border-sae-accent focus:ring-2 focus:ring-sae-accent/20 outline-none transition-all text-sm font-medium shadow-inner disabled:opacity-50"
                                />
                                
                                <div className="absolute right-3 flex items-center gap-1">
                                    {searchTerm && (
                                        <button 
                                            onClick={handleClear} 
                                            className="p-1 text-sae-muted hover:text-sae-text transition-colors"
                                            title="Limpar"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        disabled={loading}
                                        className="p-1.5 text-sae-muted hover:text-sae-accentAlt transition-colors"
                                    >
                                        <ChevronDown size={18} className={`transform transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Loader contido */}
                            {loading && (
                                <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-sae-accentText animate-pulse">
                                    <RefreshCw size={14} className="animate-spin" />
                                </div>
                            )}

                            {/* Dropdown Lista Suspensa */}
                            {isDropdownOpen && !loading && (
                                <div className="absolute left-0 right-0 top-full mt-2 bg-sae-card border border-sae-border rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl animate-fadeIn">
                                    <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                                        {filteredOrigins.length > 0 ? (
                                            filteredOrigins.map((origem, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleSelectOrigin(origem)}
                                                    className={`px-4 py-3 text-sm text-sae-text hover:bg-sae-accent/15 hover:text-sae-text transition-colors cursor-pointer flex items-center justify-between border-b border-sae-border/30 last:border-none ${
                                                        cursoSelecionado === origem ? 'bg-sae-accent/10 font-bold text-sae-accentAlt' : ''
                                                    }`}
                                                >
                                                    <span className="pr-2 leading-relaxed">{origem}</span>
                                                    {cursoSelecionado === origem && <CheckCircle size={14} className="text-sae-accentAlt shrink-0 ml-2" />}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-xs text-sae-muted">
                                                Nenhum curso de origem encontrado correspondente a "{searchTerm}".
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 bg-sae-soft border-t border-sae-border/30 text-[10px] text-sae-muted text-center">
                                        Exibindo {filteredOrigins.length} opções disponíveis
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Helper sob o input */}
                        <div className="mt-2.5 flex items-center justify-between text-xs text-sae-muted">
                            <span>💡 Dica: Clique na seta para listar todas as opções de uma vez.</span>
                            {cursoSelecionado && (
                                <span className="text-sae-accentAlt font-semibold animate-fadeIn">Origem confirmada</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Área de Resultados — Cursos Disponíveis */}
                <div className="relative z-10">
                    {cursoSelecionado ? (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center justify-between border-b border-sae-border pb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-sae-text flex items-center gap-2">
                                        <Sparkles className="text-sae-accentAlt" size={20} />
                                        Cursos Disponíveis
                                    </h3>
                                    <p className="text-xs text-sae-muted mt-1">
                                        Opções habilitadas para quem cursou <strong className="text-sae-text font-semibold">{cursoSelecionado}</strong>
                                    </p>
                                </div>
                                <Badge variant="success">
                                    {cursosDestino.length} {cursosDestino.length === 1 ? 'Opção' : 'Opções'}
                                </Badge>
                            </div>

                            {/* Renderização em Cards Empilhados */}
                            {cursosDestino.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {cursosDestino.map((destino, idx) => (
                                        <Card 
                                            key={idx} 
                                            hoverEffect 
                                            className="p-5 bg-gradient-to-r from-sae-darker via-sae-card to-sae-card border-l-4 border-l-sae-accent hover:border-l-sae-accentHover transition-all group duration-300"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-start gap-3.5">
                                                    <div className="mt-0.5 p-2 bg-sae-accentSoft rounded-lg text-sae-accentText group-hover:text-sae-accentHover transition-colors">
                                                        <GraduationCap size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-sae-text text-base group-hover:text-sae-accentHover transition-colors">
                                                            {destino.nome}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-sae-muted">
                                                            {destino.prazo && (
                                                                <span className="flex items-center gap-1 text-sae-accentAlt font-medium">
                                                                    Duração Mínima do Curso<Clock size={12} />
                                                                    {destino.prazo}
                                                                </span>
                                                            )}
                                                            <span>Aproveitamento imediato</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-sae-muted group-hover:text-sae-text group-hover:translate-x-1 transition-all">
                                                    <ArrowRight size={18} />
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <Card className="p-12 text-center border-sae-border/50 bg-sae-darker/50">
                                    <BookOpen size={40} className="mx-auto mb-3 text-sae-muted opacity-40" />
                                    <p className="text-sm font-medium text-sae-muted">
                                        Nenhum curso de destino cadastrado para esta origem na planilha.
                                    </p>
                                </Card>
                            )}
                        </div>
                    ) : (
                        /* Estado inicial sem seleção */
                        <Card className="p-12 text-center border-sae-border/50 bg-sae-soft backdrop-blur-sm">
                            <div className="max-w-md mx-auto">
                                <div className="w-16 h-16 rounded-full bg-sae-accent/10 flex items-center justify-center mx-auto mb-4 border border-sae-accent/20">
                                    <GraduationCap size={32} className="text-sae-accentText" />
                                </div>
                                <h4 className="text-base font-bold text-sae-text mb-2">Simulação Pronta</h4>
                                <p className="text-xs text-sae-muted leading-relaxed">
                                    Utilize o campo de busca acima para selecionar seu curso de origem. O sistema irá consultar a base em tempo real e empilhar todas as opções elegíveis para sua trajetória.
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </Layout>
    );
};
