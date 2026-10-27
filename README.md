# SAE - Sistema de Apoio Educacional

O **SAE (Sistema de Apoio Educacional)** é uma plataforma educacional desenvolvida em React. Este sistema foi projetado para facilitar o acesso e a gestão de cursos, integrando recursos de Inteligência Artificial para apoiar o aprendizado dos alunos e a administração institucional.

## Principais Funcionalidades

- **Autenticação:** Sistema de login, registro e proteção de rotas.
- **Home:** saudação com o nome do usuário, banner, atalhos, feed de publicações, últimos avisos e a história de cada instituição.
- **Gestão Institucional:** Páginas de contatos, avisos, memorandos e cadastros gerais.
- **Informações do Curso:** a consulta detalhada (`/cursos/info`) busca o curso sem diferenciar acentos nem maiúsculas, destaca o trecho digitado e mostra IES e modalidade ao lado de cada resultado (até 50 por vez, com aviso do total). O curso escolhido ganha um cabeçalho com selos e números principais e dois botões que copiam um resumo para enviar ao aluno, sem ou com valores. As colunas da planilha `Cursos` são localizadas pelo título, não pela posição; se o carregamento falhar, a página mostra o erro e o botão "Tentar novamente". Os links vindos da planilha só abrem se forem `http(s)`.
  Antes de escolher um curso, a página mostra uma tela inicial (`components/CoursesOverview.tsx`): o total de cursos e instituições, filtros por instituição, tipo e modalidade com contagem (variações como "EaD" e "EAD" contam juntas; os filtros valem também para a busca), os cursos consultados recentemente (guardados no navegador na chave `sae-recent-courses`), uma legenda de D10, D30 e dos botões de resumo, e atalhos para Combos, Simulador, Calendário de aulas e Solicitação de novo curso.
- **Meu perfil:** clicando no nome ou no ícone de usuário da barra de navegação abre `/perfil` (`pages/Profile.tsx`): avatar, nome, login e selos de função e perfil; dados da conta (e-mail, telefone e, quando houver, CNPJ), lidos só das colunas A-D e K-M da aba `Cadastros`, sem senha nem CPF; o que o perfil pode fazer; as publicações do próprio usuário no feed (com opção de apagar); os cursos consultados recentemente (cada um abre direto na consulta, por `/cursos/info?curso=NOME&ies=IES`); e o botão Sair. Se o perfil da coluna M mudar na planilha, a página avisa para sair e entrar de novo.
- **Vídeos:** menu "Vídeos" na barra de navegação com três páginas, cada uma dividida em seções por tema (`pages/Videos.tsx`, `lib/videoLibrary.ts`): **Tutoriais da plataforma** (`/videos/tutoriais`), **Conteúdo das aulas** (`/videos/aulas`, uma seção por playlist do canal do YouTube) e **Conteúdos do Instagram** (`/videos/instagram`). Cada vídeo toca dentro do SAE, tem miniatura, botão "Copiar link" e link para abrir na plataforma; veja a seção "Vídeos".
- **Sobre o SAE:** página (`pages/About.tsx`) que explica o que é o sistema, para que serve na empresa, o que muda no dia a dia e o uso responsável (LGPD, incluindo o aviso de que o uso é registrado), com atalhos para cada área.
- **Análises de uso (só Administrativo):** painel `/analises` (ícone de gráfico na barra de navegação) com mapa de calor, jornada de cada usuário, tempo por usuário e por página e fluxo entre páginas; veja a seção "Análises de uso e mapa de calor".
- **Cursos:** Catálogo completo, informações detalhadas, cursos presenciais, combos, filtros e área para criação.
- **Recursos de Aprendizagem:** Visualização de aulas em vídeo, quizzes interativos e acompanhamento de evolução.
- **Ferramentas Avançadas:** Meu Assistente (consulta de cursos, valores, combos e documentos; veja a seção "Meu Assistente"), Simulador e suporte para geração de PDFs.

## Home, Feed e Instituições

A Home (`pages/Home.tsx`) reúne a saudação (lê `userNome` do `localStorage`), o banner rotativo (`CAROUSEL_SLIDES` em `pages/Home.tsx`, troca a cada `CAROUSEL_INTERVAL_MS`: três artes prontas em `public/`, que vão junto com o site: novidades `hero-SAE-1.jpg`, instituições `hero-SAE-2.png` e Meu Assistente `hero-SAE-3.png`; uma imagem que não carrega sai do carrossel em vez de deixar um slide preto; `art: true` mostra a arte sem o escurecimento que se aplicaria a fotos), os atalhos, o **feed** (`components/Feed.tsx`), os últimos avisos (aba `Avisos`; cada aviso é clicável e abre o texto completo, com setor, data e links, numa janela de leitura: `components/NoticeDialog.tsx`) e a seção **Nossas instituições** (`components/InstitutionsSection.tsx`). O login grava `usuarioAutenticado`, `userNome` e `userLogin` no `localStorage`; o `userLogin` identifica o autor das publicações (quem entrou antes dessa versão precisa entrar de novo para publicar).

