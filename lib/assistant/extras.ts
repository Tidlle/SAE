import { Catalog, PresentialClass, SimulatorRow, tokenize } from './catalog';
import { IES_CONTACTS, NUCLEO_INFO, NUCLEO_OPTIONS } from '../contacts';
import { foldText } from '../courses';
import { Answer, Block, Chip, Context, IES_WORDS, STOP, rank, set, shortName, textReply, wordScore } from './shared';

// Contatos, turmas presenciais e Simulador: as três consultas além de valores, combos e documentos.

// ---------------------------------------------------------------- reconhecimento da pergunta

const CONTACT_WORDS = set('contato contatos email emails mail telefone telefones whatsapp ramal setor setores responsavel quem falar cuida cuidar resolve atende');
const NUCLEO_WORDS: Record<string, string> = {
  financeiro: 'financeiro',
  financeira: 'financeiro',
  coordenacao: 'coordenacao',
  secretaria: 'coordenacao',
  certificacao: 'certificacao',
  documentacao: 'documentacao',
  rh: 'rh',
  pessoal: 'rh',
  qualidade: 'qualidade',
  licenciaturas: 'licenciatura',
  r2: 'licenciatura',
};
// "licenciaturas" e "r2" também são tipos de curso: só valem como setor quando a pergunta já é de contato
const AMBIGUOUS_NUCLEO = new Set(['licenciaturas', 'r2']);
const NUCLEO_ABOUT = set('faz fazem atribuicoes atividades responsabilidades funcoes funcao cuida');
const CLASS_WORDS = set('turma turmas vaga vagas polo polos cronograma cronogramas inicio comeca');
const POLO_WORDS: Record<string, string> = { itaquera: 'itaquera', santos: 'santos', aracatuba: 'aracatuba' };
const STATUS_WORDS: Record<string, PresentialClass['statusKind']> = {
  aberta: 'open',
  abertas: 'open',
  aberto: 'open',
  abertos: 'open',
  vagas: 'open',
  aguardando: 'waiting',
  espera: 'waiting',
  fechada: 'closed',
  fechadas: 'closed',
  encerrada: 'closed',
  encerradas: 'closed',
  lotada: 'closed',
  lotadas: 'closed',
};
const SIM_WORDS = set('aproveitar aproveito aproveitam aproveitamento simulador simular equivalencia equivale');
const SIM_NOISE = set('formado formada graduado graduada concluiu cursou tenho sou posso fazer quero queria cursar estudar curso cursos origem origens permite permitem destino destinos');

const anyIn = (tokens: string[], words: Set<string>) => tokens.some((token) => words.has(token));

export const wantsSimulator = (all: string[], hasCourseIntent: boolean): boolean =>
  anyIn(all, new Set(['aproveitar', 'aproveito', 'aproveitam', 'simulador', 'simular', 'equivalencia', 'equivale'])) ||
  (all.includes('aproveitamento') && !hasCourseIntent && !all.includes('graduacao'));

export const wantsClass = (all: string[], hasCourseIntent: boolean): boolean =>
  anyIn(all, CLASS_WORDS) || (all.some((token) => POLO_WORDS[token]) && !hasCourseIntent);

export const wantsContact = (all: string[], hasCourseIntent: boolean): boolean =>
  anyIn(all, CONTACT_WORDS) || (!hasCourseIntent && all.length <= 5 && all.some((token) => NUCLEO_WORDS[token] && !AMBIGUOUS_NUCLEO.has(token)));

// ---------------------------------------------------------------- contatos

const nucleoLabel = (key: string): string => NUCLEO_OPTIONS.find((option) => option.value === key)?.label ?? key;
const IES_KEYS: Record<string, string> = { ESP: 'esp', ALPHA: 'alpha-chanel', UCESP: 'ucesp' };

interface ContactEntry {
  iesKey: string;
  ies: string;
  label: string;
  email: string;
  words: string[];
}

