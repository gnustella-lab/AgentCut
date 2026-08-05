# AgentCut, baseline arquitetural

Status: baseline arquitetural da versão completa. O repositório também contém um MVP local funcional, sem backend, para validar o fluxo agente → plano → aprovação → operação.

## Propósito

AgentCut será um editor de vídeo não destrutivo no qual humanos e agentes usam o mesmo estado de projeto. A fonte de verdade será uma representação determinística da timeline, acompanhada por operações atômicas, versões, precondições, inversas e auditoria. A interface visual, o SDK e agentes externos serão clientes desse núcleo, não implementações paralelas da lógica de edição.

## Assumptions

- O primeiro produto é uma aplicação web desktop-first, com API separada e workers locais ou distribuídos.
- O MVP prioriza uma experiência local reproduzível. Colaboração, publicação e render distribuído ficam para fases posteriores.
- Arquivos originais são imutáveis e armazenados por conteúdo, usando SHA-256.
- O sistema suporta modelos locais e hospedados por adaptadores. Nenhum fornecedor de IA é requisito do domínio.
- Determinismo significa plano de render idêntico sempre. Exportação byte a byte será garantida no perfil CPU reprodutível, com toolchain fixada. Aceleração por hardware será marcada como não bit-exata.

## Arquitetura

A primeira versão usa um monólito modular, não uma frota de microsserviços. API, domínio e runtime ficam separados por módulos e contratos. Workers executam tarefas pesadas por filas. Quando houver necessidade operacional, cada módulo poderá ser extraído sem alterar os contratos públicos.

Camadas:

1. `apps/web`: UI React, player, biblioteca, timeline, transcript e painel do agente.
2. `apps/api`: autenticação, REST, WebSocket, políticas, domínio de projeto e operações.
3. `apps/worker`: jobs de mídia, análise, render e controle de qualidade.
4. `packages/timeline-engine`: modelo temporal e invariantes.
5. `packages/operation-engine`: validação, aplicação, inversão, dry run e conflitos.
6. `packages/agent-runtime`: contexto, planejamento, catálogo, política, execução, aprovação e revisão.
7. `packages/media-pipeline`: abstração tipada de `ffprobe`, FFmpeg, codecs e filtros.
8. `packages/render-engine`: compilador da timeline para Render IR e pipeline executável.
9. `packages/contracts`: schemas JSON, eventos, erros e contratos OpenAPI.
10. `packages/sdk`: cliente TypeScript para aplicações e agentes externos.

Infraestrutura local: PostgreSQL, Redis, MinIO e FFmpeg. PostgreSQL guarda o estado materializado, o log de operações, análises e auditoria. Redis e BullMQ orquestram jobs. MinIO fornece uma API S3 local para originais, proxies e exports.

## Timeline

O tempo é racional, não um `number` de JavaScript. A forma JSON é:

    { "value": "24000", "timescale": "1001" }

A biblioteca de tempo normaliza frações, compara valores sem ponto flutuante e converte para frames ou samples com arredondamento explícito. Cada clip possui `timeline_range` e `source_range`; a duração é derivada e validada. Tracks, efeitos, keyframes, máscaras, links de áudio e tags semânticas ficam no estado da sequência.

A persistência usa log de operações mais projeção materializada. Cada operação informa ator, parâmetros, precondições, estado anterior, estado posterior, motivo, confiança, versão da ferramenta, idempotency key e operação inversa. Snapshots reduzem o custo de reconstrução. O domínio não depende da UI.

## Runtime de agentes

O ciclo é: compreender, inspecionar, planejar, simular, pedir aprovação conforme a política, executar, validar, revisar e apresentar. O modelo nunca escreve diretamente no banco. Ele produz chamadas de ferramentas tipadas. Toda ferramenta mutável gera operações atômicas por meio do `OperationEngine`.

O runtime possui adaptadores para planner, transcrição, visão, embeddings, áudio e geração. O MVP inclui um planner determinístico para testes e um adaptador compatível com APIs de chat estruturadas. Texto de transcript, OCR e descrições de mídia é evidência não confiável, nunca instrução de sistema.

## Renderização

A timeline é compilada para um `RenderPlan` versionado. O plano resolve assets por hash, normaliza timebases, monta trilhas de vídeo e áudio, aplica efeitos, compõe legendas e define codecs. O `MediaPipeline` cria listas de argumentos, nunca concatena strings para shell. `ffprobe` valida entradas e saídas.

O cache usa o hash de asset, snapshot, Render IR, preset e toolchain. O manifesto registra hashes, parâmetros, logs, custos e artefatos. O perfil reprodutível usa CPU, metadados fixos e parâmetros de codec explicitamente definidos.

## Segurança

Todo acesso é limitado por workspace e projeto. Uploads passam por limite de tamanho, MIME real, `ffprobe`, nome seguro, diretório temporário e armazenamento por hash. Workers executam em sandbox com diretório de trabalho isolado, sem shell, com limites de CPU, memória, processos e rede.

Agentes recebem permissões e orçamento próprios. A política pode bloquear exclusão, envio externo, publicação, resolução, número de operações, custo e render. A operação é negada antes de tocar no estado quando faltar aprovação. URLs de mídia são assinadas e expiram.

## MVP

O MVP entrega criação de projeto, importação de vídeo e áudio, probe, proxy, thumbnails, waveform, timeline multipista básica, player, corte, movimento, split, trim, delete, undo, transcrição por adaptador, edição via transcript, remoção de silêncios, legendas, reenquadramento vertical, normalização, plano de agente, dry run, aprovação, execução, auditoria, validação, preview, MP4 1080x1920 e SRT/VTT.

Ficam fora do MVP: colaboração em tempo real, branches e merge completos, tracking avançado, remoção de fundo, marketplace de modelos, publicação, render distribuído, todos os scopes profissionais e bit-exact em GPU.

## Decisões de integração

- FFmpeg e `ffprobe` ficam atrás de `MediaPipeline`, por causa da amplitude de filtros e da necessidade de testar os argumentos gerados.
- BullMQ é usado para o MVP por oferecer filas Redis, retries, prioridades, concorrência, progresso e recuperação de workers. O banco continua sendo a fonte de verdade e a idempotência é garantida pelo domínio. Temporal é uma opção futura para workflows de longa duração com muitas pausas humanas.
- OpenTimelineIO será um adaptador de intercâmbio, não o modelo canônico, pois o domínio de AgentCut precisa incluir operações, aprovação, permissões, custos e auditoria.
- WebCodecs será usado de forma oportunista no preview dentro de Dedicated Workers, com fallback para vídeo HTML e proxies. Exportação continua no worker.
- OpenTelemetry instrumentará API e workers. Instrumentação crítica não dependerá do status experimental do browser.

## Critérios de desenho

Uma alteração somente é concluída quando sua operação foi validada, persistida com precondições, registrada no audit log, tornada reversível quando aplicável e incluída em uma projeção de estado consistente. Falhas de jobs não podem alterar parcialmente a timeline.
