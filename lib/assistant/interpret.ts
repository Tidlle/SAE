import { callScript } from '../feed';
import { redactPersonalData } from './ai';
import type { LeadPatch } from './shared';

// Entende texto livre do vendedor no atendimento consultivo ("tenho uma pedagoga querendo crescer, com pouca verba").
// Só entra quando as regras não entenderam. A IA devolve apenas os campos do atendimento (nada de texto solto), o Apps Script
// valida cada um e o motor confere de novo contra as opções reais da planilha. Sem a IA configurada, o assistente pede para tocar numa opção.

const ENUMS: Record<string, string[]> = {
  degree: ['sim', 'nao', 'cursando'],
  modality: ['ead', 'semi', 'presencial', 'any'],
  urgency: ['now', 'later'],
};

// Confere o que veio do servidor (defesa dupla): só campos conhecidos, com tipo e tamanho certos.
export const cleanPatch = (raw: unknown): LeadPatch => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const patch: LeadPatch = {};
  const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  if (typeof source.degree === 'string' && ENUMS.degree.includes(source.degree)) patch.degree = source.degree as 'sim' | 'nao' | 'cursando';
  if (typeof source.modality === 'string' && ENUMS.modality.includes(source.modality)) patch.modality = source.modality;
  if (typeof source.urgency === 'string' && ENUMS.urgency.includes(source.urgency)) patch.urgency = source.urgency as 'now' | 'later';
  if (typeof source.budget === 'number' && Number.isFinite(source.budget) && source.budget >= 30 && source.budget <= 20000) patch.budget = Math.round(source.budget);
  (['tipo', 'area', 'ies', 'objective', 'polo', 'motivation', 'barrier'] as const).forEach((key) => {
    const value = text(source[key], 60);
    if (value) patch[key] = value;
  });
  return patch;
};

// Pergunta à IA (via Apps Script). Lança erro com `code` quando o servidor recusa (not_configured, auth, limit, error, empty).
export const askInterpret = async (text: string, step: string): Promise<LeadPatch> => {
  const login = localStorage.getItem('userLogin') ?? '';
  const result = await callScript({
    action: 'assistantInterpret',
    login,
    text: redactPersonalData(text).slice(0, 300),
    step,
  });
  return cleanPatch(result.data);
};
