import { AREA_LABEL, areaGroupOf, foldText, formatCurrency, safeHttpUrl } from '../courses';
import { profileFor } from '../institutionProfiles';
import { Catalog, Course, tokenize } from './catalog';
import { basePrice } from './lists';
import { OBJECTIONS, Objection, objectionMenu, objectionReply, parcelsText } from './objections';
import { Answer, Block, Chip, Context, IES_WORDS, Lead, LeadArea, LeadPatch, LeadStep, MODALITY_WORDS, STOP, TIPO_WORDS, displayName, passesFilters, rank, set, splitCourseTokens, textReply } from './shared';

// Atendimento consultivo: em vez de só listar cursos, o assistente pergunta ao vendedor sobre o aluno (formação, área,
// modalidade, parcela...) e só então recomenda. As perguntas e os filtros usam a planilha e nunca inventam valor.
// O texto livre é entendido por regras; quando elas não bastam, a página pode pedir ajuda à IA (lib/assistant/interpret.ts).

const MAX_QUESTIONS = 8; // perguntas respondidas antes de recomendar de qualquer jeito
const TOP = 3; // opções recomendadas

// Ordem de preferência entre instituições na recomendação (uma regra comercial). Vazia = sem preferência.
// Exemplo: ['ESP', 'UNICIVE']. As instituições que não estão na lista vêm depois.
export const IES_PRIORITY: string[] = [];

const RECOMMEND_WORDS = set('indicar indico indicacao indicacoes recomendar recomendo recomendacao recomendacoes sugerir sugiro sugestao sugestoes');
const LEAD_WORDS = set('aluno aluna cliente lead interessado interessada candidato candidata');
const WANT_WORDS = set('quer querendo procura procurando busca buscando gostaria pediu perguntou interessa interessado interessada');
// Palavras do pedido que não dizem a área do curso
const NOISE = set(
  'indicar indico indicacao indicacoes recomendar recomendo recomendacao recomendacoes sugerir sugiro sugestao sugestoes aluno aluna cliente lead interessado interessada ' +
    'candidato candidata quer querendo procura procurando busca buscando gostaria pediu perguntou interessa fazer curso melhor opcao opcoes ideal combina serve ' +
    'ele ela dele dela pra estudar estuda formacao ajuda ajudar atender atendimento escolher escolha',
);
const CANCEL = set('cancelar cancela sair parar chega esquece esquecer encerrar');
const ANY_WORDS = set('tanto faz qualquer nenhuma nenhum preferencia indiferente');

// ---------------------------------------------------------------- escolhas

const SHORT_TIPOS = ['capacitacao', 'extensao', 'aperfeicoamento', 'atualizacao', 'livre'];

const TIPO_CHOICES: Record<string, { tipos: string[]; label: string }> = {
  pos: { tipos: ['pos'], label: 'Pós-graduação' },
  segunda: { tipos: ['graduacao'], label: 'Segunda graduação' },
  graduacao: { tipos: ['graduacao'], label: 'Graduação' },
  licenciatura: { tipos: ['licenciatura'], label: 'Licenciatura' },
  bacharel: { tipos: ['bacharel'], label: 'Bacharelado' },
  tecnolog: { tipos: ['tecnolog'], label: 'Tecnólogo' },
  curta: { tipos: SHORT_TIPOS, label: 'Curso rápido (extensão, aperfeiçoamento, capacitação)' },
};

const MODALITY_LABEL: Record<string, string> = { ead: 'EAD', semi: 'Semipresencial', presencial: 'Presencial' };

const OBJECTIVE_LABEL: Record<string, string> = {
  carreira: 'crescer na carreira',
  mudar: 'mudar de área',
  exigencia: 'exigência do emprego ou concurso',
  diploma: 'completar a formação',
};

// Palavra digitada que é o nome de uma grande área
const AREA_WORDS: Record<string, string> = { educacao: 'educacao', saude: 'saude', negocios: 'negocios', engenharia: 'engenharia', computacao: 'ti', tecnologia: 'ti', ti: 'ti', artes: 'artes', humanidades: 'artes' };

const modalityOf = (course: Course): string => {
  const key = course.modalidadeKey;
  if (key.startsWith('presencial')) return 'presencial';
  if (key.startsWith('semi')) return 'semi';
  if (key.startsWith('ead')) return 'ead';
  return 'outra';
};

