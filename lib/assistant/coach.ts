import { Catalog } from './catalog';
import { OBJECTIVE_LABEL, conditionText } from './consult';
import { Answer, Block, Context } from './shared';

// Pergunta de condução: o assistente não só responde, ele devolve ao consultor a próxima pergunta a fazer ao aluno.
// O método vem do roteiro comercial da empresa: cada mensagem tem uma função (descobrir, aprofundar, esclarecer, gerar valor,
// tratar objeção, avançar a decisão, fechar) e termina com UMA pergunta. O bloco "coach" é uma anotação interna: não vai no
// "Copiar resposta" (replyToPlain só copia o que é para o aluno).

const coach = (stage: string, question: string, tip?: string): Block => ({ type: 'coach', stage, question, tip });

const goalOf = (ctx: Context): string => (ctx.lead?.objective ? OBJECTIVE_LABEL[ctx.lead.objective] ?? '' : '');

// Escolhe a pergunta pelo tipo da resposta (tag). Só respostas de venda: contatos, vídeos, agenda etc. ficam sem.
const coachFor = (catalog: Catalog, tag: string, ctx: Context): Block | null => {
  if (tag.startsWith('curso:') && tag !== 'curso:lista') {
    const wanted = tag.slice(6).split('+');
    if (wanted.includes('price')) {
      const course = ctx.courseIds.map((id) => catalog.courses[id]).find(Boolean);
      const condition = course ? conditionText(course) : '';
      return coach(
        'Esclarecer',
        'Antes de passar o valor, pergunte: “Existe alguma dúvida sobre o curso que seja importante para a sua decisão?”',
        condition
          ? `Se ele não tiver dúvidas, apresente só a condição: “Hoje a condição é ${condition}.” Não some as parcelas nem fale em valor total. (A parcela é calculada a partir da planilha: confirme com o Financeiro.)`
          : 'Se ele não tiver dúvidas, apresente só a condição (inscrição + parcelas). Não some as parcelas nem fale em valor total.',
      );
    }
    if (wanted.includes('docs')) {
      return coach('Avançar a decisão', 'Pergunte: “Você consegue reunir esses documentos nesta semana?”', 'Se ele hesitar, descubra o que falta antes de seguir com a matrícula.');
    }
    const goal = goalOf(ctx);
    return coach(
      'Gerar valor',
      goal ? `Ele quer ${goal}. Pergunte: “Como esse curso se encaixa nisso e na sua rotina?”` : 'Pergunte: “O que você gostaria que essa formação mudasse na sua vida profissional?”',
      'Ligue a carga horária, a duração e a modalidade ao objetivo que ele declarar, sem exagerar.',
    );
  }
  if (tag === 'lista') {
    return coach('Descobrir', 'Antes de apresentar opções, pergunte: “O que você quer que essa formação mude na sua vida profissional?”', 'Não escolha o curso pelo aluno: use a resposta para filtrar a lista.');
  }
  if (tag === 'comparar:cursos') {
    return coach('Aprofundar', 'Pergunte: “O que vai pesar mais na sua escolha: condição financeira, modalidade, duração ou estrutura da formação?”', 'Compare só o que dá para verificar e não critique nenhuma instituição.');
  }
  if (tag === 'combo') {
    return coach('Avançar a decisão', 'Pergunte: “Esse conjunto atende o que você precisa agora?”', 'Apresente a condição do combo sem somar nem comparar com um total.');
  }
  if (tag.startsWith('simulador:') && !tag.endsWith('nao-achada')) {
    return coach('Aprofundar', 'Pergunte: “Qual graduação você já concluiu?”', 'O aproveitamento depende da análise acadêmica: não prometa redução de duração nem de disciplinas.');
  }
  if (tag.startsWith('turmas:') && !tag.endsWith('nao-achei') && !tag.endsWith('carregando')) {
    return coach('Esclarecer', 'Pergunte: “Em qual polo e em quais dias você consegue estudar?”', 'Confirme a situação da turma antes de prometer vaga.');
  }
  return null;
};

// Acrescenta a pergunta de condução ao fim da resposta (antes dos botões)
export const withCoach = (catalog: Catalog, answer: Answer): Answer => {
  if (answer.reply.blocks.some((block) => block.type === 'coach')) return answer;
  const block = coachFor(catalog, answer.reply.tag, answer.ctx);
  return block ? { ...answer, reply: { ...answer.reply, blocks: [...answer.reply.blocks, block] } } : answer;
};
