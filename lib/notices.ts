import { callScript } from './feed';

export const NOTICE_LIMITS = { title: 120, message: 2000, sector: 40 } as const;

export interface NewNoticeInput {
  title: string;
  message: string;
  sector: string;
}

// Cria o aviso na aba Avisos pelo mesmo Apps Script do feed (a data é definida pelo servidor).
export const createNotice = async (input: NewNoticeInput, user: { login: string }): Promise<void> => {
  await callScript({
    action: 'createNotice',
    login: user.login,
    title: input.title.trim(),
    message: input.message.trim(),
    sector: input.sector.trim(),
  });
};

export interface NoticeRef {
  rowNumber: number;
  title: string;
  message: string;
  date: string;
  sector: string;
}

// Apaga o aviso na aba Avisos. O servidor confere se a linha ainda é a mesma antes de remover
// e guarda uma cópia na aba "Avisos removidos".
export const deleteNotice = async (notice: NoticeRef, user: { login: string }): Promise<void> => {
  await callScript({
    action: 'deleteNotice',
    login: user.login,
    row: String(notice.rowNumber),
    title: notice.title,
    message: notice.message,
    date: notice.date,
    sector: notice.sector,
  });
};
