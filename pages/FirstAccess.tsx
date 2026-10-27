import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button, Card, Logo } from '../components/UI';
import { SignaturePad, SignaturePadHandle } from '../components/SignaturePad';
import { fetchSheetRanges } from '../lib/sheets';
import {
  TERMS_CLOSING,
  TERMS_PARAGRAPHS,
  TERMS_SIGILO_INTRO,
  TERMS_SIGILO_ITEMS,
  TERMS_SIGILO_TITLE,
  TermsSignerData,
} from '../lib/terms';
import { buildTermPdf, uploadTermPdf } from '../lib/termPdf';
import { acceptTerms } from '../lib/users';
import { FIRST_ACCESS_KEY, clearSession, isFirstAccessPending } from '../lib/session';
import { firstName } from '../lib/text';

// Primeiro acesso de uma conta criada por um administrativo: ler o termo, assinar e aceitar.
export const FirstAccess: React.FC = () => {
  const navigate = useNavigate();
  const login = localStorage.getItem('userLogin') ?? '';
  const loggedIn = localStorage.getItem('usuarioAutenticado') === 'true';
  const pending = isFirstAccessPending();
  const name = localStorage.getItem('userNome') ?? '';

  const padRef = useRef<SignaturePadHandle>(null);
  const [signer, setSigner] = useState<TermsSignerData | null>(null);
  const [signerState, setSignerState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [hasSignature, setHasSignature] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Dados que vão impressos no termo: nome, CPF, e-mail e celular (a senha não é lida nem impressa).
  useEffect(() => {
    if (!loggedIn || !pending || !login) return;
    let active = true;
    setSignerState('loading');
    fetchSheetRanges(['Cadastros!A:D', 'Cadastros!G:G'])
      .then(([basics, cpfs]) => {
        if (!active) return;
        const index = basics.findIndex((row, i) => i > 0 && (row[1] ?? '').trim() === login);
        if (index === -1) throw new Error('Cadastro não encontrado');
        const row = basics[index] ?? [];
        setSigner({
          name: (row[0] ?? '').trim() || name,
          email: (row[2] ?? '').trim(),
          phone: (row[3] ?? '').trim(),
          cpf: ((cpfs[index] ?? [])[0] ?? '').toString().trim(),
        });
        setSignerState('ready');
      })
      .catch(() => active && setSignerState('failed'));
    return () => {
      active = false;
    };
  }, [loggedIn, pending, login, name, reloadKey]);

  if (!loggedIn) return <Navigate to="/login" replace />;
  if (!pending) return <Navigate to="/" replace />;

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !signer) return;
    const signature = padRef.current?.toDataURL() ?? '';
    if (!hasSignature || !signature) {
      setError('Assine no campo acima antes de continuar.');
      return;
    }
    if (!accepted) {
      setError('Marque que você leu e aceita o Termo de Responsabilidade.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const pdf = buildTermPdf(signer, signature);
      await uploadTermPdf(pdf, `${signer.name.replace(/[\/:*?"<>|]/g, ' ').trim() || login}.pdf`);
      await acceptTerms({ login });
      localStorage.removeItem(FIRST_ACCESS_KEY);
      navigate('/', { replace: true });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = signerState === 'ready' && hasSignature && accepted && !submitting;

  return (
    <div className="min-h-screen px-4 py-8 flex items-start sm:items-center justify-center">
      <Card className="w-full max-w-3xl p-6 md:p-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <Logo className="h-16 w-auto" />
          <Button variant="ghost" size="sm" onClick={handleLogout} disabled={submitting}>
            <LogOut size={16} className="mr-2" /> Sair
          </Button>
        </div>

        <h1 className="text-2xl md:text-3xl font-heading font-bold text-sae-text flex items-center gap-2">
          <ShieldCheck className="text-sae-accentText" size={28} /> Primeiro acesso
        </h1>
        <p className="text-sae-muted mt-2">
          {firstName(name) ? `Olá, ${firstName(name)}. ` : ''}Antes de usar o SAE, leia o Termo de Responsabilidade, assine e aceite.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div
            tabIndex={0}
            aria-label="Texto do Termo de Responsabilidade"
            className="max-h-72 overflow-y-auto rounded-lg border border-sae-border bg-sae-soft p-5 text-sm text-sae-text leading-relaxed space-y-3 text-justify focus:border-sae-accent outline-none"
          >
            <h2 className="text-base font-heading font-bold">Termo de Responsabilidade</h2>
            {TERMS_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <h3 className="font-heading font-bold">{TERMS_SIGILO_TITLE}</h3>
            <p>{TERMS_SIGILO_INTRO}</p>
            <ol className="list-decimal pl-5 space-y-2">
              {TERMS_SIGILO_ITEMS.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
            <p>{TERMS_CLOSING}</p>
          </div>

          <div>
            <h2 className="font-heading font-bold text-sae-text mb-2">Sua assinatura</h2>
            <SignaturePad ref={padRef} onChange={setHasSignature} disabled={submitting} />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 w-5 h-5 accent-[#a02d32]"
            />
            <span className="text-sm text-sae-text">Li e aceito o Termo de Responsabilidade.</span>
          </label>

          {signerState === 'failed' && (
            <div className="text-sm text-sae-danger flex flex-wrap items-center gap-3" role="alert">
              Não foi possível carregar seus dados para o termo.
              <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                Tentar de novo
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-sae-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? 'Registrando...' : 'Aceitar e continuar'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
