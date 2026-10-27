// Apresentação de cada instituição na Home. O conteúdo foi levantado nos sites oficiais em outubro de 2026
// (iteqescolas.com.br, faculdadeesp.com.br, ucesp.com.br, faculdadealphachannel.com.br e unicive.com): números e afirmações de
// reconhecimento são da própria instituição. Para trocar um texto sem mexer no código, preencha o campo
// equivalente na aba Instituições da planilha da Home: ele tem prioridade sobre este arquivo.

// Cores da apresentação, tiradas da identidade visual de cada instituição.
export interface InstitutionTheme {
  bg: string; // fundo do painel
  fg: string; // texto principal e títulos
  muted: string; // texto secundário
  accent: string; // destaques: frase, números, ícones, botão
  surface: string; // fundo de cartões e etiquetas
  border: string;
  logo?: string; // versão do logotipo própria para este fundo
  logoPlate?: string; // fundo atrás do logotipo (vazio = direto sobre o fundo do painel)
}

export interface InstitutionProfile {
  fullName: string;
  kind: string; // tipo da instituição
  tagline: string;
  tradition: string; // ex.: "Desde 2001"
  location: string;
  address: string;
  modalities: string[];
  stats: { value: string; label: string }[];
  about: string[];
  highlights: string[];
  courseTypes: string[]; // "Tipos de curso" do bloco "O que oferece" da Home (as modalidades vêm de `modalities`)
  offerings: { title: string; items: string[] }[]; // detalhe por nível; usado pelo Meu Assistente
  accreditation: string;
  site: string;
  logo: string;
  theme: InstitutionTheme;
}

const ITEQ: InstitutionProfile = {
  fullName: 'ITEQ Escolas',
  kind: 'Instituto educacional',
  tagline: 'Conectamos pessoas a faculdades e cursos alinhados às suas metas de carreira.',
  tradition: '',
  location: 'São Paulo (SP)',
  address: 'Rua Lagoa Tái Grande, 91, São Paulo (SP), CEP 08290-500',
  modalities: ['Presencial', 'Semipresencial', 'EAD'],
  stats: [
    { value: '+80 mil', label: 'alunos orientados' },
    { value: '+850', label: 'cursos disponíveis' },
    { value: '+50', label: 'instituições parceiras' },
  ],
  about: [
    'O ITEQ é um instituto educacional de consultoria, captação de alunos, suporte acadêmico e planejamento de formação continuada. Atua como ponte entre o aluno e a educação de qualidade, por meio de instituições parceiras reconhecidas pelo MEC.',
    'Seu propósito é conectar pessoas que buscam crescimento profissional a faculdades e cursos alinhados às suas metas de carreira. A rede reúne mais de 50 instituições parceiras, entre elas Alpha Channel, ESP e UCESP, que atuam em áreas como saúde, estética, odontologia e educação.',
    'Cada aluno é atendido de forma individual, com orientação clara e acompanhamento da jornada, da escolha do curso até o decorrer da formação. O SAE é o sistema de apoio da equipe: a Área do Colaborador do site do ITEQ leva a ele.',
  ],
  highlights: [
    'Consultoria especializada para escolher o curso e a instituição',
    'Atendimento humanizado em cada etapa',
    'Rede de instituições parceiras reconhecidas pelo MEC',
    'Processos claros e seguros, do primeiro contato à matrícula',
    'Plataforma digital',
    'Três pilares de atuação: acolhimento, clareza e suporte contínuo',
  ],
  courseTypes: ['Graduação (bacharelado, tecnólogo e licenciatura)', 'Graduação com aproveitamento', 'Pós-graduação', 'Extensão', 'Aperfeiçoamento', 'Capacitação em Estética e em Saúde e Bem-Estar', 'Cursos livres com certificação'],
  offerings: [
    { title: 'Serviços', items: ['Consultoria educacional', 'Captação de alunos', 'Suporte acadêmico', 'Formação continuada', 'Planejamento de carreira'] },
    { title: 'Graduação', items: ['Bacharelado', 'Tecnólogo', 'Licenciatura', 'Graduação com aproveitamento', 'Presencial e semipresencial'] },
    { title: 'Pós-graduação', items: ['Presencial', 'EAD'] },
    { title: 'Extensão e capacitação', items: ['Extensão (presencial e EAD)', 'Aperfeiçoamento', 'Capacitação em Estética e em Saúde e Bem-Estar', 'Cursos livres com certificação'] },
  ],
  accreditation: 'Trabalha com instituições parceiras reconhecidas pelo MEC, segundo o site.',
  site: 'https://iteqescolas.com.br/',
  logo: 'https://iteqescolas.com.br/assets/logo_iteq.png',
  theme: {
    bg: '#F7EBEC',
    fg: '#232323',
    muted: '#636262',
    accent: '#A02D32',
    surface: '#FFFFFF',
    border: 'rgba(160,45,50,0.2)',
  },
};

