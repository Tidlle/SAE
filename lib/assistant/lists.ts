import { formatCurrency, foldText } from '../courses';
import { InstitutionProfile, profileFor } from '../institutionProfiles';
import { Catalog, Course, tokenize } from './catalog';
import { Answer, Block, Chip, Context, IES_WORDS, STOP, displayName, passesFilters, rank, set, shortName, splitCourseTokens, textReply } from './shared';

// Listas ("pós em Educação até R$ 2.000"), contagens ("quantos cursos a ESP tem?") e comparações (cursos e instituições).

const PAGE = 15;
const COUNT_WORDS = set('quantos quantas');
const LIST_NOISE = set(
  'lista listar liste listagem listem quais barato baratos barata baratas economico economicos caro caros cara caras curto curtos curta curtas rapido rapidos ' +
    'menor maior mais menos ate abaixo acima entre reais r hs horas hora longo longos eixo area areas',
);
const EXPLICIT_LIST = set('lista listar liste listagem listem barato baratos barata baratas economico economicos caro caros cara caras curto curtos curta curtas rapido rapidos quantos quantas');

const money = (value: number | null): string => (value === null ? '-' : formatCurrency(value));

// ---------------------------------------------------------------- valores e horas

const basePrice = (course: Course): number | null => course.unicive?.total ?? course.boleto.d30 ?? course.pix.d30 ?? course.cartao.d30;

const priceLabel = (course: Course): string => {
  const value = basePrice(course);
  if (value === null) return '-';
  return course.unicive?.total ? `${money(value)} (integral)` : money(value);
};

