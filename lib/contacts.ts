// E-mails por IES e assunto. Usado pela página Contatos e pelo Meu Assistente.
export interface IesContact {
    name: string;
    emails: { label: string; email: string }[];
}

export const IES_CONTACTS: Record<string, IesContact> = {
    'esp': {
        name: 'ESP',
        emails: [
            { label: 'Declaração de Conclusão', email: 'coordenacao@faculdadeesp.com.br' },
            { label: 'Entrega de Atividade', email: 'atendimento@faculdadeesp.com.br' },
            { label: 'Publicação de Artigo-Revista', email: 'artigo.revista@suporteies.com.br' },
            { label: 'Assuntos Gerais', email: 'secretaria@faculdadeesp.com.br' },
            { label: 'Assuntos de Pós-Graduação', email: 'certificados@faculdadeesp.com.br' },
            { label: 'Assuntos de Diplomas', email: 'diplomas01@faculdadeesp.com.br' },
            { label: 'Assuntos de Extensão e Aperfeiçoamento', email: 'aperf.extensao@certificadoies.com.br' },
            { label: 'Autorização de Retirada', email: 'atendimento@suporteies.com.br' },
            { label: 'Qualidade', email: 'relacionamentos@faculdadeesp.com.br' },
            { label: 'Financeiro', email: 'financeiro01@iteqescolas.com.br' },
            { label: 'Negociação', email: 'negociacao@iteqescolas.com.br' },
        ]
    },
    'alpha-chanel': {
        name: 'Alpha Channel',
        emails: [
            { label: 'Declaração de Conclusão', email: 'coordenacao@faculdadealphachannel.com.br' },
            { label: 'Entrega de atividades', email: 'atendimento@faculdadealphachannel.com.br' },
            { label: 'Publicação de Artigo-Revista', email: 'artigo.revista@suporteies.com.br' },
            { label: 'Assuntos Gerais', email: 'secretaria@faculdadealphachannel.com.br' },
            { label: 'Assuntos de Pós-Graduação', email: 'certificados@faculdadealphachannel.com.br' },
            { label: 'Assuntos de Diplomas', email: 'diplomas@faculdadealphachannel.com.br' },
            { label: 'Assuntos de Extensão', email: 'aperf.extensao@certificadoies.com.br' },
            { label: 'Autorização de Retirada', email: 'atendimento@suporteies.com.br' },
            { label: 'Qualidade', email: 'relacionamentos@faculdadealphachannel.com.br' },
            { label: 'Financeiro', email: 'financeiro01@iteqescolas.com.br' },
            { label: 'Negociação', email: 'negociacao@iteqescolas.com.br' },
        ]
    },
    'ucesp': {
        name: 'UCESP',
        emails: [
            { label: 'Pedagógico || Secretaria', email: 'atendimento@faculdadeuceesp.com.br' },
            { label: 'Publicação de Artigo-Revista', email: 'artigo.revista@suporteies.com.br' },
            { label: 'Assuntos de Pós-Graduação', email: 'certificados@ucesp.com.br' },
            { label: 'Assuntos de Diplomas', email: 'diplomas01@ucesp.com.br' },
            { label: 'Assuntos de Extensão', email: 'aperf.extensao@certificadoies.com.br' },
            { label: 'Autorização de Retirada', email: 'atendimento@suporteies.com.br' },
            { label: 'Qualidade', email: 'relacionamentos@ucesp.com.br' },
            { label: 'Financeiro', email: 'financeiro01@iteqescolas.com.br' },
            { label: 'Negociação', email: 'negociacao@iteqescolas.com.br' },
        ]
    }
};

// O que cada núcleo/departamento faz
export const NUCLEO_INFO: Record<string, string[]> = {
    'coordenacao': [
        'Suporte ao aluno, para acesso à plataforma;',
        'Tutoria - Suporte disponível para ajudar o aluno na realização de atividades e trabalhos;',
        'Análise de atividades entregues (Artigo, Estágio, Dissertações);',
        'Revisão e atribuição de notas;',
        'Preparo de material para publicação da revista mensal;',
        'Elaboração de ementas para posterior criação de cursos;',
        'Emissão de documentos acadêmicos (Declaração de Matricula, Histórico Parcial);',
        'Liberação de Requerimentos de solicitação de certificados;',
        'Cadastro de cursos e turmas na plataforma;',
        'Vestibular – análise para aprovação de processo seletivo.'
    ],
    'financeiro': [
        'Criação dos preços e planos de todos os cursos e combos (tabela de valores);',
        'Treinamento da plataforma (Cadastro);',
        'Alteração de valores, parcelamento, método de pagamento;',
        'Criação de link de taxa de matrícula;',
        'Baixa financeira manual (se necessário);',
        'Negociações / cobrança;',
        'Envio de boleto para os alunos quando solicitado;',
        'Rematrícula de primeira graduação;',
        'Trancamento / Destrancamento / Cancelamento;',
        'Readaptação / Reativação;',
        'Troca de Curso;',
        'Fechamento - relatório de matrículas mensal;',
        'Análise de solicitação de certificação e liberação de lotes;'
    ],
    'certificacao': [
        'Aprovação e emissão das solicitações de certificados para que sejam disponibilizados no portal do aluno;',
        'Contato com o aluno para ajustes de informações;',
        'Suporte ao aluno sobre dúvidas e prazos.'
    ],
    'documentacao': [
        'Análise de documentação pessoal, seguindo os critérios para cada tipo de curso;',
        'Envio de notificação aos alunos com processo de Certificação em pausa devido documentação pendente;',
        'Suporte ao aluno.'
    ],
    'rh': [
        'Contrato de Experiência;',
        'Abertura de Conta no Banco correspondente ou Conta Salário;',
        'Benefícios: VT, VR, Vale Saúde entre outros;',
        'Pagamentos e Descontos;',
        'Demonstrativo de Pagamento;',
        'Atestados;',
        'Férias;',
        'Controle de Horas;'
    ],
    'qualidade': [
        'Boas Vindas – Envio de acesso ao portal e login;',
        'Pós Venda - Acompanhamento de novos alunos;',
        'Relatório semanal – Monitoramento do AVA;',
        'Pesquisa de Satisfação – A cada 3 meses;',
        'Casos Críticos / Reclame Aqui – Atendimento prioritário a insatisfações;',
        'Melhorias – Aprimoramento da comunicação.'
    ],
    'licenciatura': [
        'Montagem de lote mensal de documentação;',
        'Envio de lotes para registro;',
        'Recebimento e baixa de lotes;',
        'Notificação ao aluno sobre documentos;',
        'Ocorrência no sistema Lyra;',
        'Suporte sobre consulta pública e recusa de diploma.'
    ]
};

export const NUCLEO_OPTIONS: { value: string; label: string }[] = [
    { value: 'coordenacao', label: 'Coordenação / Secretaria' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'certificacao', label: 'Certificação' },
    { value: 'licenciatura', label: 'Licenciaturas e R2' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'rh', label: 'RH / Depto Pessoal' },
    { value: 'qualidade', label: 'Qualidade' },
];

// Opções da lista de IES da página Contatos (valor = chave de IES_CONTACTS).
export const IES_OPTIONS: { value: string; label: string }[] = [
    { value: 'esp', label: 'ESP' },
    { value: 'alpha-chanel', label: 'Alpha Channel' },
    { value: 'ucesp', label: 'UCESP' },
];