### Avisos

Os avisos continuam na aba `Avisos` da planilha principal (`Título | Mensagem | Data | Setor | Notificados`). Quem tem perfil Administrativo cria avisos pelo botão "Novo aviso" do Mural: escolhe um setor já existente ou cadastra um novo, e o aviso entra no fim da aba com a data de hoje (formato `dd/MM/yyyy`) e a coluna `Notificados` em branco, como se fosse digitado à mão. O Administrativo também pode apagar avisos (ícone de lixeira em cada aviso, com confirmação): antes de remover a linha, o script guarda uma cópia na aba `Avisos removidos` (com a data e quem apagou), então dá para recuperar um aviso copiando a linha de volta. A gravação usa as ações `createNotice` e `deleteNotice` do mesmo Apps Script do feed (`apps-script/feed.gs`, versão `feed-5-avisos-apagar`); para elas funcionarem, atualize o código no Apps Script e crie uma nova versão da implantação. A conta que implanta precisa poder editar a planilha principal. Ao apagar, as linhas abaixo sobem uma posição na aba `Avisos`.

### Feed de publicações

- **Planilha própria:** o feed e as instituições ficam numa **planilha separada** da planilha principal do SAE (que segue com `Cadastros`, `Avisos`, `Cursos`...). O ID dela vai em `HOME_SHEET_ID` em `lib/sheets.ts` e ela precisa estar compartilhada como "qualquer pessoa com o link pode ver". Enquanto o ID estiver vazio, o feed aparece vazio e as instituições mostram o texto reserva.
- **Leitura:** aba `Feed` dessa planilha, pela API do Sheets (`lib/feed.ts`, `lib/sheets.ts`). Colunas: `id | data | login | autor | categoria | titulo | mensagem | link | instituicao | status | imagens`. Linhas com `status` = `REMOVIDO` não aparecem.
- **Nova publicação:** o botão "Nova publicação" do feed abre o formulário (`components/PostComposer.tsx`) numa janela, sem ocupar espaço no feed. Cada publicação aceita até 4 imagens, reduzidas no navegador (`lib/images.ts`, lado maior de 1280px, JPEG) antes do envio.
- **Imagens:** o script salva os arquivos numa pasta do Drive da conta que implanta ("SAE Feed - Imagens", acesso "qualquer pessoa com o link") e a coluna `imagens` guarda só os IDs. Ao apagar a publicação, as imagens vão para a lixeira do Drive.
- **Escrita:** Google Apps Script em `apps-script/feed.gs` (ações `create` e `delete`). Qualquer usuário logado publica; só o autor apaga a própria publicação. Para moderar, mude o `status` da linha para `REMOVIDO` na planilha.
- **Configuração (uma vez):**
  1. Na planilha nova, abra Extensões > Apps Script e cole o conteúdo de `apps-script/feed.gs` (o script confere os logins na aba `Cadastros` da planilha principal, pelo ID em `USERS_SPREADSHEET_ID`; a conta que implanta precisa ter acesso a ela).
  2. Execute a função `setup()` para criar/atualizar a aba `Feed` com o cabeçalho e criar a pasta de imagens no Drive (aceite a permissão de Drive). Ao atualizar o script depois, rode `setup()` de novo e crie uma nova versão da implantação.
  3. Implante como Aplicativo da Web (Executar como: eu; Quem pode acessar: qualquer pessoa).
  4. Copie a URL terminada em `/exec` para `FEED_SCRIPT_URL` em `lib/feed.ts`. Enquanto estiver vazia, o feed funciona só para leitura.
- **Conferir a versão publicada:** abrir a URL `/exec` no navegador mostra um JSON com a versão do script (`feed-2-imagens` ou mais nova). Se a publicação sair sem as imagens, o site mostra um aviso de que o script está desatualizado; nesse caso crie uma nova versão da implantação (Implantar > Gerenciar implantações > lápis > Nova versão).
- **Limite conhecido:** o login do SAE é validado só no navegador e o script confere apenas que o login existe na aba `Cadastros` com `Acesso` = `SIM`; ele não valida senha.

### Apresentação das instituições

A seção "Nossas instituições" (`components/InstitutionsSection.tsx`) tem uma aba por instituição: **ITEQ**, ESP, Alpha Channel, UCESP e UNICIVE. Cada uma mostra: logotipo, nome completo, tipo, ano ou tradição e cidade; frase de apresentação; números de destaque; "Quem é"; diferenciais; "O que oferece", dividido em **Tipos de curso** (`courseTypes`) e **Modalidades** (`modalities`); endereço, credenciamento no MEC e botão "Visitar site". O painel de cada instituição usa as cores da sua marca: ITEQ em tom claro de vinho, ESP em preto e amarelo, Alpha Channel em vinho, UCESP em amarelo e UNICIVE em verde e dourado.

