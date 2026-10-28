import { formatCurrency, foldText, safeHttpUrl } from '../courses';
import { profileFor } from '../institutionProfiles';
import { Course } from './catalog';
import { basePrice } from './lists';
import { Block, Chip, Context, displayName } from './shared';

// Objeções de venda: o assistente ajuda o vendedor a descobrir o motivo real (perguntas para fazer ao aluno), sugere como
// responder e mostra os dados da planilha que sustentam a resposta. Os textos são de apoio e ficam aqui, fáceis de editar.

export interface Objection {
  id: string;
  title: string; // nome do botão
  match: RegExp; // frase do vendedor (sem acento e em minúsculas) que aponta a objeção
  discover: string[]; // perguntas para fazer ao aluno
  reply: string[]; // como responder
  close: string; // pergunta para o vendedor seguir
  data: 'price' | 'time' | 'trust' | 'compare' | 'money' | 'issue' | 'requirements' | 'none'; // dados da planilha mostrados
}

export const OBJECTIONS: Objection[] = [
  {
    id: 'preciso',
    title: 'Acha que não precisa do curso',
    match: /nao (preciso|precisa|vejo (necessidade|utilidade)|ve (necessidade|utilidade))|pra que (fazer|serve)|nao vai (ajudar|servir)|nao serve (pra|para) nada/,
    discover: [
      'Qual o objetivo profissional dele nos próximos anos?',
      'A empresa ou a rede onde ele trabalha valoriza ou exige esse tipo de formação (plano de carreira, progressão, concurso)?',
      'Ele já pensou em mudar de área ou crescer na atual?',
    ],
    reply: [
      'Não argumente contra: ligue o curso ao objetivo que ele mesmo contou.',
      'Pergunte o que mudaria na vida profissional dele se tivesse essa formação.',
      'Se de fato não faz sentido agora, deixe a porta aberta e combine um novo contato.',
    ],
    close: 'Qual é hoje o maior objetivo profissional dele? Com isso eu indico um curso que faça sentido.',
    data: 'none',
  },
  {
    id: 'emissao',
    title: 'Demora a emissão do diploma ou certificado',
    match: /(demora|demorado|demorada|prazo|quanto tempo).*(diploma|certificado|emissao)|emissao d[eo] (diploma|certificado)|quando (recebe|chega|sai) (o )?(diploma|certificado)/,
    discover: ['Ele precisa do documento para alguma data (concurso, promoção, inscrição)?', 'Qual a data limite que ele tem?'],
    reply: [
      'Mostre o prazo médio de emissão após a colação, como está na ficha do curso (abaixo).',
      'Explique o que ele recebe (titulação e tipo de documento) e o que acontece até lá.',
      'Se houver uma data limite, veja se o prazo cabe antes de prometer qualquer coisa.',
    ],
    close: 'Ele tem uma data limite para ter o documento em mãos?',
    data: 'issue',
  },
  {
    id: 'tcc',
    title: 'Tem TCC, artigo ou estágio?',
    match: /\btcc\b|trabalho de conclusao|monografia|precisa (de )?(fazer )?(artigo|estagio)|tem (que )?(fazer )?(artigo|estagio)/,
    discover: ['O que o preocupa: o tempo para escrever, o custo ou a dificuldade?', 'Ele já tem experiência com trabalhos acadêmicos?'],
    reply: [
      'Confira na ficha (abaixo) se o curso exige artigo ou estágio: não prometa o que a planilha não diz.',
      'Se exige, explique o prazo do curso, que inclui essa etapa, e que há orientação.',
      'Se ele não quer essa etapa, mostre outras opções do tema que não exigem.',
    ],
    close: 'Para ele, o artigo ou o estágio é um impedimento? Posso procurar opções sem essa exigência.',
    data: 'requirements',
  },
  {
    id: 'presencial',
    title: 'Prefere presencial',
    match: /prefere (aula )?presencial|quer presencial|so (quer|aceita) presencial|nao quer ead|nao gosta de ead|nao quer (estudar )?a distancia|nao (curte|confia em) ead/,
    discover: ['Em qual cidade ou polo ele consegue ir às aulas?', 'Em quais dias e horários ele consegue estar presente?'],
    reply: [
      'Veja as turmas presenciais abertas no polo mais perto dele (botão abaixo).',
      'Se não houver turma por perto, mostre a opção semipresencial.',
      'Confirme a situação da turma (aberta, aguardando abertura ou sem vagas) antes de prometer vaga.',
    ],
    close: 'Em que polo ele consegue estudar? Posso mostrar as turmas presenciais.',
    data: 'time',
  },
  {
    id: 'outra',
    title: 'Achou mais barato em outro lugar',
    match: /(outra|outro) (faculdade|instituicao|lugar|curso|escola)|mais barato (em|na|no|la|outr)|encontrou mais barato|achou mais barato|concorrente/,
    discover: [
      'Qual curso e qual instituição ele viu? Qual o valor, a carga horária e a duração?',
      'O curso é reconhecido pelo MEC? Dá para conferir no e-MEC?',
      'O valor que ele viu inclui taxa de inscrição, material e emissão do certificado ou diploma?',
    ],
    reply: [
      'Compare o mesmo com o mesmo: carga horária, duração, reconhecimento pelo MEC, taxa de inscrição e emissão do documento.',
      'Mostre o valor por mês e as condições de pagamento (desconto de pontualidade e parcelamento), não só o valor total.',
      'Se o outro curso for realmente igual e mais barato, não force: ofereça uma opção de menor valor entre as nossas.',
    ],
    close: 'Você sabe qual curso e valor ele viu? Com isso eu comparo com as nossas opções.',
    data: 'compare',
  },
  {
    id: 'confianca',
    title: 'Desconfia do EAD ou do diploma',
    match: /confiavel|golpe|reconhecid[oa]s? pelo mec|tem validade|diploma (vale|e valido|tem valor)|ead (vale|e bom|presta)|desconfia|medo de (ser )?(golpe|enganad)/,
    discover: [
      'Qual a dúvida exata: reconhecimento do MEC, validade do diploma ou a forma de estudar a distância?',
      'Ele já estudou a distância antes? Como foi?',
    ],
    reply: [
      'O reconhecimento pode ser conferido por ele mesmo no e-MEC: envie o link do curso (abaixo, quando houver).',
      'Explique o que ele recebe ao concluir (titulação e emissão) e em quanto tempo, como está na ficha do curso.',
      'Se a dúvida for a forma de estudar, mostre as opções semipresenciais ou presenciais.',
    ],
    close: 'A dúvida dele é sobre o reconhecimento ou sobre estudar a distância?',
    data: 'trust',
  },
  {
    id: 'familia',
    title: 'Precisa falar com a família',
    match: /(falar|conversar|ver|consultar|decidir) com (a |o |minha |meu )?(esposa|marido|mulher|esposo|pai|mae|familia|namorad[oa]|filh[oa]|chefe)|(esposa|marido|familia) (decide|precisa|tem que)/,
    discover: [
      'Quem participa dessa decisão? Dá para incluir essa pessoa na conversa?',
      'Que informação ela vai querer ver: valor, tempo de curso ou reconhecimento?',
    ],
    reply: [
      'Ofereça uma mensagem resumida, por escrito, para ele mostrar em casa (botão abaixo).',
      'Combine um dia e um horário para retomar a conversa, de preferência com a outra pessoa presente.',
    ],
    close: 'Quer que eu monte a mensagem com as opções para ele mostrar a quem decide junto?',
    data: 'none',
  },
  {
    id: 'pensar',
    title: 'Quer pensar / vai responder depois',
    match: /(vai|quer|vou|preciso|precisa|deixa|deixe) (pensar|ver com calma)|pensar (melhor|um pouco|mais)|vai me responder depois|depois (eu )?(te|lhe) (aviso|respondo|retorno)|deixa para depois/,
    discover: [
      'O que falta para ele decidir hoje: valor, tempo, dúvida sobre o curso ou sobre a instituição?',
      'Até quando ele precisa dar a resposta?',
    ],
    reply: [
      'Quem diz "vou pensar" costuma ter uma dúvida que não falou. Pergunte qual é, com leveza.',
      'Deixe as informações por escrito (botão abaixo) e combine data e horário para retomar.',
      'Confira na ficha do curso se há data limite de inclusão ou início de turma antes de pressionar prazo.',
    ],
    close: 'Se ele pudesse tirar uma única dúvida agora, qual seria?',
    data: 'none',
  },
  {
    id: 'tempo',
    title: 'Sem tempo para estudar',
    match: /(sem|nao tem|nao tenho|falta de|pouco) tempo|corrido|trabalha muito|nao vai conseguir estudar|nao da tempo/,
    discover: ['Quantas horas por semana ele consegue estudar? Em que horário?', 'Prefere estudar no celular ou no computador?'],
    reply: [
      'Mostre a duração mínima e máxima do curso, para ele ver o prazo para concluir.',
      'Confira, na modalidade de cada curso abaixo, como é a rotina de estudo antes de prometer flexibilidade de horário.',
      'Se o tempo for muito curto, ofereça uma opção de menor carga horária ou duração.',
    ],
    close: 'Quantas horas por semana ele consegue? Posso mostrar as opções mais rápidas.',
    data: 'time',
  },
  {
    id: 'dinheiro',
    title: 'Sem dinheiro agora',
    match: /(nao tem|sem|nao tenho) (dinheiro|condicao|condicoes)|sem grana|apertado|desempregad[oa]|sem (renda|emprego)|nao consegue pagar|nao vai conseguir pagar/,
    discover: ['Quando ele consegue começar a pagar?', 'Que parcela caberia no mês dele, sem aperto?'],
    reply: [
      'Mostre o parcelamento máximo: dividir em mais parcelas reduz o valor do mês.',
      'Veja se a taxa de inscrição é o que pesa e se há opção de menor valor ou menor duração.',
      'Não empurre uma parcela que ele não consegue pagar: combine um novo contato para quando for possível.',
    ],
    close: 'Quanto ele consegue pagar por mês? Posso filtrar as opções por essa parcela.',
    data: 'money',
  },
  {
    id: 'caro',
    title: 'Achou caro',
    match: /(esta|ta|ficou|achou|acha|achei|foi|muito|bem|bastante) (muito |bem |meio )?(caro|salgado)|caro demais|muito caro|valor (alto|elevado)|acima do (orcamento|que)|fora do (orcamento|bolso)|nao cabe no (bolso|orcamento)|pesa no bolso/,
    discover: [
      'O que pesa mais: o valor total ou a parcela do mês?',
      'Quanto cabe no mês dele?',
      'Ele comparou com outro curso? Qual?',
    ],
    reply: [
      'Apresente o valor por mês, não o total.',
      'Pagando em dia há desconto de pontualidade (D10); mostro a economia na planilha abaixo.',
      'Dividir em mais parcelas reduz o valor do mês; veja o máximo de cada forma de pagamento.',
      'Se ainda pesar, mostre uma opção de menor valor no mesmo tema.',
    ],
    close: 'O que pesa é o total ou a parcela? Se for a parcela, posso mostrar as opções com parcela menor.',
    data: 'price',
  },
];

