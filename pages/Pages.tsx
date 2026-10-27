import React from 'react';
import { Layout } from '../components/Layout';
import { Button, SectionTitle, Card, Badge, Breadcrumb } from '../components/UI';
import { Mail, Phone, MapPin, Clock, Linkedin, Twitter, Calendar, Pin, Filter, Search, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PenSquare, Trash2 } from 'lucide-react';
import { deleteNotice } from '../lib/notices';
import { NoticeComposer } from '../components/NoticeComposer';
import { can } from '../lib/permissions';
import { IES_CONTACTS, IES_OPTIONS, NUCLEO_INFO, NUCLEO_OPTIONS } from '../lib/contacts';

// --- CONTACTS PAGE ---
export const Contacts: React.FC = () => {
    const [selectedIES, setSelectedIES] = React.useState('');
    const [selectedNucleo, setSelectedNucleo] = React.useState('');

    const iesContacts = IES_CONTACTS;
    const nucleoInfo = NUCLEO_INFO;

    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12">
            <Breadcrumb items={[{ label: 'Contatos' }]} />
            <SectionTitle title="Central de Relacionamento" subtitle="Encontre o canal certo para sua necessidade." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start min-h-[500px]">
                
                {/* Column 1: IES Selection */}
                <Card className="p-6 bg-sae-card/80 border-sae-accent/20 flex flex-col shadow-lg h-full">
                    <div className="text-center mb-6">
                        <div className="bg-sae-accent/10 p-4 rounded-full inline-block mb-4">
                            <Mail size={32} className="text-sae-accentText" />
                        </div>
                        <h3 className="text-xl font-bold text-sae-text">Selecione a IES</h3>
                        <p className="text-sm text-sae-muted mt-2">Para ver a lista de contatos</p>
                    </div>
                    
                    <select 
                        className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none cursor-pointer"
                        onChange={(e) => setSelectedIES(e.target.value)}
                        value={selectedIES}
                    >
                        <option value="">Selecione...</option>
                        {IES_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    {selectedIES && (
                        <div className="mt-8 p-4 bg-sae-darker rounded-lg border border-sae-border/50 text-center animate-fadeIn">
                             <div className="text-sm text-sae-muted">IES Selecionada</div>
                             <div className="font-bold text-sae-accentText text-lg">{iesContacts[selectedIES]?.name}</div>
                        </div>
                    )}
                </Card>

                {/* Column 2: Nucleo Selection & Info */}
                <Card className="p-6 bg-sae-card/80 border-sae-accent/20 flex flex-col shadow-lg h-full">
                    <div className="text-center mb-6">
                        <div className="bg-sae-accentAlt/10 p-4 rounded-full inline-block mb-4">
                            <Clock size={32} className="text-sae-accentAlt" />
                        </div>
                        <h3 className="text-xl font-bold text-sae-text">Núcleo / Departamento</h3>
                        <p className="text-sm text-sae-muted mt-2">Entenda as atividades de cada setor</p>
                    </div>

                    <select 
                        className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none cursor-pointer mb-6"
                        onChange={(e) => setSelectedNucleo(e.target.value)}
                        value={selectedNucleo}
                    >
                        <option value="">Selecione...</option>
                        {NUCLEO_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
                        {selectedNucleo && nucleoInfo[selectedNucleo] ? (
                            <ul className="space-y-3">
                                {nucleoInfo[selectedNucleo].map((item, idx) => (
                                    <li key={idx} className="text-sm text-sae-text flex items-start gap-2 animate-fadeIn" style={{animationDelay: `${idx * 50}ms`}}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-sae-accentAlt mt-1.5 shrink-0"></div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center text-sae-muted py-8 opacity-50">
                                Selecione um núcleo para ver as atribuições.
                            </div>
                        )}
                    </div>
                </Card>

                {/* Column 3: Contact List Results */}
                <Card className="p-6 bg-sae-card/80 border-sae-accent/20 flex flex-col shadow-lg h-full">
                     <div className="text-center mb-6 border-b border-sae-border pb-4">
                        <h3 className="text-xl font-bold text-sae-text">Lista de Contatos</h3>
                        {selectedIES ? (
                             <p className="text-sm text-sae-accentText mt-1 font-semibold">{iesContacts[selectedIES]?.name}</p>
                        ) : (
                             <p className="text-sm text-sae-muted mt-1">Aguardando seleção de IES...</p>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[500px]">
                        {selectedIES && iesContacts[selectedIES] ? (
                            <div className="space-y-3">
                                {iesContacts[selectedIES].emails.map((item, idx) => (
                                    <div key={idx} className="bg-sae-darker p-3 rounded-lg border border-sae-border/50 hover:border-sae-accent/50 transition-colors animate-fadeIn" style={{animationDelay: `${idx * 30}ms`}}>
                                        <div className="text-xs font-bold text-sae-text uppercase tracking-wider mb-1">
                                            {item.label}
                                        </div>
                                        <div className="text-sm text-sae-accentText break-all flex items-center gap-2">
                                            <Mail size={14} />
                                            <a href={`mailto:${item.email}`} className="hover:underline">{item.email}</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-sae-muted opacity-50 py-12">
                                <Mail size={48} className="mb-4 text-sae-border" />
                                <p>Selecione uma IES na primeira coluna.</p>
                            </div>
                        )}
                    </div>
                </Card>

            </div>
            </div>
        </Layout>
    );
};

// --- NOTICES PAGE ---
export const Notices: React.FC = () => {
    // Types
    interface Notice {
        title: string;
        message: string;
        date: string; // Original format from sheet (dd/mm/yyyy)
        sector: string;
        rowNumber: number; // linha na aba Avisos (a primeira linha de dados é a 2)
    }

    // State
    const [notices, setNotices] = useState<Notice[]>([]);
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
    const [composerOpen, setComposerOpen] = useState(false);
    const userLogin = localStorage.getItem('userLogin') ?? '';
    const mayCreate = can('createNotice');
    const mayDelete = can('deleteNotice') && Boolean(userLogin);
    const [confirmingRow, setConfirmingRow] = useState<number | null>(null);
    const [deletingRow, setDeletingRow] = useState<number | null>(null);
    const [deleteError, setDeleteError] = useState('');

    // API Config
    const SHEET_ID = "1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI";
    const API_KEY = "AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0";

    // Fetch Data
    const loadNotices = React.useCallback(async () => {
        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Avisos!A2:D?key=${API_KEY}`);
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP ${response.status}`);
            setLoadError(false);

            if (data.values) {
                // A API devolve também as linhas vazias ou incompletas (ex.: uma célula solta lá embaixo na aba):
                // só entra aviso com título e mensagem. O número da linha é calculado antes de filtrar.
                const parsedNotices: Notice[] = data.values
                    .map((row: string[], index: number) => ({
                        title: (row[0] ?? '').trim(),
                        message: row[1] ?? '',
                        date: row[2] ?? '',
                        sector: row[3] ?? '',
                        rowNumber: index + 2
                    }))
                    .filter((notice: Notice) => notice.title && notice.message.trim())
                    .reverse();

                setNotices(parsedNotices);

                // Extract unique sectors
                const uniqueSectors = Array.from(new Set(parsedNotices.map((n: Notice) => n.sector))).filter(Boolean) as string[];
                setSectors(uniqueSectors);
            }
        } catch (error) {
            console.error("Error loading notices:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotices();
    }, [loadNotices]);

    // Helper: Parse Brazilian Date string to Date object
    const parseDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    };

    // Filter Logic
    const filteredNotices = React.useMemo(() => {
        return notices.filter(notice => {
            // Date Filter
            const noticeDate = parseDate(notice.date);
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                if (noticeDate && noticeDate < start) return false;
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                // Adjust end date to include the full day
                end.setHours(23, 59, 59, 999); 
                if (noticeDate && noticeDate > end) return false;
            }

            // Sector Filter
            if (filters.sector && notice.sector !== filters.sector) return false;

            // Search Filter
            if (filters.search) {
                const term = filters.search.toLowerCase();
                if (!notice.title.toLowerCase().includes(term) && 
                    !notice.message.toLowerCase().includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [notices, filters]);

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

    const handleDelete = async (notice: Notice) => {
        setDeletingRow(notice.rowNumber);
        setDeleteError('');
        try {
            await deleteNotice(notice, { login: userLogin });
            setConfirmingRow(null);
            await loadNotices();
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Não foi possível apagar o aviso.');
        } finally {
            setDeletingRow(null);
        }
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
                <Breadcrumb items={[{ label: 'Avisos' }]} />
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <SectionTitle title="Mural de Avisos" subtitle="Fique por dentro das últimas novidades." />
                    {mayCreate && (
                        <div className="flex flex-col items-end gap-1">
                            <Button onClick={() => setComposerOpen(true)} disabled={!userLogin}>
                                <PenSquare size={16} className="mr-2" /> Novo aviso
                            </Button>
                            {!userLogin && <p className="text-xs text-sae-muted">Entre novamente no SAE para criar avisos.</p>}
                        </div>
                    )}
                </div>
                {mayCreate && (
                    <NoticeComposer
                        open={composerOpen}
                        onClose={() => setComposerOpen(false)}
                        onCreated={loadNotices}
                        sectors={sectors}
                        user={{ login: userLogin }}
                    />
                )}

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
                        {deleteError && <p role="alert" className="text-sm text-sae-danger">{deleteError}</p>}
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin w-8 h-8 border-4 border-sae-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-sae-muted">Carregando avisos...</p>
                            </div>
                        ) : loadError ? (
                            <div role="alert" className="text-center py-12 border border-sae-border rounded-xl bg-sae-card/50">
                                <Info size={32} className="mx-auto mb-4 text-sae-muted" />
                                <p className="text-sae-muted">Não foi possível carregar os avisos. Tente novamente em instantes.</p>
                            </div>
                        ) : filteredNotices.length > 0 ? (
                            filteredNotices.map((notice, i) => (
                                <Card key={i} className="p-6 transition-all hover:border-sae-accent/30 group animate-fadeIn" style={{animationDelay: `${i * 50}ms`}}>
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <Badge variant={notice.sector === 'RH' ? 'primary' : 'secondary'}>{notice.sector}</Badge>
                                                <span className="text-xs text-sae-muted flex items-center gap-1">
                                                    <Calendar size={12}/> {notice.date}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-sae-text group-hover:text-sae-accentText transition-colors">
                                                {notice.title}
                                            </h3>
                                        </div>
                                        {mayDelete && (
                                            confirmingRow === notice.rowNumber ? (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button size="sm" onClick={() => handleDelete(notice)} disabled={deletingRow === notice.rowNumber}>
                                                        {deletingRow === notice.rowNumber ? 'Apagando...' : 'Apagar aviso'}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setConfirmingRow(null)} disabled={deletingRow === notice.rowNumber}>
                                                        Cancelar
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingRow(notice.rowNumber)}
                                                    className="p-2 text-sae-muted hover:text-sae-danger transition-colors shrink-0"
                                                    aria-label={`Apagar o aviso ${notice.title}`}
                                                    title="Apagar aviso"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )
                                        )}
                                    </div>
                                    
                                    <div className={`text-sae-muted text-sm leading-relaxed overflow-hidden transition-all duration-500 ${expanded.has(i) ? 'max-h-[1000px]' : 'max-h-[100px] relative'}`}>
                                        {formatMessage(notice.message)}
                                        
                                        {!expanded.has(i) && notice.message.length > 200 && (
                                            <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-sae-card to-transparent pointer-events-none"></div>
                                        )}
                                    </div>

                                    {notice.message.length > 200 && (
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
                                <Info size={32} className="mx-auto mb-4 text-sae-muted" />
                                <p className="text-sae-muted">Nenhum aviso encontrado com os filtros selecionados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};