import { foldText, formatCurrency, safeHttpUrl } from '../courses';
import { Catalog, Combo, Course, tokenize } from './catalog';
import { Agenda, answerAgenda, wantsAgenda } from './calendar';
import { answerForm, answerInstitution, answerStudy, answerVideo, wantsForm, wantsInstitution, wantsStudy, wantsVideo } from './knowledge';
import { answerCompare, answerList, answerMore, wantsCompare, wantsList } from './lists';
import { answerClass, answerContact, answerOrigin, answerSimulator, wantsClass, wantsContact, wantsSimulator } from './extras';
import { Answer, Block, Chip, Context, EMPTY_CONTEXT, IES_WORDS, Intent, Pay, Reply, STOP, displayName, passesFilters, rank, set, shortName, splitCourseTokens, textReply } from './shared';
import type { CourseFilters } from './shared';

export type { Answer, Block, Chip, Context, Intent, Reply } from './shared';
export { EMPTY_CONTEXT } from './shared';

// Motor do Meu Assistente: entende a pergunta por regras (sem IA, sem custo), acha o curso ou o combo na planilha
// e monta a resposta com os valores exatamente como estão nas células, sempre dizendo a fonte.

// ---------------------------------------------------------------- vocabulário

const PRICE = set(
  'valor valores preco precos custa custo custar mensalidade mensalidades parcela parcelas parcelado parcelamento d30 d10 pix boleto ' +
    'cartao taxa inscricao pontualidade desconto vista pagamento investimento reais',
);
const DOCS = set('documento documentos documentacao doc docs requisito requisitos prerequisito prerequisitos ingresso');
const INFO = set(
  'carga horaria duracao prazo tempo dura estagio artigo titulacao emec informativo certificado diploma emissao modalidade ementa ficha detalhes detalhe informacoes informacao',
);
const COMBO = set('combo combos pacote pacotes');
const GREET_WORDS = set('oi ola eae hey bom boa dia tarde noite tudo bem td blz');
const THANKS_WORDS = set('obrigado obrigada brigado valeu agradeco muito mt vlw');
const NOISE = set('dia d10 d30 10 30 matricular matricula matriculas matriculo');
const PAY_WORDS: Record<string, Pay> = { pix: 'pix', boleto: 'boleto', cartao: 'cartao', credito: 'cartao', parcelado: 'boleto' };

const AREA_WORDS: Record<string, string> = { educacao: 'educacao', saude: 'saude', negocios: 'negocios', negocio: 'negocios' };

interface Topic {
  words: Set<string>;
  text: string;
  link: { label: string; href: string };
}
const TOPICS: Topic[] = [
  {
    words: set('academico academicos'),
    text: 'O calendário acadêmico de cada IES (por exemplo, "Calendário ESP 2026") é publicado nos Avisos, com o link do arquivo.',
    link: { label: 'Abrir Avisos', href: '/avisos' },
  },
  {
    words: set('memorando memorandos norma normas regra regras portaria circular'),
    text: 'Os memorandos e normas ainda não estão no assistente. Eles estão na página Memorandos, com o link do documento completo.',
    link: { label: 'Abrir Memorandos', href: '/memorandos' },
  },
  {
    words: set('pontos pontuacao evolucao qpe'),
    text: 'A pontuação da evolução funcional ainda não está no assistente. Use a página Evolução.',
    link: { label: 'Abrir Evolução', href: '/evolucao' },
  },
];

const FINANCE_LINKS = [
  { label: 'Financeiro: financeiro01@iteqescolas.com.br', href: 'mailto:financeiro01@iteqescolas.com.br' },
  { label: 'Negociação: negociacao@iteqescolas.com.br', href: 'mailto:negociacao@iteqescolas.com.br' },
];

// ---------------------------------------------------------------- busca por nome
// ---------------------------------------------------------------- análise da pergunta

interface Parsed {
  all: string[]; // todas as palavras da pergunta, sem acento
  tokens: string[]; // sem palavras de ligação nem de intenção
  intents: Intent[];
  combo: boolean;
  pay: Pay[];
  topic: Topic | null;
  help: boolean;
  greet: boolean;
  thanks: boolean;
}