const hoursOf = (course: Course): number | null => {
  const match = /\d[\d.]*/.exec(course.carga);
  const value = match ? parseInt(match[0].replace(/\./g, ''), 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
};

const NUM = '(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d{1,2}))?';
const num = (match: RegExpExecArray, offset = 1): number => Number(match[offset].replace(/\./g, '') + (match[offset + 1] ? `.${match[offset + 1]}` : ''));

interface Limits {
  priceMin: number | null;
  priceMax: number | null;
  hoursMin: number | null;
  hoursMax: number | null;
}

// "até R$ 2.000", "acima de 3000", "entre 1.500 e 2.500", "com mais de 360 horas"
const parseLimits = (question: string): Limits => {
  const text = foldText(question).replace(/r\$\s*/g, '');
  const limits: Limits = { priceMin: null, priceMax: null, hoursMin: null, hoursMax: null };
  const unit = '(?!\\s*(?:x|meses|mes|anos)\\b)';
  const assign = (value: number, hours: boolean, kind: 'min' | 'max') => {
    if (hours) limits[kind === 'min' ? 'hoursMin' : 'hoursMax'] = value;
    else if (value >= 50) limits[kind === 'min' ? 'priceMin' : 'priceMax'] = value;
  };
  const isHours = (rest: string) => /^\s*(horas|hs|h)\b/.test(rest);
  const range = new RegExp(`entre\\s*${NUM}\\s*e\\s*${NUM}${unit}`).exec(text);
  if (range) {
    const low = num(range, 1);
    const high = num(range, 3);
    const hours = isHours(text.slice(range.index + range[0].length));
    assign(Math.min(low, high), hours, 'min');
    assign(Math.max(low, high), hours, 'max');
    return limits;
  }
  const max = new RegExp(`(?:ate|abaixo de|menos de|no maximo|maximo de|inferior a)\\s*${NUM}${unit}`).exec(text);
  if (max) assign(num(max), isHours(text.slice(max.index + max[0].length)), 'max');
  const min = new RegExp(`(?:acima de|mais de|a partir de|no minimo|minimo de|superior a)\\s*${NUM}${unit}`).exec(text);
  if (min) assign(num(min), isHours(text.slice(min.index + min[0].length)), 'min');
  return limits;
};

type Sort = 'price-asc' | 'price-desc' | 'hours-asc' | 'hours-desc' | null;

const parseSort = (question: string): Sort => {
  const text = foldText(question);
  if (/\b(barat\w*|economic\w*|menor (valor|preco)|mais em conta)\b/.test(text)) return 'price-asc';
  if (/\b(car[oa]s?|maior (valor|preco))\b/.test(text)) return 'price-desc';
  if (/\b(curt[oa]s?|rapid[oa]s?|menor carga)\b/.test(text)) return 'hours-asc';
  if (/\b(maior carga|mais long[oa]s?)\b/.test(text)) return 'hours-desc';
  return null;
};

const SORT_LABEL: Record<Exclude<Sort, null>, string> = {
  'price-asc': 'do menor para o maior valor',
  'price-desc': 'do maior para o menor valor',
  'hours-asc': 'da menor para a maior carga horária',
  'hours-desc': 'da maior para a menor carga horária',
};

// ---------------------------------------------------------------- lista e contagem

// Pergunta de lista: pede lista/ranking/contagem, tem limite de valor ou de horas, ou só traz filtros (IES, tipo, modalidade).
export const wantsList = (all: string[], tokens: string[], question: string, hasDocsOrInfo: boolean): boolean => {
  if (hasDocsOrInfo) return false;
  const { name, filters } = splitCourseTokens(tokens);
  const content = name.filter((token) => !LIST_NOISE.has(token) && !/^\d+$/.test(token));
  const hasFilters = Boolean(filters.ies || filters.modality || filters.tipo);
  const limits = parseLimits(question);
  const hasLimit = limits.priceMin !== null || limits.priceMax !== null || limits.hoursMin !== null || limits.hoursMax !== null;
  if (all.some((token) => EXPLICIT_LIST.has(token)) || parseSort(question) !== null || hasLimit) return true;
  return (all.includes('quais') && hasFilters) || (content.length === 0 && hasFilters);
};

const rowsFor = (courses: Course[]): string[][] => courses.map((course) => [shortName(displayName(course.name), 70), course.ies, course.modalidade || '-', priceLabel(course), course.carga || '-']);

const TABLE_COLUMNS = ['Curso', 'IES', 'Modalidade', 'Valor (D30 no boleto)', 'Carga'];

const TIPO_LABEL: Record<string, string> = {
  pos: 'pós-graduação',
  graduacao: 'graduação',
  licenciatura: 'licenciatura',
  bacharel: 'bacharelado',
  tecnolog: 'tecnólogo/tecnológico',
  extensao: 'extensão',
  capacitacao: 'capacitação',
  aperfeicoamento: 'aperfeiçoamento',
  atualizacao: 'atualização',
  livre: 'curso livre',
};

const pageReply = (catalog: Catalog, ids: number[], offset: number, title: string, note: string[], ctx: Context): Answer => {
  const slice = ids.slice(offset, offset + PAGE).map((id) => catalog.courses[id]);
  const next = offset + PAGE;
  const blocks: Block[] = [{ type: 'text', text: offset === 0 ? title : `Continuando a lista (${offset + 1} a ${offset + slice.length} de ${ids.length}):` }];
  note.forEach((text) => blocks.push({ type: 'text', tone: 'muted', text }));
  blocks.push({ type: 'table', columns: TABLE_COLUMNS, rows: rowsFor(slice) });
  const more = ids.length - next;
  if (more > 0) blocks.push({ type: 'text', tone: 'muted', text: `Mostrando ${offset + 1} a ${offset + slice.length} de ${ids.length}. Acrescente filtros (IES, modalidade, tipo ou valor) para reduzir a lista.` });
  const chips: Chip[] = [];
  if (more > 0) chips.push({ label: `Mostrar mais (${Math.min(PAGE, more)})`, query: '#l:more' });
  slice.slice(0, 3).forEach((course) => chips.push({ label: `Ver ${shortName(displayName(course.name), 40)}`, query: `#c:${course.id}` }));
  return {
    reply: { tag: 'lista', blocks, chips, sources: ['aba Cursos', ...(slice.some((course) => course.unicive) ? ['aba Valores UNICIVE'] : [])] },
    ctx: { ...ctx, kind: 'course', courseIds: [], pending: ['price'], listIds: ids, listOffset: next, listTitle: title },
  };
};

export const answerMore = (catalog: Catalog, ctx: Context): Answer => {
  if (ctx.listIds.length === 0 || ctx.listOffset >= ctx.listIds.length) {
    return { reply: textReply('lista:fim', 'Não há mais cursos nessa lista. Faça uma nova pergunta ou acrescente filtros.'), ctx };
  }
  return pageReply(catalog, ctx.listIds, ctx.listOffset, ctx.listTitle, [], ctx);
};

export const answerList = (catalog: Catalog, tokens: string[], all: string[], question: string, ctx: Context): Answer => {
  const { name, filters } = splitCourseTokens(tokens);
  const nameTokens = name.filter((token) => !LIST_NOISE.has(token) && !/^\d+$/.test(token));
  const limits = parseLimits(question);
  const sort = parseSort(question);
  const counting = all.some((token) => COUNT_WORDS.has(token));

  let pool = catalog.courses.filter((course) => passesFilters(course, filters));
  const notes: string[] = [];
  if (nameTokens.length > 0) {
    const eixoOnly = all.includes('eixo') || all.includes('area') || all.includes('areas');
    const byEixo = (list: Course[]) => rank(list.map((course) => ({ course, words: tokenize(course.eixo) })), nameTokens, true).map((entry) => entry.item.course);
    if (eixoOnly) {
      pool = byEixo(pool); // "área/eixo de Saúde": todos os cursos do eixo
    } else {
      const byName = rank(pool, nameTokens, true).map((entry) => entry.item);
      if (byName.length > 0) {
        pool = byName; // procura primeiro no nome do curso
        notes.push('Procurei pelo nome do curso. Para ver a área inteira, acrescente "eixo" (por exemplo: "cursos do eixo Saúde").');
      } else {
        pool = byEixo(pool);
        if (pool.length > 0) notes.push(`Nenhum nome de curso tem "${nameTokens.join(' ')}"; mostrei os cursos do eixo correspondente.`);
      }
    }
  }
  const hasPriceFilter = limits.priceMin !== null || limits.priceMax !== null || sort === 'price-asc' || sort === 'price-desc';
  if (hasPriceFilter) {
    const before = pool.length;
    pool = pool.filter((course) => basePrice(course) !== null);
    if (pool.length < before) notes.push(`${before - pool.length} curso(s) sem valor cadastrado ficaram de fora.`);
  }
  const beforeLimit = pool;
  if (limits.priceMax !== null) pool = pool.filter((course) => (basePrice(course) as number) <= (limits.priceMax as number));
  if (limits.priceMin !== null) pool = pool.filter((course) => (basePrice(course) as number) >= (limits.priceMin as number));
  const needsHours = limits.hoursMin !== null || limits.hoursMax !== null || sort === 'hours-asc' || sort === 'hours-desc';
  if (needsHours) {
    pool = pool.filter((course) => hoursOf(course) !== null);
    if (limits.hoursMax !== null) pool = pool.filter((course) => (hoursOf(course) as number) <= (limits.hoursMax as number));
    if (limits.hoursMin !== null) pool = pool.filter((course) => (hoursOf(course) as number) >= (limits.hoursMin as number));
  }
  if (sort === 'price-asc') pool = [...pool].sort((a, b) => (basePrice(a) as number) - (basePrice(b) as number));
  if (sort === 'price-desc') pool = [...pool].sort((a, b) => (basePrice(b) as number) - (basePrice(a) as number));
  if (sort === 'hours-asc') pool = [...pool].sort((a, b) => (hoursOf(a) as number) - (hoursOf(b) as number));
  if (sort === 'hours-desc') pool = [...pool].sort((a, b) => (hoursOf(b) as number) - (hoursOf(a) as number));

  const parts = [
    filters.ies,
    filters.tipo ? TIPO_LABEL[filters.tipo] ?? filters.tipo : '',
    filters.modality ? { ead: 'EAD', presencial: 'presencial', semi: 'semipresencial' }[filters.modality] ?? filters.modality : '',
    nameTokens.length > 0 ? `"${nameTokens.join(' ')}"` : '',
    limits.priceMax !== null ? `até ${money(limits.priceMax)}` : '',
    limits.priceMin !== null ? `a partir de ${money(limits.priceMin)}` : '',
    limits.hoursMax !== null ? `até ${limits.hoursMax} horas` : '',
    limits.hoursMin !== null ? `mais de ${limits.hoursMin} horas` : '',
  ].filter(Boolean);
  const scope = parts.length > 0 ? ` (${parts.join(' · ')})` : '';

  if (pool.length === 0) {
    let hint = '';
    if (beforeLimit.length > 0 && (limits.priceMax !== null || limits.priceMin !== null)) {
      const cheapest = [...beforeLimit].sort((a, b) => (basePrice(a) as number) - (basePrice(b) as number))[0];
      const dearest = [...beforeLimit].sort((a, b) => (basePrice(b) as number) - (basePrice(a) as number))[0];
      hint = ` Sem o limite de valor há ${beforeLimit.length} cursos, de ${money(basePrice(cheapest))} (${shortName(displayName(cheapest.name), 50)}) até ${money(basePrice(dearest))}.`;
    }
    // Sem cursos na modalidade pedida: mostra em quais modalidades existem
    if (!hint && filters.modality) {
      const others = catalog.courses.filter((course) => passesFilters(course, { ...filters, modality: '' }));
      if (others.length > 0) {
        const byModality = new Map<string, number>();
        others.forEach((course) => byModality.set(course.modalidade || '-', (byModality.get(course.modalidade || '-') ?? 0) + 1));
        hint = ` Com esses filtros, mas em outra modalidade, há ${others.length} cursos: ${[...byModality.entries()].map(([label, total]) => `${label} (${total})`).join(', ')}.`;
      }
    }
    return {
      reply: textReply('lista:vazia', `Não encontrei cursos com esses filtros${scope}.${hint || ' Tente tirar algum filtro (valor, modalidade ou tipo).'}`, [{ label: 'O que você sabe responder?', query: 'ajuda' }]),
      ctx,
    };
  }

  const ids = pool.map((course) => course.id);
  if (counting) {
    const countBy = (key: (course: Course) => string) => {
      const map = new Map<string, number>();
      pool.forEach((course) => map.set(key(course) || '-', (map.get(key(course) || '-') ?? 0) + 1));
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    };
    const blocks: Block[] = [{ type: 'text', text: `${pool.length} ${pool.length === 1 ? 'curso' : 'cursos'}${scope}.` }];
    if (!filters.tipo) blocks.push({ type: 'table', columns: ['Tipo', 'Cursos'], rows: countBy((course) => course.tipo).slice(0, 10).map(([label, total]) => [label, String(total)]) });
    if (!filters.ies) blocks.push({ type: 'table', columns: ['IES', 'Cursos'], rows: countBy((course) => course.ies).map(([label, total]) => [label, String(total)]) });
    if (!filters.modality) blocks.push({ type: 'table', columns: ['Modalidade', 'Cursos'], rows: countBy((course) => course.modalidade).map(([label, total]) => [label, String(total)]) });
    return {
      reply: { tag: 'lista:contagem', blocks, chips: [{ label: 'Ver a lista', query: '#l:more' }], sources: ['aba Cursos'] },
      ctx: { ...ctx, listIds: ids, listOffset: 0, listTitle: `${pool.length} cursos${scope}:` },
    };
  }

  const title = `${pool.length} ${pool.length === 1 ? 'curso' : 'cursos'}${scope}${sort ? `, ordenados ${SORT_LABEL[sort]}` : ''}:`;
  return pageReply(catalog, ids, 0, title, notes, ctx);
};

// ---------------------------------------------------------------- comparação

export const COMPARE_WORDS = set('comparar compare comparacao compara diferenca diferencas versus vs');

export const wantsCompare = (all: string[]): boolean => all.some((token) => COMPARE_WORDS.has(token)) || all.includes('x');

type Side = { kind: 'course'; course: Course; average: number } | { kind: 'inst'; key: string };

const PROFILE_NAME: Record<string, string> = { ESP: 'ESP', ALPHA: 'Alpha Channel', UCESP: 'UCESP', UNICIVE: 'UNICIVE', ITEQ: 'ITEQ', FAEP: 'FAEP' };

const resolveSide = (catalog: Catalog, text: string, inherit?: { name: string[] }): Side | null => {
  const tokens = tokenize(text).filter((token) => !STOP.has(token) && !COMPARE_WORDS.has(token) && token !== 'entre');
  if (tokens.length === 0) return null;
  const { name, filters } = splitCourseTokens(tokens);
  const onlyInstitution = name.length === 0 && filters.ies && !filters.modality && !filters.tipo;
  if (onlyInstitution && !inherit) return { kind: 'inst', key: filters.ies };
  const nameTokens = name.length > 0 ? name : inherit?.name ?? [];
  if (nameTokens.length === 0) return null;
  const ranked = rank(catalog.courses.filter((course) => passesFilters(course, filters)), nameTokens, true);
  if (ranked.length === 0) return null;
  return { kind: 'course', course: ranked[0].item, average: ranked[0].average };
};

const SEPARATORS = [/\s+(?:x|vs|versus)\s+/, /\s+ou\s+/, /\s+com\s+/, /\s+e\s+/];

const findSides = (catalog: Catalog, question: string): [Side, Side] | null => {
  const text = foldText(question).replace(/[?!.,;]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = text.replace(/^(?:.*?\b)?(?:comparar|compare|comparacao|compara|diferencas?|diferenca)\b\s*(?:entre\s+)?/, '').replace(/^entre\s+/, '');
  let best: { sides: [Side, Side]; score: number } | null = null;
  for (const separator of SEPARATORS) {
    const regex = new RegExp(separator.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleaned)) !== null) {
      const left = cleaned.slice(0, match.index);
      const right = cleaned.slice(match.index + match[0].length);
      const a = resolveSide(catalog, left);
      if (!a) continue;
      const b = resolveSide(catalog, right, a.kind === 'course' ? { name: tokenize(left).filter((token) => !STOP.has(token) && !IES_WORDS[token]) } : undefined);
      if (!b || a.kind !== b.kind) continue;
      const score = a.kind === 'course' && b.kind === 'course' ? Math.min(a.average, (b as { average: number }).average) : 1;
      if (!best || score > best.score) best = { sides: [a, b], score };
    }
    if (best && best.score >= 0.9) break;
  }
  return best ? best.sides : null;
};

