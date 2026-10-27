import { callScript } from '../feed';
import { IES_CONTACTS, NUCLEO_INFO, NUCLEO_OPTIONS } from '../contacts';
import { InstitutionProfile, PRESENTATION_ORDER, profileFor } from '../institutionProfiles';
import { VIDEOS, watchUrl } from '../videos';
import { FORMS_DATA } from '../registrationForms';
import { EDUCATION_OPTIONS, eligibleTypes } from '../quizRules';
import { formatCurrency } from '../courses';
import { Agenda } from './calendar';
import { Catalog, Course, Notice, tokenize } from './catalog';
import { Block, Reply, STOP, set, wordScore } from './shared';

// Reserva com IA: só entra quando a base do SAE não consegue responder. O site monta um contexto com os dados do SAE
// (cursos, combos, turmas, memorandos, contatos...) e o Apps Script repassa à IA. A chave da IA fica só no Apps Script.

// Respostas do motor que significam "não consegui responder" e podem ir para a IA.
export const AI_FALLBACK_TAGS = new Set([
  'nao-entendi',
  'curso-nao-achado',
  'comparar:nao-entendi',
  'turmas:nao-achei',
  'simulador:origem-nao-achada',
  'contato:nao-achei',
  'video:nao-achei',
  'assunto-fora',
]);

export const AI_SOURCE = 'IA (Claude Sonnet 5), com base nos dados do SAE';

// ---------------------------------------------------------------- privacidade

// CPF, CNPJ, e-mail e telefone digitados na pergunta não saem do SAE.
export const redactPersonalData = (value: string): string =>
  value
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF removido]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ removido]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail removido]')
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, '[telefone removido]');

// ---------------------------------------------------------------- contexto

const cut = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const one = (value: string): string => value.replace(/\s+/g, ' ').trim();
const brl = (value: number | null): string => (value === null ? 'não cadastrado' : formatCurrency(value));

const courseLine = (course: Course): string => {
  const parts = [course.name, course.ies, course.tipo, course.modalidade, course.eixo ? `eixo ${course.eixo}` : '', course.carga ? `carga ${course.carga}` : '', course.duracao ? `duração ${course.duracao}` : ''];
  if (course.unicive) {
    const u = course.unicive;
    parts.push(`valores: integral ${brl(u.total)}, parcela ${brl(u.installment)} x ${u.installments ?? '?'}, à vista ${brl(u.cash)}, taxa ${brl(u.fee)}`);
  } else {
    parts.push(
      `valores: D30 boleto ${brl(course.boleto.d30)}, pix ${brl(course.pix.d30)}, cartão ${brl(course.cartao.d30)}; com desconto de pontualidade boleto ${brl(course.boleto.punctual)}, pix ${brl(course.pix.punctual)}; parcelas até ${course.parcelasBoleto ?? '?'}x boleto e ${course.parcelasCartao ?? '?'}x cartão; taxa de inscrição ${brl(course.fee)}`,
    );
  }
  if (course.preReq) parts.push(`pré-requisito: ${cut(one(course.preReq), 150)}`);
  if (course.docs) parts.push(`documentos: ${cut(one(course.docs), 180)}`);
  if (course.emissao) parts.push(`emissão: ${course.emissao}${course.prazoEmissao ? `, prazo ${course.prazoEmissao}` : ''}`);
  if (course.estagio || course.artigo) parts.push(`estágio: ${course.estagio || '-'}, artigo: ${course.artigo || '-'}`);
  return `- ${parts.filter(Boolean).join(' | ')}`;
};

const noticeLine = (item: Notice): string =>
  `- [${item.date || 's/d'}] [${item.sector || 'sem setor'}] ${item.title}${item.summary ? `: ${cut(item.summary, 200)}` : ''}${item.link ? ` (link: ${item.link})` : ''}`;

const institutionLine = (name: string, profile: InstitutionProfile): string =>
  `- ${name} (${profile.fullName}): ${profile.kind}; ${[profile.tradition, profile.location].filter(Boolean).join(', ')}; modalidades: ${profile.modalities.join(', ')}; ${profile.stats.slice(0, 3).map((stat) => `${stat.value} ${stat.label}`).join('; ')}; diferenciais: ${profile.highlights.slice(0, 4).join('; ')}; ${profile.accreditation} Endereço: ${profile.address}. Site: ${profile.site}`;

const PAGES = [
  ['/cursos/info', 'Informações de cursos (valores, documentos, ficha)'],
  ['/cursos/presenciais', 'Turmas presenciais por polo, com cronograma'],
  ['/cursos/filtro', 'Filtro avançado de cursos'],
  ['/cursos/combos', 'Combos de cursos'],
  ['/simulador', 'Simulador de aproveitamento de estudos'],
  ['/contatos', 'Contatos por IES e setores'],
  ['/memorandos', 'Memorandos internos'],
  ['/avisos', 'Avisos (calendários, cronogramas, manuais)'],
  ['/videos', 'Vídeos tutoriais do Portal do Aluno'],
  ['/cadastros', 'Formulários de cadastro'],
  ['/quiz', 'O que posso estudar?'],
  ['/evolucao', 'Evolução funcional (pontos)'],
  ['/cursos/calendario', 'Calendário de aulas'],
] as const;

