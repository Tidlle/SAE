import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Button } from './UI';
import { copyText } from '../lib/text';
import { trackAction } from '../lib/tracker';

interface CopyButtonProps {
  getText: () => string;
  title: string;
  // Com `label`, vira um botão com texto; sem ele, é só o ícone.
  label?: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ getText, title, label, className = '' }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async () => {
    trackAction(`Copiar: ${title}`); // só o nome do botão, nunca o texto copiado
    const ok = await copyText(getText());
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  const Icon = state === 'copied' ? Check : state === 'failed' ? X : Copy;

  if (label) {
    return (
      <Button variant="secondary" size="sm" onClick={handleClick} title={title} className={`gap-1.5 ${className}`} aria-live="polite">
        <Icon size={16} />
        {state === 'copied' ? 'Copiado!' : state === 'failed' ? 'Não foi possível copiar' : label}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={state === 'copied' ? 'Copiado!' : state === 'failed' ? 'Não foi possível copiar' : title}
      aria-label={title}
      aria-live="polite"
      className={`flex-shrink-0 flex items-center justify-center bg-sae-darker border rounded-lg px-3 py-2 transition-colors min-h-[40px] ${
        state === 'copied'
          ? 'border-sae-success text-sae-success'
          : state === 'failed'
            ? 'border-sae-danger text-sae-danger'
            : 'border-sae-border/50 text-sae-muted hover:text-sae-text hover:border-sae-accent'
      } ${className}`}
    >
      <Icon size={16} />
    </button>
  );
};
