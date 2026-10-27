import React from 'react';
import { foldText } from './courses';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export const linkify = (text: string): React.ReactNode[] =>
  text.split(URL_PATTERN).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sae-accentText underline break-all hover:text-sae-accentHover"
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );

const relativeFormat = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export const timeAgo = (date: Date, now: Date = new Date()): string => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'agora mesmo';
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 7) return relativeFormat.format(Math.round(seconds / 86400), 'day');
  return date.toLocaleDateString('pt-BR');
};

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

export const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] || '';

// Copia para a área de transferência; usa um plano B quando a API moderna não está disponível.
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // segue para o plano B
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};

// Destaca o trecho buscado ignorando acentos e maiúsculas (mantém o texto original).
export const highlightMatch = (text: string, term: string): React.ReactNode => {
  const strip = foldText;
  const needle = strip(term.trim());
  const haystack = strip(text);
  if (!needle || haystack.length !== text.length) return text;
  const start = haystack.indexOf(needle);
  if (start === -1) return text;
  const end = start + needle.length;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-sae-accentSoft text-sae-accentText rounded px-0.5">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
};