- **Conteúdo e cores padrão:** `lib/institutionProfiles.ts` (objeto `theme` de cada instituição), levantado nos sites oficiais (iteqescolas.com.br, faculdadeesp.com.br, ucesp.com.br, faculdadealphachannel.com.br e unicive.com) em outubro de 2026. Números e afirmações de reconhecimento são da própria instituição. Para atualizar um texto ou uma cor, edite esse arquivo (os tipos de curso e as modalidades de cada instituição ficam em `courseTypes` e `modalities`; `offerings`, o detalhe por nível, só alimenta o Meu Assistente). Os logotipos são carregados direto dos sites das instituições.
- **ITEQ:** aparece mesmo sem linha na planilha e abre a lista (`withKnownProfiles` em `lib/institutions.ts`). Ele não entra na lista de instituições do Feed (`INSTITUTION_NAMES`), que continua só com as quatro faculdades.
- **Planilha (opcional):** a aba `Instituições` da planilha nova (`lib/institutions.ts`) continua valendo e tem prioridade campo a campo. Colunas: `nome | resumo | ano | historia | site | logo | ordem`. `resumo` troca a frase de apresentação, `ano` vira "Desde ano", `historia` (parágrafos separados por quebra de linha na célula) troca o texto "Quem é", `site` e `logo` aceitam só URLs `http(s)` (um logotipo vindo da planilha aparece sobre uma placa branca). Há um modelo em `docs/instituicoes-modelo.csv`. O que ficar vazio usa o conteúdo padrão.

## Perfis de usuário

O SAE tem três perfis: **Administrativo**, **Consultor** e **Representante**. Consultor e Representante têm exatamente os mesmos privilégios. O perfil vem da coluna **M ("Perfil")** da aba `Cadastros` e é lido no login (`localStorage`, chave `userPerfil`); depois de mudar o perfil na planilha, a pessoa precisa sair e entrar de novo.

- **Sem aplicar nas contas:** a coluna `Perfil` começa vazia e **vazio vale Administrativo**, com o acesso total de antes. Nada muda para ninguém até você preencher `Consultor` na coluna M de uma conta. A coluna `É?` (K) não é usada para isso.
- **Valores:** `Administrativo` (ou vazio), `Consultor` e `Representante`. Qualquer outro texto também vale Consultor, para um erro de digitação restringir em vez de liberar.
- **O que o Consultor e o Representante não podem** (`lib/permissions.ts`): publicar no feed, criar avisos, criar usuários e ver o painel de análises de uso.
  - **Feed:** o botão "Nova publicação" some e o Apps Script (`apps-script/feed.gs`, versão `feed-3-perfis`) recusa a publicação, então a regra vale também no servidor. Para isso funcionar, atualize o código no Apps Script e crie uma nova versão da implantação.
  - **Criar usuários:** veja a seção "Criação de usuários e primeiro acesso" abaixo. O Consultor não vê o botão "Novo usuário" e, se abrir `/usuarios/novo`, volta para a Home.
  - **Criar e apagar avisos:** os botões "Novo aviso" e de apagar do Mural de Avisos só aparecem para o Administrativo (`components/NoticeComposer.tsx`). O servidor também recusa o pedido de Consultor.
- **Limite conhecido:** o login do SAE é validado só no navegador, então esconder telas por perfil é organização, não segurança. Quem conhecer um login válido ainda pode se passar por ele.

## Criação de usuários e primeiro acesso

Não existe mais auto-cadastro: **quem já tem conta Administrativa cria as novas contas**. A rota `/register` apenas leva ao login.

