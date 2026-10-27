import React from 'react';
import { Layout } from '../components/Layout';
import { Button, SectionTitle, Card, Badge, Breadcrumb } from '../components/UI';
import { eligibleTypes, EDUCATION_OPTIONS } from '../lib/quizRules';
import { Search, Filter, Calendar, MapPin, Clock, CheckCircle, SlidersHorizontal, ChevronRight, Star, GraduationCap, BookOpen } from 'lucide-react';

// --- QUIZ (O QUE POSSO ESTUDAR?) ---
export const CourseQuiz: React.FC = () => {
    const [selectedEducation, setSelectedEducation] = React.useState('');
    const [eligibleTypes, setEligibleTypes] = React.useState<string[]>([]);
    const [availableCourses, setAvailableCourses] = React.useState<any[]>([]);
    const [filteredCourses, setFilteredCourses] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Constants
    const SHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
    const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';
    const RANGE = 'Cursos!A2:E1000'; // Fetches Name(A), Type(B) etc.

    // Fetch All Courses once
    React.useEffect(() => {
        const fetchCourses = async () => {
            try {
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
                const response = await fetch(url);
                const result = await response.json();
                if (result.values) {
                    setAvailableCourses(result.values);
                }
            } catch (error) {
                console.error('Erro ao buscar cursos:', error);
            }
        };
        fetchCourses();
    }, []);

    // Logic: Map Education -> Eligible Types
    const handleEducationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelectedEducation(value);
        setLoading(true);

        const types = eligibleTypes(value);

        setEligibleTypes(types);

        // Filter courses based on types
        if (value && types.length > 0) {
            const matches = availableCourses.filter(row => {
                 const courseType = row[1]; // Column B is Type
                 return types.includes(courseType) || types.some(t => courseType && courseType.includes(t)); // Loose matching if needed
            });
            setFilteredCourses(matches);
        } else {
            setFilteredCourses([]);
        }
        setLoading(false);
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12">
                <Breadcrumb items={[{ label: 'Home', path: '#' }, { label: 'O que posso estudar?' }]} />
                <SectionTitle title="Guia de Estudos" subtitle="Descubra as melhores opções para sua carreira." />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch min-h-[500px]">
                    
                    {/* Column 1: Cursou */}
                    <Card className="p-6 bg-sae-card/80 border-sae-accent/20 flex flex-col items-center text-center shadow-lg">
                        <div className="bg-sae-accent/10 p-4 rounded-full mb-4">
                           <GraduationCap size={40} className="text-sae-accentText" />
                        </div>
                        <h3 className="text-xl font-bold text-sae-text mb-6">O que você cursou?</h3>
                        
                        <div className="w-full max-w-xs">
                            <select 
                                value={selectedEducation}
                                onChange={handleEducationChange}
                                className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none text-center cursor-pointer hover:border-sae-accent/50 transition-colors"
                            >
                                <option value="">Selecione sua formação</option>
                                {EDUCATION_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-sae-muted text-sm mt-4">
                            Selecione sua formação atual para ver as oportunidades disponíveis.
                        </p>
                    </Card>

                    {/* Column 2: Pode Cursar */}
                    <Card className="p-6 bg-sae-card/80 border-sae-accent/20 flex flex-col shadow-lg">
                        <h3 className="text-xl font-bold text-sae-text mb-6 text-center border-b border-sae-border pb-4">
                            Você pode cursar
                        </h3>
                        
                        {eligibleTypes.length > 0 ? (
                            <ul className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {eligibleTypes.map((type, idx) => (
                                    <li key={idx} className="flex items-center gap-3 bg-sae-darker p-3 rounded-lg border border-sae-border/50 animate-fadeIn" style={{animationDelay: `${idx * 50}ms`}}>
                                        <CheckCircle size={18} className="text-sae-success flex-shrink-0" />
                                        <span className="text-sae-text font-medium">{type}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-sae-muted opacity-50">
                                <Search size={48} className="mb-4" />
                                <p>Aguardando seleção...</p>
                            </div>
                        )}
                    </Card>

                    {/* Column 3: Lista de Opções */}
                    <Card className="p-6 bg-sae-card/80 border-sae-accent/20 flex flex-col shadow-lg">
                        <h3 className="text-xl font-bold text-sae-text mb-6 text-center border-b border-sae-border pb-4">
                            Lista de Opções
                        </h3>

                        {loading ? (
                            <div className="flex-1 flex justify-center items-center">
                                <div className="animate-spin w-8 h-8 border-2 border-sae-accent border-t-transparent rounded-full"></div>
                            </div>
                        ) : filteredCourses.length > 0 ? (
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 max-h-[500px]">
                                {filteredCourses.map((course, idx) => {
                                    const nome = course[0];
                                    const tipo = course[1];
                                    return (
                                        <div key={idx} className="bg-sae-darker hover:bg-sae-accent/5 p-3 rounded-lg border border-sae-border/50 transition-colors cursor-default text-left">
                                            <div className="font-bold text-sae-text text-sm leading-tight mb-1">{nome}</div>
                                            <div className="text-xs text-sae-accentAlt font-medium uppercase tracking-wider">{tipo}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-sae-muted opacity-50">
                                <BookOpen size={48} className="mb-4" />
                                <p>Nenhum curso listado ainda.</p>
                            </div>
                        )}
                    </Card>

                </div>
            </div>
        </Layout>
    );
};