const ESP: InstitutionProfile = {
  fullName: 'Faculdade do Estado de São Paulo',
  kind: 'Faculdade',
  tagline: 'Faça acontecer, faça ESP.',
  tradition: '',
  location: 'Araçatuba (SP)',
  address: 'Estrada Municipal Caram Rezek, km 135 (lado ímpar), Chácara Araçatuba',
  modalities: ['Especializada em EAD'],
  stats: [
    { value: '+10 mil', label: 'títulos na biblioteca virtual' },
    { value: '10', label: 'áreas de pós-graduação e MBA' },
    { value: '139', label: 'cursos de pós em Educação, a maior área' },
    { value: '131', label: 'cursos de pós em Saúde e Bem-Estar' },
  ],
  about: [
    'A Faculdade do Estado de São Paulo (ESP) atua na formação continuada e tem o ensino a distância como especialidade, com plataforma própria e o aplicativo PED, que permite baixar conteúdos e estudar offline.',
    'Reúne graduação, pós-graduação e MBA, cursos de extensão, aperfeiçoamento e atualização, além de formação para quem já é graduado (segunda licenciatura e formação pedagógica para bacharéis e tecnólogos). Na pós-graduação e no MBA, o site lista cursos em dez áreas, com destaque para Educação e Saúde e Bem-Estar.',
    'A ESP se apresenta como fruto da dedicação de seus mantenedores à educação e diz trabalhar com respeito e transparência com o aluno, atualizando seus métodos conforme as exigências do mercado de trabalho.',
  ],
  highlights: [
    'Estudo onde e quando quiser, com o App PED e conteúdos para baixar',
    'Metodologia dinâmica, com conteúdos atuais e voltados a resultados na carreira',
    'Apoio personalizado: equipe que acompanha o aluno em cada fase da formação',
    'Biblioteca virtual com mais de 10 mil títulos',
    'Ingresso por vestibular online, análise de currículo, ENEM ou transferência',
    'Programas de convênios, Polo Parceiro e Parceiro Digital',
  ],
  courseTypes: ['Graduação (licenciatura e Pedagogia)', 'Segunda licenciatura', 'Formação pedagógica para bacharéis e tecnólogos', 'Pós-graduação e MBA', 'Extensão', 'Aperfeiçoamento', 'Atualização', 'Cursos livres'],
  offerings: [
    { title: 'Graduação', items: ['Licenciatura e Pedagogia'] },
    {
      title: 'Pós-graduação e MBA',
      items: [
        'Educação',
        'Saúde e Bem-Estar',
        'Negócios, Administração e Direito',
        'Ciências Sociais, Comunicação e Informação',
        'Computação e TIC',
        'Engenharia, Produção e Construção',
      ],
    },
    { title: 'Formação para graduados', items: ['Segunda licenciatura', 'Formação pedagógica para bacharéis e tecnólogos'] },
    { title: 'Mais opções', items: ['Extensão', 'Aperfeiçoamento', 'Atualização', 'Cursos livres (portal EAD próprio)'] },
  ],
  accreditation: 'Cursos reconhecidos pelo MEC (Portaria 1.013, de 27/11/2020), segundo o site. Cadastro consultável no e-MEC.',
  site: 'https://faculdadeesp.com.br/',
  logo: 'https://faculdadeesp.com.br/wp-content/themes/novo-site-esp/assets/img/ESP-Logo.webp',
  theme: {
    bg: '#151515',
    fg: '#FFFFFF',
    muted: 'rgba(255,255,255,0.72)',
    accent: '#F5DB18',
    surface: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.16)',
  },
};

