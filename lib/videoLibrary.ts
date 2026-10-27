import { PLAYLISTS } from './videoPlaylists.generated';

// Biblioteca de vídeos do SAE, usada pelas páginas Vídeos e pelo Meu Assistente.
//
// - Tutoriais da plataforma: vídeos escolhidos um a um e agrupados por tema (id do YouTube + título).
// - Conteúdo das aulas: uma seção por playlist do YouTube (`playlistId`); a lista de vídeos vem de
//   lib/videoPlaylists.generated.ts, atualizada com `npm run videos:update`.
// - Conteúdos do Instagram: seções por tema com links de posts e reels do próprio Instagram (`instagram`).

export interface LibraryVideo {
  id: string;
  title: string;
}

export interface InstagramItem {
  url: string; // endereço do post ou reel: https://www.instagram.com/reel/CODIGO/
  title?: string;
  semPlayer?: boolean; // o Instagram não deixa incorporar este post: o botão abre direto no Instagram
}

export interface VideoSection {
  id: string;
  title: string; // o tema da seção
  description?: string;
  playlistId?: string; // seção alimentada por uma playlist do YouTube
  videos?: LibraryVideo[]; // vídeos escolhidos à mão
  instagram?: InstagramItem[]; // links do Instagram
}

export interface VideoGroup {
  key: 'tutoriais' | 'aulas' | 'instagram';
  path: string;
  navLabel: string; // texto do menu
  title: string;
  kind: 'youtube' | 'instagram';
  sections: VideoSection[];
}