const CONTACT_ENTRIES: ContactEntry[] = Object.entries(IES_CONTACTS).flatMap(([iesKey, ies]) =>
  ies.emails.map((entry) => ({
    iesKey,
    ies: ies.name,
    label: entry.label,
    email: entry.email,
    words: tokenize(`${entry.label} ${entry.email.split('@')[0]}`),
  })),
);

const FINANCE_EMAILS = [
  { label: 'Financeiro: financeiro01@iteqescolas.com.br', href: 'mailto:financeiro01@iteqescolas.com.br' },
  { label: 'Negociação: negociacao@iteqescolas.com.br', href: 'mailto:negociacao@iteqescolas.com.br' },
];

const contactTable = (entries: ContactEntry[], singleIes: boolean): Block[] => {
  // E-mail igual em todas as IES (ex.: Financeiro) vira uma linha só
  const groups = new Map<string, { label: string; email: string; ies: string[] }>();
  entries.forEach((entry) => {
    const key = `${foldText(entry.label)}|${entry.email}`;
    const group = groups.get(key) ?? { label: entry.label, email: entry.email, ies: [] };
    group.ies.push(entry.ies);
    groups.set(key, group);
  });
  const total = new Set(entries.map((entry) => entry.ies)).size;
  const all = [...groups.values()];
  if (singleIes) return [{ type: 'table', columns: ['Assunto', 'E-mail'], rows: all.map((group) => [group.label, group.email]) }];
  return [
    {
      type: 'table',
      columns: ['IES', 'Assunto', 'E-mail'],
      rows: all.map((group) => [group.ies.length === total && total > 1 ? 'Todas' : group.ies.join(', '), group.label, group.email]),
    },
  ];
};

const contactChips = (): Chip[] => [
  { label: 'E-mail de diplomas da UCESP', query: 'email de diplomas da UCESP' },
  { label: 'Contato do financeiro', query: 'contato do financeiro' },
  { label: 'Quem cuida de trancamento?', query: 'quem cuida de trancamento' },
];