const ALPHA: InstitutionProfile = {
  fullName: 'Faculdade Alpha Channel',
  kind: 'Faculdade de Tecnologia',
  tagline: 'Transformando conhecimento em carreiras de sucesso.',
  tradition: 'Desde 2001',
  location: 'Itaquera, São Paulo (SP)',
  address: 'Rua Lagoa Tái Grande, 91, Itaquera, São Paulo (SP), CEP 08290-500',
  modalities: ['Presencial'],
  stats: [
    { value: '2001', label: 'ano de fundação' },
    { value: '100%', label: 'dos cursos são presenciais' },
    { value: '1ª', label: 'faculdade de computação gráfica de São Paulo, segundo o site' },
  ],
  about: [
    'A Alpha Channel nasceu em 2001, criada por engenheiros aeronáuticos formados pelo ITA que, desde a década de 1980, já trabalhavam com simulação gráfica por computador, design, desenvolvimento de produtos e comunicação visual.',
    'Entrou para a história como a primeira faculdade de computação gráfica de São Paulo. Com o tempo ampliou o foco e hoje oferece graduações, pós-graduações e cursos de capacitação em várias áreas, com crescimento nas formações em saúde e estética.',
    'É uma faculdade de tecnologia credenciada pelo MEC, com sede em Itaquera, em São Paulo, e cursos exclusivamente presenciais.',
  ],
  highlights: [
    'Tradição e pioneirismo em computação gráfica',
    'Cursos exclusivamente presenciais',
    'Contato próximo entre alunos, professores e equipe acadêmica',
    'Atendimento individual e consultivo, com acompanhamento da jornada do aluno',
    'Tecnologia integrada ao projeto educacional',
    'Atuação em várias áreas do conhecimento, com saúde e estética em crescimento',
  ],
  courseTypes: ['Graduação (bacharelado, tecnólogo e licenciatura)', 'Pós-graduação', 'Capacitação', 'Extensão', 'Cursos de estética'],
  offerings: [
    { title: 'Graduação', items: ['Bacharelado', 'Tecnólogo', 'Licenciatura', 'Design Gráfico em destaque'] },
    { title: 'Pós-graduação', items: ['Educação', 'Saúde', 'Segurança'] },
    { title: 'Mais opções', items: ['Capacitação', 'Extensão', 'Cursos de estética'] },
  ],
  accreditation: 'Faculdade credenciada pelo MEC, segundo o site. Cadastro consultável no e-MEC.',
  site: 'https://www.faculdadealphachannel.com.br/',
  logo: 'https://www.faculdadealphachannel.com.br/assets/logo-alpha-1.png',
  theme: {
    bg: '#9D3D3D',
    fg: '#FFFFFF',
    muted: 'rgba(255,255,255,0.8)',
    accent: '#FFE1E1',
    surface: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.28)',
    logoPlate: '#FFFFFF',
  },
};

const UCESP: InstitutionProfile = {
  fullName: 'Faculdade União Cultural do Estado de São Paulo',
  kind: 'Faculdade',
  tagline: 'Educação que transforma. Escolhas que conectam.',
  tradition: 'Desde 2003',
  location: 'Araçatuba (SP)',
  address: 'Estrada Municipal Caram Rezek, km 135 (lado ímpar), Chácara Araçatuba, Araçatuba (SP), CEP 16078-035',
  modalities: ['Graduação presencial', 'Pós-graduação EAD'],
  stats: [
    { value: '2003', label: 'ano de início da trajetória' },
    { value: '100%', label: 'dos cursos reconhecidos pelo MEC, segundo o site' },
  ],
  about: [
    'A UCESP (Faculdade União Cultural do Estado de São Paulo) apoia a formação de profissionais desde 2003. Tem sede em Araçatuba (SP) e afirma que todos os seus cursos são reconhecidos pelo Ministério da Educação.',
    'Oferece graduação (bacharelado, tecnólogo e licenciatura), graduação com aproveitamento de disciplinas para quem já tem curso superior e pós-graduação. Pelo site, as graduações são presenciais e as pós-graduações são EAD.',
    'Entre os cursos em destaque estão Engenharia de Produção, Engenharia Civil, Teologia e Pedagogia, além de especializações em Educação, como Neurociências na Educação Infantil e Educação Especial com ênfase em Altas Habilidades ou Superdotação.',
  ],
  highlights: [
    'Tradição e experiência no mercado educacional',
    'Atendimento humanizado',
    'Segurança e confiança',
    'Tecnologia que conecta',
    'Aproveitamento de disciplinas para quem já tem formação superior',
  ],
  courseTypes: ['Graduação (bacharelado, tecnólogo e licenciatura)', 'Graduação com aproveitamento', 'Pós-graduação'],
  offerings: [
    { title: 'Graduação (presencial)', items: ['Bacharelado', 'Tecnólogo', 'Licenciatura'] },
    { title: 'Graduação com aproveitamento', items: ['Para quem já tem formação superior'] },
    {
      title: 'Pós-graduação (EAD)',
      items: ['Neurociências na Educação Infantil', 'Educação Especial (Altas Habilidades ou Superdotação)', 'Mediação de Conflitos Escolares', 'Música na Educação Infantil', 'Meio Ambiente e Sustentabilidade'],
    },
  ],
  accreditation: 'Todos os cursos reconhecidos pelo MEC, segundo o site. Cadastro consultável no e-MEC.',
  site: 'https://www.ucesp.com.br/',
  logo: 'https://www.ucesp.com.br/assets/logo_ucesp.png',
  theme: {
    bg: '#F6DF15',
    fg: '#141414',
    muted: 'rgba(20,20,20,0.78)',
    accent: '#141414',
    surface: 'rgba(255,255,255,0.45)',
    border: 'rgba(20,20,20,0.22)',
    logoPlate: '#FFFFFF',
  },
};

