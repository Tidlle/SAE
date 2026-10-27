import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Button, SectionTitle, Card, Badge, Breadcrumb } from '../components/UI';
import { Filter, Search, Calendar, ChevronDown, ChevronUp, Info, FileText } from 'lucide-react';

interface Memorando {
    title: string;
    message: string;
    date: string;
    sector: string;
}

export const Memorandos: React.FC = () => {
    const [memorandos, setMemorandos] = useState<Memorando[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [sectors, setSectors] = useState<string[]>([]);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        sector: '',
        search: ''
    });
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    // API Config
    const SHEET_ID = "1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI";
    const API_KEY = "AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0";

    // Fetch Data
    useEffect(() => {
        const fetchMemorandos = async () => {
            try {
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Memorandos!A2:D?key=${API_KEY}`);
                const data = await response.json();
                if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP ${response.status}`);

                if (data.values) {
                    // A API devolve também as linhas vazias ou incompletas (ex.: uma célula solta lá embaixo na aba):
                    // só entra memorando com título e mensagem.
                    const parsed: Memorando[] = data.values
                        .map((row: string[]) => ({
                            title: (row[0] ?? '').trim(),
                            message: row[1] ?? '',
                            date: row[2] ?? '',
                            sector: row[3] ?? ''
                        }))
                        .filter((memo: Memorando) => memo.title && memo.message.trim())
                        .reverse();

                    setMemorandos(parsed);
                    
                    const uniqueSectors = Array.from(new Set(parsed.map((n: Memorando) => n.sector))).filter(Boolean) as string[];
                    setSectors(uniqueSectors);
                }
            } catch (error) {
                console.error("Error loading memorandos:", error);
                setLoadError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchMemorandos();
    }, []);

    // Helper: Parse Brazilian Date string to Date object
    const parseDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    };

    // Filter Logic
    const filteredMemorandos = useMemo(() => {
        return memorandos.filter(memo => {
            // Date Filter
            const memoDate = parseDate(memo.date);
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                if (memoDate && memoDate < start) return false;
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                if (memoDate && memoDate > end) return false;
            }

            // Sector Filter
            if (filters.sector && memo.sector !== filters.sector) return false;

            // Search Filter
            if (filters.search) {
                const term = filters.search.toLowerCase();
                if (!memo.title.toLowerCase().includes(term) && 
                    !memo.message.toLowerCase().includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [memorandos, filters]);

    // Toggle Expand
    const toggleExpand = (index: number) => {
        const newExpanded = new Set(expanded);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpanded(newExpanded);
    };

    // Helper to format text with links and line breaks
    const formatMessage = (text: string) => {
        return text.split('\n').map((line, i) => (
            <React.Fragment key={i}>
                {line.split(/(https?:\/\/[^\s]+)/g).map((part, j) => 
                    part.match(/^https?:\/\//) ? (
                        <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-sae-accentText hover:underline">{part}</a>
                    ) : part
                )}
                <br />
            </React.Fragment>
        ));
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12">
                <Breadcrumb items={[{ label: 'Memorandos' }]} />
                <SectionTitle title="Memorandos" subtitle="Consulte os memorandos internos da instituição." />

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Filters Sidebar */}
                    <div className="lg:w-1/4 space-y-6">
                        <Card className="p-6 sticky top-8">
                            <h3 className="font-bold text-sae-text mb-4 flex items-center gap-2">
                                <Filter size={20} className="text-sae-accentText" /> Filtros
                            </h3>
                            
                            <div className="space-y-4">
                                {/* Date Range */}
                                <div>
                                    <label className="text-xs text-sae-muted uppercase font-bold mb-1 block">Período</label>
                                    <div className="flex flex-col gap-2">
                                        <input 
                                            type="date" 
                                            className="bg-sae-darker border border-sae-border rounded p-2 text-sae-text text-sm focus:border-sae-accent outline-none"
                                            value={filters.startDate}
                                            onChange={e => setFilters({...filters, startDate: e.target.value})}
                                        />
                                        <input 
                                            type="date" 
                                            className="bg-sae-darker border border-sae-border rounded p-2 text-sae-text text-sm focus:border-sae-accent outline-none"
                                            value={filters.endDate}
                                            onChange={e => setFilters({...filters, endDate: e.target.value})}
                                        />
                                    </div>
                                </div>

                                {/* Sector */}
                                <div>
                                    <label className="text-xs text-sae-muted uppercase font-bold mb-1 block">Setor</label>
                                    <select 
                                        className="w-full bg-sae-darker border border-sae-border rounded p-2 text-sae-text text-sm focus:border-sae-accent outline-none"
                                        value={filters.sector}
                                        onChange={e => setFilters({...filters, sector: e.target.value})}
                                    >
                                        <option value="">Todos</option>
                                        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {/* Search */}
                                <div>
                                    <label className="text-xs text-sae-muted uppercase font-bold mb-1 block">Busca</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sae-muted" />
                                        <input 
                                            type="text" 
                                            placeholder="Palavra-chave..."
                                            className="w-full bg-sae-darker border border-sae-border rounded p-2 pl-9 text-sae-text text-sm focus:border-sae-accent outline-none"
                                            value={filters.search}
                                            onChange={e => setFilters({...filters, search: e.target.value})}
                                        />
                                    </div>
                                </div>

                                {/* Clear Button */}
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full mt-2"
                                    onClick={() => setFilters({ startDate: '', endDate: '', sector: '', search: '' })}
                                >
                                    Limpar Filtros
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Feed */}
                    <div className="lg:w-3/4 space-y-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin w-8 h-8 border-4 border-sae-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-sae-muted">Carregando memorandos...</p>
                            </div>
                        ) : loadError ? (
                            <div role="alert" className="text-center py-12 border border-sae-border rounded-xl bg-sae-card/50">
                                <FileText size={32} className="mx-auto mb-4 text-sae-muted" />
                                <p className="text-sae-muted">Não foi possível carregar os memorandos. Tente novamente em instantes.</p>
                            </div>
                        ) : filteredMemorandos.length > 0 ? (
                            filteredMemorandos.map((memo, i) => (
                                <Card key={i} className="p-6 transition-all hover:border-sae-accent/30 group animate-fadeIn" style={{animationDelay: `${i * 50}ms`}}>
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <Badge variant={memo.sector === 'RH' ? 'primary' : 'secondary'}>{memo.sector}</Badge>
                                                <span className="text-xs text-sae-muted flex items-center gap-1">
                                                    <Calendar size={12}/> {memo.date}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-sae-text group-hover:text-sae-accentText transition-colors">
                                                {memo.title}
                                            </h3>
                                        </div>
                                    </div>
                                    
                                    <div className={`text-sae-muted text-sm leading-relaxed overflow-hidden transition-all duration-500 ${expanded.has(i) ? 'max-h-[1000px]' : 'max-h-[100px] relative'}`}>
                                        {formatMessage(memo.message)}
                                        
                                        {!expanded.has(i) && memo.message.length > 200 && (
                                            <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-sae-card to-transparent pointer-events-none"></div>
                                        )}
                                    </div>

                                    {memo.message.length > 200 && (
                                        <button 
                                            onClick={() => toggleExpand(i)}
                                            className="mt-4 text-xs font-bold text-sae-accentText uppercase tracking-wider hover:underline flex items-center gap-1"
                                        >
                                            {expanded.has(i) ? 'Recolher' : 'Ler mais'}
                                            {expanded.has(i) ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                        </button>
                                    )}
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-12 border border-sae-border rounded-xl bg-sae-card/50">
                                <FileText size={32} className="mx-auto mb-4 text-sae-muted" />
                                <p className="text-sae-muted">Nenhum memorando encontrado com os filtros selecionados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};