1. **Criar:** o Administrativo clica em "Novo usuário" (ícone de usuário com "+" na barra de navegação, e item no menu lateral do celular), abre `/usuarios/novo` (`pages/NewUser.tsx`) e preenche nome, usuário, e-mail, celular, CPF, senha, função (Administrativo, Representante ou Consultor, sem valor pré-marcado) e CNPJ (só para Representante e Consultor). A função escolhida define também o perfil de acesso: o script grava o mesmo valor nas colunas `É?` (K) e `Perfil` (M). Ao salvar, aparece a mensagem pronta com os dados de acesso para copiar e enviar à pessoa.
2. **Gravação:** a ação `createUser` do Apps Script (`apps-script/feed.gs`, versão `feed-8-analytics`) valida os dados (CPF, e-mail, usuário único sem diferenciar maiúsculas) e acrescenta a linha em `Cadastros` com `Liberado = SIM`, `Enviado` e a coluna **N ("Primeiro acesso") = `PENDENTE`**. A senha definida pelo administrativo é a senha da conta (fica na planilha em texto, como as demais).
3. **Primeiro acesso:** no login, uma conta com N = `PENDENTE` é levada a `/primeiro-acesso` (`pages/FirstAccess.tsx`) e nenhuma outra tela abre antes de concluir: a pessoa lê o Termo de Responsabilidade (`lib/terms.ts`), desenha a assinatura (`components/SignaturePad.tsx`), marca "Li e aceito" e confirma. O site monta o PDF com os dados dela, sem a senha (`lib/termPdf.ts`), e o envia para a pasta `TERMOS-ASS` da hospedagem (hPanel) em `https://legacy.iteqescolas.com.br/TERMOS-ASS/upload.php` (arquivo `Nome completo.pdf`; o domínio principal está na Vercel, que não executa PHP, por isso o envio usa o endereço `legacy`, o mesmo para onde a Vercel encaminha `/SAE`). O `upload.php` libera CORS, então o site lê a resposta: falha de rede, erro HTTP ou "Requisição inválida" impedem a conclusão; só depois do envio a ação `acceptTerms` troca a coluna N para `OK` e a data. O site não consegue confirmar o conteúdo do arquivo salvo, só que o servidor aceitou.
4. **Contas antigas:** a coluna N vazia significa que não há obrigação, então as contas anteriores entram direto. Enquanto N for `PENDENTE`, o servidor também recusa publicar no feed, criar ou apagar avisos e criar usuários.
5. **Para fechar de vez o cadastro público**, desative a implantação do Apps Script do cadastro antigo; enquanto ela existir, quem souber a URL ainda consegue gravar linhas em `Cadastros`.

## Vídeos

O menu **Vídeos** (barra de navegação) leva a três páginas. `/videos` redireciona para os tutoriais. Todo o conteúdo é definido em `lib/videoLibrary.ts`; cada página tem seções por tema, um índice para pular entre os temas, busca (quando há mais de 8 vídeos) e "Mostrar todos" nas seções com mais de 6 vídeos.

- **Tutoriais da plataforma:** vídeos escolhidos um a um e agrupados por tema (Primeiro acesso e cadastro; Documentos, estágio e artigo; Atividades e notas; Financeiro e certificado). Para acrescentar um vídeo, inclua `{ id, title }` na seção (o `id` é o código depois de `v=` ou `youtu.be/`).
- **Conteúdo das aulas:** cada seção aponta para uma playlist do YouTube (`playlistId`). Hoje: Estética Clínica Avançada, Obstetrícia, UTI, AHA, Enfermagem Aeroespacial, Pedagogia e Direito. Os vídeos de cada playlist ficam em `lib/videoPlaylists.generated.ts`, gerado por **`npm run videos:update`** (lê as páginas públicas das playlists do canal, sem chave de API; se a página não trouxer os vídeos, usa o feed RSS, de até 15 vídeos). Rode o comando quando entrarem vídeos novos e publique o site de novo. Para uma playlist nova, acrescente uma seção com o `playlistId` (o trecho depois de `list=`) e rode o comando. Playlists não listadas funcionam se você souber o endereço; as privadas, não.
- **Conteúdos do Instagram:** seções por tema com links de posts e reels do próprio Instagram (`instagram: [{ url, title }]`, com o exemplo comentado no arquivo). O vídeo abre no player da página (incorporação do Instagram, só para contas e posts públicos) e sempre há o link "Abrir no Instagram". Alguns posts o Instagram não deixa exibir em outros sites (a janela mostra "link quebrado"): marque-os com `semPlayer: true`; o botão passa a abrir direto no Instagram e o card vai para o fim da seção. As capas dos cards são imagens salvas em `public/instagram/<código>.jpg`, baixadas por **`npm run instagram:update`** (`scripts/update-instagram.mjs`, que consulta o oEmbed do Instagram, sem chave de API, e grava `lib/instagramThumbs.generated.ts`). Os links de capa do Instagram expiram, por isso a imagem é copiada para o site; rode o comando quando incluir posts novos e publique o site de novo, com a pasta `instagram` do `dist` junto. Posts sem capa (bloqueados) mostram um ícone. Para descobrir quais são, consulte `https://www.instagram.com/api/v1/oembed/?url=<link do reel>`: a resposta `geoblock_required` indica post bloqueado. Links que não forem de post ou reel são ignorados (os parâmetros `?utm_source=...` do link copiado não são necessários). Hoje há cinco seções, todas de depoimentos em reels: pacientes modelos, alunos de Estética, alunos de Direito, alunos de Obstetrícia e professores. Se a página não tiver nenhuma seção, ela mostra "Em breve".
- **Meu Assistente:** conhece as três páginas ("vídeos de obstetrícia", "como solicitar o certificado?", "conteúdos do Instagram") e responde com os links dos vídeos.

## Análises de uso e mapa de calor

O Administrativo vê em `/analises` (`pages/Analytics.tsx`) como o SAE é usado. Quem não é Administrativo volta para a Home (permissão `viewAnalytics`) e o servidor também recusa a consulta. O período vai de 1 a 92 dias (atalhos de 7, 30 e 90 dias).