// Pedido para ver as objeções ("o aluno tem uma objeção", "como contornar objeção")
const MENU = /objecao|objecoes|contornar|rebater|quebrar (a )?resistencia/;

export const findObjection = (text: string): Objection | null => {
  const folded = foldText(text);
  return OBJECTIONS.find((objection) => objection.match.test(folded)) ?? null;
};

export const wantsObjectionMenu = (text: string): boolean => MENU.test(foldText(text));

// ---------------------------------------------------------------- dados dos cursos da conversa

const money = (value: number | null): string => (value === null ? '-' : formatCurrency(value));

export const parcelsText = (course: Course): string => {
  if (course.unicive?.installments && course.unicive.installment !== null) return `${course.unicive.installments}x de ${money(course.unicive.installment)}`;
  const parts: string[] = [];
  if (course.parcelasBoleto) parts.push(`até ${course.parcelasBoleto}x no boleto`);
  if (course.parcelasCartao) parts.push(`até ${course.parcelasCartao}x no cartão`);
  return parts.join(' · ');
};

const dataBlocks = (kind: Objection['data'], courses: Course[]): Block[] => {
  if (kind === 'none' || courses.length === 0) return [];
  const blocks: Block[] = [{ type: 'text', tone: 'muted', text: `Dados da planilha para ${courses.length === 1 ? 'o curso em conversa' : 'os cursos em conversa'}:` }];
  courses.forEach((course) => {
    const facts: [string, string][] = [];
    const add = (label: string, value: string) => value && facts.push([label, value]);
    const total = basePrice(course);
    if (kind === 'price' || kind === 'money' || kind === 'compare') {
      add(course.unicive?.total ? 'Valor integral' : 'Valor integral (D30 no boleto)', total !== null ? money(total) : '');
      const punctual = course.boleto.punctual;
      if (kind === 'price' && punctual !== null && course.boleto.d30 !== null && punctual < course.boleto.d30) {
        add('Com desconto de pontualidade (D10)', money(punctual));
        add('Economia pagando em dia', money(course.boleto.d30 - punctual));
      }
      if (course.unicive?.cash) add('Pagamento à vista', money(course.unicive.cash));
      if (kind !== 'compare') add('Parcelamento', parcelsText(course));
      if (kind !== 'price') add('Taxa de inscrição', money(course.unicive?.fee ?? course.fee));
    }
    if (kind === 'compare') {
      add('Carga horária', course.carga);
      add('Duração', course.duracao);
      add('Titulação recebida', course.titulacao);
      add('Emissão', course.emissao);
    }
    if (kind === 'time') {
      add('Modalidade', course.modalidade);
      add('Duração', [course.duracao, course.duracaoMax && !course.duracao.includes(course.duracaoMax) ? `máximo ${course.duracaoMax}` : ''].filter(Boolean).join(' · '));
      add('Carga horária', course.carga);
    }
    if (kind === 'trust' || kind === 'issue') {
      add('Titulação recebida', course.titulacao);
      add('Emissão', course.emissao);
      add('Prazo médio de emissão após a colação', course.prazoEmissao);
    }
    if (kind === 'requirements') {
      add('Estágio', course.estagio);
      add('Artigo', course.artigo);
      add('Duração', course.duracao);
    }
    blocks.push({ type: 'course', title: displayName(course.name), meta: [course.ies, course.tipo, course.modalidade].filter(Boolean) });
    if (facts.length > 0) blocks.push({ type: 'facts', items: facts });
    if (kind === 'trust') {
      const accreditation = profileFor(course.ies)?.accreditation;
      if (accreditation) blocks.push({ type: 'text', tone: 'muted', text: accreditation });
      const emec = safeHttpUrl(course.emec);
      if (emec) blocks.push({ type: 'links', items: [{ label: `Consultar ${displayName(course.name)} no e-MEC`, href: emec }] });
    }
  });
  return blocks;
};

