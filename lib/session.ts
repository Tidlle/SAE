import { trackLogout } from './tracker';
import { cell, fetchSheet } from './sheets';

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

// Quem entrou antes de o login passar a ser guardado (`userLogin`) continua logado sem ele, e sem o login o servidor não
// sabe quem está pedindo. Aqui o login é recuperado pelo nome, na aba Cadastros; só vale se o nome tiver um único login
// liberado. Devolve '' quando não dá para saber (a pessoa precisa sair e entrar de novo).
export const recoverLogin = async (): Promise<string> => {
  try {
    const name = (localStorage.getItem('userNome') ?? '').trim();
    if (!name) return '';
    const rows = await fetchSheet('Cadastros!A:I');
    const logins = new Set(
      rows
        .filter((row) => cell(row, 0) === name && cell(row, 8).toUpperCase() === 'SIM' && cell(row, 1))
        .map((row) => cell(row, 1))
    );
    if (logins.size !== 1) return '';
    const login: string = Array.from(logins)[0];
    localStorage.setItem('userLogin', login);
    return login;
  } catch {
    return '';
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