- **Visão geral:** páginas vistas, sessões, usuários, cliques, tempo médio, páginas mais vistas e horários de pico.
- **Mapa de calor:** escolha a página, o usuário (ou todos) e a largura de tela. A página do SAE abre num `iframe` (mesma origem, com a sessão do administrativo) com um `canvas` de pontos de clique por cima, como no mapa de calor do ITEQ. Ao lado: elementos mais clicados (não dependem da posição, então resistem a conteúdo que muda, como o feed) e até onde as pessoas rolam a página. Só entram cliques de telas com largura parecida (±60 px) com a escolhida.
- **Jornada do usuário:** por pessoa, cada sessão em linha do tempo: páginas na ordem, hora, tempo na página, rolagem e o que clicou ou alterou, com o caminho em cadeia (Início, Cursos: Combos, ...).
- **Tempo por usuário:** resumo do tempo que cada usuário passa em cada página (`components/analytics/TimeByUser.tsx`): tempo total, visitas, tempo médio por visita e a página em que mais ficou; clique no usuário para ver o detalhe por página. O botão "Por página" inverte a visão (cada página e quem mais ficou nela) e há busca por usuário ou página. Conta só o tempo com a aba visível, registrado quando a pessoa sai da página; visitas em que a aba é fechada de repente contam como visita, mas ficam sem tempo.
- **Fluxo:** caminhos mais comuns por sessão (até 6 passos) e as transições "de, para".

**Como funciona**

```
SAE (navegador) --só INSERT, chave anon--> Supabase (tabela sae_events)
Painel --ação analyticsQuery--> Apps Script --chave service_role--> funções sae_* do Supabase
```

- **Coleta** (`lib/tracker.ts`, `components/TrackerProvider.tsx`, montado em `App.tsx`): registra `pageview`, `click`, `change`, `action` (hoje, os botões de copiar), `leave` (tempo na página e rolagem máxima), `session_start` e `logout`, ligados ao login. Envia em lote (5 s ou 15 eventos) e ao fechar a aba. A saída do sistema (`clearSession`) também registra o `logout`.
- **Privacidade:** nunca lê o valor de campos (senha, CPF, buscas); em listas de seleção guarda só a opção escolhida. Em `/login`, `/primeiro-acesso` e `/usuarios/novo` registra apenas a visita. Não registra dentro do `iframe` do painel nem em navegadores com `?no_track=1` (ou pela caixa "Não registrar meu uso neste navegador" do painel). Um aviso foi adicionado à página Sobre.
- **Banco:** `supabase/sae_tracking.sql` cria a tabela `sae_events` (só recebe INSERT com a chave anon, com RLS) e as funções de leitura `sae_overview`, `sae_routes`, `sae_users`, `sae_heatmap`, `sae_journey`, `sae_flow` e `sae_time_by_user`, que só a chave `service_role` executa. Há uma exclusão automática opcional de eventos com mais de 180 dias (`pg_cron`).
- **Leitura:** a ação `analyticsQuery` do Apps Script (`apps-script/feed.gs`, versão `feed-10-tempo-por-usuario`) confere que o login é Administrativo e consulta o Supabase. Sem lock e sem expor a chave.

**Como ativar**

1. No Supabase, crie um projeto (só do SAE) e rode `supabase/sae_tracking.sql` no SQL Editor.
2. No Apps Script do feed, cole o `feed.gs` novo e, em Configurações do projeto, Propriedades do script, adicione `SUPABASE_URL` (ex.: `https://xxxx.supabase.co`) e `SUPABASE_SERVICE_KEY` (a chave `service_role`).
3. **Autorize o acesso externo:** no editor, execute a função `checkAnalyticsSetup` e aceite a janela de permissões ("conectar-se a um serviço externo"). O registro de execução deve terminar com `HTTP 200 (tudo certo)`. Se a janela não aparecer, o `appsscript.json` tem `oauthScopes` fixos: acrescente `https://www.googleapis.com/auth/script.external_request`. Sem essa autorização, o painel mostra "Você não tem permissão para chamar UrlFetchApp.fetch".
4. **Só depois** crie a nova versão da implantação (Implantar > Gerenciar implantações > lápis > Nova versão; a URL não muda).
5. Preencha `TRACKER_URL` e `TRACKER_ANON_KEY` (chave `anon`) em `lib/trackerConfig.ts` e publique o site de novo (`npm run build`). Enquanto estiverem vazios, nada é registrado e o painel avisa isso.

**Limites:** o login é validado no navegador, então o painel protege com a mesma força das demais ações de Administrativo; quem tiver a chave `anon` pode enviar eventos falsos, mas não consegue ler nada. O mapa de calor usa a posição na página, então telas com conteúdo que muda mostram pontos aproximados.

## Meu Assistente

