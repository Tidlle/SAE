import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Calculator,
  ClipboardList,
  GraduationCap,
  Headset,
  LayoutGrid,
  Megaphone,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Breadcrumb, Card, Logo, SectionTitle } from '../components/UI';

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Catálogo de cursos',
    text: 'Consulte informações, carga horária, pré-requisitos, documentos e valores dos cursos, a distância e presenciais, com filtros para achar o curso certo. O calendário de aulas e o pedido de novos cursos ficam no mesmo menu.',
    path: '/cursos/info',
    action: 'Ver cursos',
  },
  {
    icon: Tags,
    title: 'Combos e valores',
    text: 'Veja os combos de matrícula com os valores por data de pagamento (dia 10 e dia 30) e as formas de parcelamento.',
    path: '/cursos/combos',
    action: 'Ver combos',
  },
  {
    icon: Calculator,
    title: 'Simulador',
    text: 'A partir do curso de origem do aluno, mostra os cursos de destino possíveis e o prazo de cada um.',
    path: '/simulador',
    action: 'Abrir simulador',
  },
  {
    icon: ClipboardList,
    title: 'Cadastros',
    text: 'Acesso direto aos formulários de cadastro de graduações, capacitações, pós-graduações, reingresso e novas inscrições.',
    path: '/cadastros',
    action: 'Ir para cadastros',
  },
  {
    icon: Megaphone,
    title: 'Comunicação interna',
    text: 'Mural de avisos, memorandos internos e o feed da página inicial, onde a equipe divulga novidades como o lançamento de novos cursos.',
    path: '/avisos',
    action: 'Ver avisos',
  },
  {
    icon: Headset,
    title: 'Central de Relacionamento',
    text: 'Encontre o setor e o e-mail certos de cada instituição para resolver a necessidade de cada atendimento.',
    path: '/contatos',
    action: 'Ver contatos',
  },
  {
    icon: PlayCircle,
    title: 'Treinamento e evolução',
    text: 'Vídeos tutoriais, guia de estudos e a calculadora de evolução funcional, para aprender a usar o sistema e acompanhar o crescimento na carreira.',
    path: '/videos',
    action: 'Ver tutoriais',
  },
  {
    icon: Bot,
    title: 'Meu Assistente',
    text: 'Assistente com inteligência artificial para tirar dúvidas do dia a dia sem sair do sistema.',
    path: '/assistente',
    action: 'Conversar',
  },
];

const BENEFITS = [
  {
    icon: LayoutGrid,
    title: 'Tudo em um só lugar',
    text: 'Cursos, valores, combos, cadastros, contatos e comunicados reunidos em um único acesso, em vez de espalhados em várias planilhas e conversas.',
  },
  {
    icon: RefreshCw,
    title: 'Informação sempre atual',
    text: 'Os dados de cursos, valores, combos e avisos vêm das planilhas mantidas pela equipe. Quando a planilha é atualizada, o SAE mostra a mudança.',
  },
  {
    icon: Users,
    title: 'Equipe alinhada',
    text: 'Administrativo, representantes e consultores consultam as mesmas informações e passam a mesma orientação ao aluno.',
  },
];

export const About: React.FC = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12 space-y-12">
        <div>
          <Breadcrumb items={[{ label: 'Sobre SAE' }]} />
          <SectionTitle title="Sobre o SAE" />
        </div>

        <Card className="p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <Logo className="h-28 md:h-36 w-auto self-start" />
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-heading font-bold text-sae-text">O que é o SAE</h2>
              <p className="text-sae-text leading-relaxed">
                O <strong>SAE, Sistema de Apoio Educacional</strong>, é a plataforma interna do ITEQ que reúne, em um só
                lugar, as informações e as ferramentas que a equipe usa para atender, orientar e matricular alunos.
              </p>
              <p className="text-sae-text leading-relaxed">
                Em vez de procurar dados em vários lugares, quem atende consulta o SAE para saber quais cursos existem,
                quanto custam, em que condições podem ser pagos, como fazer o cadastro e a quem recorrer quando precisa de
                ajuda.
              </p>
            </div>
          </div>
        </Card>

        <section aria-labelledby="purpose-title">
          <h2 id="purpose-title" className="text-2xl font-heading font-bold text-sae-text mb-2">
            Para que ele serve na empresa
          </h2>
          <p className="text-sae-muted mb-6 max-w-3xl">
            O SAE apoia o atendimento ao aluno e o trabalho de quem atende. Estas são as principais frentes do sistema:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, text, path, action }) => (
              <Card key={title} hoverEffect className="p-5 flex flex-col">
                <span className="w-11 h-11 rounded-full bg-sae-accentSoft text-sae-accentText flex items-center justify-center mb-4">
                  <Icon size={22} />
                </span>
                <h3 className="text-lg font-heading font-bold text-sae-text">{title}</h3>
                <p className="text-sm text-sae-muted mt-2 leading-relaxed flex-1">{text}</p>
                <Link
                  to={path}
                  className="mt-4 text-sm font-semibold text-sae-accentText hover:text-sae-accentHover transition-colors"
                >
                  {action} →
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="benefits-title">
          <h2 id="benefits-title" className="text-2xl font-heading font-bold text-sae-text mb-6">
            O que isso muda no dia a dia
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="p-5">
                <Icon size={24} className="text-sae-accentText mb-3" />
                <h3 className="text-lg font-heading font-bold text-sae-text">{title}</h3>
                <p className="text-sm text-sae-muted mt-2 leading-relaxed">{text}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="p-6 md:p-8 border-sae-accent/30">
          <div className="flex flex-col md:flex-row gap-5">
            <span className="w-12 h-12 rounded-full bg-sae-accentSoft text-sae-accentText flex items-center justify-center shrink-0">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h2 className="text-xl font-heading font-bold text-sae-text">Uso responsável</h2>
              <p className="text-sae-text mt-2 leading-relaxed">
                O acesso ao SAE é pessoal e vinculado ao Termo de Responsabilidade aceito no cadastro, que segue a Lei Geral
                de Proteção de Dados (LGPD). Por isso, não compartilhe seu login nem senha e não envie capturas de tela ou
                documentos com dados pessoais ou informações confidenciais da empresa sem autorização. O envio dos links dos
                vídeos tutoriais do próprio SAE é permitido.
              </p>
              <p className="text-sae-text mt-3 leading-relaxed">
                Para melhorar o sistema, o SAE registra o seu uso: as páginas que você visita, onde clica e quanto tempo fica em cada
                uma, ligados ao seu login. Esse registro é visto apenas por usuários Administrativos. O que você digita nos campos
                (senhas, CPF, buscas) não é registrado.
              </p>
              <p className="text-sm text-sae-muted mt-3">
                Dúvidas sobre como usar o sistema? Veja os{' '}
                <Link to="/videos" className="font-semibold text-sae-accentText hover:text-sae-accentHover">
                  vídeos tutoriais
                </Link>{' '}
                ou fale com a{' '}
                <Link to="/contatos" className="font-semibold text-sae-accentText hover:text-sae-accentHover">
                  Central de Relacionamento
                </Link>
                .
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};
