import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button, SectionTitle, Card, Badge, Breadcrumb } from '../components/UI';
import { Play, Clock, Search, Award, TrendingUp, BookOpen, CheckCircle, Download } from 'lucide-react';

// --- QUIZ PAGE (What to study) ---
export const Quiz: React.FC = () => {
  const [step, setStep] = useState(1);
  const [showResult, setShowResult] = useState(false);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else setShowResult(true);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Cursos', path: '#' }, { label: 'O que estudar?' }]} />
        
        <div className="max-w-2xl mx-auto">
          {!showResult ? (
            <Card className="p-8">
              <div className="mb-8">
                <div className="flex justify-between text-sm text-sae-muted mb-2">
                  <span>Passo {step} de 3</span>
                  <span>{Math.round((step/3)*100)}%</span>
                </div>
                <div className="h-2 bg-sae-darker rounded-full overflow-hidden">
                  <div className="h-full bg-sae-accent transition-all duration-300" style={{ width: `${(step/3)*100}%` }}></div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-sae-text mb-6">
                {step === 1 && "Qual seu principal objetivo profissional agora?"}
                {step === 2 && "Quanto tempo você tem disponível por semana?"}
                {step === 3 && "Qual área você sente mais dificuldade?"}
              </h2>

              <div className="space-y-4 mb-8">
                {[1, 2, 3].map((opt) => (
                  <label key={opt} className="flex items-center p-4 border border-sae-border rounded-lg cursor-pointer hover:bg-sae-border/30 transition-colors">
                    <input type="radio" name="q" className="w-4 h-4 text-sae-accentText bg-sae-darker border-sae-border focus:ring-sae-accent" />
                    <span className="ml-3 text-sae-text">Opção de resposta {opt} para a pergunta atual.</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(s => Math.max(1, s-1))} disabled={step === 1}>Voltar</Button>
                <Button onClick={handleNext}>{step === 3 ? 'Ver Recomendação' : 'Próximo'}</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <Card className="p-8 text-center bg-gradient-to-b from-sae-card to-sae-darker">
                <div className="w-16 h-16 bg-sae-accent/20 rounded-full flex items-center justify-center text-sae-accentText mx-auto mb-4">
                  <Award size={32} />
                </div>
                <h2 className="text-3xl font-bold text-sae-text mb-2">Perfil: Negociador Estratégico</h2>
                <p className="text-sae-muted mb-6">Com base nas suas respostas, recomendamos focar em soft skills e fechamento.</p>
                <Button onClick={() => {setShowResult(false); setStep(1);}} variant="outline">Refazer Quiz</Button>
              </Card>

              <div>
                <h3 className="text-xl font-bold text-sae-text mb-4">Cursos Recomendados para Você</h3>
                <div className="grid gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 bg-sae-card p-4 rounded-lg border border-sae-border">
                       <div className="w-16 h-16 bg-sae-border rounded-md shrink-0"></div>
                       <div className="flex-1">
                         <h4 className="font-bold text-sae-text">Psicologia de Vendas Avançada</h4>
                         <p className="text-xs text-sae-muted">Online • 8 horas</p>
                       </div>
                       <Button size="sm">Acessar</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

// --- EVOLUTION PAGE ---
export const Evolution: React.FC = () => {
    // State for Inputs
    const [qpe, setQpe] = useState<number | ''>('');
    const [lastEvolutionDate, setLastEvolutionDate] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    
    // State for Quantities (key -> quantity)
    const [quantitiesMap, setQuantitiesMap] = useState<Record<string, number>>({});

    // Field Configuration: Points per item & Max Quantity
    const fields = [
        { label: 'Doutorado', points: 10, max: 1 },
        { label: 'Mestrado', points: 9, max: 1 },
        { label: 'Tecnólogo', points: 4, max: 1 },
        { label: 'Bacharelado', points: 4, max: 1 },
        { label: '2ª Licenciatura', points: 5, max: 1 },
        { label: 'Pós Lato-Sensu', points: 3, max: 1 },
        { label: 'Extensão 100h', points: 1.5, max: 2 },
        { label: 'Extensão 45h', points: 0.5, max: 2 },
        { label: 'Curso PMSP', points: 1, max: 6 },
        { label: 'Curso Sindicato', points: 0.5, max: 6 },
        { label: 'Participação PEA', points: 2, max: 3 },
        { label: 'Mais Educa 144h', points: 2, max: 3 },
        { label: 'Mais Educa 72h', points: 0.5, max: 3 },
        { label: 'Participação APM', points: 1, max: 3 },
        { label: 'Participação Conselho de Classe', points: 0.5, max: 3 },
        { label: 'Participação CIPA', points: 0.5, max: 3 },
        { label: 'Publicação de Livro', points: 2, max: 1 },
        { label: 'Publicação de Artigo', points: 1, max: 3 },
    ];

    // Calculation Results
    const qpeResult = React.useMemo(() => {
        if (!qpe) return null;
        const val = Number(qpe);
        if (val >= 14 && val <= 16) return 13.5;
        if (val >= 17 && val <= 19) return 18;
        if (val === 20) return 9;
        if (val === 21) return 4;
        return null;
    }, [qpe]);

    const timeMetrics = React.useMemo(() => {
        if (!lastEvolutionDate || !currentDate) return { months: 0, points: 0 };
        
        const start = new Date(lastEvolutionDate);
        const end = new Date(currentDate);
        
        if (start > end) return { months: 0, points: 0 };

        const diffYears = end.getFullYear() - start.getFullYear();
        const diffMonths = end.getMonth() - start.getMonth();
        const totalMonths = (diffYears * 12) + diffMonths;
        
        return {
            months: totalMonths,
            points: Number((totalMonths * 0.3).toFixed(1))
        };
    }, [lastEvolutionDate, currentDate]);

    const totalPoints = React.useMemo(() => {
        // Calculate points from quantities
        const certPoints = fields.reduce((acc, field) => {
            const qty = quantitiesMap[field.label] || 0;
            return acc + (qty * field.points);
        }, 0);

        return (certPoints + timeMetrics.points).toFixed(1);
    }, [quantitiesMap, timeMetrics.points]);

    // Handlers
    const handleSelectChange = (key: string, value: string) => {
        setQuantitiesMap(prev => ({ ...prev, [key]: parseInt(value) }));
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 lg:px-8 py-12">
            <Breadcrumb items={[{ label: 'Home', path: '#'}, { label: 'Minha Evolução' }]} />
            <SectionTitle title="Calculadora de Evolução Funcional" subtitle="Simule sua pontuação e planeje seu crescimento na carreira." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Calculator Inputs */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 bg-sae-card/80 border-sae-accent/20">
                        <h3 className="text-xl font-bold text-sae-text mb-6 flex items-center gap-2">
                            <Clock size={20} className="text-sae-accentText" /> Dados Básicos
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* QPE */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sae-muted">Qual QPE você está?</label>
                                <input 
                                    type="number" 
                                    value={qpe} 
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setQpe(isNaN(val) ? '' : Math.max(0, val));
                                    }}
                                    className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none"
                                    placeholder="Ex: 14"
                                />
                            </div>

                            {/* QPE Result Display (Inline) */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sae-muted">Precisa p/ Próxima:</label>
                                <div className="p-3 bg-sae-darker border border-sae-border rounded-lg text-sae-accentText font-bold">
                                    {qpeResult !== null ? `${qpeResult} pontos` : '-'}
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sae-muted">Data Última Evolução</label>
                                <input 
                                    type="date" 
                                    value={lastEvolutionDate}
                                    onChange={(e) => setLastEvolutionDate(e.target.value)}
                                    className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sae-muted">Data Atual</label>
                                <input 
                                    type="date" 
                                    value={currentDate}
                                    onChange={(e) => setCurrentDate(e.target.value)}
                                    className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text focus:border-sae-accent outline-none"
                                />
                            </div>
                        </div>

                        {/* Time Results */}
                        <div className="mt-6 grid grid-cols-2 gap-4 bg-sae-darker/50 p-4 rounded-lg">
                            <div>
                                <div className="text-xs text-sae-muted uppercase tracking-wider">Meses Trabalhados</div>
                                <div className="text-xl font-bold text-sae-text">{timeMetrics.months}</div>
                            </div>
                            <div>
                                <div className="text-xs text-sae-muted uppercase tracking-wider">Pontos por Tempo</div>
                                <div className="text-xl font-bold text-sae-success">+{timeMetrics.points}</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-sae-card/80 border-sae-accent/20">
                        <h3 className="text-xl font-bold text-sae-text mb-6 flex items-center gap-2">
                            <Award size={20} className="text-sae-accentAlt" /> Títulos e Certificados
                        </h3>
                        <p className="text-sm text-sae-muted mb-4">Selecione a <b>quantidade</b> de títulos que você possui em cada categoria.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fields.map((field, idx) => (
                                <div key={idx} className="flex flex-col space-y-1">
                                    <div className="flex justify-between items-center pr-2">
                                        <label className="text-sm text-sae-muted">{field.label}</label>
                                        <span className="text-xs text-sae-success">({field.points} pts/un)</span>
                                    </div>
                                    <select 
                                        className="bg-sae-darker border border-sae-border rounded-lg p-2 text-sae-text focus:border-sae-accent outline-none appearance-none cursor-pointer hover:border-sae-accent/50"
                                        onChange={(e) => handleSelectChange(field.label, e.target.value)}
                                        value={quantitiesMap[field.label] || 0}
                                    >
                                        {/* Generate options 0 to Max */}
                                        {Array.from({ length: field.max + 1 }, (_, i) => (
                                            <option key={i} value={i}>{i}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right Column: Sticky Results */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 space-y-6">
                        <Card className="p-6 border-2 border-sae-accent bg-sae-card shadow-lg shadow-sae-success/20">
                            <div className="text-center mb-6">
                                <h2 className="text-sm font-bold text-sae-muted uppercase tracking-widest mb-2">Total Acumulado</h2>
                                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sae-accent to-sae-accentHover">
                                    {totalPoints}
                                </div>
                                <div className="text-sm text-sae-text mt-1">pontos</div>
                            </div>

                            <div className="space-y-4 border-t border-sae-border pt-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-sae-muted">Meta Atual (QPE {qpe || '?'})</span>
                                    <span className="font-bold text-sae-text">{qpeResult ? qpeResult : '--'} pts</span>
                                </div>
                                
                                {/* Progress Bar */}
                                {qpeResult && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-sae-accentText">{Math.round((Number(totalPoints) / qpeResult) * 100)}%</span>
                                        </div>
                                        <div className="h-3 bg-sae-darker rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-sae-accent to-sae-accentHover transition-all duration-500 ease-out"
                                                style={{ width: `${Math.min(100, (Number(totalPoints) / qpeResult) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {qpeResult && Number(totalPoints) >= qpeResult ? (
                                    <div className="bg-sae-success/20 text-sae-success p-3 rounded-lg text-center font-bold text-sm animate-pulse">
                                        🚀 Você atingiu a meta!
                                    </div>
                                ) : (
                                    <div className="text-center text-xs text-sae-muted">
                                        Continue evoluindo para alcançar o próximo nível!
                                    </div>
                                )}
                            </div>
                        </Card>



                    </div>
                </div>

            </div>
            </div>
        </Layout>
    );
};