const courseRows = (a: Course, b: Course): string[][] => {
  const rows: string[][] = [];
  const add = (label: string, x: string, y: string) => {
    if (x || y) rows.push([label, x || '-', y || '-']);
  };
  add('IES', a.ies, b.ies);
  add('Tipo', a.tipo, b.tipo);
  add('Modalidade', a.modalidade, b.modalidade);
  add('Eixo', a.eixo, b.eixo);
  add('Carga horária', a.carga, b.carga);
  add('Duração', a.duracao, b.duracao);
  add('Titulação', a.titulacao, b.titulacao);
  add('Emissão', a.emissao, b.emissao);
  add('Estágio', a.estagio, b.estagio);
  add('Artigo', a.artigo, b.artigo);
  const valor = (c: Course) => (c.unicive?.total ? `${money(c.unicive.total)} (integral)` : c.boleto.d30 !== null ? money(c.boleto.d30) : '');
  add('Valor (D30 no boleto)', valor(a), valor(b));
  add('Valor no pix (D30)', a.pix.d30 !== null ? money(a.pix.d30) : '', b.pix.d30 !== null ? money(b.pix.d30) : '');
  add('Com desconto de pontualidade (boleto)', a.boleto.punctual !== null ? money(a.boleto.punctual) : '', b.boleto.punctual !== null ? money(b.boleto.punctual) : '');
  const parcels = (c: Course) => [c.parcelasBoleto ? `até ${c.parcelasBoleto}x no boleto` : '', c.parcelasCartao ? `até ${c.parcelasCartao}x no cartão` : ''].filter(Boolean).join(' · ');
  add('Parcelamento', parcels(a), parcels(b));
  if (a.unicive || b.unicive) {
    const cash = (c: Course) => (c.unicive?.cash ? money(c.unicive.cash) : '');
    add('Pagamento à vista (UNICIVE)', cash(a), cash(b));
  }
  add('Taxa de inscrição', a.fee !== null ? money(a.fee) : '', b.fee !== null ? money(b.fee) : '');
  return rows;
};