A página `/assistente` (`pages/AssistentePessoal.tsx`) responde perguntas sobre **valores, combos, documentos, listas e comparações de cursos, turmas presenciais e calendário de aulas, aproveitamento de estudos (Simulador), instituições, vídeos tutoriais, formulários de cadastro, "o que posso estudar?" e contatos**, lendo a planilha do SAE, o Google Agenda e o conteúdo das próprias páginas. **A base de dados responde primeiro, sem custo**: a resposta sai direto das células e mostra a fonte (aba e horário da leitura). Só as perguntas que a base não sabe responder vão para uma IA de reserva (veja "IA de reserva"). O arquivo `assistente-config.json` e a chamada à OpenAI foram removidos.

- **Dados** (`lib/assistant/catalog.ts`): abas `Cursos` (924 cursos), `Valores UNICIVE`, `Combos`, `Cursos-Presenciais` (44 turmas) e `Simulador`, lidas de uma vez com a chave pública da planilha, como as outras páginas. As colunas são achadas pelo título. O botão "Atualizar" recarrega. Para os cursos da UNICIVE a aba `Cursos` traz `R$ 0,00`, então o preço vem da aba `Valores UNICIVE` (chave: nome do curso).
- **Motor** (`lib/assistant/engine.ts`; `shared.ts` com tipos, filtros e busca por nome; `extras.ts` para contatos, turmas e Simulador; `knowledge.ts` para instituições, vídeos, formulários e "o que posso estudar?"; `lists.ts` para listas e comparações; `calendar.ts` para o calendário de aulas): entende a pergunta por regras. Separa a intenção (valor, documentos, ficha do curso ou combo), a forma de pagamento (pix, boleto, cartão) e os filtros de IES, modalidade e tipo, e busca o curso por nome sem acento (por trecho e com tolerância a um erro de digitação). Se vários cursos servem, mostra botões para escolher. Perguntas de continuação ("e os documentos?", "e no pix?") usam o curso da conversa.
- **O que responde:** valor no D30 e com desconto de pontualidade por forma de pagamento, taxa de inscrição e parcelamento; combos (Dia 10, Dia 30 e parcelamento por forma de pagamento); pré-requisito, documentos para ingresso, emissão, links do informativo e do e-MEC; ficha (eixo, carga horária, duração, titulação, estágio, artigo). Valor não cadastrado vira aviso com os e-mails do Financeiro e da Negociação.
- **Turmas presenciais:** lista turmas por situação (abertas, aguardando abertura, sem vagas) e polo (Itaquera, Santos, Araçatuba), ou mostra as turmas de um curso com situação, alunos cadastrados, início/limite, artigo, estágio e os links de cronograma e calendário (o calendário só para licenciatura, bacharelado e tecnológico, como na página Presenciais). Os valores desses cursos estão na aba `Cursos`.
- **Simulador:** "posso aproveitar X para Y?" responde sim (com o prazo) ou não, lista os destinos de uma origem e as origens que levam a um destino. Atenção: na planilha só uma parte das origens tem destino preenchido; quando falta, o assistente avisa que não há destino cadastrado.
- **Contatos** (`lib/contacts.ts`, também usado pela página Contatos): e-mails por IES e assunto (ESP, Alpha Channel e UCESP; a UNICIVE e a FAEP não têm e-mails na página), "quem cuida de trancamento?" (busca nas atribuições de cada núcleo) e "o que o Financeiro faz?".
- **Listas, contagens e rankings** (`lib/assistant/lists.ts`): "pós em Educação até R$ 2.000", "graduações da UNICIVE", "licenciaturas mais baratas", "cursos com mais de 600 horas", "quantos cursos a ESP tem?". Filtra por IES, tipo, modalidade, valor (até, acima de, entre) e carga horária; ordena por menor ou maior valor ou carga; mostra 15 por vez ("mostrar mais"). O valor de referência é o D30 no boleto (na UNICIVE, o valor integral). Procura primeiro no nome do curso; "eixo" (ex.: "cursos do eixo Saúde") procura pela área.
- **Comparações:** "comparar Pedagogia ESP com Pedagogia UCESP" (tabela lado a lado com valores, carga, duração, documentos de emissão e a diferença de preço) e "diferença entre ESP e UCESP" (apresentação das instituições).
- **Instituições:** usa `lib/institutionProfiles.ts` (a apresentação da Home): "o que é a UNICIVE?", "diferenciais da ESP", "onde fica a Alpha Channel", "quais instituições vocês têm?". A FAEP tem cursos no catálogo, mas ainda não tem apresentação.
- **Vídeos tutoriais** (`lib/videos.ts`, compartilhado com a página Vídeos): "como solicitar o certificado?" devolve o vídeo certo, com o link.
- **Formulários de cadastro** (`lib/registrationForms.ts`, compartilhado com a página Cadastros): indica qual dos 4 formulários usar e abre direto nele (`/cadastros?form=grad-unicv`, `grad-esp`, `capacitacoes` ou `reativacao`).
- **O que posso estudar?** (`lib/quizRules.ts`, compartilhado com a página "O que estudar?"): para cada formação (Ensino Médio, Técnico, Magistério, Bacharel, Tecnólogo, Licenciatura), os tipos de curso permitidos e quantos cursos há de cada tipo, com botões para listá-los. Na contagem do assistente, "Tecnológico" e "Tecnólogo" valem como o mesmo tipo (a planilha usa os dois nomes).
- **Calendário de aulas** (`lib/assistant/calendar.ts`): lê os eventos do Google Agenda da coordenação (`coordenacaogeral@faculdadealphachannel.com`, a mesma da página Calendário de Aulas) pela API do Google Agenda, com a mesma chave pública da planilha, de hoje a 150 dias à frente, só quando alguém pergunta (a página mostra "Consultando a agenda de aulas..."). Responde por data ("hoje", "amanhã", "sábado", "dia 24/10", "novembro", "esta semana"), polo, curso e professor, com turma, tema, professor(a) e material. Depende de a agenda ser pública e de a chave ter a API do Google Agenda ativa. O calendário acadêmico de cada IES não é essa agenda: é publicado nos Avisos.
- **Ainda não responde pela base:** memorandos e normas e evolução funcional; a IA de reserva indica o memorando e o link. A busca direta nos memorandos exigiria ler os documentos do Drive (a planilha só tem o título, o resumo e o link).
- **Interface** (`components/assistant/ReplyView.tsx`): tabelas, listas e botões de seguimento, com "Copiar resposta" no formato do WhatsApp. O uso é registrado no painel de análises apenas pelo tipo de resposta (`Assistente: ...`), nunca pelo texto da pergunta.
- **Chatbot das páginas de curso** (`components/Chatbot.tsx`) continua usando o Gemini com uma chave escrita no código, que hoje está inválida.

