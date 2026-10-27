// Formulários da página Cadastros. Usado por ela e pelo Meu Assistente.
export interface FormBitrixData {
  type: 'bitrix';
  title: string;
  formId: string;
  scriptSrc: string;
}

export interface FormIframeData {
  type: 'iframe';
  title: string;
  iframeSrc: string;
}

export type FormScriptData = FormBitrixData | FormIframeData;

export const FORMS_DATA: Record<string, FormScriptData | null> = {
  'grad-unicv': {
    type: 'iframe',
    title: 'Cadastro Graduações UNICIVE',
    iframeSrc: 'https://pedapp.com.br/processo-seletivo/#/vendedor/unicv',
  },
  'grad-esp': {
    type: 'iframe',
    title: 'Cadastro Graduações Próprias',
    iframeSrc: 'https://pedapp.com.br/processo-seletivo/#/vendedor/esp',
  },
  'capacitacoes': {
    type: 'iframe',
    title: 'Cadastro Capacitações/Pós Presenciais/Residências',
    iframeSrc: 'https://pedapp.com.br/processo-seletivo/#/vendedor/pos',
  },
  'reativacao': {
    type: 'bitrix',
    title: 'Cadastro de Nova Inscrição + Reingresso',
    formId: 'inline/1312/6yz453',
    scriptSrc: 'https://cdn.bitrix24.com.br/b17708775/crm/form/loader_1312.js',
  },
};
