import { Catalog, Course } from './catalog';
import { InstitutionProfile, PRESENTATION_ORDER, profileFor } from '../institutionProfiles';
import { VIDEOS, Video, watchUrl } from '../videos';
import { FORMS_DATA } from '../registrationForms';
import { EDUCATION_OPTIONS, eligibleTypes } from '../quizRules';
import { foldText } from '../courses';
import { Answer, Block, Chip, Context, IES_WORDS, STOP, set, textReply } from './shared';

// Instituições, vídeos tutoriais, formulários de cadastro e "O que posso estudar?": conteúdo que já existe no SAE.

const anyIn = (tokens: string[], words: Set<string>) => tokens.some((token) => words.has(token));
const SENSITIVE_OTHER = set('email emails mail telefone telefones contato contatos whatsapp ramal setor setores');

// ---------------------------------------------------------------- instituições

const PROFILE_NAME: Record<string, string> = { ESP: 'ESP', ALPHA: 'Alpha Channel', UCESP: 'UCESP', UNICIVE: 'UNICIVE', ITEQ: 'ITEQ', FAEP: 'FAEP' };
const INSTITUTION_WORDS = set('instituicao instituicoes faculdade faculdades ies grupo parceiras parceiros conhecer');
const ASPECTS: { key: 'highlights' | 'address' | 'offers' | 'accreditation' | 'numbers' | 'about' | 'site'; pattern: RegExp }[] = [
  { key: 'highlights', pattern: /^(diferencia\w*|vantage\w*|destaque\w*|fortes)$/ },
  { key: 'address', pattern: /^(onde|endereco|sede|localizacao|fica|local|cidade)$/ },
  { key: 'offers', pattern: /^(oferece|oferecem|modalidade|modalidades|ofertas|areas)$/ },
  { key: 'accreditation', pattern: /^(mec|credenciada|credenciamento|reconhecida|reconhecimento|emec)$/ },
  { key: 'numbers', pattern: /^(numeros|alunos|tamanho)$/ },
  { key: 'about', pattern: /^(quem|historia|fundada|fundacao|tradicao|sobre|apresentacao)$/ },
  { key: 'site', pattern: /^(site|pagina)$/ },
];
const COURSE_WORDS = new Set(['curso', 'cursos', 'graduacao', 'graduacoes', 'pos', 'licenciatura', 'bacharelado', 'tecnologo', 'extensao', 'capacitacao', 'valor', 'valores', 'preco', 'combo', 'combos', 'turma', 'turmas', 'aula', 'aulas']);

export const wantsInstitution = (all: string[], hasIntent: boolean): boolean => {
  if (hasIntent || anyIn(all, SENSITIVE_OTHER) || all.some((token) => COURSE_WORDS.has(token))) return false;
  const named = all.some((token) => IES_WORDS[token]);
  const listing = all.some((token) => ['instituicao', 'instituicoes', 'faculdades', 'parceiras', 'parceiros'].includes(token));
  const rest = all.filter((token) => !STOP.has(token) && !IES_WORDS[token] && token !== 'channel' && !INSTITUTION_WORDS.has(token) && !ASPECTS.some((aspect) => aspect.pattern.test(token)));
  return (named && rest.length === 0) || (listing && rest.length === 0);
};

const institutionChips = (name: string, label: string): Chip[] => [
  { label: `Diferenciais da ${label}`, query: `diferenciais da ${name}` },
  { label: `O que a ${label} oferece`, query: `o que a ${name} oferece` },
  { label: `Cursos da ${label}`, query: `listar cursos da ${name}` },
  { label: `Onde fica a ${label}`, query: `onde fica a ${name}` },
];

const overviewBlocks = (profile: InstitutionProfile, name: string): Block[] => {
  const blocks: Block[] = [
    { type: 'course', title: profile.fullName, meta: [profile.kind, profile.tradition, profile.location].filter(Boolean) },
  ];
  if (profile.tagline) blocks.push({ type: 'text', text: profile.tagline });
  if (profile.stats.length > 0) blocks.push({ type: 'facts', items: profile.stats.map((stat) => [stat.label, stat.value]) });
  profile.about.slice(0, 2).forEach((paragraph) => blocks.push({ type: 'text', text: paragraph }));
  if (profile.modalities.length > 0) blocks.push({ type: 'facts', items: [['Modalidades', profile.modalities.join(', ')]] });
  blocks.push({ type: 'links', items: [{ label: `Site da ${name}`, href: profile.site }] });
  return blocks;
};