export const VIDEO_GROUPS: VideoGroup[] = [
  {
    key: 'tutoriais',
    path: '/videos/tutoriais',
    navLabel: 'Tutoriais da plataforma',
    title: 'Tutoriais da plataforma',
    kind: 'youtube',
    sections: [
      {
        id: 'primeiro-acesso',
        title: 'Primeiro acesso e cadastro',
        description: 'Como o aluno entra pela primeira vez e preenche os dados.',
        videos: [
          { id: 'xAso0Zk77X0', title: 'Como efetuar o 1º acesso e preenchimento dos dados' },
          { id: '6oNRF5XV3O4', title: 'Introdução do aluno' },
        ],
      },
      {
        id: 'documentos',
        title: 'Documentos, estágio e artigo',
        description: 'Envio de documentos e de trabalhos pela área do aluno.',
        videos: [
          { id: 'DyB23r8slj4', title: 'Como inserir os documentos no Portal do Aluno' },
          { id: 'eF_e49RVl_I', title: 'Como enviar o estágio, o artigo e os documentos na área do aluno' },
        ],
      },
      {
        id: 'atividades',
        title: 'Atividades e notas',
        description: 'Realização das atividades, notas e recuperação.',
        videos: [
          { id: '2QBpaPefoQM', title: 'Como realizar as atividades do seu curso' },
          { id: 'C3rzdKQFv5s', title: 'Como executar as atividades na área do aluno' },
          { id: 'pBF7IsogLag', title: 'Orientações para realizar as atividades na área do aluno' },
          { id: 'H9P18ObXzLU', title: 'Como verificar suas notas e realizar a recuperação' },
        ],
      },
      {
        id: 'financeiro-certificado',
        title: 'Financeiro e certificado',
        description: 'Consulta financeira e solicitação do certificado.',
        videos: [
          { id: 'G4-TzOBc3Ow', title: 'Como consultar sua área financeira' },
          { id: 'QXaZJTPDHC8', title: 'Como realizar a solicitação do seu certificado' },
        ],
      },
    ],
  },
  {
    key: 'aulas',
    path: '/videos/aulas',
    navLabel: 'Conteúdo das aulas',
    title: 'Conteúdo das aulas',
    kind: 'youtube',
    sections: [
      { id: 'estetica', title: 'Estética Clínica Avançada', playlistId: 'PLZo1Py9-Ocp4' },
      { id: 'obstetricia', title: 'Obstetrícia', playlistId: 'PLDxuSl9sYvLc' },
      { id: 'uti', title: 'UTI: Unidade de Terapia Intensiva', description: 'Adulto, pediátrico e neonatal.', playlistId: 'PLLdIpDo9f5GE' },
      { id: 'aha', title: 'American Heart Association (AHA)', playlistId: 'PLfKoNAzX_ZJo' },
      { id: 'aeroespacial', title: 'Enfermagem Aeroespacial', playlistId: 'PLK2UD1KNVypvIpCS59cMH9WDEYYiyyWkw' },
      { id: 'pedagogia', title: 'Pedagogia', playlistId: 'PLJcvJPgw3SO4' },
      { id: 'direito', title: 'Direito', playlistId: 'PLP6RITGrkOmE' },
    ],
  },
  {
    key: 'instagram',
    path: '/videos/instagram',
    navLabel: 'Conteúdos do Instagram',
    title: 'Conteúdos do Instagram',
    kind: 'instagram',
    // Exemplo de como acrescentar uma seção (cada tema é uma seção):
    //   {
    //     id: 'estetica',
    //     title: 'Estética',
    //     instagram: [
    //       { url: 'https://www.instagram.com/reel/CODIGO/', title: 'Título do reel' },
    //       { url: 'https://www.instagram.com/p/CODIGO/' },
    //     ],
    //   },
    sections: [
      {
        id: 'pacientes-modelos',
        title: 'Depoimentos de pacientes modelos',
        description: 'Pacientes que participaram das práticas de Estética.',
        instagram: [
          { url: 'https://www.instagram.com/reel/DPWTBaLkWIV/', title: 'Depoimento de paciente modelo 1' },
          { url: 'https://www.instagram.com/reel/DPTsVOwkQhu/', title: 'Depoimento de paciente modelo 2' },
          { url: 'https://www.instagram.com/reel/DPRrQ9bEbjn/', title: 'Depoimento de paciente modelo 3' },
        ],
      },
      {
        id: 'alunos-estetica',
        title: 'Depoimentos de alunos de Estética',
        instagram: [
          { url: 'https://www.instagram.com/reel/DePL0flxzAR/', title: 'Depoimento de aluno de Estética 1' },
          { url: 'https://www.instagram.com/reel/DctK1xmxU-l/', title: 'Depoimento de aluno de Estética 2' },
          { url: 'https://www.instagram.com/reel/DcgWg4bRJpj/', title: 'Depoimento de aluno de Estética 3' },
          { url: 'https://www.instagram.com/reel/DaDZAORxFY0/', title: 'Depoimento de aluno de Estética 4' },
          { url: 'https://www.instagram.com/reel/DZIKFjVxUNU/', title: 'Depoimento de aluno de Estética 5' },
          { url: 'https://www.instagram.com/reel/DSXXxzfEdeu/', title: 'Depoimento de aluno de Estética 6' },
          { url: 'https://www.instagram.com/reel/DSSITjUEbOd/', title: 'Depoimento de aluno de Estética 7' },
          { url: 'https://www.instagram.com/reel/DSKUTuEkfBH/', title: 'Depoimento de aluno de Estética 8' },
          { url: 'https://www.instagram.com/reel/DSH8OT6ke6D/', title: 'Depoimento de aluno de Estética 9' },
          { url: 'https://www.instagram.com/reel/DSDmSBxkc85/', title: 'Depoimento de aluno de Estética 10' },
        ],
      },
      {
        id: 'alunos-direito',
        title: 'Depoimentos de alunos de Direito',
        instagram: [
          { url: 'https://www.instagram.com/reel/DQW5xs9kWGC/', title: 'Depoimento de aluno de Direito 1' },
          { url: 'https://www.instagram.com/reel/DQUBbT2kZ-X/', title: 'Depoimento de aluno de Direito 2' },
          { url: 'https://www.instagram.com/reel/DQMUp75kRne/', title: 'Depoimento de aluno de Direito 3' },
          { url: 'https://www.instagram.com/reel/DQJtVdTEbkr/', title: 'Depoimento de aluno de Direito 4' },
        ],
      },
      {
        id: 'alunos-obstetricia',
        title: 'Depoimentos de alunos de Obstetrícia',
        instagram: [
          { url: 'https://www.instagram.com/reel/DKAAnxFxVeW/', title: 'Depoimento de aluno de Obstetrícia 1' },
          { url: 'https://www.instagram.com/reel/DJrowDfRw_g/', title: 'Depoimento de aluno de Obstetrícia 2' },
          { url: 'https://www.instagram.com/reel/DJE4XWCRtc6/', title: 'Depoimento de aluno de Obstetrícia 3' },
        ],
      },
      {
        id: 'professores',
        title: 'Depoimentos de professores',
        instagram: [
          { url: 'https://www.instagram.com/reel/Dd6nygQxkuM/', title: 'Depoimento de professor 1' },
          { url: 'https://www.instagram.com/reel/DdtezJ_x2aL/', title: 'Depoimento de professor 2' },
        ],
      },
    ],
  },
];

export const groupByKey = (key: VideoGroup['key']): VideoGroup => VIDEO_GROUPS.find((group) => group.key === key) as VideoGroup;

// Vídeos de uma seção: os escolhidos à mão ou os da playlist.
export const sectionVideos = (section: VideoSection): LibraryVideo[] => section.videos ?? (section.playlistId ? PLAYLISTS[section.playlistId]?.videos ?? [] : []);

export const playlistUrl = (playlistId: string): string => `https://www.youtube.com/playlist?list=${playlistId}`;

// Tutoriais em uma lista só (usada pelo Meu Assistente)
export const VIDEOS: LibraryVideo[] = groupByKey('tutoriais').sections.flatMap((section) => sectionVideos(section));