const section = (title: string, lines: string[], max: number): string => {
  if (lines.length === 0) return '';
  let body = lines.join('\n');
  if (body.length > max) body = `${body.slice(0, max - 1)}…`;
  return `## ${title}\n${body}`;
};

// Palavras de pergunta que não ajudam a achar um curso, combo ou turma
const GENERIC = set('valor valores preco precos custa custo mensalidade parcela documento documentos requisito requisitos ingresso como qual quais quanto fazer faco diferenca comparar');

// Busca tolerante: vale quem casa com a maioria das palavras da pergunta (a busca do motor exige todas).
const loose = <T extends { words: string[] }>(items: T[], tokens: string[], limit: number): T[] => {
  const useful = tokens.filter((token) => !GENERIC.has(token));
  if (useful.length === 0) return [];
  const scored = items
    .map((item) => {
      const best = useful.map((token) => Math.max(0, ...item.words.map((word) => wordScore(token, word, true))));
      return { item, matched: best.filter((value) => value >= 0.6).length, quality: best.reduce((sum, value) => sum + value, 0) };
    })
    .filter((entry) => entry.matched > 0);
  const top = Math.max(0, ...scored.map((entry) => entry.matched));
  return scored
    .filter((entry) => entry.matched >= Math.max(1, Math.ceil(useful.length / 2)) && entry.matched >= top - 1)
    .sort((a, b) => b.matched - a.matched || b.quality - a.quality || a.item.words.length - b.item.words.length)
    .slice(0, limit)
    .map((entry) => entry.item);
};

const AGENDA_WORDS = new Set(['aula', 'aulas', 'agenda', 'calendario', 'sabado', 'semana', 'hoje', 'amanha']);

// Monta o texto com os dados do SAE mais relevantes para a pergunta. Fica abaixo de ~20 mil caracteres.
export const buildAiContext = (catalog: Catalog, question: string, agenda: Agenda | null = null): string => {
  const tokens = tokenize(question).filter((token) => !STOP.has(token) && token.length >= 3);
  const sections: string[] = [];

  // cursos mais parecidos com a pergunta (nome, eixo, tipo, IES)
  if (tokens.length > 0) {
    const pool = catalog.courses.map((course) => ({ course, words: [...course.words, ...tokenize(`${course.eixo} ${course.tipo} ${course.ies} ${course.modalidade}`)] }));
    const ranked = loose(pool, tokens, 8).map((entry) => entry.course);
    sections.push(section('Cursos relacionados à pergunta', ranked.map(courseLine), 6500));
  }
  const byIes = new Map<string, number>();
  catalog.courses.forEach((course) => byIes.set(course.ies, (byIes.get(course.ies) ?? 0) + 1));
  sections.push(`## Resumo do catálogo\n${catalog.courses.length} cursos: ${[...byIes.entries()].map(([ies, total]) => `${ies} ${total}`).join(', ')}. Valor de referência: D30 no boleto (UNICIVE: valor integral).`);

  // combos
  const wantsCombos = tokens.includes('combo') || tokens.includes('combos') || tokens.includes('pacote');
  const comboPool = loose(catalog.combos.map((combo) => ({ combo, words: combo.words })), tokens.filter((token) => !token.startsWith('combo')), 4).map((entry) => entry.combo);
  const combos = (wantsCombos ? catalog.combos : comboPool).slice(0, wantsCombos ? 40 : 4);
  sections.push(
    section(
      'Combos',
      combos.map((combo) => `- ${cut(combo.name, 170)} (${combo.area}): ${combo.lines.map((line) => `${line.method}: Dia 10 ${line.day10}, Dia 30 ${line.day30}${line.installments && line.installments !== '-' ? `, ${line.installments}` : ''}`).join('; ')}`),
      wantsCombos ? 6000 : 2500,
    ),
  );

  // turmas presenciais e calendário de aulas
  const classes = loose(catalog.presential, tokens, 6);
  sections.push(section('Turmas presenciais', classes.map((item) => `- ${item.name} | ${item.tipo} | polo ${item.polo} | turma ${item.turma} | situação: ${item.status} | alunos ${item.students || '-'} | início/limite: ${item.start || '-'}${item.schedule ? ` | cronograma: ${item.schedule}` : ''}`), 2500));
  if (agenda && tokens.concat(tokenize(question)).some((token) => AGENDA_WORDS.has(token))) {
    const upcoming = agenda.events.slice(0, 12);
    sections.push(section('Próximas aulas (Google Agenda)', upcoming.map((event) => `- ${event.start.toLocaleDateString('pt-BR')} ${event.allDay ? 'dia inteiro' : event.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} | ${event.polo || 'sem polo'} | ${event.course} | turma ${event.turma || '-'} | tema ${event.tema || '-'} | professor ${event.professor || '-'}`), 2500));
  }

  // simulador
  const origins = loose(catalog.simulator, tokens, 3).filter((row) => row.destinations.length > 0);
  sections.push(section('Simulador de aproveitamento', origins.map((row) => `- ${row.origin} permite: ${row.destinations.map((destination) => `${destination.name}${destination.prazo ? ` (${destination.prazo})` : ''}`).join(', ')}`), 1200));

  // memorandos e avisos (procedimentos): o texto do procedimento está no documento do link
  sections.push(section('Memorandos (o procedimento completo está no documento do link)', catalog.memos.map(noticeLine), 4500));
  const matchedNotices = loose(catalog.notices.map((item) => ({ item, words: tokenize(`${item.title} ${item.sector}`) })), tokens, 6).map((entry) => entry.item);
  sections.push(section('Avisos relacionados', (matchedNotices.length > 0 ? matchedNotices : catalog.notices.slice(-5)).map(noticeLine), 2200));

  // instituições
  const institutions = PRESENTATION_ORDER.map((name) => {
    const profile = profileFor(name);
    return profile ? institutionLine(name, profile) : `- ${name}: ${catalog.courses.filter((course) => course.ies.toUpperCase() === name.toUpperCase()).length} cursos no catálogo; sem apresentação no SAE`;
  });
  sections.push(section('Instituições', institutions, 5000));

  // contatos e setores
  const contacts = Object.values(IES_CONTACTS).map((ies) => `- ${ies.name}: ${ies.emails.map((entry) => `${entry.label}: ${entry.email}`).join('; ')}`);
  sections.push(section('Contatos por IES (e-mails)', contacts, 3200));
  const nuclei = NUCLEO_OPTIONS.map((option) => `- ${option.label}: ${(NUCLEO_INFO[option.value] ?? []).map((line) => line.replace(/[;.]$/, '')).join('; ')}`);
  sections.push(section('Setores e o que cada um faz', nuclei, 4200));

  // vídeos, formulários, regras de "o que estudar" e páginas
  sections.push(section('Vídeos tutoriais do Portal do Aluno', VIDEOS.map((video) => `- ${video.title}: ${watchUrl(video.id)}`), 900));
  sections.push(section('Formulários de cadastro (página /cadastros)', Object.entries(FORMS_DATA).map(([key, form]) => `- ${form?.title ?? key} (/cadastros?form=${key})`), 600));
  sections.push(
    section('O que cada formação permite cursar', EDUCATION_OPTIONS.map((option) => `- ${option.label}: ${eligibleTypes(option.value).join(', ')}`), 1500),
  );
  sections.push(section('Páginas do SAE', PAGES.map(([path, label]) => `- ${path}: ${label}`), 1200));

  return sections.filter(Boolean).join('\n\n').slice(0, 22000);
};

