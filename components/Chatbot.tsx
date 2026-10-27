import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { Button, Card } from './UI';

// Using the key provided by user. Ideally this should be in env vars, but proceeding as requested.
const API_KEY = 'AIzaSyCx5us6tFvc1K4GNo5GQxCdpY7gkbl3ly8';

interface ChatbotProps {
    courseName?: string;
    courseDescription?: string;
    itemData?: any[];
    headers?: string[];
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export const Chatbot: React.FC<ChatbotProps> = ({ courseName, courseDescription, itemData, headers }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Initialize/Reset chat when course changes or opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const initialMsg: Message = {
                id: 'init',
                role: 'model',
                text: courseName 
                    ? `Olá! Sou a IA do SAE. Posso tirar suas dúvidas sobre o curso **${courseName}**. O que gostaria de saber?`
                    : 'Olá! Sou a IA do SAE. Como posso ajudar com os cursos hoje?'
            };
            setMessages([initialMsg]);
        }
    }, [isOpen, courseName]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            // Construct detailed context from headers and itemData
            let detailedContext = '';
            if (headers && itemData) {
                headers.forEach((header, index) => {
                    if (header && itemData[index]) {
                        detailedContext += `- ${header}: ${itemData[index]}\n`;
                    }
                });
            }

            const context = `
                Você é um tutor educacional inteligente e prestativo do sistema SAE que pertence ao ITEQ.
                Curso atual sendo visualizado: "${courseName || 'Nenhum específico'}".
                
                Detalhes completos do curso:
                ${detailedContext || courseDescription || 'N/A'}
                
                Se o usuário perguntar sobre o curso, use os detalhes fornecidos acima. ESTAS SÃO AS INFORMAÇÕES VERDADEIRAS.
                Se faltar informação, seja honesto mas persuasivo, sugerindo contatar o suporte.
                Responda de forma concisa (máximo 3 parágrafos curtos) e profissional.
                Use formatação markdown (negrito, listas) se ajudar.
                
                Se o usuário informar que o cliente esta colocando alguma objeção (preço, modalidade etc) gere uma respposta que ajude ele a quebrar a objeção do cliente. 
            `;

            const chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{ text: context }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Entendido. Estou pronto para ajudar com dúvidas sobre este curso.' }]
                    },
                    ...messages.map(m => ({
                        role: m.role,
                        parts: [{ text: m.text }]
                    }))
                ]
            });

            const result = await chat.sendMessage(input);
            const response = result.response;
            const text = response.text();

            const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: text };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error('Gemini Error:', error);
            const errorMsg: Message = { id: Date.now().toString(), role: 'model', text: 'Desculpe, tive um problema de conexão. Tente novamente.' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg shadow-sae-accent/30 transition-all duration-300 hover:scale-110 ${isOpen ? 'bg-sae-accentHover rotate-90' : 'bg-sae-accent hover:bg-sae-accentHover'}`}
            >
                {isOpen ? <X size={28} className="text-white" /> : <MessageSquare size={28} className="text-white" />}
            </button>

            {/* Chat Window */}
            <div className={`fixed bottom-24 right-4 md:right-6 w-[90vw] md:w-[400px] h-[500px] max-h-[70vh] z-50 transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
                <Card className="h-full flex flex-col border-sae-accent/30 shadow-2xl bg-sae-darker/95 backdrop-blur-xl">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-sae-border flex items-center gap-3 bg-gradient-to-r from-sae-accent/10 to-transparent">
                        <div className="w-10 h-10 rounded-full bg-sae-accent/20 flex items-center justify-center border border-sae-accent/50">
                            <Sparkles size={20} className="text-sae-accentText" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sae-text text-sm">Assistente IA SAE</h3>
                            <p className="text-xs text-sae-muted flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-sae-success animate-pulse"></span> Online • Gemini Pro
                            </p>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-sae-border scrollbar-track-transparent">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                        ? 'bg-sae-accent/20 text-sae-text rounded-br-none border border-sae-accent/30' 
                                        : 'bg-sae-card text-sae-text rounded-bl-none border border-sae-border'
                                }`}>
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-sae-card rounded-2xl rounded-bl-none p-3 border border-sae-border flex gap-1">
                                    <span className="w-2 h-2 bg-sae-muted rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-sae-muted rounded-full animate-bounce delay-75"></span>
                                    <span className="w-2 h-2 bg-sae-muted rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-sae-border bg-sae-soft">
                        <div className="flex gap-2">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Digite sua dúvida..."
                                className="flex-1 bg-sae-darker border border-sae-border rounded-xl px-4 py-3 text-sm text-sae-text focus:border-sae-accent outline-none transition-colors"
                            />
                            <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="rounded-xl px-4 bg-sae-accent text-white hover:bg-sae-accent/90">
                                <Send size={20} />
                            </Button>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-[10px] text-sae-muted">IA pode cometer erros. Verifique informações críticas.</p>
                        </div>
                    </div>
                </Card>
            </div>
        </>
    );
};

// Simple Markdown Renderer helper since we didn't install react-markdown to keep it lightweight if possible, 
// OR we can install it. For now, I'll use a simple formatter or text display. 
// Actually, simple text rendering is fine, but I used <ReactMarkdown> above.
// Let's replace ReactMarkdown with simple text for now to avoid another install, 
// or I can handle bolding manually.
const ReactMarkdown: React.FC<{ children: string }> = ({ children }) => {
    // Basic bold parsing
    const parts = children.split(/(\*\*.*?\*\*)/g);
    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="text-sae-accentText">{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </span>
    );
};
