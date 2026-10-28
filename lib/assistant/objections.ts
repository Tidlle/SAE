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
  avoid: string[]; // o que NÃO dizer
  close: string; // pergunta para o vendedor fazer ao aluno, no fim
  data: 'price' | 'time' | 'trust' | 'compare' | 'money' | 'issue' | 'requirements' | 'none'; // dados da planilha mostrados
}

export const OBJECTIONS: Objection[] = [
  {
    id: 'caro',
    title: 'Achou caro',
    match: /(esta|ta|ficou|achou|acha|achei|foi|muito|bem|bastante) (muito |bem |meio )?(caro|salgado)|caro demais|muito caro|valor (alto|elevado)|acima do (orcamento|que)|fora do (orcamento|bolso)|nao cabe no (bolso|orcamento)|pesa no bolso/,
    discover: [
      'Qual faixa mensal ficaria confortável para ele investir na formação?',
      'Ele comparou com algum outro curso? Qual?',
    ],
    reply: [
      'Não ofereça desconto de imediato: primeiro investigue se o valor mensal é mesmo o único ponto.',
      'Só depois de saber a faixa confortável, use alternativas reais (parcelamento, pagamento em dia, opção de menor valor do mesmo tema).',
      'O pagamento em dia (D10) é uma condição oficial da planilha: apresente como condição, não como favor.',
      'Fale a condição como inscrição + parcelas, sem somar o total.',
    ],
    avoid: ['Não diga "consegui um desconto para você" nem "falei com a coordenação".', 'Não invente outro curso nem outra condição.', 'Não some as parcelas nem diga "o curso inteiro fica…".'],
    close: 'Hoje o valor mensal é realmente o único ponto que impediria você de começar?',
    data: 'price',
  },
  {
    id: 'pensar',
    title: 'Quer pensar / vai responder depois',
    match: /(vai|quer|vou|preciso|precisa|deixa|deixe) (pensar|ver com calma)|pensar (melhor|um pouco|mais)|vai me responder depois|depois (eu )?(te|lhe) (aviso|respondo|retorno)|deixa para depois/,
    discover: ['O que falta para ele decidir: valor, tempo, dúvida sobre o curso ou sobre a instituição?', 'Até quando ele precisa dar a resposta?'],
    reply: [
      'Não responda só "tudo bem" e também não ataque com desconto.',
      'A resposta à pergunta abaixo costuma mostrar a objeção verdadeira.',
      'Deixe as informações por escrito (mensagem sem valores) e combine um dia para retomar.',
    ],
    avoid: ['Não pressione com prazo que não existe.', 'Não use falsa escassez ("última vaga").'],
    close: 'Claro. Para eu não ficar te pressionando sem necessidade, o que você sente que ainda precisa avaliar antes de decidir?',
    data: 'none',
  },
  {
    id: 'outra',
    title: 'Vai ver outras instituições / achou mais barato',
    match: /ver outras (faculdades|instituicoes|opcoes)|(outra|outro) (faculdade|instituicao|lugar|curso|escola)|mais barato (em|na|no|la|outr)|encontrou mais barato|achou mais barato|concorrente/,
    discover: [
      'Qual curso e qual instituição ele viu? Qual o valor, a carga horária e a duração?',
      'O curso é reconhecido pelo MEC? Dá para conferir no e-MEC?',
      'O valor que ele viu inclui taxa de inscrição, material e emissão do certificado ou diploma?',
    ],
    reply: [
      'Faz sentido comparar: apoie a comparação, sem criticar ninguém.',
      'Compare só critérios verificáveis: carga horária, duração, modalidade, reconhecimento no e-MEC, taxa de inscrição e emissão do documento.',
      'Mostre a condição como inscrição + parcelas, não só o valor total.',
    ],
    avoid: ['Não critique o concorrente.', 'Não diga que o ITEQ é "o melhor".', 'Não tente assustar o aluno.'],
    close: 'Faz sentido comparar antes de decidir. O que vai pesar mais na sua escolha: condição financeira, modalidade, duração ou estrutura da formação?',
    data: 'compare',
  },
  {
    id: 'tempo',
    title: 'Sem tempo para estudar',
    match: /(sem|nao tem|nao tenho|falta de|pouco) tempo|corrido|trabalha muito|nao vai conseguir estudar|nao da tempo/,
    discover: ['Quantas horas por semana ele consegue estudar? Em que horário?', 'Ele prefere estudar no celular ou no computador?'],
    reply: [
      'Não diga logo "é flexível": primeiro descubra o problema real.',
      'Só depois ligue a modalidade e a duração reais do curso (abaixo) à rotina que ele descreveu.',
      'Se o tempo for muito curto, mostre uma opção de menor carga horária ou duração.',
    ],
    avoid: ['Não prometa flexibilidade de horário sem confirmar a modalidade do curso.', 'Não minimize a falta de tempo ("é fácil").'],
    close: 'Entendo. Hoje o que mais dificulta para você é horário de trabalho, rotina familiar ou disponibilidade para estudar?',
    data: 'time',
  },
  {
    id: 'familia',
    title: 'Precisa falar com a família',
    match: /(falar|conversar|ver|consultar|decidir) com (a |o |minha |meu )?(esposa|marido|mulher|esposo|pai|mae|familia|namorad[oa]|filh[oa]|chefe)|(esposa|marido|familia) (decide|precisa|tem que)/,
    discover: ['Quem participa dessa decisão? Dá para incluir essa pessoa na conversa?', 'Que informação ela vai querer ver: tempo de curso, modalidade ou reconhecimento?'],
    reply: [
      'Nunca desvalorize a decisão conjunta.',
      'Ajude o aluno a construir segurança: ofereça uma mensagem resumida, por escrito, para ele mostrar em casa (botão abaixo).',
      'Combine um dia e um horário para retomar, de preferência com a outra pessoa presente.',
    ],
    avoid: ['Não diga que "a decisão é só sua".', 'Não pressione para decidir sem a outra pessoa.'],
    close: 'Claro, é uma decisão importante mesmo. O que você acha que ele(a) vai querer entender melhor antes de vocês decidirem?',
    data: 'none',
  },
  {
    id: 'pesquisando',
    title: 'Só está pesquisando',
    match: /so (estou|to|esta|ta) pesquisando|apenas pesquisando|so (olhando|vendo|dando uma olhada)|pesquisa de preco|so pesquisa/,
    discover: ['O que ele está comparando principalmente?', 'Ele já tem alguma opção em mente?'],
    reply: [
      'Pesquisar faz parte da decisão: não force o fechamento.',
      'Transforme a pesquisa em diagnóstico: descubra os critérios que ele usa para comparar.',
      'Passe só o que ele pedir, sem enviar tudo de uma vez.',
    ],
    avoid: ['Não pressione por matrícula agora.', 'Não despeje todas as informações e valores de uma vez.'],
    close: 'Perfeito, pesquisar bem faz parte da decisão. O que você está comparando principalmente entre as opções que encontrou?',
    data: 'none',
  },
  {
    id: 'indeciso',
    title: 'Indeciso entre dois cursos',
    match: /(indeciso|indecisa|em duvida|na duvida) entre|entre (dois|2) cursos|nao sabe (qual|se) (escolher|fazer)|nao sabe (ainda )?o que fazer/,
    discover: ['Quais são os dois cursos?', 'O que o atrai em cada um?'],
    reply: [
      'Nunca escolha por ele: os dois podem levar a caminhos profissionais bem diferentes.',
      'Use a resposta à pergunta abaixo para orientar a escolha.',
      'Compare só características reais dos dois cursos.',
    ],
    avoid: ['Não escolha aleatoriamente.', 'Não use argumentos genéricos ("o mercado está bombando").'],
    close: 'Os dois podem levar a caminhos bem diferentes. Pensando daqui a alguns anos, com qual tipo de trabalho você se imagina mais envolvido?',
    data: 'none',
  },
  {
    id: 'dinheiro',
    title: 'Sem dinheiro agora',
    match: /(nao tem|sem|nao tenho) (dinheiro|condicao|condicoes)|sem grana|apertado|desempregad[oa]|sem (renda|emprego)|nao consegue pagar|nao vai conseguir pagar/,
    discover: ['Quando ele consegue começar a pagar?', 'A taxa de inscrição é o que pesa?'],
    reply: [
      'Descubra a faixa mensal que cabe sem aperto antes de mostrar alternativas.',
      'Mostre o parcelamento máximo e veja se há opção de menor valor ou menor duração.',
      'Não empurre uma parcela que ele não consegue pagar: combine um novo contato para quando for possível.',
    ],
    avoid: ['Não insista em parcela que ele disse não caber.', 'Não invente condição ou desconto.'],
    close: 'Entendi. Qual faixa mensal ficaria confortável para você investir na sua formação?',
    data: 'money',
  },
  {
    id: 'confianca',
    title: 'Desconfia do EAD ou do diploma',
    match: /confiavel|golpe|reconhecid[oa]s? pelo mec|tem validade|diploma (vale|e valido|tem valor)|ead (vale|e bom|presta)|desconfia|medo de (ser )?(golpe|enganad)/,
    discover: ['Ele já estudou a distância antes? Como foi?', 'A dúvida é o reconhecimento do MEC, a validade do diploma ou a forma de estudar?'],
    reply: [
      'O reconhecimento pode ser conferido pelo próprio aluno no e-MEC: envie o link do curso (abaixo, quando houver).',
      'Explique o que ele recebe ao concluir (titulação e emissão) e em quanto tempo, como está na ficha do curso.',
      'Se a dúvida for a forma de estudar, mostre as opções semipresenciais ou presenciais.',
    ],
    avoid: ['Não prometa reconhecimento que você não possa comprovar.', 'Não garanta emprego, salário ou aprovação em concurso.'],
    close: 'Sua dúvida é sobre o reconhecimento do curso ou sobre estudar a distância?',
    data: 'trust',
  },
  {
    id: 'preciso',
    title: 'Acha que não precisa do curso',
    match: /nao (preciso|precisa|vejo (necessidade|utilidade)|ve (necessidade|utilidade))|pra que (fazer|serve)|nao vai (ajudar|servir)|nao serve (pra|para) nada/,
    discover: ['A empresa ou a rede onde ele trabalha valoriza ou exige esse tipo de formação (plano de carreira, progressão, concurso)?', 'Ele já pensou em mudar de área ou crescer na atual?'],
    reply: [
      'Não argumente contra: ligue o curso ao objetivo que ele mesmo contou.',
      'Pergunte o que mudaria na vida profissional dele com essa formação.',
      'Se de fato não faz sentido agora, deixe a porta aberta e combine um novo contato.',
    ],
    avoid: ['Não prometa emprego, salário ou promoção.', 'Não use medo ou culpa ("você vai ficar para trás").'],
    close: 'Qual é o seu maior objetivo profissional hoje?',
    data: 'none',
  },
  {
    id: 'emissao',
    title: 'Demora a emissão do diploma ou certificado',
    match: /(demora|demorado|demorada|prazo|quanto tempo).*(diploma|certificado|emissao)|emissao d[eo] (diploma|certificado)|quando (recebe|chega|sai) (o )?(diploma|certificado)/,
    discover: ['Qual a data limite que ele tem?', 'O documento é para concurso, promoção ou inscrição em outro curso?'],
    reply: [
      'Mostre o prazo médio de emissão após a colação, como está na ficha do curso (abaixo).',
      'Explique o que ele recebe (titulação e tipo de documento) e o que acontece até lá.',
      'Se houver data limite, veja se o prazo cabe antes de prometer qualquer coisa.',
    ],
    avoid: ['Não prometa data de emissão: o prazo da planilha é uma média.', 'Não diga que "é rápido" sem conferir.'],
    close: 'Você precisa do documento para alguma data específica?',
    data: 'issue',
  },
  {
    id: 'tcc',
    title: 'Tem TCC, artigo ou estágio?',
    match: /\btcc\b|trabalho de conclusao|monografia|precisa (de )?(fazer )?(artigo|estagio)|tem (que )?(fazer )?(artigo|estagio)/,
    discover: ['O que o preocupa: o tempo, o custo ou a dificuldade?', 'Ele já tem experiência com trabalhos acadêmicos?'],
    reply: [
      'Confira na ficha do curso (abaixo) se exige artigo ou estágio e explique só o que ela informa.',
      'Se a ficha não diz como funciona (orientação, prazo), não prometa: confirme com o setor responsável.',
      'Se ele não quer essa etapa, mostre outras opções do tema que não exigem.',
    ],
    avoid: ['Não prometa orientação, prazo ou facilidade que a ficha do curso não informa.'],
    close: 'Para você, o artigo ou o estágio é um impedimento?',
    data: 'requirements',
  },
  {
    id: 'presencial',
    title: 'Prefere presencial',
    match: /prefere (aula )?presencial|quer presencial|so (quer|aceita) presencial|nao quer ead|nao gosta de ead|nao quer (estudar )?a distancia|nao (curte|confia em) ead/,
    discover: ['Em quais dias e horários ele consegue estar presente?', 'Há polo perto da casa ou do trabalho dele?'],
    reply: [
      'Veja as turmas presenciais abertas no polo mais perto dele (botão abaixo).',
      'Se não houver turma por perto, mostre a opção semipresencial.',
      'Confirme a situação da turma (aberta, aguardando abertura ou sem vagas) antes de prometer vaga.',
    ],
    avoid: ['Não prometa vaga sem confirmar a situação da turma.'],
    close: 'Em qual polo você consegue estudar?',
    data: 'time',
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
  const data = dataBlocks(objection.data, courses.slice(0, 3));
  const blocks: Block[] = [
    { type: 'text', text: `Objeção: ${objection.title}.` },
    { type: 'text', tone: 'muted', text: 'Antes de rebater, entenda o motivo real. Quem faz a objeção raramente diz o que de fato o preocupa.' },
    { type: 'list', title: 'Como responder', items: objection.reply },
    { type: 'list', title: 'Para descobrir mais', items: objection.discover },
    ...(courses.length === 0 && objection.data !== 'none'
      ? [{ type: 'text', tone: 'muted', text: 'Se você me disser o curso (ou fizer um atendimento), eu mostro aqui os valores e os dados que ajudam nessa resposta.' } as Block]
      : data),
    { type: 'list', title: 'O que NÃO dizer', items: objection.avoid },
    { type: 'coach', stage: 'Tratar objeção', question: objection.close, tip: 'Faça só esta pergunta e escute a resposta antes de argumentar.' },
  ];
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