// ---------------------------------------------------------------- resposta

// Texto da IA (Markdown simples) em blocos da tela: parágrafos, listas e links.
export const answerToBlocks = (answer: string): Block[] => {
  const blocks: Block[] = [];
  const urls: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length > 0) blocks.push({ type: 'list', title: '', items: list });
    list = [];
  };
  answer.split('\n').forEach((raw) => {
    const line = raw.replace(/\*\*|__|`/g, '').replace(/^#{1,6}\s*/, '').trim();
    if (!line) {
      flush();
      return;
    }
    const withoutUrls = line.replace(/https?:\/\/[^\s)>"]+/g, (url) => {
      if (urls.length < 4 && !urls.includes(url)) urls.push(url);
      return '(link abaixo)';
    });
    const item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(withoutUrls);
    if (item) list.push(item[1]);
    else {
      flush();
      blocks.push({ type: 'text', text: withoutUrls });
    }
  });
  flush();
  if (urls.length > 0) {
    blocks.push({
      type: 'links',
      items: urls.map((url) => ({ label: url.replace(/^https?:\/\//, '').slice(0, 60), href: url })),
    });
  }
  return blocks;
};

export interface AiTurn {
  role: 'user' | 'assistant';
  text: string;
}

// Pergunta à IA (via Apps Script). Lança erro com `code` quando o servidor recusa (not_configured, auth, limit, error, empty).
export const askAi = async (input: { question: string; history: AiTurn[]; catalog: Catalog; agenda: Agenda | null }): Promise<Reply> => {
  const login = localStorage.getItem('userLogin') ?? '';
  const question = redactPersonalData(input.question).slice(0, 600);
  const history = input.history.slice(-6).map((turn) => ({ role: turn.role, text: redactPersonalData(turn.text).slice(0, 800) }));
  const result = await callScript({
    action: 'assistantAsk',
    login,
    question,
    context: buildAiContext(input.catalog, question, input.agenda),
    history: JSON.stringify(history),
  });
  const blocks = answerToBlocks(result.answer ?? '');
  if (blocks.length === 0) throw new Error('A IA não devolveu resposta.');
  return { tag: 'ia', blocks, chips: [], sources: [AI_SOURCE] };
};