const aspectBlocks = (profile: InstitutionProfile, aspect: (typeof ASPECTS)[number]['key'], name: string): Block[] => {
  const header: Block = { type: 'course', title: profile.fullName, meta: [profile.kind, profile.location].filter(Boolean) };
  switch (aspect) {
    case 'highlights':
      return [header, { type: 'list', title: 'Diferenciais', items: profile.highlights }];
    case 'address':
      return [header, { type: 'facts', items: [['Endereço', profile.address]] }];
    case 'offers':
      return [
        header,
        ...profile.offerings.map((group): Block => ({ type: 'list', title: group.title, items: group.items })),
        { type: 'facts', items: [['Modalidades', profile.modalities.join(', ')]] },
      ];
    case 'accreditation':
      return [header, { type: 'facts', items: [['Credenciamento', profile.accreditation]] }];
    case 'numbers':
      return [header, { type: 'facts', items: profile.stats.map((stat) => [stat.label, stat.value] as [string, string]) }];
    case 'site':
      return [header, { type: 'links', items: [{ label: `Site da ${name}`, href: profile.site }] }];
    default:
      return [header, ...profile.about.map((paragraph): Block => ({ type: 'text', text: paragraph }))];
  }
};

export const answerInstitution = (catalog: Catalog, all: string[], ctx: Context): Answer => {
  const sources = ['apresentação das instituições (Home)'];
  const mentioned = [...new Set(all.map((token) => IES_WORDS[token]).filter(Boolean))];

  if (mentioned.length === 0) {
    const rows = PRESENTATION_ORDER.map((name) => {
      const profile = profileFor(name);
      return profile ? [name, profile.kind, profile.location || '-', profile.modalities.join(', ') || '-'] : null;
    }).filter((row): row is string[] => row !== null);
    return {
      reply: {
        tag: 'instituicoes:lista',
        blocks: [
          { type: 'text', text: 'Estas são as instituições do grupo. A FAEP também tem cursos no catálogo, mas ainda não tem apresentação no SAE.' },
          { type: 'table', columns: ['Instituição', 'Tipo', 'Local', 'Modalidades'], rows },
        ],
        chips: PRESENTATION_ORDER.slice(0, 5).map((name) => ({ label: `O que é a ${name}?`, query: `o que é a ${name}` })),
        sources,
      },
      ctx,
    };
  }

  const key = mentioned[0];
  const name = PROFILE_NAME[key] ?? key;
  const profile = profileFor(name);
  if (!profile) {
    const own = catalog.courses.filter((course) => course.ies.toUpperCase() === key);
    return {
      reply: textReply(
        'instituicao:sem-apresentacao',
        `Ainda não tenho uma apresentação da ${name} no SAE.${own.length > 0 ? ` No catálogo há ${own.length} cursos dela.` : ''}`,
        own.length > 0 ? [{ label: `Cursos da ${name}`, query: `listar cursos da ${name}` }] : [],
      ),
      ctx,
    };
  }
  const aspect = ASPECTS.find((candidate) => all.some((token) => candidate.pattern.test(token)));
  const blocks = aspect ? aspectBlocks(profile, aspect.key, name) : overviewBlocks(profile, name);
  return { reply: { tag: `instituicao:${aspect?.key ?? 'resumo'}`, blocks, chips: institutionChips(name, name), sources }, ctx };
};

// ---------------------------------------------------------------- vídeos tutoriais

const VIDEO_HINTS: Record<string, string> = {
  xAso0Zk77X0: 'primeiro acesso entrar login senha preenchimento dados',
  DyB23r8slj4: 'documentos enviar anexar inserir portal',
  'G4-TzOBc3Ow': 'financeiro boleto pagamento mensalidade parcelas',
  '2QBpaPefoQM': 'atividades trabalhos tarefas',
  H9P18ObXzLU: 'notas recuperacao provas',
  QXaZJTPDHC8: 'certificado solicitacao solicitar',
};
const VIDEO_WORDS = set('video videos tutorial tutoriais assistir');
const VIDEO_GENERIC = new Set(['como', 'video', 'videos', 'tutorial', 'tutoriais', 'assistir', 'portal', 'aluno', 'fazer', 'faco', 'ver', 'seu', 'sua', 'minha', 'meu']);