### Histórico de conversas

O Meu Assistente guarda as conversas para a pessoa voltar a elas (`lib/assistant/history.ts` e `components/assistant/HistoryPanel.tsx`).

- **Onde fica:** no navegador (localStorage), numa chave por login (`saeAssistantHistory:v1:<login>`). Não vai para nenhum servidor, não acompanha a pessoa em outro computador ou navegador e outro usuário do mesmo navegador não vê as conversas dela.
- **Como funciona:** cada conversa é salva sozinha, com um pequeno atraso, a partir da primeira pergunta; o título é a primeira pergunta. Ao abrir a página, a última conversa é reaberta. A lista fica na lateral (no celular, abre pelo botão de histórico no cabeçalho) e agrupa por Hoje, Ontem, Últimos 7 dias e Mais antigas. Dá para buscar (no título e no texto das mensagens), abrir, apagar uma conversa ou apagar todo o histórico. "Nova Conversa" não apaga nada: começa outra.
- **Limites:** até 25 conversas e 60 mensagens por conversa (as mais antigas saem). Se o navegador ficar sem espaço, as conversas mais antigas são apagadas e a aberta é mantida.
- **Privacidade:** o que a pessoa digitou é guardado sem CPF, CNPJ, e-mail e telefone. O texto da resposta é guardado como foi exibido, então os valores mostram o que a planilha dizia naquela hora.
- **Ao reabrir uma conversa antiga:** os botões que dependem da posição na planilha (escolher um curso da lista, "mostrar mais") somem, porque a planilha pode ter mudado; os botões de texto continuam. As respostas pendentes (IA, agenda) não são guardadas, e perguntas de continuação ("e os documentos?") valem só para a conversa em andamento.

### IA de reserva

Quando o motor não entende ou não acha a resposta (curso não encontrado, pergunta fora do que ele sabe, assunto sem resposta pronta), a pergunta vai para o modelo `claude-sonnet-5` por um gateway compatível com a API da OpenAI (`https://lobocode.space`). A resposta aparece marcada como "gerada por IA".