export const answerContact = (all: string[], ctx: Context): Answer => {
  const sources = ['página Contatos'];
  const tokens = all.filter((token) => !STOP.has(token) && !CONTACT_WORDS.has(token));
  const requestedIes = [...new Set(tokens.map((token) => IES_WORDS[token]).filter(Boolean))];
  const iesKeys = requestedIes.map((ies) => IES_KEYS[ies]).filter(Boolean);
  const unsupported = requestedIes.filter((ies) => !IES_KEYS[ies]);
  const subject = tokens.filter((token) => !IES_WORDS[token] && token !== 'channel');
  const noteBlocks: Block[] =
    unsupported.length > 0
      ? [{ type: 'text', tone: 'muted', text: `A página Contatos não tem e-mails da ${unsupported.join(' e ')}. Mostrando o que existe para as demais IES.` }]
      : [];
  const pool = CONTACT_ENTRIES.filter((entry) => iesKeys.length === 0 || iesKeys.includes(entry.iesKey));
  const singleIes = iesKeys.length === 1;
  const done = (tag: string, blocks: Block[], chips: Chip[] = []): Answer => ({
    reply: { tag, blocks: [...noteBlocks, ...blocks], chips, sources },
    ctx,
  });

  // "O que o Financeiro faz?"
  const nucleoKey = subject.map((token) => NUCLEO_WORDS[token]).find(Boolean);
  if (nucleoKey && anyIn(all, NUCLEO_ABOUT) && NUCLEO_INFO[nucleoKey]) {
    return done('contato:nucleo', [
      { type: 'list', title: `O que faz: ${nucleoLabel(nucleoKey)}`, items: NUCLEO_INFO[nucleoKey] },
      ...(nucleoKey === 'financeiro' ? [{ type: 'links' as const, items: FINANCE_EMAILS }] : []),
    ]);
  }

  if (subject.length === 0) {
    if (iesKeys.length > 0) {
      return done('contato:ies', [{ type: 'text', text: `E-mails da ${pool[0]?.ies ?? 'IES'} por assunto:` }, ...contactTable(pool, singleIes)]);
    }
    return done('contato:pergunta', [{ type: 'text', text: 'De qual assunto e de qual IES? Por exemplo: "e-mail de diplomas da UCESP" ou "contato do financeiro".' }], contactChips());
  }

  // E-mails: cada palavra do assunto precisa casar com o rótulo ou com o nome do e-mail
  const scored = pool.map((entry) => ({
    entry,
    count: subject.filter((token) => entry.words.some((word) => wordScore(token, word, false) >= 0.85)).length,
  }));
  const best = Math.max(0, ...scored.map((item) => item.count));
  if (best > 0) {
    const matches = scored.filter((item) => item.count === best).map((item) => item.entry).slice(0, 10);
    const chips: Chip[] = nucleoKey ? [{ label: `O que o ${nucleoLabel(nucleoKey)} faz?`, query: `o que o ${nucleoLabel(nucleoKey)} faz` }] : [];
    return done('contato:email', [{ type: 'text', text: singleIes ? `E-mails da ${matches[0].ies}:` : 'Encontrei estes contatos:' }, ...contactTable(matches, singleIes)], chips);
  }

  // Quem cuida de um assunto (busca nas atribuições dos núcleos)
  const candidates: { key: string; line: string; count: number }[] = [];
  Object.entries(NUCLEO_INFO).forEach(([key, lines]) =>
    lines.forEach((line) => {
      const words = tokenize(line);
      const count = subject.filter((token) => words.some((word) => wordScore(token, word, false) >= 0.85 || (token.length >= 5 && word.includes(token)))).length;
      if (count > 0) candidates.push({ key, line: line.replace(/[;.]$/, ''), count });
    }),
  );
  if (candidates.length > 0) {
    const top = Math.max(...candidates.map((item) => item.count));
    const winners = candidates.filter((item) => item.count === top);
    const keys = [...new Set(winners.map((item) => item.key))].slice(0, 2);
    const blocks: Block[] = [];
    keys.forEach((key) => {
      blocks.push({
        type: 'list',
        title: `Quem cuida: ${nucleoLabel(key)}`,
        items: winners.filter((item) => item.key === key).slice(0, 3).map((item) => item.line),
      });
      if (key === 'financeiro') blocks.push({ type: 'links', items: FINANCE_EMAILS });
    });
    blocks.push({ type: 'text', tone: 'muted', text: 'Para o e-mail do setor em cada IES, pergunte por exemplo "e-mail de qualidade da ESP", ou abra a página Contatos.' });
    blocks.push({ type: 'links', items: [{ label: 'Abrir Contatos', href: '/contatos' }] });
    return done('contato:setor', blocks);
  }

  return done(
    'contato:nao-achei',
    [
      { type: 'text', text: 'Não achei esse assunto nos contatos. Tente com outras palavras (diplomas, financeiro, qualidade, secretaria, artigo...) e diga a IES.' },
      { type: 'links', items: [{ label: 'Abrir Contatos', href: '/contatos' }] },
    ],
    contactChips(),
  );
};

// ---------------------------------------------------------------- turmas presenciais

const STATUS_LABEL: Record<PresentialClass['statusKind'], string> = {
  open: 'abertas para inclusão',
  waiting: 'aguardando abertura',
  closed: 'sem vagas',
  other: '',
};

const classBlocks = (item: PresentialClass): Block[] => {
  const facts: [string, string][] = [];
  const add = (label: string, value: string) => value && facts.push([label, value]);
  add('Turma', item.turma);
  add('Situação', item.status);
  add('Alunos cadastrados', item.students);
  add('Início / limite para inclusão', item.start);
  add('Artigo', item.artigo);
  add('Estágio', item.estagio);
  add('Observação', item.note);
  const links: { label: string; href: string }[] = [];
  if (item.schedule) links.push({ label: 'Cronograma', href: item.schedule });
  if (item.calendar) links.push({ label: 'Calendário', href: item.calendar });
  return [
    { type: 'course', title: item.name, meta: [item.tipo, item.polo].filter(Boolean) },
    { type: 'facts', items: facts },
    ...(links.length > 0 ? [{ type: 'links' as const, items: links }] : []),
  ];
};