const parse = (question: string): Parsed => {
  const all = tokenize(question);
  const has = (words: Set<string>) => all.some((token) => words.has(token));
  const intents: Intent[] = [];
  if (has(PRICE)) intents.push('price');
  if (has(DOCS) || (all.includes('matricular') && all.some((t) => ['preciso', 'precisa', 'necessario', 'levar'].includes(t)))) intents.push('docs');
  if (has(INFO)) intents.push('info');

  const pay: Pay[] = [];
  all.forEach((token) => {
    const method = PAY_WORDS[token];
    if (method && !pay.includes(method)) pay.push(method);
  });

  const topic = TOPICS.find((candidate) => all.some((token) => candidate.words.has(token))) ?? null;
  const tokens = all.filter(
    (token) => !STOP.has(token) && !PRICE.has(token) && !DOCS.has(token) && !INFO.has(token) && !COMBO.has(token) && !NOISE.has(token),
  );
  const help =
    all.some((t) => ['ajuda', 'ajudar', 'help', 'comandos'].includes(t)) ||
    (all.includes('voce') && all.some((t) => ['faz', 'sabe', 'pode'].includes(t)));
  return {
    all,
    tokens,
    intents,
    combo: has(COMBO),
    pay,
    topic,
    help,
    greet: all.length > 0 && all.every((t) => GREET_WORDS.has(t)),
    thanks: all.some((t) => THANKS_WORDS.has(t)) && all.every((t) => THANKS_WORDS.has(t) || STOP.has(t)),
  };
};

// ---------------------------------------------------------------- blocos de resposta

const money = (value: number | null): string => (value === null ? '-' : formatCurrency(value));

const courseHref = (course: Course): string =>
  `/cursos/info?curso=${encodeURIComponent(course.name)}&ies=${encodeURIComponent(course.ies)}`;

const courseHeader = (course: Course): Block => ({
  type: 'course',
  title: displayName(course.name),
  meta: [course.ies, course.tipo, course.modalidade].filter(Boolean),
  href: courseHref(course),
});

// Lista de documentos separada por vírgula, "/" ou ";" (sem quebrar o que está entre parênteses).
const splitItems = (value: string): string[] => {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (char === ',' || char === '/' || char === ';' || char === '\n')) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items;
};

const priceBlocks = (course: Course, pay: Pay[]): Block[] => {
  if (course.unicive) {
    const u = course.unicive;
    const facts: [string, string][] = [];
    if (u.fee !== null) facts.push(['Taxa de inscrição', money(u.fee)]);
    if (u.total !== null) facts.push(['Valor integral do curso', money(u.total)]);
    if (u.installment !== null) {
      facts.push(['Parcelamento regular com desconto de parceria', u.installments ? `${u.installments}x de ${money(u.installment)}` : money(u.installment)]);
    }
    if (u.cash !== null) facts.push(['Pagamento à vista', money(u.cash)]);
    if (facts.length > 0) {
      return [{ type: 'facts', items: facts }, { type: 'text', tone: 'muted', text: 'Os valores da UNICIVE vêm da aba "Valores UNICIVE": na aba Cursos eles aparecem zerados.' }];
    }
  }
  const methods: { key: Pay; label: string; cell: Course['boleto'] }[] = [
    { key: 'boleto', label: 'Boleto', cell: course.boleto },
    { key: 'pix', label: 'Pix', cell: course.pix },
    { key: 'cartao', label: 'Cartão', cell: course.cartao },
  ];
  const shown = methods.filter((method) => pay.length === 0 || pay.includes(method.key));
  const hasAny = methods.some((method) => method.cell.d30 !== null || method.cell.punctual !== null);
  if (!hasAny) {
    return [
      { type: 'text', tone: 'warn', text: 'O valor deste curso não está cadastrado na planilha.' },
      { type: 'links', items: FINANCE_LINKS },
    ];
  }
  const blocks: Block[] = [
    {
      type: 'table',
      columns: ['Forma', 'D30', 'Com desconto de pontualidade'],
      rows: shown.map((method) => [method.label, money(method.cell.d30), money(method.cell.punctual)]),
    },
  ];
  const facts: [string, string][] = [];
  if (course.fee !== null) facts.push(['Taxa de inscrição', money(course.fee)]);
  const parcels: string[] = [];
  if (course.parcelasBoleto) parcels.push(`até ${course.parcelasBoleto}x no boleto`);
  if (course.parcelasCartao) parcels.push(`até ${course.parcelasCartao}x no cartão`);
  if (parcels.length > 0) facts.push(['Parcelamento', parcels.join(' · ')]);
  if (course.parcelado !== null && course.parcelado !== course.boleto.d30) facts.push(['Valor parcelado no boleto (D30)', money(course.parcelado)]);
  if (facts.length > 0) blocks.push({ type: 'facts', items: facts });
  return blocks;
};

