// Regras do "O que posso estudar?": o que cada formação permite cursar. Usado pela página e pelo Meu Assistente.

export const EDUCATION_OPTIONS: { value: string; label: string }[] = [
    { value: 'ensino-medio', label: 'Ensino Médio' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'magisterio', label: 'Magistério' },
    { value: 'bacharel', label: 'Bacharel' },
    { value: 'tecnologo', label: 'Tecnólogo' },
    { value: 'licenciatura', label: 'Licenciatura' },
];

// Tipos de curso (coluna "Tipo" da aba Cursos) que cada formação permite cursar.
export const eligibleTypes = (education: string): string[] => {
    switch (education) {
        case 'ensino-medio':
        case 'tecnico':
            return ['Licenciatura', 'Bacharelado', 'Tecnológico', 'Curso Livre', 'Atualização', 'Capacitação'];
        case 'magisterio':
            return ['Licenciatura', 'Bacharelado', 'Tecnológico', 'Curso Livre', 'Atualização', 'Capacitação', 'Pedagogia para Magistério'];
        case 'bacharel':
        case 'tecnologo':
            return ['Licenciatura', 'Bacharelado', 'Tecnológico', 'Formação Pedagógica - R2', 'Pós-Graduação', 'Atualização', 'Capacitação', 'Curso Livre', 'Aperfeiçoamento', 'Extensão'];
        case 'licenciatura':
            return ['2ª Licenciatura', 'Licenciatura', 'Bacharelado', 'Tecnológico', 'Pós-Graduação', 'Atualização', 'Capacitação', 'Curso Livre', 'Aperfeiçoamento', 'Extensão'];
        default:
            return [];
    }
};
