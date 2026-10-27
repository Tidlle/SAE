import { trackLogout } from './tracker';

// Chaves do navegador que representam o usuário logado.
export const SESSION_KEYS = ['usuarioAutenticado', 'userNome', 'userLogin', 'userPerfil', 'userPrimeiroAcesso'];

// Conta criada por um administrativo que ainda não assinou o termo de responsabilidade.
export const FIRST_ACCESS_KEY = 'userPrimeiroAcesso';
export const isFirstAccessPending = (): boolean => {
  try {
    return localStorage.getItem(FIRST_ACCESS_KEY) === 'pendente';
  } catch {
    return false;
  }
};

export const clearSession = (): void => {
  trackLogout(); // registra a saída antes de apagar o login
  SESSION_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // armazenamento indisponível
    }
  });
};
