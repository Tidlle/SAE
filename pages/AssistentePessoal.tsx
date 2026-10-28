import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, Button, Breadcrumb } from '../components/UI';
import { HistoryPanel } from '../components/assistant/HistoryPanel';
import { CopyButton } from '../components/CopyButton';
import { ReplyView } from '../components/assistant/ReplyView';
import { Send, Bot, User, Sparkles, Plus, History, AlertCircle, RefreshCw, Handshake } from 'lucide-react';
import { Catalog, loadCatalog } from '../lib/assistant/catalog';
import { Agenda, loadAgenda } from '../lib/assistant/calendar';
import { AI_FALLBACK_TAGS, AiTurn, askAi } from '../lib/assistant/ai';
import { applyInterpretation, interpretMode, interpretStep, reaskConsult } from '../lib/assistant/consult';
import { askInterpret } from '../lib/assistant/interpret';
import { Answer, Block, Chip, Context, EMPTY_CONTEXT, HELP_CHIPS, Reply, answerQuestion, replyToPlain } from '../lib/assistant/engine';
import { trackAction } from '../lib/tracker';
import {
  ChatMessage as Message,
  EMPTY_STORE,
  Store,
  StoredContext,
  clearStore,
  fromStored,
  fromStoredContext,
  groupConversations,
  loadStore,
  newConversationId,
  removeConversation,
  saveStore,
  searchConversations,
  toStoredContext,
  upsertConversation,
} from '../lib/assistant/history';