const docsBlocks = (course: Course): Block[] => {
  const blocks: Block[] = [];
  const documents = splitItems(course.docs);
  if (!course.preReq && documents.length === 0) {
    return [{ type: 'text', tone: 'warn', text: 'Os documentos e o pré-requisito deste curso não estão cadastrados na planilha.' }];
  }
  if (course.preReq) blocks.push({ type: 'facts', items: [['Pré-requisito para matrícula', course.preReq]] });
  if (documents.length > 0) blocks.push({ type: 'list', title: 'Documentos para ingresso', items: documents });
  const facts: [string, string][] = [];
  if (course.emissao) facts.push(['Emissão', course.emissao]);
  if (course.prazoEmissao) facts.push(['Prazo médio de emissão após a colação', course.prazoEmissao]);
  if (facts.length > 0) blocks.push({ type: 'facts', items: facts });
  const links: { label: string; href: string }[] = [];
  const informativo = safeHttpUrl(course.informativo);
  const emec = safeHttpUrl(course.emec);
  if (informativo) links.push({ label: 'Informativo do curso', href: informativo });
  if (emec) links.push({ label: 'Consulta no e-MEC', href: emec });
  if (links.length > 0) blocks.push({ type: 'links', items: links });
  return blocks;
};

const infoBlocks = (course: Course, summarizePrice: boolean): Block[] => {
  const duration = [course.duracao, course.duracaoMax && !course.duracao.includes(course.duracaoMax) ? `máximo ${course.duracaoMax}` : ''].filter(Boolean).join(' · ');
  const facts: [string, string][] = [];
  const add = (label: string, value: string) => value && facts.push([label, value]);
  add('Eixo', course.eixo);
  add('Carga horária', course.carga);
  add('Duração', duration);
  add('Titulação recebida', course.titulacao);
  add('Emissão', course.emissao);
  add('Estágio', course.estagio);
  add('Artigo', course.artigo);
  const blocks: Block[] = [{ type: 'facts', items: facts }];
  if (summarizePrice) {
    if (course.unicive?.total) {
      blocks.push({ type: 'facts', items: [['Valor integral', money(course.unicive.total)]] });
    } else if (course.boleto.d30 !== null || course.pix.d30 !== null || course.cartao.d30 !== null) {
      blocks.push({ type: 'facts', items: [['Valor (D30)', `boleto ${money(course.boleto.d30)} · pix ${money(course.pix.d30)} · cartão ${money(course.cartao.d30)}`]] });
    }
  }
  return facts.length === 0 && blocks.length === 1 ? [{ type: 'text', tone: 'muted', text: 'Sem detalhes cadastrados para este curso.' }] : blocks;
};

const sourcesFor = (intents: Intent[], courses: Course[]): string[] => {
  const sources = new Set<string>(['aba Cursos']);
  if (intents.includes('price') && courses.some((course) => course.unicive)) sources.add('aba Valores UNICIVE');
  return [...sources];
};

const courseReply = (courses: Course[], intents: Intent[], pay: Pay[], note?: string): Reply => {
  const wanted: Intent[] = intents.length > 0 ? intents : ['info'];
  const blocks: Block[] = [];
  if (note) blocks.push({ type: 'text', tone: 'muted', text: note });
  courses.forEach((course) => {
    blocks.push(courseHeader(course));
    wanted.forEach((intent) => {
      if (intent === 'price') blocks.push(...priceBlocks(course, pay));
      if (intent === 'docs') blocks.push(...docsBlocks(course));
      if (intent === 'info') blocks.push(...infoBlocks(course, intents.length === 0));
    });
  });
  const chips: Chip[] = [];
  if (!wanted.includes('price')) chips.push({ label: 'Ver valores', query: '#i:price' });
  if (!wanted.includes('docs')) chips.push({ label: 'Ver documentos', query: '#i:docs' });
  if (!wanted.includes('info')) chips.push({ label: 'Ver ficha do curso', query: '#i:info' });
  chips.push({ label: 'Combos', query: 'combos' });
  return { tag: `curso:${wanted.join('+')}`, blocks, chips, sources: sourcesFor(wanted, courses) };
};

