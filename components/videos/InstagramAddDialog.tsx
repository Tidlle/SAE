import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { Button } from '../UI';
import { AddResult, INSTAGRAM_ADD_LIMIT, addInstagramLinks, instagramCode } from '../../lib/instagramLive';
import { instagramPostUrl } from '../../lib/videos';

interface Props {
  open: boolean;
  sections: { id: string; title: string }[];
  knownCodes: Set<string>; // códigos dos posts que já estão no site
  onClose: () => void;
  onAdded: () => void;
}

const RESULT_TEXT: Record<AddResult['status'], string> = {
  added: 'Adicionado',
  duplicate: 'Já estava no site',
  invalid: 'Link inválido (use o endereço de um reel ou post do Instagram)',
  error: 'Não foi possível adicionar',
};

const fieldClass = 'w-full bg-sae-darker border border-sae-border rounded-lg px-3 py-2 text-sm text-sae-text placeholder:text-sae-muted focus:border-sae-accent outline-none';

// Janela para adicionar vídeos do Instagram colando os links (um por linha). Só o Administrativo vê o botão que a abre.
export const InstagramAddDialog: React.FC<Props> = ({ open, sections, knownCodes, onClose, onAdded }) => {
  const [text, setText] = useState('');
  const [section, setSection] = useState(sections[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [noPlayer, setNoPlayer] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<AddResult[] | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setTitle('');
    setNoPlayer(false);
    setError('');
    setResults(null);
    setSection(sections[0]?.id ?? '');
    areaRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
    // só quando a janela abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, sending, onClose]);

  if (!open) return null;

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const submit = async () => {
    setError('');
    if (lines.length === 0) return setError('Cole pelo menos um link do Instagram.');
    if (lines.length > INSTAGRAM_ADD_LIMIT) return setError(`Adicione no máximo ${INSTAGRAM_ADD_LIMIT} links por vez.`);

    // Links inválidos e os que já estão no site não vão ao servidor
    const local: AddResult[] = [];
    const toSend: string[] = [];
    const seen = new Set<string>();
    lines.forEach((line) => {
      const clean = instagramPostUrl(line);
      const code = instagramCode(line);
      if (!clean || !code) local.push({ url: line.slice(0, 120), status: 'invalid' });
      else if (knownCodes.has(code) || seen.has(code)) local.push({ url: clean, status: 'duplicate' });
      else {
        seen.add(code);
        toSend.push(clean);
      }
    });
    if (toSend.length === 0) {
      setResults(local);
      return;
    }

    setSending(true);
    try {
      const login = localStorage.getItem('userLogin') ?? '';
      const name = localStorage.getItem('userNome') ?? '';
      const sent = await addInstagramLinks({ urls: toSend, section, title: toSend.length === 1 ? title : '', noPlayer }, { login, name });
      setResults([...sent, ...local]);
      if (sent.some((item) => item.status === 'added')) onAdded();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível adicionar agora. Tente de novo.');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !sending && onClose()} />
      <div role="dialog" aria-modal="true" aria-labelledby="instagram-add-title" className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto bg-sae-card border border-sae-border rounded-2xl shadow-2xl p-5 sm:p-6 animate-fadeIn">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="instagram-add-title" className="text-xl font-heading font-bold text-sae-text">
              Adicionar vídeos do Instagram
            </h2>
            <p className="text-sm text-sae-muted mt-1">Cole os links dos reels ou posts. O SAE busca a capa sozinho e o vídeo aparece na página para todos.</p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Fechar" className="p-1.5 rounded-full text-sae-muted hover:text-sae-text hover:bg-sae-soft transition-colors shrink-0 disabled:opacity-50">
            <X size={22} />
          </button>
        </div>

        {results ? (
          <div className="space-y-4">
            <ul className="space-y-2" aria-live="polite">
              {results.map((item, index) => (
                <li key={`${item.url}-${index}`} className="flex items-start gap-2 text-sm">
                  {item.status === 'added' ? <CheckCircle2 size={18} className="text-sae-success shrink-0 mt-0.5" /> : <XCircle size={18} className={`${item.status === 'duplicate' ? 'text-sae-muted' : 'text-sae-danger'} shrink-0 mt-0.5`} />}
                  <span className="min-w-0">
                    <span className="text-sae-text break-all">{item.url}</span>
                    <span className="block text-sae-muted">
                      {RESULT_TEXT[item.status]}
                      {item.status === 'added' && !item.cover ? '. Sem capa (o Instagram não entregou a imagem)' : ''}
                      {item.status === 'added' && item.noPlayer ? '. Vai abrir direto no Instagram' : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setResults(null)}>
                Adicionar mais
              </Button>
              <Button size="sm" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-sae-text">
              Links (um por linha, até {INSTAGRAM_ADD_LIMIT})
              <textarea
                ref={areaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={5}
                placeholder="https://www.instagram.com/reel/..."
                className={`${fieldClass} mt-1 font-normal`}
              />
            </label>
            <label className="block text-sm font-semibold text-sae-text">
              Tema
              <select value={section} onChange={(event) => setSection(event.target.value)} className={`${fieldClass} mt-1 font-normal`}>
                {sections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            {lines.length === 1 && (
              <label className="block text-sm font-semibold text-sae-text">
                Título (opcional)
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={90} placeholder="Se ficar em branco, uso o início da legenda do post" className={`${fieldClass} mt-1 font-normal`} />
              </label>
            )}
            <label className="flex items-start gap-2 text-sm text-sae-text">
              <input type="checkbox" checked={noPlayer} onChange={(event) => setNoPlayer(event.target.checked)} className="mt-1" />
              <span>
                Abrir direto no Instagram (sem player)
                <span className="block text-xs text-sae-muted">Marque se o vídeo não abre dentro do SAE. Se o Instagram bloquear a exibição, o SAE já faz isso sozinho.</span>
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-sae-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit} disabled={sending}>
                {sending ? 'Adicionando...' : lines.length > 1 ? `Adicionar ${lines.length} links` : 'Adicionar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
