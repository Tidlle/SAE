import { callScript } from './feed';

export const USER_FUNCTIONS = ['Administrativo', 'Representante', 'Consultor'] as const;
export type UserFunction = (typeof USER_FUNCTIONS)[number];

export interface NewUserInput {
  name: string;
  newLogin: string;
  email: string;
  phone: string;
  cpf: string;
  password: string;
  // Função e perfil de acesso são o mesmo campo: o valor escolhido vale para as duas colunas da planilha.
  funcao: UserFunction | '';
  cnpj: string;
}

// Cria o usuário na aba Cadastros pelo Apps Script (só Administrativo). Entra liberado e com o primeiro acesso pendente.
export const createUser = async (input: NewUserInput, admin: { login: string }): Promise<void> => {
  await callScript({
    action: 'createUser',
    login: admin.login,
    name: input.name.trim(),
    newLogin: input.newLogin.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    cpf: input.cpf.trim(),
    password: input.password,
    funcao: input.funcao,
    cnpj: input.cnpj.trim(),
    profile: input.funcao,
  });
};

// A própria pessoa conclui o primeiro acesso depois de assinar o termo.
export const acceptTerms = async (user: { login: string }): Promise<void> => {
  await callScript({ action: 'acceptTerms', login: user.login });
};
