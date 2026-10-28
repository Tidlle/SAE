import { foldText } from './courses';

export type Role = 'Administrativo' | 'Consultor' | 'Representante';
export type Permission = 'postFeed' | 'createNotice' | 'deleteNotice' | 'createUser' | 'viewAnalytics' | 'manageFlyers' | 'manageVideos';

// Consultor e Representante têm os mesmos privilégios e não podem: publicar no feed, criar nem apagar avisos,
// criar usuários, ver o painel de análises, adicionar ou excluir flyers (só baixam e compartilham), nem adicionar ou excluir
// vídeos do Instagram.
// Só o Administrativo tem acesso total.
const DENIED_FOR_RESTRICTED: Permission[] = ['postFeed', 'createNotice', 'deleteNotice', 'createUser', 'viewAnalytics', 'manageFlyers', 'manageVideos'];

export const ROLE_STORAGE_KEY = 'userPerfil';

// Perfil vem da coluna "Perfil" da aba Cadastros.
// Em branco = Administrativo (acesso total, como era antes da separação).
// "Representante" tem perfil próprio. Qualquer outro texto que não seja "Administrativo" é tratado como Consultor,
// para um erro de digitação restringir em vez de liberar.
export const parseRole = (raw: string | null | undefined): Role => {
  const value = foldText(raw ?? '').trim();
  if (value === '' || value === 'administrativo') return 'Administrativo';
  if (value === 'representante') return 'Representante';
  return 'Consultor';
};

export const getCurrentRole = (): Role => {
  try {
    return parseRole(localStorage.getItem(ROLE_STORAGE_KEY));
  } catch {
    return 'Administrativo';
  }
};

export const can = (permission: Permission, role: Role = getCurrentRole()): boolean =>
  role === 'Administrativo' || !DENIED_FOR_RESTRICTED.includes(permission);
