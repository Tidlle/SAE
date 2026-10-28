import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, User, UserPlus, BarChart3, ChevronDown, LogOut, Facebook, Twitter, Instagram, Youtube, MapPin, Mail, Phone } from 'lucide-react';
import { Button, Logo } from './UI';
import { clearSession } from '../lib/session';
import { can } from '../lib/permissions';

const NAV_ITEMS = [
  { label: 'Início', path: '/' },
  { label: 'Sobre SAE', path: '/sobre' },
  {
    label: 'Conteúdos',
    path: '#',
    children: [
      { label: 'Tutoriais da plataforma', path: '/videos/tutoriais' },
      { label: 'Conteúdo das aulas', path: '/videos/aulas' },
      { label: 'Conteúdos do Instagram', path: '/videos/instagram' },
      { label: 'Flyers', path: '/videos/flyers' },
    ],
  },
  { 
    label: 'Cursos', 
    path: '#',
    children: [
      { label: 'Informações', path: '/cursos/info' },
      { label: 'Presenciais', path: '/cursos/presenciais' },
      { label: 'Filtro Avançado', path: '/cursos/filtro' },
      { label: 'Combos', path: '/cursos/combos' },
      { label: 'O que estudar?', path: '/quiz' },
      { label: 'Evolução', path: '/evolucao' },
      { label: 'Solicitação de Novos Cursos', path: '/cursos/criacao' },
      { label: 'Calendário de Aulas', path: '/cursos/calendario' },
    ]
  },
  { label: 'Contatos', path: '/contatos' },
  { label: 'Avisos', path: '/avisos' },
  { label: 'Cadastros', path: '/cadastros' },
  { label: 'Memorandos', path: '/memorandos' },
  { label: 'Meu Assistente', path: '/assistente' },
  { label: 'Simulador', path: '/simulador' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location.pathname]);

  const toggleDropdown = (label: string) => {
    if (activeDropdown === label) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(label);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-sae-text">
      {/* --- NAVBAR --- */}
      <header className="sticky top-0 z-50 bg-white border-b border-sae-border shadow-sm">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <Logo className="h-16 w-auto group-hover:scale-105 transition-transform" />
            </Link>

            {/* Desktop Menu */}
            <nav className="hidden xl:flex items-center gap-3">
              {NAV_ITEMS.map((item) => (
                <div key={item.label} className="relative group">
                  <Link 
                    to={item.path} 
                    className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-sae-accentText ${location.pathname === item.path ? 'text-sae-accentText' : 'text-sae-text'}`}
                  >
                    {item.label}
                    {item.children && <ChevronDown size={14} />}
                  </Link>
                  
                  {/* Dropdown */}
                  {item.children && (
                    <div className="absolute top-full left-0 w-56 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
                      <div className="bg-sae-card border border-sae-border rounded-lg shadow-xl overflow-hidden py-2">
                        {item.children.map((child) => (
                          <Link 
                            key={child.path}
                            to={child.path}
                            className="block px-4 py-2 text-sm text-sae-muted hover:bg-sae-border/50 hover:text-sae-accentText transition-colors"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Actions */}
            <div className="hidden xl:flex items-center gap-2">
              {can('viewAnalytics') && (
                <Link
                  to="/analises"
                  aria-label="Análises de uso"
                  title="Análises de uso"
                  className={`p-2 rounded-full transition-colors hover:text-sae-accentText hover:bg-sae-accentSoft ${location.pathname === '/analises' ? 'text-sae-accentText' : 'text-sae-muted'}`}
                >
                  <BarChart3 size={20} />
                </Link>
              )}
              {can('createUser') && (
                <Link
                  to="/usuarios/novo"
                  aria-label="Novo usuário"
                  title="Novo usuário"
                  className={`p-2 rounded-full transition-colors hover:text-sae-accentText hover:bg-sae-accentSoft ${location.pathname === '/usuarios/novo' ? 'text-sae-accentText' : 'text-sae-muted'}`}
                >
                  <UserPlus size={20} />
                </Link>
              )}
              <button className="p-2 text-sae-muted hover:text-sae-accentText transition-colors">
                <Search size={20} />
              </button>
              <Link
                to="/perfil"
                aria-label="Meu perfil"
                title="Meu perfil"
                className={`group flex items-center gap-2 pl-4 border-l border-sae-border ${location.pathname === '/perfil' ? 'text-sae-accentText' : ''}`}
              >
                <div className="text-right hidden 2xl:block">
                  <div className="text-xs text-sae-muted">Bem-vindo,</div>
                  <div className="text-sm font-bold truncate max-w-[150px] text-sae-text group-hover:text-sae-accentText transition-colors">
                    {localStorage.getItem('userNome')?.split(' ')[0] || 'Visitante'}
                  </div>
                </div>
                <div className="w-10 h-10 bg-sae-card border border-sae-border group-hover:border-sae-accent rounded-full flex items-center justify-center text-sae-accentText transition-colors">
                  <User size={20} />
                </div>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 p-2 rounded-full text-sae-muted hover:text-sae-accentText hover:bg-sae-accentSoft transition-colors"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>

            {/* Mobile Toggle */}
            <div className="flex items-center gap-2 xl:hidden">
              <button className="p-2 text-sae-muted hover:text-sae-accentText">
                <Search size={20} />
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-sae-text hover:text-sae-accentText"
              >
                <Menu size={28} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* --- MOBILE DRAWER --- */}
      <div className={`fixed inset-0 z-[60] xl:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        <div className={`absolute top-0 left-0 w-[85%] max-w-[320px] h-full bg-sae-darker border-r border-sae-border shadow-2xl transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full">
            <div className="p-6 flex items-center justify-between border-b border-sae-border">
               <Logo className="h-12 w-auto" />
               <button onClick={() => setIsMobileMenuOpen(false)} className="text-sae-muted hover:text-sae-text">
                 <X size={24} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-6 px-4">
              <nav className="space-y-2">
                {NAV_ITEMS.map((item) => (
                  <div key={item.label}>
                    {item.children ? (
                      <div>
                        <button 
                          onClick={() => toggleDropdown(item.label)}
                          className="flex items-center justify-between w-full px-4 py-3 text-left font-medium text-sae-text hover:bg-sae-card rounded-lg transition-colors"
                        >
                          {item.label}
                          <ChevronDown size={16} className={`transition-transform duration-200 ${activeDropdown === item.label ? 'rotate-180' : ''}`} />
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ${activeDropdown === item.label ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                          <div className="pl-4 space-y-1 border-l-2 border-sae-border ml-4">
                            {item.children.map((child) => (
                              <Link 
                                key={child.path}
                                to={child.path}
                                className="block px-4 py-2 text-sm text-sae-muted hover:text-sae-accentText"
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Link 
                        to={item.path}
                        className="block px-4 py-3 font-medium text-sae-text hover:bg-sae-card rounded-lg transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </div>
                ))}
                {can('viewAnalytics') && (
                  <Link
                    to="/analises"
                    className="flex items-center gap-2 px-4 py-3 font-medium text-sae-accentText hover:bg-sae-card rounded-lg transition-colors"
                  >
                    <BarChart3 size={18} /> Análises de uso
                  </Link>
                )}
                {can('createUser') && (
                  <Link
                    to="/usuarios/novo"
                    className="flex items-center gap-2 px-4 py-3 font-medium text-sae-accentText hover:bg-sae-card rounded-lg transition-colors"
                  >
                    <UserPlus size={18} /> Novo usuário
                  </Link>
                )}
              </nav>
            </div>

            <div className="p-6 border-t border-sae-border bg-sae-card/30">
              <Link to="/perfil" className="flex items-center gap-3 rounded-lg hover:bg-sae-card transition-colors -m-2 p-2">
                <div className="w-10 h-10 bg-sae-card border border-sae-border rounded-full flex items-center justify-center text-sae-accentText">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-sae-text">
                    {localStorage.getItem('userNome')?.split(' ')[0] || 'Visitante'}
                  </div>
                  <div className="text-xs text-sae-muted">Ver meu perfil</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-sae-accent text-sae-accentText font-semibold hover:bg-sae-accentSoft transition-colors"
              >
                <LogOut size={18} /> Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-grow">
        {children}
      </main>


    </div>
  );
};