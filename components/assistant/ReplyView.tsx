import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ExternalLink, Mail, Sparkles } from 'lucide-react';
import { Block, Chip, Reply } from '../../lib/assistant/engine';

// Só links internos do SAE, e-mail e http(s): nada que venha da planilha vira outro tipo de endereço.
const isInternal = (href: string): boolean => href.startsWith('/') && !href.startsWith('//');
const isSafeExternal = (href: string): boolean => /^(https?:\/\/|mailto:)/i.test(href);

const BlockView: React.FC<{ block: Block }> = ({ block }) => {
  switch (block.type) {
    case 'text':
      if (block.tone === 'warn') {
        return (
          <div className="flex items-start gap-2 rounded-lg bg-sae-accentSoft text-sae-accentText px-3 py-2 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{block.text}</span>
          </div>
        );
      }
      return <p className={block.tone === 'muted' ? 'text-xs text-sae-muted' : 'text-sm text-sae-text'}>{block.text}</p>;

    case 'course':
      return (
        <div className="pt-1 first:pt-0">
          <h4 className="font-heading font-bold text-sae-text leading-snug break-words">{block.title}</h4>
          {block.meta.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {block.meta.map((item) => (
                <span key={item} className="px-2 py-0.5 rounded-full bg-sae-soft border border-sae-border text-[11px] font-semibold text-sae-text">
                  {item}
                </span>
              ))}
            </div>
          )}
          {block.href && isInternal(block.href) && (
            <Link to={block.href} className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-sae-accentText hover:underline">
              <ExternalLink size={12} /> Abrir na página de cursos
            </Link>
          )}
        </div>
      );

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-sae-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sae-soft text-left text-[11px] uppercase tracking-wide text-sae-muted">
                {block.columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-bold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, index) => (
                <tr key={index} className="border-t border-sae-border">
                  {row.map((value, cellIndex) => (
                    <td key={cellIndex} className={`px-3 py-2 ${cellIndex === 0 ? 'font-semibold text-sae-text' : 'tabular-nums text-sae-text'}`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'facts':
      return (
        <dl className="space-y-1 text-sm">
          {block.items.map(([label, value]) => (
            <div key={label} className="sm:flex sm:gap-2">
              <dt className="text-sae-muted sm:shrink-0">{label}:</dt>
              <dd className="font-semibold text-sae-text break-words">{value}</dd>
            </div>
          ))}
        </dl>
      );

    case 'list':
      return (
        <div>
          {block.title && <p className="text-xs font-bold uppercase tracking-wide text-sae-muted mb-1">{block.title}</p>}
          <ul className="list-disc pl-5 space-y-0.5 text-sm text-sae-text">
            {block.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      );

    case 'coach':
      return (
        <div className="rounded-lg border-l-4 border-sae-accent bg-sae-accentSoft px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-sae-accentText">{block.note ? block.stage : `${block.stage} · pergunta para fazer ao aluno`}</p>
          <p className="text-sm font-semibold text-sae-text mt-0.5">{block.question}</p>
          {block.tip && <p className="text-xs text-sae-muted mt-1">{block.tip}</p>}
        </div>
      );

    case 'links':
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((item) =>
            isInternal(item.href) ? (
              <Link key={item.href} to={item.href} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sae-accent text-xs font-semibold text-sae-accentText hover:bg-sae-accentSoft">
                <ExternalLink size={13} /> {item.label}
              </Link>
            ) : isSafeExternal(item.href) ? (
              <a
                key={item.href}
                href={item.href}
                target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sae-accent text-xs font-semibold text-sae-accentText hover:bg-sae-accentSoft"
              >
                {item.href.startsWith('mailto:') ? <Mail size={13} /> : <ExternalLink size={13} />} {item.label}
              </a>
            ) : null,
          )}
        </div>
      );
  }
};

interface ReplyViewProps {
  reply: Reply;
  loadedAt: Date | null;
  onPick: (chip: Chip) => void;
  disabled?: boolean;
  showChips?: boolean;
}

export const ReplyView: React.FC<ReplyViewProps> = ({ reply, loadedAt, onPick, disabled = false, showChips = true }) => (
  <div className="space-y-3 min-w-0">
    {reply.tag === 'ia' && (
      <div className="flex items-start gap-2 rounded-lg bg-sae-soft border border-sae-border px-3 py-2 text-xs text-sae-muted">
        <Sparkles size={14} className="shrink-0 mt-0.5 text-sae-accentText" />
        <span>Resposta gerada por IA a partir dos dados do SAE. Confira valores, prazos e procedimentos antes de passar ao aluno.</span>
      </div>
    )}
    {reply.blocks.map((block, index) => (
      <BlockView key={index} block={block} />
    ))}

    {reply.sources.length > 0 && (
      <p className="text-[11px] text-sae-muted">
        Fonte: {reply.sources.join(' e ')}
        {loadedAt && reply.sources.some((source) => source.startsWith('aba') || source.startsWith('Calendário')) ? `, lida às ${loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}.
      </p>
    )}

    {showChips && reply.chips.length > 0 && (
      <div className="flex flex-wrap gap-2 pt-1">
        {reply.chips.map((chip) => (
          <button
            key={chip.query + chip.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(chip)}
            className="text-left px-3 py-1.5 rounded-full border border-sae-border bg-sae-card text-xs font-semibold text-sae-text hover:border-sae-accent hover:text-sae-accentText transition-colors disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>
    )}
  </div>
);