// Meu Assistente: responde sobre cursos, valores, combos, documentos, turmas, instituições e mais, lendo a planilha do SAE.
// A base responde primeiro (sem custo, sempre com a fonte); só o que ela não sabe vai para a IA de reserva.
// As conversas ficam salvas no navegador de cada usuário (lib/assistant/history.ts).
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
  const ctxRef = useRef<Context>(EMPTY_CONTEXT);
  ctxRef.current = ctx;
  const catalogRef = useRef<Catalog | null>(null);
  catalogRef.current = catalog;
  const pendingContext = useRef<StoredContext | undefined>(undefined); // atendimento guardado, a restaurar quando a planilha carregar

  // Histórico: lista de conversas salvas neste navegador (por login) e a conversa aberta
  const login = localStorage.getItem('userLogin') ?? '';
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false); // no celular a lista abre por cima da conversa
  const [search, setSearch] = useState('');
  const storeRef = useRef<Store>(EMPTY_STORE);
  const activeIdRef = useRef<string | null>(null);
  const loadedMessages = useRef<Message[] | null>(null); // lista que acabou de ser aberta do histórico: não precisa ser regravada
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  storeRef.current = store;
  activeIdRef.current = activeId;

  // Ao entrar, reabre a última conversa
  useEffect(() => {
    const saved = loadStore(login);
    setStore(saved);
    const last = saved.conversations.find((conversation) => conversation.id === saved.activeId);
    if (last) {
      const restored = fromStored(last.messages);
      loadedMessages.current = restored;
      pendingContext.current = last.ctx;
      setActiveId(last.id);
      setMessages(restored);
    }
  }, [login]);

  // Restaura o atendimento (perfil do aluno, cursos indicados, resultado) da conversa reaberta, ligando os cursos de novo à planilha
  useEffect(() => {
    if (!catalog || !pendingContext.current) return;
    setCtx(fromStoredContext(pendingContext.current, catalog));
    pendingContext.current = undefined;
  }, [catalog]);

  // Grava a conversa aberta (com um pequeno atraso, para não gravar a cada tecla)
  const persistNow = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (messagesRef.current.every((message) => message.loading)) return;
    const id = activeIdRef.current ?? newConversationId();
    const next = saveStore(login, upsertConversation(storeRef.current, id, messagesRef.current, new Date(), toStoredContext(ctxRef.current, catalogRef.current)));
    if (next === storeRef.current) return;
    activeIdRef.current = id;
    setActiveId(id);
    storeRef.current = next;
    setStore(next);
  }, [login]);

  useEffect(() => {
    if (messages === loadedMessages.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persistNow, 400);
    return () => clearTimeout(saveTimer.current);
  }, [messages, persistNow]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
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
    // Sem mensagens (tela de boas-vindas) a área fica no topo; só com mensagens ela desce até a última
    if (messages.length === 0) scrollAreaRef.current?.scrollTo({ top: 0 });
    else messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // `shown` é o que aparece como fala da pessoa; `query` é o que o motor recebe (os botões usam um código interno).
  const send = (shown: string, query: string = shown) => {
    const trimmed = query.trim();
    if (!trimmed || !catalog) return;
    const now = Date.now();
    const userMessage: Message = { id: `${now}-u`, role: 'user', text: shown.trim(), timestamp: new Date(now) };
    const answer = answerQuestion(catalog, trimmed, ctx, agenda);
    setInput('');
    inputRef.current?.focus({ preventScroll: true });

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

    // Atendimento consultivo: texto livre que as regras não entenderam. A IA devolve só campos do atendimento; sem IA, repete a pergunta.
    const mode = interpretMode(trimmed, ctx, answer.reply.tag, AI_FALLBACK_TAGS);
    if (mode === 'step' && aiOff) {
      const again = reaskConsult(catalog, ctx, trimmed);
      if (again) {
        setCtx(again.ctx);
        trackAction(`Assistente: ${again.reply.tag}`);
        setMessages((current) => [...current, userMessage, { id: `${now}-a`, role: 'assistant', reply: again.reply, loadedAt: catalog.loadedAt, timestamp: new Date(now) }]);
        return;
      }
    }
    if (mode && !aiOff) {
      const pendingId = `${now}-a`;
      setMessages((current) => [...current, userMessage, { id: pendingId, role: 'assistant', loading: true, loadingText: 'Entendendo o pedido...', timestamp: new Date(now) }]);
      const finish = (final: Answer) => {
        setCtx(final.ctx);
        trackAction(`Assistente: ${final.reply.tag}`);
        setMessages((current) => current.map((message) => (message.id === pendingId ? { ...message, loading: false, reply: final.reply, loadedAt: catalog.loadedAt } : message)));
      };
      askInterpret(trimmed, interpretStep(ctx))
        .then((patch) => finish(applyInterpretation(catalog, trimmed, ctx, mode, patch) ?? (mode === 'step' ? reaskConsult(catalog, ctx, trimmed) : null) ?? answer))
        .catch((error: Error & { code?: string }) => {
          if (error.code === 'not_configured' || error.code === 'auth' || /Ação inválida/.test(error.message)) setAiOff(true);
          finish((mode === 'step' ? reaskConsult(catalog, ctx, trimmed) : null) ?? answer);
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

  const resetConversation = (nextId: string | null, nextMessages: Message[], storedContext?: StoredContext) => {
    loadedMessages.current = nextMessages;
    activeIdRef.current = nextId;
    setActiveId(nextId);
    setMessages(nextMessages);
    // O contexto comum ("e os documentos?") não vale para uma conversa de outra hora; só o atendimento guardado volta
    pendingContext.current = undefined;
    if (storedContext && catalog) setCtx(fromStoredContext(storedContext, catalog));
    else {
      setCtx(EMPTY_CONTEXT);
      pendingContext.current = storedContext;
    }
    setInput('');
    setHistoryOpen(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleNewConversation = () => {
    persistNow();
    const next = { ...storeRef.current, activeId: null };
    storeRef.current = saveStore(login, next);
    setStore(storeRef.current);
    resetConversation(null, []);
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeIdRef.current) {
      setHistoryOpen(false);
      return;
    }
    persistNow();
    const conversation = storeRef.current.conversations.find((item) => item.id === id);
    if (!conversation) return;
    storeRef.current = saveStore(login, { ...storeRef.current, activeId: id });
    setStore(storeRef.current);
    resetConversation(id, fromStored(conversation.messages), conversation.ctx);
  };

  const handleDeleteConversation = (id: string) => {
    if (!window.confirm('Apagar esta conversa do histórico?')) return;
    const next = saveStore(login, removeConversation(storeRef.current, id));
    storeRef.current = next;
    setStore(next);
    if (id === activeIdRef.current) resetConversation(null, []);
  };

  const handleClearHistory = () => {
    if (!window.confirm('Apagar todas as conversas salvas neste navegador?')) return;
    storeRef.current = clearStore(login);
    setStore(storeRef.current);
    resetConversation(null, []);
  };

  const groups = groupConversations(searchConversations(store.conversations, search));
  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const userName = localStorage.getItem('userNome')?.split(' ')[0] || 'Colaborador';
  const ready = !loading && catalog !== null;

  return (
    <Layout>
      <div className="container mx-auto px-4 lg:px-8 py-6 h-[calc(100vh-80px)] flex flex-col">
        <Breadcrumb items={[{ label: 'Meu Assistente Pessoal' }]} />

        <Card className="flex-1 flex flex-row overflow-hidden relative border-sae-accent/20 bg-sae-darker/80 backdrop-blur-xl">
          {/* Histórico (computador) */}
          <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-sae-border bg-sae-soft">
            <HistoryPanel
              groups={groups}
              total={store.conversations.length}
              activeId={activeId}
              search={search}
              onSearch={setSearch}
              onSelect={handleSelectConversation}
              onDelete={handleDeleteConversation}
              onNew={handleNewConversation}
              onClearAll={handleClearHistory}
            />
          </aside>

          {/* Histórico (celular): abre por cima da conversa */}
          {historyOpen && (
            <div className="md:hidden absolute inset-0 z-20 bg-sae-darker">
              <HistoryPanel
                groups={groups}
                total={store.conversations.length}
                activeId={activeId}
                search={search}
                onSearch={setSearch}
                onSelect={handleSelectConversation}
                onDelete={handleDeleteConversation}
                onNew={handleNewConversation}
                onClearAll={handleClearHistory}
                onClose={() => setHistoryOpen(false)}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-sae-border flex items-center justify-between gap-3 bg-gradient-to-r from-sae-accent/10 via-transparent to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex w-12 h-12 rounded-full bg-sae-accent/20 items-center justify-center border border-sae-accent/50 shrink-0">
                <Sparkles size={24} className="text-sae-accentText" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-sae-text leading-tight">Meu Assistente Pessoal</h2>
                <p className="text-xs text-sae-muted flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ready ? 'bg-sae-success animate-pulse' : error ? 'bg-sae-danger' : 'bg-sae-muted'}`}></span>
                  {loading
                    ? 'Carregando a base de cursos...'
                    : catalog
                      ? (
                          <>
                            <span className="sm:hidden">{`${catalog.courses.length} cursos, lidos às ${catalog.loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}</span>
                            <span className="hidden sm:inline">{`${catalog.courses.length} cursos, ${catalog.combos.length} combos e ${catalog.presential.length} turmas presenciais, lidos às ${catalog.loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}</span>
                          </>
                        )
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
                onClick={() => setHistoryOpen(true)}
                className="md:hidden flex items-center gap-2 px-3 py-2 text-xs text-sae-muted hover:text-sae-text hover:bg-sae-accent/10 rounded-lg transition-colors border border-sae-border hover:border-sae-accent/30"
                title="Histórico de conversas"
                aria-label="Histórico de conversas"
              >
                <History size={14} />
                {store.conversations.length > 0 && <span className="text-[10px] font-bold">{store.conversations.length}</span>}
              </button>
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-2 px-3 py-2 text-xs text-sae-muted hover:text-sae-text hover:bg-sae-accent/10 rounded-lg transition-colors border border-sae-border hover:border-sae-accent/30"
                title="Nova Conversa"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Nova Conversa</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-10 animate-fadeIn">
                <div className="w-20 h-20 rounded-full bg-sae-accent/10 flex items-center justify-center mb-6 border border-sae-accent/30">
                  <Bot size={40} className="text-sae-accentText" />
                </div>
                <h3 className="text-2xl font-bold text-sae-text mb-2">Olá, {userName}!</h3>
                <p className="text-sae-muted max-w-md mb-6">
                  Pergunte sobre <strong className="text-sae-text">valores</strong>, <strong className="text-sae-text">combos</strong>,{' '}
                  <strong className="text-sae-text">documentos</strong>, <strong className="text-sae-text">listas e comparações</strong>,{' '}
                  <strong className="text-sae-text">aulas e turmas</strong>, <strong className="text-sae-text">instituições</strong>,{' '}
                  <strong className="text-sae-text">vídeos</strong>, <strong className="text-sae-text">cadastros</strong> e{' '}
                  <strong className="text-sae-text">contatos</strong>. Eu respondo direto da planilha e das páginas do SAE e mostro a fonte.
                </p>
                {/* Atendimento consultivo: botão de destaque, centralizado, acima das sugestões */}
                <button
                  type="button"
                  onClick={() => send('Atender um aluno', '#k:start')}
                  disabled={!ready}
                  className="mb-3 flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-sae-accent text-white font-bold text-base shadow-lg shadow-sae-accent/25 hover:bg-sae-accentHover hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <Handshake size={20} /> Atender um aluno
                </button>
                <p className="text-xs text-sae-muted mb-8">Eu pergunto sobre o aluno e indico o curso ideal.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
                  {HELP_CHIPS.filter((suggestion) => suggestion.query !== '#k:start').map((suggestion) => (
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
          </div>
        </Card>
      </div>
    </Layout>
  );
};