const classRows = (items: PresentialClass[]): string[][] =>
  items.map((item) => [shortName(item.name, 60), item.turma || '-', item.polo || '-', item.status || '-']);

const classChips = (polo: string, status: string): Chip[] => {
  const chips: Chip[] = [];
  if (!status) chips.push({ label: 'Só turmas abertas', query: `turmas abertas${polo ? ' ' + polo : ''}` });
  if (polo !== 'itaquera') chips.push({ label: 'Turmas em Itaquera', query: 'turmas em Itaquera' });
  if (polo !== 'santos') chips.push({ label: 'Turmas em Santos', query: 'turmas em Santos' });
  if (polo !== 'aracatuba') chips.push({ label: 'Turmas em Araçatuba', query: 'turmas em Araçatuba' });
  return chips;
};

const COURSE_TYPE_WORDS = set('pos graduacao presencial semipresencial ead licenciatura bacharelado tecnologo tecnologico extensao capacitacao curso livre residencia');

export const answerClass = (catalog: Catalog, all: string[], ctx: Context): Answer => {
  const polo = all.map((token) => POLO_WORDS[token]).find(Boolean) ?? '';
  const statusKind = all.map((token) => STATUS_WORDS[token]).find(Boolean) ?? null;
  const hasPrice = all.some((token) => ['valor', 'valores', 'preco', 'custa', 'quanto', 'mensalidade'].includes(token));
  // "turmas dessa": usa o curso da conversa
  const refersBack = all.some((token) => ['dessa', 'desse', 'desta', 'deste', 'disso'].includes(token));
  const lastCourse = ctx.courseIds.length > 0 ? catalog.courses[ctx.courseIds[0]] : undefined;
  const fromContext = refersBack && lastCourse
    ? lastCourse.words.filter((word) => !STOP.has(word) && !COURSE_TYPE_WORDS.has(word) && !POLO_WORDS[word]).slice(0, 4)
    : [];
  const name = fromContext.length > 0 ? fromContext : all.filter(
    (token) =>
      !STOP.has(token) &&
      !CLASS_WORDS.has(token) &&
      !POLO_WORDS[token] &&
      !STATUS_WORDS[token] &&
      !IES_WORDS[token] &&
      !['presencial', 'presenciais', 'valor', 'valores', 'preco', 'custa', 'mensalidade', 'curso', 'cursos', 'em', 'de'].includes(token),
  );
  const sources = ['aba Cursos-Presenciais'];
  // A situação ("abertas") só filtra listas: com o nome de um curso, a resposta mostra a situação da turma, qualquer que seja.
  const pool = catalog.presential.filter((item) => (!polo || foldText(item.polo) === polo) && (name.length > 0 || !statusKind || item.statusKind === statusKind));
  const poloLabel = polo ? catalog.presential.find((item) => foldText(item.polo) === polo)?.polo ?? '' : '';
  const link: Block = { type: 'links', items: [{ label: 'Abrir Presenciais', href: '/cursos/presenciais' }] };
  const priceNote: Block[] = hasPrice ? [{ type: 'text', tone: 'muted', text: 'Os valores dos cursos presenciais estão na aba Cursos. Pergunte, por exemplo, "valor de Estética Clínica Avançada Itaquera".' }] : [];

  if (name.length === 0) {
    if (pool.length === 0) {
      return { reply: textReply('turmas:vazio', 'Não há turmas presenciais com esse filtro na planilha.', classChips('', ''), [link]), ctx };
    }
    const order = { open: 0, waiting: 1, closed: 2, other: 3 };
    const sorted = [...pool].sort((a, b) => order[a.statusKind] - order[b.statusKind] || a.polo.localeCompare(b.polo, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'));
    const shown = sorted.slice(0, 15);
    const title = `${pool.length} ${pool.length === 1 ? 'turma' : 'turmas'}${statusKind ? ' ' + STATUS_LABEL[statusKind] : ''}${poloLabel ? ' em ' + poloLabel : ''}`;
    return {
      reply: {
        tag: 'turmas:lista',
        blocks: [
          ...priceNote,
          { type: 'text', text: `${title}:` },
          { type: 'table', columns: ['Curso', 'Turma', 'Polo', 'Situação'], rows: classRows(shown) },
          ...(pool.length > shown.length ? [{ type: 'text' as const, tone: 'muted' as const, text: `Mostrando ${shown.length} de ${pool.length}. Diga o nome do curso para ver o cronograma e os detalhes.` }] : [{ type: 'text' as const, tone: 'muted' as const, text: 'Diga o nome de um curso para ver o cronograma e os detalhes da turma.' }]),
        ],
        chips: classChips(polo, statusKind ? 'x' : ''),
        sources,
      },
      ctx,
    };
  }

  const ranked = rank(pool, name, true);
  if (ranked.length === 0) {
    return {
      reply: textReply('turmas:nao-achei', `Não encontrei turma presencial de "${name.join(' ')}"${poloLabel ? ' em ' + poloLabel : ''}. Confira a grafia ou veja a lista completa.`, classChips(polo, ''), [link]),
      ctx,
    };
  }
  const best = ranked[0].score;
  const strong = ranked.filter((entry) => entry.score >= best - 0.12).map((entry) => entry.item);
  if (strong.length <= 4) {
    return {
      reply: { tag: 'turmas:curso', blocks: [...priceNote, ...strong.flatMap(classBlocks)], chips: classChips(polo, ''), sources },
      ctx,
    };
  }
  const shown = strong.slice(0, 12);
  return {
    reply: {
      tag: 'turmas:lista',
      blocks: [
        ...priceNote,
        { type: 'text', text: `Encontrei ${strong.length} turmas para "${name.join(' ')}":` },
        { type: 'table', columns: ['Curso', 'Turma', 'Polo', 'Situação'], rows: classRows(shown) },
        { type: 'text', tone: 'muted', text: 'Acrescente o polo (Itaquera, Santos, Araçatuba) ou mais palavras do nome para ver o cronograma de uma turma.' },
      ],
      chips: classChips(polo, ''),
      sources,
    },
    ctx,
  };
};

// ---------------------------------------------------------------- simulador

const simulatorLink: Block = { type: 'links', items: [{ label: 'Abrir Simulador', href: '/simulador' }] };

const originAnswer = (row: SimulatorRow, destTokens: string[], ctx: Context): Answer => {
  const sources = ['aba Simulador'];
  const header: Block = { type: 'course', title: row.origin, meta: ['Curso de origem'] };
  if (row.destinations.length === 0) {
    return {
      reply: {
        tag: 'simulador:vazio',
        blocks: [header, { type: 'text', tone: 'warn', text: 'Ainda não há curso de destino cadastrado no Simulador para esta origem.' }, simulatorLink],
        chips: [],
        sources,
      },
      ctx,
    };
  }
  const table: Block = { type: 'table', columns: ['Curso de destino', 'Prazo para conclusão'], rows: row.destinations.map((destination) => [destination.name, destination.prazo || 'não informado']) };
  if (destTokens.length > 0) {
    const matches = row.destinations.filter((destination) => {
      const words = tokenize(destination.name);
      return destTokens.every((token) => words.some((word) => wordScore(token, word, true) >= 0.6));
    });
    if (matches.length > 0) {
      return {
        reply: {
          tag: 'simulador:sim',
          blocks: [
            header,
            { type: 'text', text: `Sim, é possível: ${row.origin} permite ${matches.map((destination) => `${destination.name}${destination.prazo ? ` (prazo: ${destination.prazo})` : ' (prazo não informado)'}`).join('; ')}.` },
          ],
          chips: [],
          sources,
        },
        ctx,
      };
    }
    return {
      reply: {
        tag: 'simulador:nao',
        blocks: [header, { type: 'text', text: `Não consta "${destTokens.join(' ')}" entre os destinos cadastrados para esta origem. Os destinos cadastrados são:` }, table, simulatorLink],
        chips: [],
        sources,
      },
      ctx,
    };
  }
  return { reply: { tag: 'simulador:destinos', blocks: [header, { type: 'text', text: 'Quem cursou esta origem pode aproveitar estudos para:' }, table, simulatorLink], chips: [], sources }, ctx };
};

export const answerOrigin = (catalog: Catalog, id: number, ctx: Context): Answer | null => {
  const row = catalog.simulator[id];
  if (!row) return null;
  return originAnswer(row, ctx.simDest ? ctx.simDest.split(' ') : [], { ...ctx, simDest: '' });
};

export const answerSimulator = (catalog: Catalog, all: string[], ctx: Context): Answer => {
  const split = all.indexOf('para');
  const clean = (tokens: string[]) => tokens.filter((token) => !STOP.has(token) && !SIM_WORDS.has(token) && !SIM_NOISE.has(token));
  const originTokens = clean(split === -1 ? all : all.slice(0, split));
  const destTokens = split === -1 ? [] : clean(all.slice(split + 1));
  const sources = ['aba Simulador'];

  if (originTokens.length === 0) {
    // "Quais origens permitem Pedagogia?"
    if (destTokens.length > 0) {
      const origins = catalog.simulator.filter((row) =>
        row.destinations.some((destination) => {
          const words = tokenize(destination.name);
          return destTokens.every((token) => words.some((word) => wordScore(token, word, true) >= 0.6));
        }),
      );
      if (origins.length > 0) {
        return {
          reply: {
            tag: 'simulador:origens',
            blocks: [{ type: 'text', text: `Origens que permitem aproveitar para "${destTokens.join(' ')}":` }, { type: 'list', title: 'Cursos de origem', items: origins.map((row) => row.origin) }, simulatorLink],
            chips: [],
            sources,
          },
          ctx,
        };
      }
    }
    return {
      reply: textReply('simulador:pede-origem', 'Diga o curso de origem. Por exemplo: "posso aproveitar Bacharelado em Administração para Pedagogia?".', [
        { label: 'Aproveitar Administração para Pedagogia', query: 'posso aproveitar Bacharelado em Administração para Pedagogia' },
      ], [simulatorLink]),
      ctx,
    };
  }

  const ranked = rank(catalog.simulator, originTokens, true);
  if (ranked.length === 0) {
    return { reply: textReply('simulador:origem-nao-achada', `Não encontrei "${originTokens.join(' ')}" entre os cursos de origem do Simulador.`, [], [simulatorLink]), ctx };
  }
  const best = ranked[0].score;
  const strong = ranked.filter((entry) => entry.score >= best - 0.08).map((entry) => entry.item);
  // Origem com exatamente as palavras da pergunta ("Bacharelado em Administração") vence as parecidas ("... Pública")
  const wanted = new Set(originTokens);
  const exact = strong.filter((row) => {
    const content = row.words.filter((word) => !STOP.has(word));
    return content.length === wanted.size && content.every((word) => wanted.has(word));
  });
  if (strong.length === 1 || exact.length === 1) return originAnswer(exact.length === 1 ? exact[0] : strong[0], destTokens, ctx);
  return {
    reply: {
      tag: 'simulador:lista',
      blocks: [
        { type: 'text', text: `Encontrei ${strong.length} cursos de origem para "${originTokens.join(' ')}". Qual deles?` },
      ],
      chips: strong.slice(0, 8).map((row) => ({ label: shortName(row.origin, 80), query: `#o:${row.id}` })),
      sources,
    },
    ctx: { ...ctx, simDest: destTokens.join(' ') },
  };
};