const UNICIVE: InstitutionProfile = {
  fullName: 'Centro Universitário Cidade Verde',
  kind: 'Centro Universitário',
  tagline: 'Educação na vida real!',
  tradition: 'Mais de 20 anos de história',
  location: 'Maringá (PR)',
  address: 'Campus Sede: Av. Horácio Raccanello Filho, 5950, Maringá (PR)',
  modalities: ['EAD', 'Semipresencial', 'Presencial'],
  stats: [
    { value: '+160 mil', label: 'alunos formados no Brasil e no exterior' },
    { value: '90%', label: 'dos docentes são mestres ou doutores' },
    { value: '+24 mil m²', label: 'de estrutura em Maringá' },
    { value: '+40 mil', label: 'exemplares de livros e periódicos' },
  ],
  about: [
    'O Unicive é o Centro Universitário Cidade Verde, de Maringá (PR), com mais de 20 anos de história. Inspirado no conceito de cidade-jardim de Maringá, cidade planejada em 1947, une educação, inovação e sustentabilidade.',
    'Segundo o site, são mais de 160 mil alunos formados no Brasil e no exterior, com polos no país e fora dele e um corpo docente em que 90% são mestres ou doutores. O recredenciamento recebeu nota máxima do MEC.',
    'Atua em EAD, semipresencial e presencial, da graduação (bacharelado, licenciatura, tecnólogo, técnico para tecnólogo e segunda graduação) à pós-graduação, extensão, cursos livres e mestrado EAD internacional.',
    'Em Maringá, a estrutura reúne o Campus Sede, o Campus II, a Sede Administrativa e o Núcleo de Atendimento à Comunidade (NAC), com laboratórios de anatomia, microscopia, química, fisioterapia e informática, biblioteca, Espaço Maker e Smart Space.',
  ],
  highlights: [
    'Metodologia ativa, que alia teoria e prática',
    'Flexibilidade e acompanhamento personalizado',
    'Programa de bolsas e parcerias com empresas e escolas (Parceria de Sucesso)',
    'Inovação: HUB de inovação digital, Espaço Maker e Smart Space',
    'Pós-graduação que pode ser concluída a partir de 4 meses',
    'Avaliação do Estadão: 19 cursos com quatro estrelas',
  ],
  courseTypes: ['Graduação (bacharelado, licenciatura e tecnólogo)', 'Técnico para tecnólogo', '2ª graduação', 'Pós-graduação', 'Aperfeiçoamento', 'Mestrado EAD internacional', 'Extensão', 'Cursos livres', 'Profissionalizantes', 'Preparatório para o ENCCEJA'],
  offerings: [
    { title: 'Graduação EAD e semipresencial', items: ['Bacharelado', 'Licenciatura', 'Tecnólogo', 'Técnico para tecnólogo', '2ª graduação', '2ª graduação em licenciatura'] },
    { title: 'Graduação presencial', items: ['Graduação', 'Técnico para tecnólogo', '2ª graduação'] },
    { title: 'Pós-graduação', items: ['EAD', 'Presencial', 'Pós+', 'Aperfeiçoamento'] },
    { title: 'Mestrado', items: ['Mestrado EAD internacional'] },
    { title: 'Mais opções', items: ['Extensão', 'Cursos livres (EAD, ao vivo e presenciais)', 'Profissionalizantes', 'Preparatório para o ENCCEJA'] },
  ],
  accreditation: 'Recredenciado com nota máxima pelo MEC, segundo o site. Cadastro consultável no e-MEC.',
  site: 'https://unicive.com/',
  logo: 'https://unicive.com/wp-content/uploads/2020/12/LOGOMARCA-UNICIVE.webp',
  theme: {
    bg: '#006752',
    fg: '#FFFFFF',
    muted: 'rgba(255,255,255,0.8)',
    accent: '#FFC672',
    surface: 'rgba(255,255,255,0.1)',
    border: 'rgba(255,255,255,0.25)',
    logo: 'https://unicive.com/wp-content/uploads/2020/12/LOGOMARCA-UNICIVE-BRANCA.webp',
  },
};

// Chave = nome da instituição em minúsculas e sem espaços (ver profileFor).
const PROFILES: Record<string, InstitutionProfile> = {
  iteq: ITEQ,
  esp: ESP,
  alphachannel: ALPHA,
  ucesp: UCESP,
  unicive: UNICIVE,
};

export const profileFor = (name: string): InstitutionProfile | undefined =>
  PROFILES[name.toLowerCase().replace(/\s+/g, '')];

// Ordem das abas quando a instituição não está na planilha: o ITEQ vem primeiro.
export const PRESENTATION_ORDER = ['ITEQ', 'ESP', 'Alpha Channel', 'UCESP', 'UNICIVE'];
