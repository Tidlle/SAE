// Vídeos tutoriais do Portal do Aluno. Usado pela página Vídeos e pelo Meu Assistente.
export interface Video {
  title: string;
  id: string;
}

export const VIDEOS: Video[] = [
  { title: 'Como efetuar o 1º acesso e preenchimento dos dados', id: 'xAso0Zk77X0' },
  { title: 'Como inserir os documentos no Portal do Aluno', id: 'DyB23r8slj4' },
  { title: 'Como consultar sua área financeira', id: 'G4-TzOBc3Ow' },
  { title: 'Como realizar as atividades do seu curso', id: '2QBpaPefoQM' },
  { title: 'Como verificar suas notas e realizar a recuperação', id: 'H9P18ObXzLU' },
  { title: 'Como realizar a solicitação do seu certificado', id: 'QXaZJTPDHC8' },
];

export const watchUrl = (id: string) => `https://youtu.be/${id}`;