const prefix = (a: string, b: string): number => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};
const similar = (a: string, b: string): boolean => a === b || (Math.min(a.length, b.length) >= 5 && prefix(a, b) >= 5);

const videoTokens = (video: Video): string[] => `${foldText(video.title)} ${VIDEO_HINTS[video.id] ?? ''}`.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);

const videoMatches = (all: string[]): { video: Video; count: number }[] => {
  const content = all.filter((token) => !STOP.has(token) && !VIDEO_GENERIC.has(token) && token.length >= 3);
  return VIDEOS.map((video) => {
    const words = videoTokens(video);
    return { video, count: content.filter((token) => words.some((word) => similar(token, word))).length };
  })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
};

export const wantsVideo = (all: string[], hasPriceOrDocs: boolean): boolean => {
  if (anyIn(all, VIDEO_WORDS)) return true;
  return !hasPriceOrDocs && all.includes('como') && videoMatches(all).length > 0;
};

export const answerVideo = (all: string[], ctx: Context): Answer => {
  const sources = ['página Vídeos'];
  const explicit = anyIn(all, VIDEO_WORDS);
  const matches = videoMatches(all);
  const top = matches.length > 0 ? matches.filter((entry) => entry.count === matches[0].count).map((entry) => entry.video) : [];
  const shown = top.length > 0 && top.length < VIDEOS.length ? top : explicit ? VIDEOS : [];
  if (shown.length === 0) {
    return { reply: textReply('video:nao-achei', 'Não achei um vídeo para isso. Veja a lista completa de tutoriais do Portal do Aluno.', [], [{ type: 'links', items: [{ label: 'Abrir Vídeos', href: '/videos' }] }]), ctx };
  }
  const intro = shown.length === VIDEOS.length ? `Estes são os ${VIDEOS.length} vídeos tutoriais do Portal do Aluno:` : shown.length === 1 ? 'Este vídeo tutorial explica:' : 'Estes vídeos tutoriais podem ajudar:';
  return {
    reply: {
      tag: 'video',
      blocks: [
        { type: 'text', text: intro },
        { type: 'links', items: shown.map((video) => ({ label: video.title, href: watchUrl(video.id) })) },
        { type: 'links', items: [{ label: 'Abrir a página Vídeos', href: '/videos' }] },
      ],
      chips: [],
      sources,
    },
    ctx,
  };
};

// ---------------------------------------------------------------- formulários de cadastro

const FORM_WORDS = set('cadastro cadastros cadastrar cadastrei cadastrado formulario formularios reingresso reativacao reativar');
const FORM_PRICE = set('valor valores preco taxa custa mensalidade');

export const wantsForm = (all: string[]): boolean =>
  (anyIn(all, FORM_WORDS) || (all.includes('nova') && all.includes('inscricao'))) && !anyIn(all, FORM_PRICE);

const formLink = (key: string): { label: string; href: string } => ({ label: FORMS_DATA[key]?.title ?? key, href: `/cadastros?form=${key}` });

export const answerForm = (all: string[], ctx: Context): Answer => {
  const sources = ['página Cadastros'];
  const has = (...words: string[]) => words.some((word) => all.includes(word));
  const keys: string[] = [];
  if (has('unicive', 'unicv', 'unicve')) keys.push('grad-unicv');
  if (has('capacitacao', 'capacitacoes', 'residencia', 'residencias', 'itaquera', 'santos') || (has('presencial', 'presenciais') && has('pos'))) keys.push('capacitacoes');
  if (has('reingresso', 'reativacao', 'reativar') || (has('nova') && has('inscricao'))) keys.push('reativacao');
  if (has('esp', 'ucesp', 'alpha', 'faep', 'propria', 'proprias') && has('graduacao', 'graduacoes', 'curso', 'cursos', 'cadastro', 'cadastrar')) keys.push('grad-esp');
  const unique = [...new Set(keys)];
  if (unique.length === 1) {
    return {
      reply: {
        tag: 'cadastro:um',
        blocks: [{ type: 'text', text: 'Use este formulário na página Cadastros:' }, { type: 'links', items: [formLink(unique[0])] }],
        chips: [],
        sources,
      },
      ctx,
    };
  }
  const shown = unique.length > 1 ? unique : Object.keys(FORMS_DATA);
  return {
    reply: {
      tag: 'cadastro:lista',
      blocks: [
        { type: 'text', text: unique.length > 1 ? 'Estes formulários podem servir:' : 'A página Cadastros tem 4 formulários. Qual é o seu caso?' },
        { type: 'links', items: shown.map(formLink) },
        { type: 'text', tone: 'muted', text: 'Graduações da UNICIVE usam o primeiro formulário; as graduações próprias (ESP, UCESP, Alpha e FAEP), o segundo; capacitações, pós e residências presenciais, o terceiro; reativação e reingresso, o quarto.' },
      ],
      chips: [
        { label: 'Cadastro de graduação UNICIVE', query: 'cadastro de graduação UNICIVE' },
        { label: 'Cadastro de reingresso', query: 'cadastro de reingresso' },
      ],
      sources,
    },
    ctx,
  };
};