// ---------------------------------------------------------------- resposta

export const objectionMenu = (): { text: string; chips: Chip[] } => ({
  text: 'Qual objeção o aluno trouxe?',
  chips: OBJECTIONS.map((objection) => ({ label: objection.title, query: `#k:obj:${objection.id}` })),
});

export const objectionReply = (objection: Objection, courses: Course[], hasLead: boolean): { blocks: Block[]; chips: Chip[] } => {
  const blocks: Block[] = [
    { type: 'text', text: `Objeção: ${objection.title}.` },
    { type: 'text', tone: 'muted', text: 'Antes de rebater, entenda o motivo real. Quem faz a objeção raramente diz o que de fato o preocupa.' },
    { type: 'list', title: 'Pergunte ao aluno', items: objection.discover },
    { type: 'list', title: 'Como responder', items: objection.reply },
    ...dataBlocks(objection.data, courses.slice(0, 3)),
    { type: 'text', text: objection.close },
  ];
  if (courses.length === 0 && objection.data !== 'none') {
    blocks.splice(4, 0, { type: 'text', tone: 'muted', text: 'Se você me disser o curso (ou fizer um atendimento), eu mostro aqui os valores e os dados que ajudam nessa resposta.' });
  }
  const chips: Chip[] = [];
  if (hasLead && objection.id === 'caro') chips.push({ label: 'Mostrar opções mais baratas', query: '#k:sort:price' });
  if (hasLead && (objection.id === 'tempo' || objection.id === 'dinheiro')) chips.push({ label: objection.id === 'tempo' ? 'Mostrar os mais rápidos' : 'Mostrar opções mais baratas', query: objection.id === 'tempo' ? '#k:sort:fast' : '#k:sort:price' });
  if (hasLead && (objection.id === 'caro' || objection.id === 'dinheiro')) chips.push({ label: 'Mudar a parcela', query: '#k:reset:budget' });
  if (hasLead && objection.id === 'presencial') chips.push({ label: 'Só presenciais', query: '#k:mod:presencial' });
  if (objection.id === 'presencial') chips.push({ label: 'Ver turmas presenciais', query: 'turmas abertas' });
  if (courses.length > 0 && (objection.id === 'caro' || objection.id === 'dinheiro' || objection.id === 'outra')) chips.push({ label: 'Combos', query: 'combos' });
  chips.push(
    { label: 'Mensagem para o aluno', query: '#k:msg' },
    { label: 'Ficha do atendimento', query: '#k:ficha' },
    { label: 'Registrar resultado', query: '#k:result' },
    { label: 'Outra objeção', query: '#k:obj' },
  );
  return { blocks, chips };
};
