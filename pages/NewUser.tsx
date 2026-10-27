import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Breadcrumb, Button, Card, SectionTitle } from '../components/UI';
import { CopyButton } from '../components/CopyButton';
import { can } from '../lib/permissions';
import { NewUserInput, USER_FUNCTIONS, UserFunction, createUser } from '../lib/users';
import { cnpjDigits, isValidCpf, isValidEmail, maskCnpj, maskCpf, maskPhone, phoneDigits } from '../lib/masks';
import { firstName } from '../lib/text';

const inputClass =
  'w-full bg-sae-darker border border-sae-border rounded-lg px-3 py-2.5 text-sae-text placeholder:text-sae-muted/70 focus:border-sae-accent outline-none';
const labelClass = 'block text-xs font-bold uppercase tracking-wide text-sae-muted mb-1';

const EMPTY: NewUserInput = {
  name: '',
  newLogin: '',
  email: '',
  phone: '',
  cpf: '',
  password: '',
  funcao: '',
  cnpj: '',
};

const validate = (form: NewUserInput): string => {
  if (form.name.trim().length < 3) return 'Informe o nome completo.';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(form.newLogin.trim())) return 'O usuário deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.';
  if (!isValidEmail(form.email)) return 'Informe um e-mail válido.';
  const phone = phoneDigits(form.phone);
  if (phone < 10 || phone > 11) return 'Informe o celular com DDD.';
  if (!isValidCpf(form.cpf)) return 'CPF inválido.';
  if (form.password.trim().length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  if (!form.funcao) return 'Escolha a função do usuário.';
  if ((form.funcao === 'Representante' || form.funcao === 'Consultor') && cnpjDigits(form.cnpj) !== 14) return 'Informe o CNPJ com 14 dígitos.';
  return '';
};

export const NewUser: React.FC = () => {
  const adminLogin = localStorage.getItem('userLogin') ?? '';
  const [form, setForm] = useState<NewUserInput>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<NewUserInput | null>(null);

  if (!can('createUser')) return <Navigate to="/" replace />;

  const needsCnpj = form.funcao === 'Representante' || form.funcao === 'Consultor';
  const update = <K extends keyof NewUserInput>(key: K, value: NewUserInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createUser({ ...form, cnpj: needsCnpj ? form.cnpj : '' }, { login: adminLogin });
      setCreated(form);
      setForm(EMPTY);
      setShowPassword(false);
    } catch (problemFound) {
      setError(problemFound instanceof Error ? problemFound.message : 'Não foi possível criar o usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  const accessMessage = (user: NewUserInput): string =>
    [
      `Olá, ${firstName(user.name)}! Seu acesso ao SAE foi criado.`,
      '',
      `Endereço: ${window.location.origin}${window.location.pathname}`,
      `Usuário: ${user.newLogin.trim()}`,
      `Senha: ${user.password}`,
      '',
      'No primeiro acesso você vai ler e assinar o Termo de Responsabilidade antes de usar o sistema.',
    ].join('\n');

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <Breadcrumb items={[{ label: 'Novo usuário' }]} />
        <SectionTitle title="Novo usuário" subtitle="Cadastre a pessoa e passe a ela os dados de acesso. No primeiro acesso ela assina o termo." />

        <div className="max-w-3xl mx-auto space-y-6">
          {created && (
            <Card className="p-6 border-sae-success/40">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-sae-success shrink-0 mt-0.5" size={24} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-heading font-bold text-sae-text">Usuário criado</h2>
                  <p className="text-sm text-sae-muted mt-1">
                    {created.name.trim()} já pode entrar. Envie os dados de acesso abaixo: no primeiro login ela precisará assinar o termo antes de usar o SAE.
                  </p>
                  <pre className="mt-4 p-4 rounded-lg bg-sae-soft text-sm text-sae-text whitespace-pre-wrap break-words font-sans">{accessMessage(created)}</pre>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <CopyButton label="Copiar dados de acesso" title="Copiar a mensagem com os dados de acesso" getText={() => accessMessage(created)} />
                    <Button size="sm" variant="outline" onClick={() => setCreated(null)}>
                      Cadastrar outro
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {!created && (
            <Card className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className={labelClass} htmlFor="nu-name">Nome completo</label>
                    <input id="nu-name" className={inputClass} value={form.name} maxLength={100} onChange={(e) => update('name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nu-login">Usuário (login)</label>
                    <input id="nu-login" className={inputClass} value={form.newLogin} maxLength={40} autoComplete="off" onChange={(e) => update('newLogin', e.target.value.replace(/\s/g, ''))} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nu-password">Senha</label>
                    <div className="relative">
                      <input
                        id="nu-password"
                        className={`${inputClass} pr-11`}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        maxLength={100}
                        autoComplete="new-password"
                        onChange={(e) => update('password', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sae-muted hover:text-sae-text"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nu-email">E-mail</label>
                    <input id="nu-email" className={inputClass} type="email" value={form.email} maxLength={120} onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nu-phone">Celular</label>
                    <input id="nu-phone" className={inputClass} inputMode="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => update('phone', maskPhone(e.target.value))} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nu-cpf">CPF</label>
                    <input id="nu-cpf" className={inputClass} inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => update('cpf', maskCpf(e.target.value))} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nu-funcao">Função</label>
                    <select id="nu-funcao" className={inputClass} value={form.funcao} onChange={(e) => update('funcao', e.target.value as UserFunction | '')}>
                      <option value="">Selecione a função</option>
                      {USER_FUNCTIONS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-sae-muted mt-1">Define também o acesso: Consultor e Representante não publicam no feed, não criam avisos e não criam usuários.</p>
                  </div>
                  {needsCnpj && (
                    <div>
                      <label className={labelClass} htmlFor="nu-cnpj">CNPJ</label>
                      <input id="nu-cnpj" className={inputClass} inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => update('cnpj', maskCnpj(e.target.value))} />
                    </div>
                  )}
                </div>

                {error && (
                  <p role="alert" className="text-sm text-sae-danger">
                    {error}
                  </p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    <UserPlus size={18} className="mr-2" /> {submitting ? 'Criando...' : 'Criar usuário'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};
