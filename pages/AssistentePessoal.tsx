import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button, Breadcrumb } from '../components/UI';
import { CopyButton } from '../components/CopyButton';
import { ReplyView } from '../components/assistant/ReplyView';
import { Send, Bot, User, Sparkles, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { Catalog, loadCatalog } from '../lib/assistant/catalog';
import { Agenda, loadAgenda } from '../lib/assistant/calendar';
import { AI_FALLBACK_TAGS, AiTurn, askAi } from '../lib/assistant/ai';
import { Block, Chip, Context, EMPTY_CONTEXT, HELP_CHIPS, Reply, answerQuestion, replyToPlain } from '../lib/assistant/engine';
import { trackAction } from '../lib/tracker';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  reply?: Reply;
  loading?: boolean; // esperando dados (calendário de aulas) ou a IA
  loadingText?: string;
  loadedAt?: Date; // quando os dados da resposta foram lidos
  timestamp: Date;
}

// Meu Assistente: responde sobre cursos, valores, combos e documentos lendo a planilha do SAE.
// Não usa IA nem chave de API: a resposta sai direto das células e sempre mostra a fonte.
export const AssistentePessoal: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Context>(EMPTY_CONTEXT);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [aiOff, setAiOff] = useState(false); // a IA não está configurada no servidor: para de tentar nesta sessão
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await loadCatalog(force));
    } catch {
      setError('Não foi possível carregar a base de cursos agora. Verifique sua conexão e tente atualizar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // `shown` é o que aparece como fala da pessoa; `query` é o que o motor recebe (os botões usam um código interno).
  const send = (shown: string, query: string = shown) => {
    const trimmed = query.trim();
    if (!trimmed || !catalog) return;
    const now = Date.now();
    const userMessage: Message = { id: `${now}-u`, role: 'user', text: shown.trim(), timestamp: new Date(now) };
    const answer = answerQuestion(catalog, trimmed, ctx, agenda);
    setInput('');
    inputRef.current?.focus();

    // O calendário de aulas é lido do Google Agenda sob demanda: mostra "consultando" e responde quando chegar
    if (answer.needs === 'agenda') {
      const pendingId = `${now}-a`;
      setMessages((current) => [...current, userMessage, { id: pendingId, role: 'assistant', loading: true, timestamp: new Date(now) }]);
      loadAgenda()
        .then((loaded) => {
          setAgenda(loaded);
          const done = answerQuestion(catalog, trimmed, ctx, loaded);
          setCtx(done.ctx);
          trackAction(`Assistente: ${done.reply.tag}`);
          setMessages((current) => current.map((message) => (message.id === pendingId ? { ...message, loading: false, reply: done.reply, loadedAt: loaded.loadedAt } : message)));
        })
        .catch(() => {
          const failed: Reply = { tag: 'agenda:erro', blocks: [{ type: 'text', tone: 'warn', text: 'Não foi possível ler a agenda de aulas agora. Tente de novo em instantes ou abra o Calendário de Aulas.' }, { type: 'links', items: [{ label: 'Abrir Calendário de Aulas', href: '/cursos/calendario' }] }], chips: [], sources: [] };
          trackAction(`Assistente: ${failed.tag}`);
          setMessages((current) => current.map((message) => (message.id === pendingId ? { ...message, loading: false, reply: failed } : message)));
        });
      return;
    }

    // Reserva com IA: só quando a base do SAE não soube responder. A pergunta, sem dados pessoais, vai ao Apps Script.
    if (AI_FALLBACK_TAGS.has(answer.reply.tag) && !aiOff) {
      const pendingId = `${now}-a`;
      setCtx(answer.ctx);
      const history: AiTurn[] = messagesRef.current
        .filter((message) => !message.loading && (message.text || message.reply))
        .slice(-6)
        .map((message) => ({ role: message.role, text: message.role === 'user' ? message.text ?? '' : replyToPlain(message.reply as Reply).slice(0, 600) }));
      setMessages((current) => [...current, userMessage, { id: pendingId, role: 'assistant', loading: true, loadingText: 'Consultando a IA...', timestamp: new Date(now) }]);
      askAi({ question: trimmed, history, catalog, agenda })
        .then((reply) => {
          trackAction('Assistente: ia');
          setMessages((current) => current.map((message) => (message.id === pendingId ? { ...message, loading: false, reply } : message)));
        })
        .catch((error: Error & { code?: string }) => {
          const notConfigured = error.code === 'not_configured' || error.code === 'auth' || /Ação inválida/.test(error.message);
          if (notConfigured) setAiOff(true);
          // volta à resposta da base; só avisa quando a IA existe mas recusou (limite) ou falhou
          const note: Block[] = notConfigured ? [] : [{ type: 'text', tone: 'muted', text: error.code === 'limit' ? error.message : 'A IA não está disponível agora.' }];
          trackAction(`Assistente: ia-${notConfigured ? 'desligada' : error.code ?? 'erro'}`);
          const fallback: Reply = { ...answer.reply, blocks: [...answer.reply.blocks, ...note] };
          setMessages((current) => current.map((message) => (message.id === pendingId ? { ...message, loading: false, reply: fallback } : message)));
        });
      return;
    }

    setCtx(answer.ctx);
    trackAction(`Assistente: ${answer.reply.tag}`); // só o tipo da resposta, nunca o texto da pergunta
    const loadedAt = answer.reply.tag.startsWith('agenda') && agenda ? agenda.loadedAt : catalog.loadedAt;
    setMessages((current) => [...current, userMessage, { id: `${now}-a`, role: 'assistant', reply: answer.reply, loadedAt, timestamp: new Date(now) }]);
  };

  const handleSend = () => send(input);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handlePick = (chip: Chip) => send(chip.label, chip.query);

  const handleNewConversation = () => {
    setMessages([]);
    setCtx(EMPTY_CONTEXT);
    setInput('');
    inputRef.current?.focus();
  };

  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const userName = localStorage.getItem('userNome')?.split(' ')[0] || 'Colaborador';
  const ready = !loading && catalog !== null;

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-6 h-[calc(100vh-80px)] flex flex-col">
        <Breadcrumb items={[{ label: 'Meu Assistente Pessoal' }]} />

        <Card className="flex-1 flex flex-col overflow-hidden border-sae-accent/20 bg-sae-darker/80 backdrop-blur-xl">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-sae-border flex items-center justify-between gap-3 bg-gradient-to-r from-sae-accent/10 via-transparent to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-sae-accent/20 flex items-center justify-center border border-sae-accent/50 shrink-0">
                <Sparkles size={24} className="text-sae-accentText" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-sae-text">Meu Assistente Pessoal</h2>
                <p className="text-xs text-sae-muted flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ready ? 'bg-sae-success animate-pulse' : error ? 'bg-sae-danger' : 'bg-sae-muted'}`}></span>
                  {loading
                    ? 'Carregando a base de cursos...'
                    : catalog
                      ? `${catalog.courses.length} cursos, ${catalog.combos.length} combos e ${catalog.presential.length} turmas presenciais, lidos às ${catalog.loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Base indisponível'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => load(true)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-xs text-sae-muted hover:text-sae-text hover:bg-sae-accent/10 rounded-lg transition-colors border border-sae-border hover:border-sae-accent/30 disabled:opacity-50"
                title="Recarregar os dados da planilha"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-2 px-3 py-2 text-xs text-sae-muted hover:text-sae-text hover:bg-sae-accent/10 rounded-lg transition-colors border border-sae-border hover:border-sae-accent/30"
                title="Nova Conversa"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Nova Conversa</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-10 animate-fadeIn">
                <div className="w-20 h-20 rounded-full bg-sae-accent/10 flex items-center justify-center mb-6 border border-sae-accent/30">
                  <Bot size={40} className="text-sae-accentText" />
                </div>
                <h3 className="text-2xl font-bold text-sae-text mb-2">Olá, {userName}!</h3>
                <p className="text-sae-muted max-w-md mb-8">
                  Pergunte sobre <strong className="text-sae-text">valores</strong>, <strong className="text-sae-text">combos</strong>,{' '}
                  <strong className="text-sae-text">documentos</strong>, <strong className="text-sae-text">listas e comparações</strong>,{' '}
                  <strong className="text-sae-text">aulas e turmas</strong>, <strong className="text-sae-text">instituições</strong>,{' '}
                  <strong className="text-sae-text">vídeos</strong>, <strong className="text-sae-text">cadastros</strong> e{' '}
                  <strong className="text-sae-text">contatos</strong>. Eu respondo direto da planilha e das páginas do SAE e mostro a fonte.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
                  {HELP_CHIPS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => send(suggestion.label, suggestion.query)}
                      disabled={!ready}
                      className="text-left p-3 bg-sae-card/50 border border-sae-border rounded-lg text-sm text-sae-muted hover:text-sae-text hover:border-sae-accent/40 hover:bg-sae-accent/5 transition-all disabled:opacity-50"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                <div className={`flex items-start gap-3 min-w-0 ${message.role === 'user' ? 'max-w-[85%] flex-row-reverse' : 'max-w-full sm:max-w-[92%]'}`}>
                  <div
                    className={`w-8 h-8 rounded-full hidden sm:flex items-center justify-center shrink-0 mt-1 ${
                      message.role === 'user' ? 'bg-sae-accent/20 border border-sae-accent/40' : 'bg-sae-card border border-sae-border'
                    }`}
                  >
                    {message.role === 'user' ? <User size={16} className="text-sae-accentText" /> : <Bot size={16} className="text-sae-muted" />}
                  </div>

                  <div
                    className={`rounded-2xl p-3 sm:p-4 min-w-0 ${
                      message.role === 'user'
                        ? 'bg-sae-accent/15 border border-sae-accent/25 rounded-tr-sm'
                        : 'bg-sae-card/80 border border-sae-border rounded-tl-sm'
                    }`}
                  >
                    {message.role === 'assistant' && message.loading ? (
                      <div className="flex items-center gap-2 text-sm text-sae-muted">
                        <RefreshCw size={14} className="animate-spin" /> {message.loadingText ?? 'Consultando a agenda de aulas...'}
                      </div>
                    ) : message.role === 'assistant' && message.reply ? (
                      <>
                        <ReplyView
                          reply={message.reply}
                          loadedAt={message.loadedAt ?? catalog?.loadedAt ?? null}
                          onPick={handlePick}
                          disabled={!ready}
                          showChips={message.id === lastAssistantId}
                        />
                        <div className="flex items-center justify-between gap-3 mt-3">
                          <div className="text-[10px] text-sae-muted/60">
                            {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {message.reply.sources.length > 0 && (
                            <CopyButton label="Copiar resposta" title="Copiar a resposta para colar no WhatsApp" getText={() => replyToPlain(message.reply as Reply)} />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-sae-text">{message.text}</p>
                        <div className="text-[10px] mt-2 text-sae-accentText/50 text-right">
                          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div role="alert" className="mx-4 sm:mx-6 mb-2 p-3 bg-sae-danger/10 border border-sae-danger/30 rounded-lg flex items-center gap-2 text-sm text-sae-danger animate-fadeIn">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
              <button onClick={() => load(true)} className="ml-auto text-xs font-semibold underline">
                Tentar de novo
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 sm:p-6 border-t border-sae-border bg-sae-soft">
            <div className="flex gap-3 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ready ? 'Ex.: valor de Pedagogia no pix, documentos de Direito, combos de licenciatura...' : 'Carregando a base de cursos...'}
                disabled={!ready}
                className="flex-1 bg-sae-darker border border-sae-border rounded-xl px-4 py-3 text-sm text-sae-text placeholder-sae-muted focus:border-sae-accent focus:ring-1 focus:ring-sae-accent/30 outline-none transition-all disabled:opacity-50"
              />
              <Button onClick={handleSend} disabled={!ready || !input.trim()} className="rounded-xl px-4 py-3 bg-sae-accent hover:bg-sae-accent/80 text-white" aria-label="Enviar">
                <Send size={20} />
              </Button>
            </div>
            <p className="text-center mt-2 text-[10px] text-sae-muted">
              Os valores vêm da planilha do SAE e mudam quando ela muda. Respostas marcadas como IA podem conter erros: confirme com o Financeiro.
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
};