const instRows = (a: InstitutionProfile, b: InstitutionProfile): string[][] => [
  ['Tipo', a.kind, b.kind],
  ['Modalidades', a.modalities.join(', ') || '-', b.modalities.join(', ') || '-'],
  ['Local', a.location || '-', b.location || '-'],
  ['Tradição', a.tradition || '-', b.tradition || '-'],
  ['Principais números', a.stats.slice(0, 2).map((stat) => `${stat.value} ${stat.label}`).join('; ') || '-', b.stats.slice(0, 2).map((stat) => `${stat.value} ${stat.label}`).join('; ') || '-'],
  ['Diferenciais', a.highlights.slice(0, 3).join('; '), b.highlights.slice(0, 3).join('; ')],
  ['Credenciamento', a.accreditation, b.accreditation],
];

export const answerCompare = (catalog: Catalog, question: string, ctx: Context): Answer => {
  const sides = findSides(catalog, question);
  if (!sides) {
    return {
      reply: textReply(
        'comparar:nao-entendi',
        'Não consegui identificar os dois itens a comparar. Diga os dois nomes, por exemplo: "comparar Pedagogia ESP com Pedagogia UCESP" ou "diferença entre ESP e UCESP".',
        [
          { label: 'Pedagogia ESP x UCESP', query: 'comparar Pedagogia ESP com Pedagogia UCESP' },
          { label: 'ESP x UCESP', query: 'diferença entre ESP e UCESP' },
        ],
      ),
      ctx,
    };
  }
  const [left, right] = sides;

  if (left.kind === 'inst' && right.kind === 'inst') {
    const nameA = PROFILE_NAME[left.key] ?? left.key;
    const nameB = PROFILE_NAME[right.key] ?? right.key;
    const a = profileFor(nameA);
    const b = profileFor(nameB);
    if (!a || !b) {
      return { reply: textReply('comparar:sem-perfil', `Ainda não tenho a apresentação da ${!a ? nameA : nameB} no SAE, então não consigo compará-la.`), ctx };
    }
    return {
      reply: {
        tag: 'comparar:instituicoes',
        blocks: [
          { type: 'text', text: `${a.fullName} x ${b.fullName}` },
          { type: 'table', columns: ['', nameA, nameB], rows: instRows(a, b) },
        ],
        chips: [
          { label: `Cursos da ${nameA}`, query: `listar cursos da ${nameA}` },
          { label: `Cursos da ${nameB}`, query: `listar cursos da ${nameB}` },
        ],
        sources: ['apresentação das instituições (Home)'],
      },
      ctx,
    };
  }

  if (left.kind === 'course' && right.kind === 'course') {
    const a = left.course;
    const b = right.course;
    if (a.id === b.id) {
      return { reply: textReply('comparar:igual', 'Os dois nomes levam ao mesmo curso. Acrescente a IES, a modalidade ou o tipo para diferenciar (por exemplo: "Pedagogia ESP com Pedagogia UCESP").'), ctx };
    }
    const priceA = basePrice(a);
    const priceB = basePrice(b);
    const blocks: Block[] = [
      { type: 'text', text: `A: ${displayName(a.name)} (${a.ies})` },
      { type: 'text', text: `B: ${displayName(b.name)} (${b.ies})` },
      { type: 'table', columns: ['', 'A', 'B'], rows: courseRows(a, b) },
    ];
    if (priceA !== null && priceB !== null && priceA !== priceB) {
      const cheaper = priceA < priceB ? 'A' : 'B';
      blocks.push({ type: 'text', text: `No valor de referência (D30 no boleto, ou integral na UNICIVE), o curso ${cheaper} é mais barato em ${money(Math.abs(priceA - priceB))}.` });
    }
    if (left.average < 0.9 || right.average < 0.9) {
      blocks.push({ type: 'text', tone: 'muted', text: 'Escolhi os cursos mais parecidos com os nomes. Se não for o que você queria, acrescente a IES, a modalidade ou o tipo.' });
    }
    return {
      reply: {
        tag: 'comparar:cursos',
        blocks,
        chips: [
          { label: 'Ver valores de A', query: `#c:${a.id}` },
          { label: 'Ver valores de B', query: `#c:${b.id}` },
        ],
        sources: ['aba Cursos', ...(a.unicive || b.unicive ? ['aba Valores UNICIVE'] : [])],
      },
      ctx: { ...ctx, pending: ['price'] },
    };
  }

  return { reply: textReply('comparar:misto', 'Só consigo comparar dois cursos ou duas instituições por vez, e não um de cada tipo.'), ctx };
};