// ---------------------------------------------------------------- combos

const comboLinesFor = (combo: Combo, pay: Pay[]) =>
  combo.lines.filter((line) => {
    if (pay.length === 0) return true;
    const method = foldText(line.method);
    return (
      (pay.includes('pix') && method.includes('pix')) || (pay.includes('boleto') && method.includes('boleto')) || (pay.includes('cartao') && method.includes('cart'))
    );
  });

const comboBlocks = (combo: Combo, pay: Pay[]): Block[] => {
  const lines = comboLinesFor(combo, pay);
  return [
    { type: 'course', title: combo.name, meta: [combo.area].filter(Boolean) },
    {
      type: 'table',
      columns: ['Forma de pagamento', 'Dia 10', 'Dia 30', 'Parcelamento'],
      rows: (lines.length > 0 ? lines : combo.lines).map((line) => [line.method, line.day10 || '-', line.day30 || '-', line.installments || '-']),
    },
  ];
};

const comboReply = (combos: Combo[], pay: Pay[], note?: string): Reply => {
  const blocks: Block[] = note ? [{ type: 'text', tone: 'muted', text: note }] : [];
  combos.forEach((combo) => blocks.push(...comboBlocks(combo, pay)));
  return { tag: 'combo', blocks, chips: [], sources: ['aba Combos'] };
};


const answerCombos = (catalog: Catalog, parsed: Parsed, ctx: Context): Answer => {
  const areaKeys: string[] = [];
  const nameTokens: string[] = [];
  parsed.tokens.forEach((token) => {
    if (AREA_WORDS[token]) areaKeys.push(AREA_WORDS[token]);
    else if (!PAY_WORDS[token]) nameTokens.push(token);
  });
  const areaOf = (combo: Combo) => foldText(combo.area).trim();
  const inArea = catalog.combos.filter((combo) => areaKeys.length === 0 || areaKeys.some((key) => areaOf(combo).startsWith(key)));
  const base: Context = { ...ctx, kind: 'combo', pay: parsed.pay };

  if (nameTokens.length === 0) {
    if (areaKeys.length === 0) {
      const areas = new Map<string, number>();
      catalog.combos.forEach((combo) => areas.set(combo.area, (areas.get(combo.area) ?? 0) + 1));
      return {
        reply: {
          tag: 'combo:areas',
          blocks: [
            { type: 'text', text: `Há ${catalog.combos.length} combos cadastrados. De qual área você quer ver?` },
            { type: 'text', tone: 'muted', text: 'Você também pode descrever o combo, por exemplo: "combo de licenciatura com aproveitamento para bacharel".' },
          ],
          chips: [...areas.entries()].map(([area, total]) => ({ label: `${area} (${total})`, query: `combos ${area}` })),
          sources: ['aba Combos'],
        },
        ctx: base,
      };
    }
    return listCombos(inArea, `Combos da área de ${inArea[0]?.area ?? 'sua escolha'}`, base);
  }

  const ranked = rank(inArea, nameTokens, true);
  if (ranked.length === 0) {
    return {
      reply: {
        tag: 'combo:none',
        blocks: [{ type: 'text', text: 'Não achei um combo com essas palavras. Tente com outras palavras (por exemplo: licenciatura, bacharel, pós-graduação, artigo, extensão) ou escolha a área.' }],
        chips: [{ label: 'Ver as áreas dos combos', query: 'combos' }],
        sources: ['aba Combos'],
      },
      ctx: base,
    };
  }
  const best = ranked[0].score;
  const strong = ranked.filter((entry) => entry.score >= best - 0.08).map((entry) => entry.item);
  if (strong.length <= 3) {
    return { reply: comboReply(strong, parsed.pay), ctx: { ...base, comboId: strong[0].id } };
  }
  return listCombos(strong, `Encontrei ${strong.length} combos com essas palavras. Qual deles?`, base);
};

