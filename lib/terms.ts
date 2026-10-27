export const TERMS_PARAGRAPHS = [
    'ITEQ LESTE LTDA ME, inscrita no CNPJ sob o nº 24.180.451/0002-16, com sede na Rua Lagoa Tai Grande, nº 91, Bairro: Itaquera, São Paulo – SP – CEP: 08290-500, em virtude da entrada em vigor da Lei 13.709/2018, Lei Geral de Proteção de Dados Pessoais – LGPD e Medida Provisória nº 959/2020, comunica a todos os Funcionários, Colaboradores, Parceiros e Prestadores de Serviço, o quanto segue.',
    'Considerando que a referida lei disciplina "o tratamento de dados pessoais, inclusive nos meios digitais, por pessoa natural ou por pessoa jurídica de direito público ou privado, com o objetivo de proteger os direitos fundamentais de liberdade e de privacidade e o livre desenvolvimento da personalidade da pessoa natural";',
    'Considerando que a LGPD define como dado pessoal: "informação relacionada a pessoa natural identificada ou identificável" e como tratamento: "toda operação realizada com dados pessoais, como as que se referem a coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração";',
    'Em que pese os dados tratados e encaminhados por esta Instituição, o sejam para cumprimento de dever legal, o que torna prescindível o consentimento do titular dos dados, exceto no caso de dados sensíveis, ficam, através do presente Termo de Confidencialidade, todos os funcionários, colaboradores, parceiros e prestadores de serviço, advertidos e compromissados a não divulgar, por qualquer meio que seja, os dados pessoais a que tiverem acesso em virtude da função desenvolvida nesta serventia, salvo expressa autorização deste oficial e/ou do Encarregado de LGPD.',
    'Por este motivo, declaro que fui devidamente orientado, inclusive por escrito, pela Instituição, sobre os deveres, requisitos e responsabilidades decorrentes da Lei n. 13.709, de 14 de agosto de 2018, Lei Geral de Proteção de Dados Pessoais – LGPD, sobre as formas de coleta, tratamento e compartilhamento de dados pessoais a que tiver acesso, bem como respectivas responsabilidades, em especial sobre aqueles que constam nos artigos 7º a 10 e 42 a 45 da LGPD.',
];

export const TERMS_SIGILO_INTRO = 'Todos os funcionários, colaboradores, parceiros e prestadores de serviço ficam expressamente proibidos de:';

export const TERMS_SIGILO_ITEMS = [
    'Enviar, divulgar ou compartilhar capturas de tela (prints) ou qualquer outro tipo de imagem ou documento que contenha dados pessoais ou informações confidenciais da empresa, salvo mediante autorização formal da direção ou do Encarregado de Proteção de Dados (DPO).',
    'Compartilhar, divulgar ou repassar seu acesso pessoal ou qualquer meio de autenticação vinculado aos sistemas e dados da empresa, a fim de prevenir o acesso não autorizado e proteger as informações sob responsabilidade da ITEQ LESTE LTDA ME. Sendo autorizado somente o envio dos links de vídeos tutoriais disponíveis no SAE (Sistema de Apoio Educacional) presentes na aba "Vídeos Tutoriais".',
];

export const TERMS_CLOSING = 'Declaro, ainda, ter conhecimento sobre as medidas de segurança, técnicas e administrativas, aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito. A responsabilidade de qualquer pessoa que intervenha em uma das fases abrangidas pelo fluxo dos dados pessoais subsiste mesmo após o término do tratamento. Por fim, declaro ciência sobre as condições do tratamento dos meus próprios dados pessoais pela Instituição.';

export const TERMS_SIGILO_TITLE = 'Sigilo e Proibição de Compartilhamento de Informações';

export interface TermsSignerData {
  name: string;
  cpf: string;
  email: string;
  phone: string;
}

// Texto completo do termo, com os dados da pessoa no fim. A senha não é impressa no documento.
export const buildTermsText = (data: TermsSignerData): string => {
  const sigiloItems = TERMS_SIGILO_ITEMS.map((item, idx) => `${idx + 1}. ${item}`).join('\n\n');
  return [
    'Termo de Responsabilidade',
    ...TERMS_PARAGRAPHS,
    TERMS_SIGILO_TITLE,
    TERMS_SIGILO_INTRO,
    sigiloItems,
    TERMS_CLOSING,
    `Nome: ${data.name}\nCPF: ${data.cpf}\nEmail: ${data.email}\nCelular: ${data.phone}\nData: ${new Date().toLocaleDateString('pt-BR')}`,
  ].join('\n\n');
};
