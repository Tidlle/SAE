import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, X } from 'lucide-react';
import { Button, Card, Logo } from '../components/UI';
import { ROLE_STORAGE_KEY, parseRole } from '../lib/permissions';
import { FIRST_ACCESS_KEY } from '../lib/session';

const API_KEY = 'AIzaSyCBqdUJmSzfv0bT2g1vM8MJuAl6kWF4gE0';
const SPREADSHEET_ID = '1JZLbofayEZKDkc68ItsJWDfM02BxNpgdbsUHr-LZMJI';
const RANGE = 'Cadastros!A:N';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Recovery Modal State
    const [showRecover, setShowRecover] = useState(false);
    const [recoverEmail, setRecoverEmail] = useState('');
    const [recoverMsg, setRecoverMsg] = useState('');

    // Welcome Modal State
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomeName, setWelcomeName] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
            const data = await response.json();

            if (data.values) {
                const rows = data.values.slice(1);
                // Schema Implied:
                // 0: Nome, 1: Login, 2: Email, 4: Senha, 8: Acesso('SIM')
                
                const user = rows.find((row: any) => {
                    return row[1] === username && 
                           row[4] === password && 
                           row[8]?.trim().toUpperCase() === "SIM";
                });

                if (user) {
                    localStorage.setItem("usuarioAutenticado", "true");
                    localStorage.setItem("userNome", user[0]); // Save full name
                    localStorage.setItem("userLogin", user[1]); // Login: identifica o autor das publicações do feed
                    localStorage.setItem(ROLE_STORAGE_KEY, parseRole(user[12])); // Perfil (coluna M): em branco = Administrativo
                    // Coluna N: PENDENTE = conta nova que ainda precisa assinar o termo no primeiro acesso
                    const firstAccessPending = (user[13] ?? '').toString().trim().toUpperCase() === 'PENDENTE';
                    if (firstAccessPending) localStorage.setItem(FIRST_ACCESS_KEY, 'pendente');
                    else localStorage.removeItem(FIRST_ACCESS_KEY);
                    
                    const firstName = user[0].split(' ')[0];
                    setWelcomeName(firstName);
                    setShowWelcome(true);

                    setTimeout(() => {
                        navigate(firstAccessPending ? '/primeiro-acesso' : '/'); // Home (ou termo, no primeiro acesso)
                    }, 2500);
                } else {
                    setError('Usuário ou senha inválidos, ou acesso não autorizado.');
                }
            } else {
                setError('Erro ao carregar dados do servidor.');
            }
        } catch (err) {
            console.error(err);
            setError('Erro de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleRecover = async () => {
        if (!recoverEmail) return;
        setLoading(true);
        setRecoverMsg('Buscando...');

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
            const data = await response.json();

            if (data.values) {
                const rows = data.values.slice(1);
                const user = rows.find((row: any) => row[2] === recoverEmail);

                if (user) {
                    setRecoverMsg(`Login: ${user[1]} | Senha: ${user[4]}`);
                } else {
                    setRecoverMsg('E-mail não encontrado.');
                }
            }
        } catch (err) {
            setRecoverMsg('Erro ao buscar dados.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center">
            {/* Overlay */}

            <Card className="w-full max-w-md p-8 relative z-10 mx-4 border-sae-accent/20 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4">
                        <Logo className="h-24 w-auto" />
                    </div>
                    <h1 className="text-2xl font-bold text-sae-text">SAE Login</h1>
                    <p className="text-sae-muted text-sm mt-2">Sistema de Apoio Educacional</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-sae-accentText" size={20} />
                            <input 
                                type="text" 
                                placeholder="Usuário" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-sae-darker border border-sae-border rounded-lg pl-10 pr-4 py-3 text-sae-text focus:border-sae-accent outline-none placeholder:text-sae-muted/70 shadow-inner"
                                required
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-sae-accentText" size={20} />
                            <input 
                                type="password" 
                                placeholder="Senha" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-sae-darker border border-sae-border rounded-lg pl-10 pr-4 py-3 text-sae-text focus:border-sae-accent outline-none placeholder:text-sae-muted/70 shadow-inner"
                                required
                            />
                        </div>
                    </div>

                    <div className="text-right">
                        <button 
                            type="button"
                            onClick={() => setShowRecover(true)}
                            className="text-xs text-sae-muted hover:text-sae-accentText transition-colors"
                        >
                            Esqueci meu login ou senha
                        </button>
                    </div>

                    {error && (
                        <div className="text-sae-danger text-sm text-center bg-sae-danger/10 p-2 rounded border border-sae-danger/30">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-sae-accent/30" disabled={loading}>
                        {loading ? 'Entrando...' : 'Entrar'}
                    </Button>

                    <p className="text-center text-sm text-sae-muted mt-4">
                        Primeiro acesso? Peça seu cadastro a um administrativo.
                    </p>
                </form>
            </Card>

            {/* Recover Modal */}
            {showRecover && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowRecover(false)}></div>
                    <Card className="relative z-10 w-full max-w-sm p-6 border-sae-border shadow-2xl">
                        <button onClick={() => setShowRecover(false)} className="absolute top-4 right-4 text-sae-muted hover:text-sae-text">
                            <X size={20}/>
                        </button>
                        <h3 className="text-xl font-bold text-sae-text mb-4 flex items-center gap-2">
                            <Mail size={20} className="text-sae-accentText"/> Recuperar Acesso
                        </h3>
                        <div className="space-y-4">
                            <input 
                                type="email" 
                                placeholder="Digite seu e-mail cadastrado" 
                                value={recoverEmail}
                                onChange={(e) => setRecoverEmail(e.target.value)}
                                className="w-full bg-sae-darker border border-sae-border rounded-lg p-3 text-sae-text outline-none focus:border-sae-accent"
                            />
                            {recoverMsg && (
                                <div className={`text-sm p-2 rounded ${recoverMsg.includes('Login') ? 'bg-sae-accent/20 text-sae-accentText' : 'bg-sae-danger/10 text-sae-danger'}`}>
                                    {recoverMsg}
                                </div>
                            )}
                            <Button onClick={handleRecover} className="w-full" disabled={loading}>
                                {loading ? 'Buscando...' : 'Recuperar Dados'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Welcome Modal */}
            {showWelcome && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl"></div>
                    <div className="relative z-10 text-center animate-bounce-in">
                        <div className="w-24 h-24 bg-sae-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-sae-accent/30">
                            <User size={48} className="text-white"/>
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-2">Olá, {welcomeName}!</h2>
                        <p className="text-xl text-sae-accentText">Seja bem-vindo ao SAE.</p>
                        <div className="mt-8 flex justify-center">
                            <div className="w-12 h-12 border-4 border-sae-accent border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