const listCombos = (combos: Combo[], title: string, ctx: Context): Answer => ({
  reply: {
    tag: 'combo:lista',
    blocks: [
      { type: 'text', text: title },
      { type: 'text', tone: 'muted', text: 'Escolha um para ver os valores, ou acrescente palavras à pergunta (bacharel, artigo, extensão, brinde…).' },
    ],
    chips: combos.slice(0, 8).map((combo) => ({ label: shortName(combo.name, 80), query: `#cb:${combo.id}` })),
    sources: ['aba Combos'],
  },
  ctx,
});

// ---------------------------------------------------------------- respostas fixas

export const HELP_CHIPS: Chip[] = [
  { label: 'Quanto custa Pedagogia?', query: 'Quanto custa Pedagogia?' },
  { label: 'Documentos de Psicopedagogia (pós)', query: 'Documentos para matrícula em Psicopedagogia pós-graduação' },
  { label: 'Combos de licenciatura', query: 'Combos de licenciatura com aproveitamento' },
  { label: 'Pós em Educação até R$ 2.000', query: 'Pós-graduação em Educação até R$ 2.000 mais baratas' },
  { label: 'Comparar Pedagogia ESP com UCESP', query: 'Comparar Pedagogia ESP com Pedagogia UCESP' },
  { label: 'Aulas desta semana', query: 'Aulas desta semana' },
  { label: 'O que é a UNICIVE?', query: 'O que é a UNICIVE?' },
  { label: 'O que posso estudar com Bacharel?', query: 'O que posso estudar com Bacharel' },
];


export const helpReply = (): Reply =>
  textReply(
    'ajuda',
    'Eu consulto a planilha do SAE e as páginas do sistema e respondo sobre cursos, valores, combos, documentos, listas e comparações, turmas e calendário de aulas, aproveitamento de estudos, instituições, vídeos tutoriais, formulários de cadastro e contatos. Cada resposta mostra de onde veio o dado. Experimente:',
    HELP_CHIPS,
    [
      {
        type: 'list',
        title: 'Posso responder, por exemplo',
        items: [
          'Valor de um curso no D30, no pix, no boleto ou no cartão',
          'Valores de combos (Dia 10, Dia 30 e parcelamento)',
          'Documentos e pré-requisitos para matrícula',
          'Carga horária, duração, titulação e prazo de emissão',
          'Listas e rankings de cursos (por IES, tipo, modalidade, valor) e comparações entre cursos ou instituições',
          'Turmas presenciais e calendário de aulas (por data, polo ou curso)',
          'Sobre as instituições, vídeos tutoriais, formulários de cadastro e "o que posso estudar?"',
          'Aproveitamento de estudos (Simulador)',
          'E-mails por IES e assunto, e qual setor cuida de cada tarefa',
        ],
      },
    ],
  );

// ---------------------------------------------------------------- resposta principal

const chooseCourses = (catalog: Catalog, tokens: string[], filters: CourseFilters) => {
  const search = (active: CourseFilters) => rank(catalog.courses.filter((course) => passesFilters(course, active)), tokens, false);
  let ranked = search(filters);
  let note = '';
  if (ranked.length === 0) ranked = rank(catalog.courses.filter((course) => passesFilters(course, filters)), tokens, true);
  if (ranked.length === 0 && (filters.ies || filters.modality || filters.tipo)) {
    ranked = rank(catalog.courses, tokens, true);
    if (ranked.length > 0) note = 'Não achei esse curso com o filtro que você pediu (IES, modalidade ou tipo). Mostrando sem o filtro.';
  }
  return { ranked, note };
};

