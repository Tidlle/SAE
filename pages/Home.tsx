import React, { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Bot,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Tags,
  Zap,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/UI';
import { Feed } from '../components/Feed';
import { NoticeDialog } from '../components/NoticeDialog';
import { InstitutionsSection } from '../components/InstitutionsSection';
import { cell, fetchSheet } from '../lib/sheets';
import { firstName } from '../lib/text';

const CAROUSEL_INTERVAL_MS = 15000; // tempo de cada slide, em milissegundos

// `art: true` = arte pronta (banner com texto): aparece sem o escurecimento aplicado às fotos.
const CAROUSEL_SLIDES: { src: string; art?: boolean }[] = [
  { src: `${import.meta.env.BASE_URL}hero-SAE-1.jpg`, art: true }, // Novidades; os arquivos ficam em public/ e vão junto com o site
  { src: `${import.meta.env.BASE_URL}hero-SAE-2.png`, art: true }, // Nossas instituições
  { src: `${import.meta.env.BASE_URL}hero-SAE-3.png`, art: true }, // Meu Assistente
];

const QUICK_LINKS = [
  { label: 'Cursos', path: '/cursos/info', icon: GraduationCap },
  { label: 'Combos', path: '/cursos/combos', icon: Tags },
  { label: 'Simulador', path: '/simulador', icon: Calculator },
  { label: 'Memorandos', path: '/memorandos', icon: FileText },
  { label: 'Avisos', path: '/avisos', icon: Bell },
  { label: 'Meu Assistente', path: '/assistente', icon: Bot },
];

interface Notice {
  title: string;
  message: string;
  date: string;
  sector: string;
}

const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const Banner: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Imagens que não carregaram (arquivo ausente ou fora do ar) saem do carrossel, em vez de deixar um slide preto
  const [broken, setBroken] = useState<string[]>([]);
  const slides = CAROUSEL_SLIDES.filter((slide) => !broken.includes(slide.src));
  const count = Math.max(slides.length, 1);
  const current = currentIndex % count;

  // Troca de slide automática (o banner de novidades tem texto e precisa de tempo para ser lido)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % count);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [count]);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % count);
  };

  return (
    <div className="relative w-full h-52 sm:h-64 lg:h-80 overflow-hidden rounded-2xl bg-black shadow-lg shadow-black/10">
      {slides.map((slide, index) => (
        <div
          key={slide.src}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={slide.src}
            alt={`Slide ${index + 1}`}
            onError={() => setBroken((list) => [...list, slide.src])}
            className="w-full h-full object-cover object-center"
          />
          {!slide.art && <div className="absolute inset-0 bg-black/20"></div>}
        </div>
      ))}

      <button
        onClick={prevSlide}
        aria-label="Slide anterior"
        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-sae-accent hover:text-white transition-all backdrop-blur-sm z-10"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={nextSlide}
        aria-label="Próximo slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-sae-accent hover:text-white transition-all backdrop-blur-sm z-10"
      >
        <ChevronRight size={24} />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Ir para o slide ${index + 1}`}
            className={`h-2.5 rounded-full transition-all ${
              index === current ? 'bg-sae-accent w-8' : 'bg-white/60 hover:bg-white w-2.5'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const RecentNotices: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState<Notice | null>(null);
  const closeNotice = useCallback(() => setReading(null), []);

  useEffect(() => {
    let active = true;
    fetchSheet('Avisos!A2:D')
      .then((rows) => {
        if (!active) return;
        const parsed = rows
          .map((row) => ({ title: cell(row, 0), message: cell(row, 1), date: cell(row, 2), sector: cell(row, 3) }))
          .filter((notice) => notice.title || notice.message)
          .reverse()
          .slice(0, 3);
        setNotices(parsed);
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-heading font-bold text-sae-text flex items-center gap-2">
          <Bell size={20} className="text-sae-accentText" /> Últimos avisos
        </h2>
        <Link to="/avisos" className="text-sm font-semibold text-sae-accentText hover:text-sae-accentHover">
          Ver todos
        </Link>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <div className="animate-spin w-6 h-6 border-4 border-sae-accent border-t-transparent rounded-full"></div>
        </div>
      ) : failed ? (
        <p className="text-sm text-sae-muted">Não foi possível carregar os avisos agora.</p>
      ) : notices.length === 0 ? (
        <p className="text-sm text-sae-muted">Nenhum aviso no momento.</p>
      ) : (
        <ul className="divide-y divide-sae-border">
          {notices.map((notice, index) => (
            <li key={index} className="py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => setReading(notice)}
                aria-haspopup="dialog"
                className="block w-full text-left rounded-lg -mx-2 px-2 py-1 -my-1 hover:bg-sae-soft focus-visible:bg-sae-soft transition-colors"
              >
                <span className="block font-semibold text-sae-text leading-snug">{notice.title || 'Aviso'}</span>
                {notice.date && <span className="block text-xs text-sae-muted mt-0.5">{notice.date}</span>}
                <span className="block text-sm font-semibold text-sae-accentText mt-1">Ler mais</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <NoticeDialog notice={reading} onClose={closeNotice} />
    </Card>
  );
};

export const Home: React.FC = () => {
  const name = firstName(localStorage.getItem('userNome')) || 'Visitante';
  const todayRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-8 space-y-10">
        <header>
          <p className="text-sm text-sae-muted">{today}</p>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-sae-text mt-1">
            {greeting()}, <span className="text-sae-accentText">{name}</span>
          </h1>
          <p className="text-sae-muted mt-2">Acompanhe as novidades e acesse suas ferramentas do SAE.</p>
        </header>

        <Banner />

        <section className="space-y-3">
          <h2 id="quick-access-title" className="text-2xl font-heading font-bold text-sae-text flex items-center gap-2">
            <Zap size={24} className="text-sae-accentText" /> Acesso rápido
          </h2>
          <nav aria-labelledby="quick-access-title" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {QUICK_LINKS.map(({ label, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-sae-card border border-sae-border shadow-sm hover:border-sae-accent hover:shadow-md transition-all"
              >
                <span className="w-11 h-11 rounded-full bg-sae-accentSoft text-sae-accentText flex items-center justify-center group-hover:bg-sae-accent group-hover:text-white transition-colors">
                  <Icon size={22} />
                </span>
                <span className="text-sm font-semibold text-sae-text text-center">{label}</span>
              </Link>
            ))}
          </nav>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <Feed />
          </div>
          <aside className="space-y-6 lg:sticky lg:top-28">
            <RecentNotices />
            <Card className="p-5">
              <h2 className="text-lg font-heading font-bold text-sae-text flex items-center gap-2">
                <GraduationCap size={20} className="text-sae-accentText" /> Catálogo de cursos
              </h2>
              <p className="text-sm text-sae-muted mt-2">Consulte informações, valores e combos de todos os cursos.</p>
              <Link
                to="/cursos/info"
                className="inline-flex mt-4 px-5 py-2 rounded-full bg-sae-accent text-white text-sm font-semibold hover:bg-sae-accentHover transition-colors"
              >
                Ver cursos
              </Link>
            </Card>
          </aside>
        </div>

        <InstitutionsSection />
      </div>
    </Layout>
  );
};