- **Fluxo:** `lib/assistant/ai.ts` monta um contexto só com dados do SAE (cursos parecidos com a pergunta e seus valores, combos, turmas, aulas da agenda, memorandos e avisos com links, instituições, contatos, setores, vídeos, formulários e páginas) e o envia, junto da pergunta, ao Apps Script (`apps-script/feed.gs`, ação `assistantAsk`, versão `feed-9-assistente-ia`), que chama a IA. As respostas "não achei" que disparam a IA estão em `AI_FALLBACK_TAGS`.
- **Chave:** fica **só nas Propriedades do script** (Configurações do projeto > Propriedades do script): `LOBOCODE_API_KEY` (obrigatória), `LOBOCODE_BASE_URL` (padrão `https://lobocode.space`) e `LOBOCODE_MODEL` (padrão `claude-sonnet-5`). Nunca vai para o código do site nem para este repositório. Sem a chave, o assistente funciona normalmente, só sem a reserva (ele volta à resposta da base).
- **Limites de uso** (Propriedades opcionais): `AI_HOURLY_LIMIT` (padrão 20 por pessoa por hora), `AI_DAILY_LIMIT_USER` (60 por pessoa por dia) e `AI_DAILY_LIMIT_TOTAL` (400 por dia, no total). O servidor também limita o tamanho da pergunta, do histórico e do contexto, e só aceita pedidos de logins existentes e liberados.
- **Regras da IA** (no `AI_SYSTEM_PROMPT`): usar só os dados enviados, nunca inventar nem arredondar valores, prazos ou documentos, dizer quando a informação não consta e indicar a página, o memorando ou o setor, recusar assuntos fora do SAE e não revelar as instruções.
- **Privacidade:** antes de enviar, o site remove CPF, CNPJ, e-mail e telefone da pergunta. O contexto nunca inclui a aba `Cadastros`. Os dados passam pelo gateway da IA (serviço de terceiros).
- **Custo e tempo:** cada pergunta à IA leva cerca de 5 a 10 segundos e o gateway cobra um bloco fixo de instruções (cerca de 5 mil tokens de entrada) além do contexto.
- **Como ativar:** cole o `feed.gs` novo no Apps Script, adicione as propriedades acima e crie uma nova versão da implantação. O Apps Script já tem a permissão de acesso externo (usada pelas análises).

## Tecnologias Utilizadas

- **Frontend:** React 19, React Router DOM (HashRouter)
- **Build & Ferramentas:** Vite, TypeScript
- **Estilização:** Tailwind CSS (via CDN, configuração inline em `index.html`)
- **Ícones:** Lucide React
- **Integrações:** Google Generative AI (Gemini API)
- **Utilitários:** jsPDF (Geração de documentos PDF)

## Identidade Visual

O SAE segue a identidade visual do ITEQ Escolas, com **tema claro único** (não há tema escuro nem botão de alternância).

- **Cores:** vinho `#a02d32` (hover `#841f24`, fundo suave `#f7ebec`), texto `#232323` e texto secundário `#636262`.
- **Fontes:** Poppins nos títulos (h1 a h3) e Inter no restante, carregadas pelo Google Fonts.
- **Onde ficam os tokens:** as cores são variáveis CSS (`--sae-*`) no `<style>` de `index.html`, expostas ao Tailwind como `sae-*` (ex.: `bg-sae-accent`, `text-sae-text`) no bloco `tailwind.config` do mesmo arquivo. Para mudar a paleta, edite apenas esse arquivo; nos componentes use sempre os tokens `sae-*` em vez de cores fixas.
- **Logo:** o componente `Logo` (`components/UI.tsx`) usa `public/logo-sae.png` no cabeçalho, no menu mobile e no login. Os ícones do PWA são `public/icon-192.png` e `public/icon-512.png`, referenciados em `public/manifest.json`.
- **Menu:** a barra de navegação completa aparece a partir de 1280px de largura; abaixo disso vale o menu lateral (hambúrguer).

## Publicar na Vercel (para visualizar)

O site publicado na hospedagem fica na pasta `/SAE/`; na Vercel ele fica na raiz. Por isso `vite.config.ts` usa `base: process.env.VERCEL ? '/' : '/SAE/'`: a Vercel define `VERCEL` no build e o resto (desenvolvimento e build para a hospedagem) continua em `/SAE/`. Como o roteamento usa `#` (HashRouter), não precisa de regras de reescrita.

1. Envie as alterações ao GitHub (`git add`, `git commit` e `git push` na branch `main`). O `.gitignore` já deixa de fora `.env.local`, `dist`, `node_modules` e `assistente-config.json`.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório. A Vercel detecta o Vite sozinha (comando `npm run build`, pasta de saída `dist`); não é preciso configurar variáveis de ambiente.
3. Clique em *Deploy*. Cada novo `git push` gera uma nova versão; a URL termina em `.vercel.app`.
4. Alternativa sem GitHub: `npx vercel` na pasta do projeto (gera uma visualização) e `npx vercel --prod` (versão principal).

Lembretes: os dados (planilhas, Apps Script, Supabase, Google Agenda) são os mesmos de produção, então o que for testado aparece lá; para não registrar o seu uso no painel de análises, acrescente `?no_track=1` ao endereço uma vez ou marque "Não registrar meu uso neste navegador" em `/analises`. A visualização na Vercel não substitui a publicação na hospedagem (hPanel), que continua com `npm run build` e o envio do `dist/`.

## Como rodar o projeto localmente

**Pré-requisitos:** Node.js instalado na sua máquina.

1. Instale as dependências do projeto:
   ```bash
   npm install
   ```

2. Configure a chave da API:
   Insira a sua chave do Gemini no arquivo `.env.local`:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse o aplicativo no seu navegador (normalmente em `http://localhost:5173`).