export const answerQuestion = (catalog: Catalog, question: string, ctx: Context = EMPTY_CONTEXT, agenda: Agenda | null = null): Answer => {
  const query = question.trim();

  // Cliques nos botões da resposta anterior
  const pickCourse = /^#c:(\d+)$/.exec(query);
  if (pickCourse) {
    const course = catalog.courses[Number(pickCourse[1])];
    if (!course) return { reply: helpReply(), ctx };
    return { reply: courseReply([course], ctx.pending, ctx.pay), ctx: { ...ctx, kind: 'course', courseIds: [course.id], comboId: null, pending: [], pay: ctx.pay } };
  }
  const pickCombo = /^#cb:(\d+)$/.exec(query);
  if (pickCombo) {
    const combo = catalog.combos[Number(pickCombo[1])];
    if (!combo) return { reply: helpReply(), ctx };
    return { reply: comboReply([combo], ctx.pay), ctx: { ...ctx, kind: 'combo', comboId: combo.id } };
  }
  const pickOrigin = /^#o:(\d+)$/.exec(query);
  if (pickOrigin) {
    return answerOrigin(catalog, Number(pickOrigin[1]), ctx) ?? { reply: helpReply(), ctx };
  }
  if (query === '#l:more') return answerMore(catalog, ctx);
  const intentChip = /^#i:(price|docs|info)$/.exec(query);
  if (intentChip) {
    const courses = ctx.courseIds.map((id) => catalog.courses[id]).filter(Boolean);
    if (courses.length === 0) return { reply: helpReply(), ctx };
    return { reply: courseReply(courses, [intentChip[1] as Intent], ctx.pay), ctx: { ...ctx, kind: 'course' } };
  }

  if (/^(mostrar |ver |mostre |me mostre )?(mais|mais cursos|o resto|o restante|continuar|proxima pagina|proximos)$/.test(foldText(query).replace(/[?!.]/g, '').trim()) && ctx.listIds.length > 0) {
    return answerMore(catalog, ctx);
  }

  const parsed = parse(query);
  if (parsed.help) return { reply: helpReply(), ctx };
  if (parsed.greet) return { reply: helpReply(), ctx };
  if (parsed.thanks) return { reply: textReply('agradecimento', 'Por nada! Se precisar de outro curso, valor ou documento, é só perguntar.'), ctx };

  if (parsed.combo) return answerCombos(catalog, parsed, ctx);

  const hasCourseIntent = parsed.intents.length > 0;
  const hasPriceOrDocs = parsed.intents.includes('price') || parsed.intents.includes('docs');

  // Comparações, vídeos, formulários, "o que posso estudar", calendário de aulas e instituições
  if (wantsCompare(parsed.all)) return answerCompare(catalog, query, ctx);
  if (wantsVideo(parsed.all, hasPriceOrDocs)) return answerVideo(parsed.all, ctx);
  if (wantsForm(parsed.all)) return answerForm(parsed.all, ctx);
  if (wantsStudy(parsed.all, hasCourseIntent)) return answerStudy(catalog, parsed.all, ctx);
  if (wantsAgenda(parsed.all, hasCourseIntent)) {
    if (!agenda) {
      return { reply: textReply('agenda:carregando', 'Consultando a agenda de aulas...'), ctx, needs: 'agenda' };
    }
    return answerAgenda(agenda, parsed.all, query, ctx);
  }
  if (wantsInstitution(parsed.all, hasCourseIntent)) return answerInstitution(catalog, parsed.all, ctx);

  // Simulador, turmas presenciais e contatos (nessa ordem: "quem pode aproveitar..." é do Simulador, não de contato)
  if (wantsSimulator(parsed.all, hasCourseIntent)) return answerSimulator(catalog, parsed.all, ctx);
  if (wantsClass(parsed.all, hasCourseIntent)) return answerClass(catalog, parsed.all, ctx);
  if (wantsContact(parsed.all, hasCourseIntent)) return answerContact(parsed.all, ctx);

  // Listas, contagens e rankings ("pós em Educação até R$ 2.000", "quantos cursos a ESP tem?")
  if (wantsList(parsed.all, parsed.tokens, query, parsed.intents.includes('docs') || parsed.intents.includes('info'))) {
    return answerList(catalog, parsed.tokens, parsed.all, query, ctx);
  }

  const { name, filters } = splitCourseTokens(parsed.tokens);
  const hasIntent = parsed.intents.length > 0;
  const hasName = name.length > 0;

  // Assuntos que ainda não estão no assistente
  if (parsed.topic && !hasIntent) {
    return {
      reply: textReply('assunto-fora', parsed.topic.text, [], [{ type: 'links', items: [parsed.topic.link] }]),
      ctx,
    };
  }

  // Pergunta de continuação ("e os documentos?", "e no pix?"): usa o curso ou combo da conversa
  if (!hasName && !filters.ies && !filters.modality && !filters.tipo) {
    if (hasIntent || parsed.pay.length > 0) {
      if (ctx.kind === 'combo') {
        if (ctx.comboId !== null && catalog.combos[ctx.comboId]) {
          return { reply: comboReply([catalog.combos[ctx.comboId]], parsed.pay), ctx: { ...ctx, pay: parsed.pay } };
        }
        return { reply: textReply('pede-combo', 'De qual combo? Escolha um da lista acima ou descreva o combo, por exemplo: "combo de licenciatura para bacharel".'), ctx: { ...ctx, pay: parsed.pay } };
      }
      const courses = ctx.courseIds.map((id) => catalog.courses[id]).filter(Boolean);
      if (courses.length > 0) {
        const intents = hasIntent ? parsed.intents : ['price' as Intent];
        return { reply: courseReply(courses, intents, parsed.pay), ctx: { ...ctx, kind: 'course', pay: parsed.pay } };
      }
      return {
        reply: textReply('pede-curso', 'De qual curso? Diga o nome (por exemplo: "valor de Pedagogia"). Se quiser, acrescente a IES (ESP, UNICIVE, Alpha, UCESP, FAEP) ou a modalidade.', HELP_CHIPS),
        ctx,
      };
    }
    return { reply: textReply('nao-entendi', 'Não entendi. Diga o nome de um curso, ou pergunte por valores, documentos ou combos.', HELP_CHIPS), ctx };
  }

  if (!hasName) {
    return {
      reply: textReply('pede-curso', 'Qual curso? Diga o nome (por exemplo: "valor de Pedagogia na ESP").', HELP_CHIPS),
      ctx,
    };
  }

  const { ranked, note } = chooseCourses(catalog, name, filters);
  if (ranked.length === 0) {
    return {
      reply: textReply('curso-nao-achado', `Não encontrei um curso com "${name.join(' ')}". Confira a grafia ou tente só uma palavra do nome.`, [
        { label: 'O que você sabe responder?', query: 'ajuda' },
      ]),
      ctx,
    };
  }

  const best = ranked[0].score;
  const strong = ranked.filter((entry) => entry.score >= best - 0.12).map((entry) => entry.item);
  const base: Context = { ...ctx, kind: 'course', comboId: null, pay: parsed.pay };
  const approximate = ranked[0].average < 0.9 ? `Não achei um curso chamado exatamente "${name.join(' ')}". ${strong.length === 1 ? 'Este é o mais parecido' : 'Estes são os mais parecidos'}:` : '';

  if (strong.length <= 3) {
    return {
      reply: courseReply(strong, parsed.intents, parsed.pay, [note, approximate].filter(Boolean).join(' ') || undefined),
      ctx: { ...base, courseIds: strong.map((course) => course.id), pending: [] },
    };
  }

  const options = ranked.slice(0, 8).map((entry) => entry.item);
  return {
    reply: {
      tag: 'curso:lista',
      blocks: [
        { type: 'text', text: `Encontrei ${strong.length} cursos para "${name.join(' ')}". Qual deles?` },
        { type: 'text', tone: 'muted', text: 'Dica: acrescente a IES (ESP, UNICIVE, Alpha, UCESP, FAEP), a modalidade (EAD, presencial) ou o tipo (pós-graduação, licenciatura…) na pergunta.' },
      ],
      chips: options.map((course) => ({ label: shortName(`${displayName(course.name)} - ${course.ies}`, 80), query: `#c:${course.id}` })),
      sources: ['aba Cursos'],
    },
    ctx: { ...base, courseIds: [], pending: parsed.intents },
  };
};

// ---------------------------------------------------------------- texto simples (para copiar e colar)

export const replyToPlain = (reply: Reply): string => {
  const lines: string[] = [];
  reply.blocks.forEach((block) => {
    if (block.type === 'text') lines.push(block.text);
    if (block.type === 'course') lines.push('', `*${block.title}*`, block.meta.join(' · '));
    if (block.type === 'facts') block.items.forEach(([label, value]) => lines.push(`${label}: ${value}`));
    if (block.type === 'list') {
      lines.push(`${block.title}:`);
      block.items.forEach((item) => lines.push(`- ${item}`));
    }
    if (block.type === 'table') {
      block.rows.forEach((row) => lines.push(`${row[0]}: ${row.slice(1).map((cellValue, index) => `${block.columns[index + 1]} ${cellValue}`).join(' | ')}`));
    }
    if (block.type === 'links') block.items.forEach((item) => lines.push(item.href.startsWith('mailto:') ? item.label : `${item.label}: ${item.href}`));
  });
  return lines.join('\n').trim();
};