// ---------------------------------------------------------------- "O que posso estudar?"

const EDUCATION_WORDS: Record<string, string> = {
  medio: 'ensino-medio',
  tecnico: 'tecnico',
  magisterio: 'magisterio',
  bacharel: 'bacharel',
  bacharelado: 'bacharel',
  tecnologo: 'tecnologo',
  licenciatura: 'licenciatura',
  licenciado: 'licenciatura',
  licenciada: 'licenciatura',
};
const STUDY_WORDS = set('posso pode cursar estudar fazer opcoes opcao disponiveis oportunidades formado formada formacao tenho sou');

export const wantsStudy = (all: string[], hasIntent: boolean): boolean =>
  !hasIntent && ((all.includes('estudar') && all.includes('posso')) || (all.some((token) => EDUCATION_WORDS[token]) && anyIn(all, STUDY_WORDS) && !all.includes('aproveitar')));

const typeMatches = (course: Course, type: string): boolean => {
  const key = foldText(type);
  const tipo = course.tipoKey;
  if (tipo === key || tipo.includes(key)) return true;
  // "Tecnológico" e "Tecnólogo" são o mesmo tipo escrito de dois jeitos na planilha
  return key.startsWith('tecnolog') && tipo.startsWith('tecnolog');
};

const TYPE_QUERY: Record<string, string> = {
  Licenciatura: 'listar licenciaturas',
  Bacharelado: 'listar bacharelados',
  Tecnológico: 'listar tecnológicos',
  'Pós-Graduação': 'listar pós-graduações',
  'Curso Livre': 'listar cursos livres',
  Atualização: 'listar cursos de atualização',
  Capacitação: 'listar capacitações',
  Aperfeiçoamento: 'listar cursos de aperfeiçoamento',
  Extensão: 'listar cursos de extensão',
};

export const answerStudy = (catalog: Catalog, all: string[], ctx: Context): Answer => {
  const sources = ['regras do "O que posso estudar?" e aba Cursos'];
  const education = all.map((token) => EDUCATION_WORDS[token]).find(Boolean);
  if (!education) {
    return {
      reply: {
        tag: 'estudar:pede-formacao',
        blocks: [{ type: 'text', text: 'O que a pessoa já cursou? Escolha a formação para ver o que ela pode estudar:' }],
        chips: EDUCATION_OPTIONS.map((option) => ({ label: option.label, query: `o que posso estudar com ${option.label}` })),
        sources,
      },
      ctx,
    };
  }
  const label = EDUCATION_OPTIONS.find((option) => option.value === education)?.label ?? education;
  const types = eligibleTypes(education);
  const rows = types.map((type) => {
    const total = catalog.courses.filter((course) => typeMatches(course, type)).length;
    return [type, total > 0 ? String(total) : 'sem cursos cadastrados'];
  });
  const chips: Chip[] = types.filter((type) => TYPE_QUERY[type] && catalog.courses.some((course) => typeMatches(course, type))).slice(0, 6).map((type) => ({ label: `Ver ${type}`, query: TYPE_QUERY[type] }));
  return {
    reply: {
      tag: 'estudar:formacao',
      blocks: [
        { type: 'text', text: `Com ${label}, a pessoa pode cursar estes tipos de curso:` },
        { type: 'table', columns: ['Tipo de curso', 'Cursos no catálogo'], rows },
        { type: 'text', tone: 'muted', text: 'Quem já tem graduação também pode aproveitar estudos: pergunte, por exemplo, "posso aproveitar Bacharelado em Administração para Pedagogia?".' },
        { type: 'links', items: [{ label: 'Abrir "O que estudar?"', href: '/quiz' }] },
      ],
      chips,
      sources,
    },
    ctx,
  };
};