const money = (value: number | null): string => (value === null ? '-' : formatCurrency(value));
const cut = (value: string, max: number): string => {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

// Parcela mensal estimada: a UNICIVE já traz a parcela; nos demais, o valor parcelado no boleto (ou o integral D30) ÷ o máximo de parcelas.
const installmentsOf = (course: Course): number | null => course.unicive?.installments ?? course.parcelasBoleto ?? course.parcelasCartao;

export const monthlyOf = (course: Course): number | null => {
  if (course.unicive?.installment) return course.unicive.installment;
  const total = course.parcelado ?? basePrice(course);
  if (total === null) return null;
  return Math.ceil(total / (installmentsOf(course) ?? 1));
};

// Duração em meses, só para ordenar. A planilha mistura unidades ("4 Semestres", "12 meses", "Mínimo 4, Máximo 6").
const monthsOf = (course: Course): number | null => {
  const match = /(\d+)\s*(semestre|trimestre|bimestre|ano|mes)?/.exec(foldText(course.duracao));
  if (!match) return null;
  const unit = match[2];
  const factor = unit === 'semestre' ? 6 : unit === 'trimestre' ? 3 : unit === 'bimestre' ? 2 : unit === 'ano' ? 12 : 1;
  return Number(match[1]) * factor;
};

// ---------------------------------------------------------------- filtro

const matchesArea = (course: Course, area: LeadArea): boolean => {
  if (area.group && areaGroupOf(course.eixo) !== area.group) return false;
  return area.words.length === 0 || rank([{ words: [...course.words, ...tokenize(course.eixo)] }], area.words, true).length > 0;
};

// Segunda graduação: o Simulador diz o que a graduação de origem pode aproveitar (nomes de destino como "Pedagogia").
const destinationTokens = (name: string): string[] => tokenize(name).filter((token) => !STOP.has(token) && token.length >= 3);

const originDestinations = (catalog: Catalog, lead: Lead) => (lead.origin && lead.origin !== 'any' ? catalog.simulator[lead.origin.id]?.destinations ?? [] : []);

const destinationFor = (course: Course, destinations: { name: string; prazo: string }[]) =>
  destinations.find((destination) => {
    const tokens = destinationTokens(destination.name);
    return tokens.length > 0 && rank([{ words: course.words }], tokens, false).length > 0;
  });

const poolOf = (catalog: Catalog, lead: Lead): Course[] => {
  const destinations = lead.tipoKey === 'segunda' ? originDestinations(catalog, lead) : [];
  return catalog.courses.filter((course) => {
    if (lead.ies && course.ies.toUpperCase() !== lead.ies) return false;
    if (lead.tipoKey === 'segunda') {
      if (destinations.length > 0) {
        if (!destinationFor(course, destinations)) return false;
      } else if (!course.words.includes('aproveitamento')) return false; // sem origem: graduação com aproveitamento
    }
    if (lead.tipos && lead.tipos.length > 0 && !lead.tipos.some((tipo) => passesFilters(course, { ies: '', modality: '', tipo }))) return false;
    if (lead.modality && !passesFilters(course, { ies: '', modality: lead.modality, tipo: '' })) return false;
    if (lead.area && lead.area !== 'any' && !matchesArea(course, lead.area)) return false;
    if (typeof lead.budget === 'number') {
      const monthly = monthlyOf(course);
      if (monthly === null || monthly > lead.budget) return false;
    }
    return true;
  });
};

const newLead = (): Lead => ({
  asked: '',
  questions: 0,
  degree: '',
  tipoKey: '',
  tipos: null,
  area: null,
  themed: false,
  modality: null,
  budget: null,
  ies: '',
  sort: 'price',
  objections: [],
  origin: null,
  polo: null,
  urgency: null,
  objective: null,
  outcome: '',
  lostReason: '',
});

// ---------------------------------------------------------------- perguntas

const chip = (label: string, code: string, total?: number): Chip => ({ label: total === undefined ? label : `${label} (${total})`, query: `#k:${code}` });

export const profileLine = (lead: Lead): string => {
  const parts = [
    lead.tipoKey ? TIPO_CHOICES[lead.tipoKey]?.label : '',
    lead.origin && lead.origin !== 'any' ? `graduado em ${lead.origin.label}` : '',
    lead.ies,
    lead.area && lead.area !== 'any' ? lead.area.label : '',
    lead.modality ? MODALITY_LABEL[lead.modality] : '',
    lead.polo ? `polo ${lead.polo}` : '',
    typeof lead.budget === 'number' ? `parcela até ${money(lead.budget)}` : '',
    lead.urgency === 'now' ? 'quer começar logo' : '',
    lead.objective ? `objetivo: ${OBJECTIVE_LABEL[lead.objective] ?? lead.objective}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
};

// Faixas de parcela tiradas das próprias opções (quartis), para os botões dividirem a lista de verdade
const budgetSteps = (pool: Course[]): number[] => {
  const values = pool.map(monthlyOf).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (values.length <= TOP) return [];
  const round = (value: number) => Math.ceil(value / (value < 300 ? 10 : 50)) * (value < 300 ? 10 : 50);
  const steps = [0.25, 0.5, 0.75].map((share) => round(values[Math.floor((values.length - 1) * share)]));
  // só vale perguntar quando a faixa separa as opções de verdade (não adianta se quase todas custam o mesmo)
  return [...new Set(steps)].filter((limit) => {
    const below = values.filter((value) => value <= limit).length;
    return below >= values.length * 0.15 && below <= values.length * 0.85;
  });
};

// Temas dentro da área: palavras que aparecem nos nomes de parte das opções (nem em todas, nem em quase nenhuma)
const THEME_SKIP = set(
  'pos graduacao ead mba extensao aperfeicoamento capacitacao atualizacao livre curso cursos especializacao presencial semipresencial tecnologo licenciatura bacharelado ' +
    'formacao ensino geral aplicada aplicado itaquera',
);
const AREA_WORD_SKIP = new Set(Object.values(AREA_LABEL).flatMap((label) => tokenize(label)));

const themeOptions = (pool: Course[], lead: Lead): { token: string; total: number }[] => {
  const used = new Set(lead.area && lead.area !== 'any' ? lead.area.words : []);
  const counts = new Map<string, number>();
  pool.forEach((course) =>
    new Set(course.words).forEach((word) => {
      if (word.length < 5 || /^\d+$/.test(word) || STOP.has(word) || THEME_SKIP.has(word) || AREA_WORD_SKIP.has(word) || used.has(word)) return;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }),
  );
  return [...counts.entries()]
    .filter(([, total]) => total >= 3 && total <= pool.length * 0.6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token, total]) => ({ token, total }));
};

// A palavra como aparece no nome dos cursos (com acento), para mostrar no botão
const wordLabel = (catalog: Catalog, token: string): string => {
  for (const course of catalog.courses) {
    const found = course.name.split(/[\s,;:()/-]+/).find((word) => tokenize(word)[0] === token);
    if (found) return found.charAt(0).toUpperCase() + found.slice(1).toLowerCase();
  }
  return token;
};

const withTheme = (lead: Lead, label: string, words: string[]): Lead => {
  const area = lead.area && lead.area !== 'any' ? lead.area : { label: '', group: '', words: [] };
  return { ...lead, area: { label: [area.label, label].filter(Boolean).join(' · '), group: area.group, words: [...area.words, ...words] } };
};

// Polos que têm turma presencial (aba Cursos-Presenciais) e quantas estão abertas ou aguardando abertura
const poloCounts = (catalog: Catalog): { label: string; open: number }[] => {
  const polos = new Map<string, number>();
  catalog.presential.forEach((item) => {
    if (!item.polo) return;
    polos.set(item.polo, (polos.get(item.polo) ?? 0) + (item.statusKind === 'open' || item.statusKind === 'waiting' ? 1 : 0));
  });
  return [...polos.entries()].map(([label, open]) => ({ label, open }));
};

const nextStep = (catalog: Catalog, lead: Lead, pool: Course[]): LeadStep | null => {
  if (lead.tipos === null) return lead.degree === 'sim' ? 'goal' : lead.degree === 'nao' ? 'formation' : 'degree';
  if (lead.tipoKey === 'segunda' && lead.origin === null && catalog.simulator.length > 0) return 'origin';
  if (lead.area === null && new Set(pool.map((course) => areaGroupOf(course.eixo))).size > 1) return 'area';
  if (!lead.themed && pool.length > 12 && themeOptions(pool, lead).length >= 2) return 'theme';
  if (lead.modality === null && new Set(pool.map(modalityOf)).size > 1) return 'modality';
  if (lead.polo === null && (lead.modality === 'presencial' || lead.modality === 'semi') && poloCounts(catalog).length > 1) return 'polo';
  if (lead.budget === null && budgetSteps(pool).length > 0) return 'budget';
  if (lead.urgency === null) return 'urgency';
  if (lead.objective === null) return 'objective';
  return null;
};

const ask = (catalog: Catalog, lead: Lead, ctx: Context, step: LeadStep, preface: Block[] = [], originOptions: { id: number; origin: string }[] = []): Answer => {
  const count = (patch: Partial<Lead>) => poolOf(catalog, { ...lead, ...patch }).length;
  const pool = poolOf(catalog, lead);
  const chips: Chip[] = [];
  let text = '';
  let hint = '';

  if (step === 'degree') {
    text = 'Para indicar o curso certo, preciso entender o aluno. Ele já tem graduação (curso superior completo)?';
    chips.push(chip('Sim, já é graduado', 'degree:sim'), chip('Não, ainda não', 'degree:nao'));
  }
  if (step === 'goal') {
    text = 'O que ele procura?';
    hint = 'Quem já é graduado pode fazer pós-graduação, uma segunda graduação (com aproveitamento de disciplinas) ou um curso rápido.';
    (['pos', 'segunda', 'curta'] as const).forEach((key) => {
      const total = count({ tipos: TIPO_CHOICES[key].tipos, tipoKey: key });
      if (total > 0) chips.push(chip(TIPO_CHOICES[key].label, `tipo:${key}`, total));
    });
  }
  if (step === 'formation') {
    text = 'Qual formação ele quer?';
    hint = 'Licenciatura forma professores; bacharelado e tecnólogo são para as demais carreiras (o tecnólogo costuma ser mais curto).';
    (['licenciatura', 'bacharel', 'tecnolog', 'graduacao', 'curta'] as const).forEach((key) => {
      const total = count({ tipos: TIPO_CHOICES[key].tipos, tipoKey: key });
      const label = key === 'graduacao' ? 'Qualquer graduação' : TIPO_CHOICES[key].label;
      if (total > 0) chips.push(chip(label, `tipo:${key}`, total));
    });
  }
  if (step === 'origin') {
    text = 'Qual graduação o aluno já tem?';
    hint = 'Digite o nome do curso dele (por exemplo: Administração). Eu uso o Simulador para ver o que ele pode aproveitar.';
    originOptions.slice(0, 6).forEach((option) => chips.push(chip(option.origin, `origin:${option.id}`)));
    chips.push(chip('Não sei', 'origin:any'));
  }
  if (step === 'area') {
    text = 'Em qual área ele quer atuar ou se especializar?';
    hint = 'Toque numa área ou digite o tema (por exemplo: neuropsicopedagogia, estética, gestão, direito).';
    const groups = new Map<string, number>();
    pool.forEach((course) => groups.set(areaGroupOf(course.eixo), (groups.get(areaGroupOf(course.eixo)) ?? 0) + 1));
    [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([group, total]) => chips.push(chip(AREA_LABEL[group], `area:${group}`, total)));
    chips.push(chip('Sem preferência', 'area:any'));
  }
  if (step === 'theme') {
    const base = lead.area && lead.area !== 'any' && lead.area.label ? ` de ${lead.area.label}` : '';
    text = `Dentro da área${base}, qual tema interessa mais ao aluno?`;
    hint = `Há ${pool.length} cursos nessa combinação. Toque num tema ou digite outro.`;
    themeOptions(pool, lead).forEach(({ token, total }) => chips.push(chip(wordLabel(catalog, token), `theme:${token}`, total)));
    chips.push(chip('Qualquer tema', 'theme:any'));
  }
  if (step === 'modality') {
    text = 'Como ele prefere estudar?';
    hint = 'Presencial depende de o aluno morar perto do polo.';
    (['ead', 'semi', 'presencial'] as const).forEach((key) => {
      const total = count({ modality: key });
      if (total > 0) chips.push(chip(key === 'ead' ? 'EAD (100% online)' : MODALITY_LABEL[key], `mod:${key}`, total));
    });
    chips.push(chip('Tanto faz', 'mod:any'));
  }
  if (step === 'polo') {
    text = 'Em qual polo ele consegue estudar?';
    hint = 'Os números são de turmas abertas ou aguardando abertura (aba Cursos-Presenciais).';
    poloCounts(catalog).forEach(({ label, open }) => chips.push(chip(label, `polo:${encodeURIComponent(label)}`, open)));
    chips.push(chip('Qualquer polo', 'polo:any'));
  }
  if (step === 'budget') {
    text = 'Quanto o aluno consegue pagar por mês?';
    hint = 'Parcela estimada: valor parcelado no boleto dividido pelo máximo de parcelas (na UNICIVE, a parcela da planilha).';
    budgetSteps(pool).forEach((limit) => {
      const total = count({ budget: limit });
      if (total > 0 && total < pool.length) chips.push(chip(`Até ${money(limit)}`, `budget:${limit}`, total));
    });
    chips.push(chip('Sem limite de valor', 'budget:any'));
  }
  if (step === 'urgency') {
    text = 'Ele precisa começar logo?';
    hint = 'Se for urgente, ordeno pelos cursos mais rápidos e lembro de conferir data de início ou limite de inclusão.';
    chips.push(chip('Quer começar já', 'urgency:now'), chip('Pode esperar', 'urgency:later'));
  }
  if (step === 'objective') {
    text = 'Qual o objetivo dele com o curso?';
    hint = 'Isso ajuda você a conduzir a conversa e fica na ficha do atendimento.';
    Object.entries(OBJECTIVE_LABEL).forEach(([key, label]) => chips.push(chip(label.charAt(0).toUpperCase() + label.slice(1), `objective:${key}`)));
    chips.push(chip('Não sei', 'objective:any'));
  }

  const blocks: Block[] = [...preface, { type: 'text', text }];
  const line = profileLine(lead);
  if (line) blocks.push({ type: 'text', tone: 'muted', text: `Até agora: ${line}.` });
  if (hint) blocks.push({ type: 'text', tone: 'muted', text: hint });
  if (lead.tipos !== null) chips.push(chip('Pular e ver opções', 'go'));
  return { reply: { tag: `consulta:pergunta:${step}`, blocks, chips, sources: [] }, ctx: { ...ctx, lead: { ...lead, asked: step } } };
};

// ---------------------------------------------------------------- recomendação

const courseHref = (course: Course): string => `/cursos/info?curso=${encodeURIComponent(course.name)}&ies=${encodeURIComponent(course.ies)}`;

const pickTop = (sorted: Course[]): Course[] => {
  const top: Course[] = [];
  const seen = new Set<string>();
  sorted.forEach((course) => {
    if (top.length < TOP && !seen.has(course.ies)) {
      top.push(course);
      seen.add(course.ies);
    }
  });
  sorted.forEach((course) => {
    if (top.length < TOP && !top.includes(course)) top.push(course);
  });
  return top;
};

// Quanto o nome do curso casa com o tema digitado ou escolhido (0 quando não há tema)
const relevanceOf = (course: Course, lead: Lead): number => {
  if (!lead.area || lead.area === 'any' || lead.area.words.length === 0) return 0;
  return Math.round((rank([{ words: course.words }], lead.area.words, true)[0]?.score ?? 0) * 10);
};

const priorityOf = (course: Course): number => {
  const index = IES_PRIORITY.indexOf(course.ies.toUpperCase());
  return index < 0 ? 999 : index;
};

// Cursos com mais dados (valor, documentos e e-MEC) passam à frente em caso de empate: dão menos trabalho ao vendedor
const completenessOf = (course: Course): number => (monthlyOf(course) !== null ? 1 : 0) + (course.docs ? 1 : 0) + (safeHttpUrl(course.emec) ? 1 : 0);

// Ordem das opções: tema, prioridade comercial da instituição, dados completos e, por fim, parcela (ou duração)
const sortPool = (pool: Course[], lead: Lead): Course[] => {
  const priced = (course: Course) => (monthlyOf(course) === null ? 1 : 0);
  const byPrice = (a: Course, b: Course) => priced(a) - priced(b) || (monthlyOf(a) ?? 0) - (monthlyOf(b) ?? 0);
  const byRelevance = (a: Course, b: Course) => relevanceOf(b, lead) - relevanceOf(a, lead);
  const byPriority = (a: Course, b: Course) => priorityOf(a) - priorityOf(b);
  const byData = (a: Course, b: Course) => completenessOf(b) - completenessOf(a);
  const byDuration = (a: Course, b: Course) => (monthsOf(a) ?? 999) - (monthsOf(b) ?? 999);
  return [...pool].sort((a, b) => byRelevance(a, b) || byPriority(a, b) || byData(a, b) || (lead.sort === 'fast' ? byDuration(a, b) : 0) || byPrice(a, b));
};

// Pré-requisito que depende da área da graduação do aluno ("diploma em área relacionada à Educação")
const needsDegreeCheck = (course: Course): boolean => /area|relacionad|afim|licenciatura|bacharel|tecnolog|pedagog/i.test(foldText(course.preReq)) && !/^ensino medio/.test(foldText(course.preReq).trim());

// Turma presencial do curso no polo escolhido (aba Cursos-Presenciais), quando o nome bate
const classFor = (catalog: Catalog, course: Course, polo: string | null) => {
  if (modalityOf(course) === 'ead') return null;
  const poloWords = ['itaquera', 'santos', 'aracatuba'];
  const tokens = course.words.filter((word) => word.length >= 4 && !STOP.has(word) && !THEME_SKIP.has(word) && ![...poloWords, 'semipresencial', 'presencial'].includes(word));
  if (tokens.length === 0) return null;
  // o polo escolhido vale; sem ele, vale o polo que aparece no nome do curso (ex.: "... - Presencial - Itaquera")
  const wanted = polo ? foldText(polo) : poloWords.find((word) => course.words.includes(word)) ?? '';
  const matches = rank(
    catalog.presential.filter((item) => !wanted || foldText(item.polo) === wanted).map((item) => ({ item, words: item.words })),
    tokens,
    false,
  ).filter((entry) => entry.average >= 0.85);
  return matches[0]?.item.item ?? null;
};

// Combos que reúnem cursos do mesmo tema do primeiro curso indicado
const relatedCombos = (catalog: Catalog, top: Course[]) => {
  const tokens = new Set(top.flatMap((course) => course.words).filter((word) => word.length >= 5 && !STOP.has(word) && !THEME_SKIP.has(word)));
  return catalog.combos
    .map((combo) => ({ combo, hits: combo.words.filter((word) => tokens.has(word)).length }))
    .filter((entry) => entry.hits >= 2)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((entry) => entry.combo);
};

const recommend = (catalog: Catalog, lead: Lead, ctx: Context, preface: Block[] = []): Answer => {
  let used = lead;
  let pool = poolOf(catalog, used);
  const dropped: string[] = [];
  const relax: [string, boolean, Partial<Lead>][] = [
    ['o limite de parcela', typeof used.budget === 'number', { budget: 'any' }],
    ['a modalidade', Boolean(used.modality), { modality: '' }],
    ['a graduação de origem (Simulador)', Boolean(used.origin && used.origin !== 'any'), { origin: 'any' }],
    ['a área', Boolean(used.area && used.area !== 'any'), { area: 'any' }],
  ];
  for (const [label, applies, patch] of relax) {
    if (pool.length > 0) break;
    if (!applies) continue;
    used = { ...used, ...patch };
    pool = poolOf(catalog, used);
    dropped.push(label);
  }

  const blocks: Block[] = [...preface];
  const done: Lead = { ...lead, asked: '' };
  if (pool.length === 0) {
    blocks.push({ type: 'text', text: 'Não encontrei cursos com esse perfil na planilha.' });
    return {
      reply: { tag: 'consulta:sem-opcao', blocks, chips: [chip('Mudar respostas', 'edit'), chip('Novo atendimento', 'start')], sources: ['aba Cursos'] },
      ctx: { ...ctx, lead: done },
    };
  }

  const sorted = sortPool(pool, lead);
  const top = pickTop(sorted);
  const rest = sorted.filter((course) => !top.includes(course));
  const line = profileLine(lead);
  const destinations = lead.tipoKey === 'segunda' ? originDestinations(catalog, used) : [];
  blocks.push({ type: 'text', text: top.length === 1 ? 'Para esse perfil, a melhor opção é:' : `Para esse perfil, estas são as ${top.length} melhores opções:` });
  if (line) blocks.push({ type: 'text', tone: 'muted', text: `Perfil do aluno: ${line}.` });
  if (dropped.length > 0) blocks.push({ type: 'text', tone: 'warn', text: `Com todas as respostas não havia cursos; deixei de lado ${dropped.join(' e ')}.` });
  blocks.push({
    type: 'text',
    tone: 'muted',
    text: lead.sort === 'fast' ? 'Ordenei pelo tema, pelos dados completos e pela menor duração, mostrando uma opção de cada instituição quando possível.' : 'Ordenei pelo tema, pelos dados completos e pela menor parcela estimada, mostrando uma opção de cada instituição quando possível.',
  });

  top.forEach((course) => {
    const monthly = monthlyOf(course);
    const parcels = installmentsOf(course);
    const facts: [string, string][] = [];
    const total = basePrice(course);
    if (total !== null) facts.push([course.unicive?.total ? 'Valor integral' : 'Valor integral (D30 no boleto)', money(total)]);
    if (monthly !== null) facts.push(['Parcela estimada', parcels && parcels > 1 ? `${parcels}x de ${money(monthly)}` : money(monthly)]);
    if (course.carga) facts.push(['Carga horária', course.carga]);
    if (course.duracao) facts.push(['Duração', course.duracao]);
    if (course.preReq) facts.push(['Pré-requisito', cut(course.preReq, 150)]);
    const destination = destinations.length > 0 ? destinationFor(course, destinations) : undefined;
    if (destination?.prazo) facts.push(['Prazo no Simulador', destination.prazo]);
    const turma = classFor(catalog, course, lead.polo);
    if (turma) facts.push(['Turma presencial', `${turma.polo}: ${turma.status || 'situação não informada'}${turma.start ? ` · início/limite ${turma.start}` : ''}`]);
    const why: string[] = [];
    if (used.area && used.area !== 'any') why.push(`combina com: ${used.area.label || course.eixo}`);
    if (used.modality) why.push(course.modalidade);
    if (destination) why.push(`aproveitamento previsto no Simulador (${lead.origin && lead.origin !== 'any' ? lead.origin.label : 'origem'})`);
    if (typeof used.budget === 'number' && monthly !== null) why.push(`cabe no limite de ${money(used.budget)} por mês`);
    if (lead.sort === 'fast' && course.duracao) why.push('uma das menores durações');
    if (why.length > 0) facts.push(['Por que combina', why.join(' · ')]);
    blocks.push({ type: 'course', title: displayName(course.name), meta: [course.ies, course.tipo, course.modalidade].filter(Boolean), href: courseHref(course) });
    if (facts.length > 0) blocks.push({ type: 'facts', items: facts });
    if (turma?.statusKind === 'closed') blocks.push({ type: 'text', tone: 'warn', text: `A turma presencial deste curso em ${turma.polo} consta sem vagas na planilha. Confirme antes de oferecer.` });
  });

  if (lead.degree === 'sim' && top.some(needsDegreeCheck)) {
    blocks.push({ type: 'text', tone: 'warn', text: 'Atenção ao pré-requisito: alguns cursos pedem graduação em área relacionada. Confira se o diploma do aluno atende antes de seguir.' });
  }
  if (lead.urgency === 'now') {
    blocks.push({ type: 'text', tone: 'muted', text: 'Como ele quer começar logo, confira no curso a data de início ou o limite de inclusão antes de prometer prazo.' });
  }
  if (lead.tipoKey === 'segunda' && destinations.length === 0) {
    blocks.push({ type: 'text', tone: 'muted', text: 'Na segunda graduação, o aproveitamento de disciplinas pode reduzir o tempo do curso. Confira a graduação de origem do aluno no Simulador.' });
    blocks.push({ type: 'links', items: [{ label: 'Abrir o Simulador', href: '/simulador' }] });
  }

  [...new Set(top.map((course) => course.ies))].forEach((ies) => {
    const highlights = profileFor(ies)?.highlights.slice(0, 2) ?? [];
    if (highlights.length > 0) blocks.push({ type: 'list', title: `Argumentos de venda: ${ies}`, items: highlights });
  });

  const combos = relatedCombos(catalog, top);
  if (combos.length > 0) blocks.push({ type: 'list', title: 'Combos que podem interessar (veja os valores nos botões)', items: combos.map((combo) => combo.name) });

  blocks.push({ type: 'text', text: 'Para fechar o atendimento: o aluno consegue reunir a documentação esta semana? Posso listar o que cada curso exige.' });

  const chips: Chip[] = [
    { label: 'Documentos dessas opções', query: '#i:docs' },
    { label: 'Valores completos', query: '#i:price' },
  ];
  if (rest.length > 0) chips.push({ label: `Ver outras opções (${rest.length})`, query: '#l:more' });
  combos.forEach((combo) => chips.push({ label: `Combo: ${combo.name.length > 38 ? `${combo.name.slice(0, 37)}…` : combo.name}`, query: `#cb:${combo.id}` }));
  chips.push(lead.sort === 'price' ? chip('Mostrar os mais rápidos', 'sort:fast') : chip('Mostrar os mais baratos', 'sort:price'));
  chips.push(chip('Aluno com objeção', 'obj'), chip('Mensagem para o aluno', 'msg'), chip('Registrar resultado', 'result'), chip('Mudar respostas', 'edit'), chip('Novo atendimento', 'start'));

  return {
    reply: { tag: 'consulta:recomendacao', blocks, chips, sources: ['aba Cursos', ...(top.some((course) => course.unicive) ? ['aba Valores UNICIVE'] : []), ...(lead.tipoKey === 'segunda' && destinations.length > 0 ? ['aba Simulador'] : []), ...(top.some((course) => classFor(catalog, course, lead.polo)) ? ['aba Cursos-Presenciais'] : [])] },
    ctx: {
      ...ctx,
      kind: 'course',
      courseIds: top.map((course) => course.id),
      comboId: null,
      pending: [],
      listIds: rest.map((course) => course.id),
      listOffset: 0,
      listTitle: 'Outras opções para esse perfil',
      lead: done,
    },
  };
};

// ---------------------------------------------------------------- fluxo

const advance = (catalog: Catalog, start: Lead, ctx: Context, preface: Block[] = []): Answer => {
  let lead = start;
  if (lead.tipos !== null) {
    const pool = poolOf(catalog, lead);
    // pergunta que não muda nada (uma só área ou modalidade nas opções) não é feita
    if (lead.area === null && new Set(pool.map((course) => areaGroupOf(course.eixo))).size <= 1) lead = { ...lead, area: 'any' };
    if (lead.modality === null && new Set(pool.map(modalityOf)).size <= 1) lead = { ...lead, modality: '' };
  }
  const pool = poolOf(catalog, lead);
  const step = nextStep(catalog, lead, pool);
  if (step === null || (lead.tipos !== null && (pool.length <= TOP || lead.questions >= MAX_QUESTIONS))) return recommend(catalog, lead, ctx, preface);
  return ask(catalog, lead, ctx, step, preface);
};

const INTRO: Block = {
  type: 'text',
  tone: 'muted',
  text: 'Vamos achar a melhor opção para o aluno. Faço algumas perguntas rápidas: toque numa resposta ou digite do seu jeito. Para encerrar, escreva "cancelar".',
};

// "segunda graduação", "2ª graduação" ou "com aproveitamento"
const wantsSecondDegree = (text: string): boolean => /segunda grad|2\s*a?\s*grad|aproveitamento/.test(foldText(text).replace(/º|ª/g, 'a'));

const areaFromWords = (catalog: Catalog, words: string[]): LeadArea => {
  const group = words.length === 1 ? AREA_WORDS[words[0]] : undefined;
  return { label: group ? AREA_LABEL[group] : words.map((word) => wordLabel(catalog, word)).join(' '), group: group ?? '', words };
};

const answered = (lead: Lead, patch: Partial<Lead>): Lead => ({ ...lead, ...patch, asked: '', questions: lead.questions + 1 });

const setTipo = (lead: Lead, key: string): Lead => ({
  ...lead,
  tipoKey: key,
  tipos: TIPO_CHOICES[key].tipos,
  degree: lead.degree || (key === 'pos' || key === 'curta' || key === 'segunda' ? 'sim' : 'nao'),
});

// Aplica o que a IA (ou o texto livre) entendeu. Cada campo é validado contra as opções que existem.
const patchLead = (catalog: Catalog, base: Lead, patch: LeadPatch): { lead: Lead; filled: number } => {
  let lead: Lead = { ...base };
  let filled = 0;
  if (patch.degree === 'sim' || patch.degree === 'nao') {
    lead.degree = patch.degree;
    filled++;
  }
  if (patch.tipo && TIPO_CHOICES[patch.tipo]) {
    lead = setTipo(lead, patch.tipo);
    filled++;
  }
  if (patch.modality && ['ead', 'semi', 'presencial', 'any'].includes(patch.modality)) {
    lead.modality = patch.modality === 'any' ? '' : patch.modality;
    filled++;
  }
  if (typeof patch.budget === 'number' && patch.budget >= 30 && patch.budget <= 20000) {
    lead.budget = Math.round(patch.budget);
    filled++;
  }
  if (patch.ies && Object.values(IES_WORDS).includes(patch.ies.toUpperCase())) {
    lead.ies = patch.ies.toUpperCase();
    filled++;
  }
  if (patch.objective && OBJECTIVE_LABEL[patch.objective]) {
    lead.objective = patch.objective;
    filled++;
  }
  if (patch.urgency === 'now' || patch.urgency === 'later') {
    lead.urgency = patch.urgency;
    if (patch.urgency === 'now') lead.sort = 'fast';
    filled++;
  }
  if (patch.polo) {
    const polo = poloCounts(catalog).find((item) => foldText(item.label) === foldText(patch.polo as string));
    if (polo) {
      lead.polo = polo.label;
      filled++;
    }
  }
  if (patch.area) {
    const words = tokenize(patch.area).filter((token) => !STOP.has(token) && !NOISE.has(token));
    if (words.length > 0) {
      const area = areaFromWords(catalog, words);
      if (poolOf(catalog, { ...lead, area }).length > 0) {
        lead.area = area;
        filled++;
      }
    }
  }
  return { lead, filled };
};

const startLead = (catalog: Catalog, query: string, ctx: Context, patch?: LeadPatch): Answer => {
  let lead = newLead();
  const folded = foldText(query);
  const tokens = tokenize(query).filter((token) => !STOP.has(token) && !NOISE.has(token) && !/^\d+$/.test(token));
  const { name, filters } = splitCourseTokens(tokens);
  if (filters.ies) lead.ies = filters.ies;
  if (filters.modality) lead.modality = filters.modality;
  if (wantsSecondDegree(query)) lead = setTipo(lead, 'segunda');
  else if (filters.tipo) {
    const key = TIPO_CHOICES[filters.tipo] ? filters.tipo : SHORT_TIPOS.includes(filters.tipo) ? 'curta' : '';
    if (key) lead = setTipo(lead, key);
  }
  if (/parcela|mensalidade|por mes|mensal/.test(folded)) {
    const value = /(\d{2,5})(?:,\d{2})?/.exec(folded);
    if (value) lead.budget = Number(value[1]);
  }
  if (name.length > 0) {
    const area = areaFromWords(catalog, name);
    if (poolOf(catalog, { ...lead, area }).length > 0) lead.area = area;
  }
  if (patch) lead = patchLead(catalog, lead, patch).lead;
  return advance(catalog, lead, ctx, lead.tipos === null ? [INTRO] : []);
};

// `priceOnly`: o pedido só fala de valor ("indicar um curso com parcela até 200"); aí só vale se pedir indicação ou o melhor curso,
// para "quanto custa o curso que o aluno quer" continuar sendo uma consulta de valor.
export const wantsConsult = (all: string[], hasIntent: boolean, priceOnly = false): boolean => {
  if (hasIntent && !priceOnly) return false;
  const has = (words: Set<string>) => all.some((token) => words.has(token));
  if (has(RECOMMEND_WORDS)) return true;
  if (priceOnly) return all.includes('melhor') && all.some((token) => ['curso', 'cursos', 'opcao', 'opcoes'].includes(token));
  if (has(LEAD_WORDS) && has(WANT_WORDS)) return true;
  return all.includes('melhor') && all.some((token) => ['curso', 'cursos', 'opcao', 'opcoes'].includes(token));
};

export const answerConsult = (catalog: Catalog, query: string, ctx: Context): Answer => startLead(catalog, query, ctx);

const stopReply = (ctx: Context): Answer => ({
  reply: textReply('consulta:encerrada', 'Atendimento encerrado. Quando quiser indicar um curso para outro aluno, é só chamar.', [chip('Atender um aluno', 'start')]),
  ctx: { ...ctx, lead: null },
});

// ---------------------------------------------------------------- IA para texto livre (a chamada é feita pela página)

export type InterpretMode = 'step' | 'start';

// Quando vale pedir ajuda à IA: o texto não bateu com a pergunta pendente, ou é um pedido de indicação longo, com detalhes.
export const interpretMode = (query: string, ctx: Context, replyTag: string, aiFallbackTags: Set<string>): InterpretMode | null => {
  if (query.startsWith('#')) return null;
  const all = tokenize(query);
  if (ctx.lead?.asked && aiFallbackTags.has(replyTag)) return 'step';
  const meaningful = all.filter((token) => !STOP.has(token) && !NOISE.has(token));
  if (!ctx.lead?.asked && replyTag.startsWith('consulta:pergunta') && wantsConsult(all, false) && meaningful.length >= 3 && all.length >= 6) return 'start';
  return null;
};

export const interpretStep = (ctx: Context): string => (ctx.lead?.asked ? ctx.lead.asked : 'start');

export const applyInterpretation = (catalog: Catalog, query: string, ctx: Context, mode: InterpretMode, patch: LeadPatch): Answer | null => {
  if (mode === 'start') return startLead(catalog, query, ctx, patch);
  const lead = ctx.lead;
  if (!lead) return null;
  const { lead: next, filled } = patchLead(catalog, { ...lead, asked: '' }, patch);
  if (filled === 0) return null;
  return advance(catalog, { ...next, questions: lead.questions + 1 }, ctx);
};

// Sem entender a resposta (nem as regras, nem a IA): repete a pergunta com um aviso, em vez de cair numa resposta genérica.
export const reaskConsult = (catalog: Catalog, ctx: Context, text: string): Answer | null => {
  const lead = ctx.lead;
  if (!lead?.asked) return null;
  const shown = cut(text, 50);
  return ask(catalog, lead, ctx, lead.asked, [{ type: 'text', tone: 'warn', text: `Não entendi "${shown}". Toque numa das opções ou escreva de outro jeito.` }]);
};

// ---------------------------------------------------------------- cliques (#k:...)

export const answerConsultClick = (catalog: Catalog, query: string, ctx: Context): Answer => {
  const [, action = '', value = ''] = /^#k:([a-z]+)(?::(.+))?$/.exec(query) ?? [];
  if (action === 'start') return advance(catalog, newLead(), ctx, [INTRO]);
  if (action === 'stop') return stopReply(ctx);
  if (action === 'obj' && !value) {
    const menu = objectionMenu();
    return { reply: textReply('consulta:objecoes', menu.text, menu.chips), ctx };
  }
  if (action === 'obj') {
    const objection = OBJECTIONS.find((item) => item.id === value);
    return objection ? answerObjection(catalog, objection, ctx) : answerConsultClick(catalog, '#k:obj', ctx);
  }
  if (action === 'msg') return studentMessage(catalog, ctx);
  if (action === 'ficha') return leadSheet(catalog, ctx);
  if (action === 'result') return resultMenu(ctx);
  if (action === 'won') return recordOutcome(ctx, 'won', '');
  if (action === 'lost' && !value) return lostMenu(ctx);
  if (action === 'lost') return recordOutcome(ctx, 'lost', value);
  if (action === 'open') {
    return { reply: textReply('consulta:resultado:aberto', 'Certo, o atendimento segue em aberto. Quando tiver o resultado, é só registrar.', [chip('Ficha do atendimento', 'ficha'), chip('Mensagem para o aluno', 'msg'), chip('Registrar resultado', 'result')]), ctx };
  }
  const lead = ctx.lead;
  if (!lead) return advance(catalog, newLead(), ctx, [INTRO]);

  if (action === 'go') return recommend(catalog, { ...lead, asked: '' }, ctx);
  if (action === 'sort') return recommend(catalog, { ...lead, sort: value === 'fast' ? 'fast' : 'price' }, ctx);
  if (action === 'degree') return advance(catalog, answered(lead, { degree: value === 'sim' ? 'sim' : 'nao' }), ctx);
  if (action === 'tipo') {
    if (!TIPO_CHOICES[value]) return advance(catalog, lead, ctx);
    return advance(catalog, answered(setTipo(lead, value), {}), ctx);
  }
  if (action === 'origin') {
    if (value === 'any') return advance(catalog, answered(lead, { origin: 'any' }), ctx);
    const row = catalog.simulator[Number(value)];
    if (!row) return advance(catalog, lead, ctx);
    if (row.destinations.length === 0) {
      return advance(catalog, answered(lead, { origin: 'any' }), ctx, [{ type: 'text', tone: 'warn', text: `Ainda não há curso de destino cadastrado no Simulador para "${row.origin}". Mostro as graduações com aproveitamento em geral.` }]);
    }
    return advance(catalog, answered(lead, { origin: { id: row.id, label: row.origin } }), ctx);
  }
  if (action === 'area') {
    if (value === 'any') return advance(catalog, answered(lead, { area: 'any' }), ctx);
    return advance(catalog, answered(lead, { area: { label: AREA_LABEL[value] ?? value, group: AREA_LABEL[value] ? value : '', words: [] } }), ctx);
  }
  if (action === 'theme') {
    if (value === 'any') return advance(catalog, answered(lead, { themed: true }), ctx);
    return advance(catalog, answered(withTheme(lead, wordLabel(catalog, value), [value]), { themed: true }), ctx);
  }
  if (action === 'mod') return advance(catalog, answered(lead, { modality: value === 'any' ? '' : value }), ctx);
  if (action === 'polo') return advance(catalog, answered(lead, { polo: value === 'any' ? '' : decodeURIComponent(value) }), ctx);
  if (action === 'budget') return advance(catalog, answered(lead, { budget: value === 'any' ? 'any' : Number(value) }), ctx);
  if (action === 'urgency') return advance(catalog, answered(lead, { urgency: value === 'now' ? 'now' : 'later', sort: value === 'now' ? 'fast' : lead.sort }), ctx);
  if (action === 'objective') return advance(catalog, answered(lead, { objective: value === 'any' ? '' : value }), ctx);
  if (action === 'edit') {
    return {
      reply: textReply('consulta:mudar', 'O que você quer mudar?', [
        chip('Tipo de curso', 'reset:tipo'),
        chip('Área', 'reset:area'),
        chip('Modalidade', 'reset:mod'),
        chip('Parcela', 'reset:budget'),
        chip('Urgência', 'reset:urgency'),
      ]),
      ctx,
    };
  }
  if (action === 'reset') {
    const clean: Lead = { ...lead, asked: '' };
    if (value === 'tipo') return advance(catalog, { ...clean, tipos: null, tipoKey: '', degree: '', origin: null }, ctx);
    if (value === 'area') return ask(catalog, { ...clean, area: null, themed: false }, ctx, 'area');
    if (value === 'mod') return ask(catalog, { ...clean, modality: null, polo: null }, ctx, 'modality');
    if (value === 'budget') return ask(catalog, { ...clean, budget: null }, ctx, 'budget');
    if (value === 'urgency') return ask(catalog, { ...clean, urgency: null }, ctx, 'urgency');
  }
  return advance(catalog, lead, ctx);
};

// ---------------------------------------------------------------- resposta digitada à pergunta pendente

// Devolve null quando o texto não é resposta (aí o motor trata como pergunta normal).
export const continueConsult = (catalog: Catalog, query: string, ctx: Context): Answer | null => {
  const lead = ctx.lead;
  if (!lead || !lead.asked) return null;
  const all = tokenize(query);
  if (all.length === 0 || all.length > 8) return null;
  if (all.some((token) => CANCEL.has(token))) return stopReply(ctx);
  const wantsAny = all.every((token) => ANY_WORDS.has(token) || STOP.has(token));

  if (lead.asked === 'area') {
    if (wantsAny) return advance(catalog, answered(lead, { area: 'any' }), ctx);
    const words = all.filter((token) => !STOP.has(token) && !NOISE.has(token));
    if (words.length === 0) return null;
    const area = areaFromWords(catalog, words);
    if (poolOf(catalog, { ...lead, area }).length === 0) {
      return ask(catalog, lead, ctx, 'area', [{ type: 'text', tone: 'warn', text: `Não achei cursos de "${words.join(' ')}" com o que já foi respondido. Escolha outra área ou digite outro tema.` }]);
    }
    return advance(catalog, answered(lead, { area }), ctx);
  }
  if (lead.asked === 'theme') {
    if (wantsAny) return advance(catalog, answered(lead, { themed: true }), ctx);
    const words = all.filter((token) => !STOP.has(token) && !NOISE.has(token));
    if (words.length === 0) return null;
    const themed = withTheme(lead, words.map((word) => wordLabel(catalog, word)).join(' '), words);
    if (poolOf(catalog, themed).length === 0) {
      return ask(catalog, lead, ctx, 'theme', [{ type: 'text', tone: 'warn', text: `Não achei cursos de "${words.join(' ')}" com o que já foi respondido. Escolha um tema da lista ou digite outro.` }]);
    }
    return advance(catalog, answered(themed, { themed: true }), ctx);
  }
  if (lead.asked === 'origin') {
    if (wantsAny) return advance(catalog, answered(lead, { origin: 'any' }), ctx);
    const words = all.filter((token) => !STOP.has(token) && !NOISE.has(token) && !['graduado', 'graduada', 'formado', 'formada', 'bacharel', 'bacharelado', 'licenciatura', 'tecnologo'].includes(token));
    if (words.length === 0) return null;
    const ranked = rank(catalog.simulator, words, true);
    if (ranked.length === 0) {
      return ask(catalog, lead, ctx, 'origin', [{ type: 'text', tone: 'warn', text: `Não encontrei "${words.join(' ')}" entre as graduações do Simulador. Tente só uma palavra do nome ou toque em "Não sei".` }]);
    }
    const best = ranked[0];
    const unique = ranked.length === 1 || best.score - ranked[1].score > 0.15;
    if (unique && best.item.destinations.length > 0) return advance(catalog, answered(lead, { origin: { id: best.item.id, label: best.item.origin } }), ctx);
    return ask(catalog, lead, ctx, 'origin', [{ type: 'text', text: `Achei ${ranked.length} graduações parecidas. Qual é a dele?` }], ranked.slice(0, 6).map((entry) => ({ id: entry.item.id, origin: entry.item.origin })));
  }
  if (lead.asked === 'modality') {
    if (wantsAny) return advance(catalog, answered(lead, { modality: '' }), ctx);
    const found = all.map((token) => MODALITY_WORDS[token]).find(Boolean);
    return found ? advance(catalog, answered(lead, { modality: found }), ctx) : null;
  }
  if (lead.asked === 'polo') {
    if (wantsAny) return advance(catalog, answered(lead, { polo: '' }), ctx);
    const polo = poloCounts(catalog).find((item) => all.includes(foldText(item.label).split(' ')[0]));
    return polo ? advance(catalog, answered(lead, { polo: polo.label }), ctx) : null;
  }
  if (lead.asked === 'budget') {
    if (wantsAny) return advance(catalog, answered(lead, { budget: 'any' }), ctx);
    const value = /(\d[\d.]*)/.exec(foldText(query));
    const amount = value ? Number(value[1].replace(/\./g, '')) : 0;
    return amount >= 30 ? advance(catalog, answered(lead, { budget: amount }), ctx) : null;
  }
  if (lead.asked === 'urgency') {
    if (all.some((token) => ['ja', 'logo', 'urgente', 'rapido', 'agora', 'imediato'].includes(token))) return advance(catalog, answered(lead, { urgency: 'now', sort: 'fast' }), ctx);
    if (all.some((token) => ['esperar', 'calma', 'pressa', 'depois', 'vai', 'tranquilo'].includes(token)) || wantsAny) return advance(catalog, answered(lead, { urgency: 'later' }), ctx);
    return null;
  }
  if (lead.asked === 'objective') {
    if (wantsAny) return advance(catalog, answered(lead, { objective: '' }), ctx);
    const folded = foldText(query);
    const key = /carreira|crescer|promocao|salario|cresc/.test(folded) ? 'carreira' : /mudar|migrar|nova area|transicao/.test(folded) ? 'mudar' : /exig|concurso|vaga|empresa|trabalho/.test(folded) ? 'exigencia' : /diploma|formacao|completar|terminar/.test(folded) ? 'diploma' : '';
    return key ? advance(catalog, answered(lead, { objective: key }), ctx) : null;
  }
  if (lead.asked === 'degree') {
    const first = all[0];
    if (['sim', 'ja', 'tem', 'possui', 'graduado', 'graduada', 'formado', 'formada'].includes(first)) return advance(catalog, answered(lead, { degree: 'sim' }), ctx);
    if (['nao', 'ainda', 'nenhuma', 'nenhum'].includes(first)) return advance(catalog, answered(lead, { degree: 'nao' }), ctx);
    return null;
  }
  // 'goal' e 'formation': o texto precisa dizer o tipo de curso
  const typed = all.map((token) => TIPO_WORDS[token]).find(Boolean);
  const key = wantsSecondDegree(query) ? 'segunda' : typed === 'pos' ? 'pos' : typed && TIPO_CHOICES[typed] ? typed : typed && SHORT_TIPOS.includes(typed) ? 'curta' : '';
  if (!key) return null;
  return advance(catalog, answered(setTipo(lead, key), {}), ctx);
};

// ---------------------------------------------------------------- objeções, mensagem, ficha e resultado

const coursesOf = (catalog: Catalog, ctx: Context): Course[] => ctx.courseIds.map((id) => catalog.courses[id]).filter(Boolean);

// Objeção do aluno (por botão ou por frase do vendedor): perguntas para descobrir o motivo, como responder e os dados da planilha
export const answerObjection = (catalog: Catalog, objection: Objection, ctx: Context): Answer => {
  const { blocks, chips } = objectionReply(objection, coursesOf(catalog, ctx), Boolean(ctx.lead));
  const lead = ctx.lead ? { ...ctx.lead, objections: [...new Set([...ctx.lead.objections, objection.id])] } : null;
  return { reply: { tag: `consulta:objecao:${objection.id}`, blocks, chips, sources: ['aba Cursos'] }, ctx: { ...ctx, lead } };
};

// Mensagem pronta para o vendedor copiar e enviar ao aluno (só valores da planilha, sem anotações internas)
const studentMessage = (catalog: Catalog, ctx: Context): Answer => {
  const courses = coursesOf(catalog, ctx).slice(0, TOP);
  if (courses.length === 0) {
    return { reply: textReply('consulta:mensagem-vazia', 'Ainda não há cursos indicados para montar a mensagem. Faça um atendimento primeiro.', [chip('Atender um aluno', 'start')]), ctx };
  }
  const blocks: Block[] = [{ type: 'text', text: 'Olá! Conforme nossa conversa, separei estas opções para você:' }];
  courses.forEach((course) => {
    const facts: [string, string][] = [];
    const total = basePrice(course);
    if (total !== null) facts.push([course.unicive?.total ? 'Valor integral' : 'Valor integral (D30 no boleto)', money(total)]);
    const parcels = parcelsText(course);
    if (parcels) facts.push(['Parcelamento', parcels]);
    if (course.carga) facts.push(['Carga horária', course.carga]);
    if (course.duracao) facts.push(['Duração', course.duracao]);
    blocks.push({ type: 'course', title: displayName(course.name), meta: [course.ies, course.tipo, course.modalidade].filter(Boolean) });
    if (facts.length > 0) blocks.push({ type: 'facts', items: facts });
  });
  blocks.push({ type: 'text', text: 'Se quiser, envio também os documentos necessários para a matrícula. Qual dessas opções você prefere?' });
  blocks.push({ type: 'text', tone: 'muted', text: 'Use "Copiar resposta" para enviar ao aluno.' });
  return {
    reply: {
      tag: 'consulta:mensagem',
      blocks,
      chips: [chip('Ficha do atendimento', 'ficha'), chip('Aluno com objeção', 'obj'), chip('Registrar resultado', 'result'), chip('Novo atendimento', 'start')],
      sources: ['aba Cursos', ...(courses.some((course) => course.unicive) ? ['aba Valores UNICIVE'] : [])],
    },
    ctx,
  };
};

const OUTCOME_LABEL: Record<string, string> = { won: 'venda fechada', lost: 'não fechou' };

// Ficha de uso interno: perfil descoberto, opções indicadas, objeções trabalhadas e resultado
const leadSheet = (catalog: Catalog, ctx: Context): Answer => {
  const courses = coursesOf(catalog, ctx).slice(0, TOP);
  if (!ctx.lead && courses.length === 0) {
    return { reply: textReply('consulta:ficha-vazia', 'Ainda não há um atendimento para resumir. Comece um atendimento e eu monto a ficha.', [chip('Atender um aluno', 'start')]), ctx };
  }
  const facts: [string, string][] = [['Perfil do aluno', (ctx.lead ? profileLine(ctx.lead) : '') || 'ainda não definido']];
  const handled = (ctx.lead?.objections ?? []).map((id) => OBJECTIONS.find((item) => item.id === id)?.title).filter(Boolean) as string[];
  facts.push(['Objeções trabalhadas', handled.length > 0 ? handled.join('; ') : 'nenhuma']);
  const outcome = ctx.lead?.outcome ?? '';
  const reason = ctx.lead?.lostReason ? OBJECTIONS.find((item) => item.id === ctx.lead?.lostReason)?.title ?? 'outro motivo' : '';
  facts.push(['Resultado', outcome ? `${OUTCOME_LABEL[outcome]}${reason ? ` (${reason})` : ''}` : 'em aberto']);
  const blocks: Block[] = [{ type: 'text', text: 'Ficha do atendimento (uso interno, não enviar ao aluno):' }, { type: 'facts', items: facts }];
  if (courses.length > 0) {
    blocks.push({
      type: 'list',
      title: 'Opções indicadas',
      items: courses.map((course) => {
        const monthly = monthlyOf(course);
        const total = basePrice(course);
        return `${displayName(course.name)} (${course.ies}, ${course.modalidade || 'modalidade não informada'})${total !== null ? `: integral ${money(total)}` : ''}${monthly !== null ? `, parcela estimada ${money(monthly)}` : ''}`;
      }),
    });
  }
  return {
    reply: { tag: 'consulta:ficha', blocks, chips: [chip('Mensagem para o aluno', 'msg'), chip('Aluno com objeção', 'obj'), chip('Registrar resultado', 'result'), chip('Novo atendimento', 'start')], sources: ['aba Cursos'] },
    ctx,
  };
};

// Como terminou o atendimento (alimenta a ficha e o painel de Análises, só pelo tipo de resposta)
const resultMenu = (ctx: Context): Answer => ({
  reply: textReply('consulta:resultado:menu', 'Como terminou o atendimento?', [chip('Venda fechada', 'won'), chip('Não fechou', 'lost'), chip('Ainda em negociação', 'open')]),
  ctx,
});

const lostMenu = (ctx: Context): Answer => ({
  reply: textReply('consulta:resultado:motivo', 'Qual foi o principal motivo?', [
    ...OBJECTIONS.map((objection) => chip(objection.title, `lost:${objection.id}`)),
    chip('Outro motivo', 'lost:outro'),
  ]),
  ctx,
});

const recordOutcome = (ctx: Context, outcome: 'won' | 'lost', reason: string): Answer => {
  const lead = ctx.lead ?? newLead();
  const repeated = lead.outcome === outcome && lead.lostReason === reason;
  const next: Lead = { ...lead, asked: '', outcome, lostReason: reason };
  const text = outcome === 'won' ? 'Venda registrada. Parabéns pelo atendimento!' : 'Registrado. Se quiser, volte à conversa com o aluno mais tarde: o atendimento fica salvo nesta conversa.';
  return {
    reply: textReply(repeated ? 'consulta:resultado:repetido' : outcome === 'won' ? 'consulta:resultado:fechada' : `consulta:perdida:${reason || 'outro'}`, text, [
      chip('Ficha do atendimento', 'ficha'),
      chip('Novo atendimento', 'start'),
    ]),
    ctx: { ...ctx, lead: next },
  };
};
