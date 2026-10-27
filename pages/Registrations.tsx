import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { Button, Card } from '../components/UI';
import { X, FileText, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FORMS_DATA, FormBitrixData, FormIframeData } from '../lib/registrationForms';

const BitrixForm: React.FC<{ data: FormBitrixData }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Limpa o contêiner sempre que abrir
      containerRef.current.innerHTML = '';
      
      // Cria dinamicamente a tag de script do formulário do Bitrix24
      const scriptNode = document.createElement('script');
      scriptNode.src = `${data.scriptSrc}?${(Date.now() / 180000) | 0}`;
      scriptNode.async = true;
      scriptNode.dataset.b24Form = data.formId;
      scriptNode.dataset.skipMoving = "true";
      
      containerRef.current.appendChild(scriptNode);
    }
  }, [data]);

  return <div ref={containerRef} className="w-full min-h-[500px]" />;
};

export const Registrations: React.FC = () => {
  const [activeFormKey, setActiveFormKey] = useState<string | null>(null);

  // Abre direto o formulário pedido por outra página (ex.: Meu Assistente): /cadastros?form=grad-unicv
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const wanted = searchParams.get('form');
    if (wanted && FORMS_DATA[wanted]) setActiveFormKey(wanted);
    if (wanted) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold text-sae-text mb-8 border-l-4 border-sae-accent pl-4">
          Cadastros
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Menu Lateral Esquerdo */}
          <div className="md:col-span-1 flex flex-col gap-3">
            <button
               onClick={() => setActiveFormKey('grad-unicv')}
               className="flex items-center justify-between p-4 bg-sae-card border border-sae-border rounded-xl text-sae-text hover:bg-sae-accent/10 hover:border-sae-accent transition-all text-left group"
            >
               <span className="font-medium group-hover:text-sae-accentText transition-colors">Cadastro Graduações UNICIVE</span>
               <ChevronRight size={18} className="text-sae-accentText" />
            </button>
            <button
               onClick={() => setActiveFormKey('grad-esp')}
               className="flex items-center justify-between p-4 bg-sae-card border border-sae-border rounded-xl text-sae-text hover:bg-sae-accent/10 hover:border-sae-accent transition-all text-left group"
            >
               <span className="font-medium group-hover:text-sae-accentText transition-colors">Cadastro Graduações Próprias</span>
               <ChevronRight size={18} className="text-sae-accentText" />
            </button>
            <button
               onClick={() => setActiveFormKey('capacitacoes')}
               className="flex items-center justify-between p-4 bg-sae-card border border-sae-border rounded-xl text-sae-text hover:bg-sae-accent/10 hover:border-sae-accent transition-all text-left group"
            >
               <span className="font-medium group-hover:text-sae-accentText transition-colors">Cadastro Capacitações/Pós Presenciais/Residências</span>
               <ChevronRight size={18} className="text-sae-accentText" />
            </button>
            <button
               onClick={() => setActiveFormKey('reativacao')}
               className="flex items-center justify-between p-4 bg-sae-card border border-sae-border rounded-xl text-sae-text hover:bg-sae-accent/10 hover:border-sae-accent transition-all text-left group"
            >
               <span className="font-medium group-hover:text-sae-accentText transition-colors">Cadastro de Nova Inscrição + Reingresso</span>
               <ChevronRight size={18} className="text-sae-accentText" />
            </button>
          </div>
          
          {/* Área Principal - Informação Inicial */}
          <div className="md:col-span-3">
            <Card className="h-full flex flex-col items-center justify-center p-12 border-sae-border/50 bg-sae-card/30 text-center min-h-[400px]">
              <FileText size={64} className="text-sae-muted mb-4 opacity-50" />
              <h2 className="text-xl font-bold text-sae-text mb-2">Central de Cadastros</h2>
              <p className="text-sae-muted max-w-md">
                Selecione uma das opções no menu lateral para abrir o pop-up com o formulário específico e realizar os cadastros no sistema de forma integrada.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal / Pop-up do Formulário */}
      {activeFormKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveFormKey(null)} />
          <Card className={`relative z-10 w-full max-w-4xl flex flex-col p-0 border-sae-accent/30 shadow-2xl overflow-hidden bg-sae-darker ${FORMS_DATA[activeFormKey]?.type === 'iframe' ? 'h-[90vh]' : 'max-h-[90vh]'}`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-sae-border bg-sae-soft">
              <h2 className="text-xl sm:text-2xl font-bold text-sae-text">
                {FORMS_DATA[activeFormKey]?.title || "Formulário em Configuração"}
              </h2>
              <button 
                onClick={() => setActiveFormKey(null)}
                className="p-2 text-sae-muted hover:text-sae-text hover:bg-sae-accent/20 rounded-full transition-colors"
                title="Fechar Formulário"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body with form logic */}
            <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sae-border ${FORMS_DATA[activeFormKey]?.type === 'iframe' ? '' : 'p-4 sm:p-6'}`}>
              {FORMS_DATA[activeFormKey] ? (
                 FORMS_DATA[activeFormKey]?.type === 'iframe' ? (
                   <iframe 
                     src={(FORMS_DATA[activeFormKey] as FormIframeData).iframeSrc} 
                     className="w-full h-full min-h-[600px] border-0"
                     title={FORMS_DATA[activeFormKey]!.title}
                     allow="camera; microphone; geolocation"
                   />
                 ) : (
                   <BitrixForm data={FORMS_DATA[activeFormKey] as FormBitrixData} />
                 )
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 border-4 border-sae-border border-t-sae-accent rounded-full animate-spin mb-6" />
                  <h3 className="text-lg font-bold text-sae-text mb-2">Formulário Indisponível</h3>
                  <p className="text-sae-muted">
                    O script do formulário selecionado ainda não foi configurado nesta aplicação.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
};
