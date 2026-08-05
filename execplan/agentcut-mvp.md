# Construir o vertical slice do MVP do AgentCut

Este é um plano vivo. As seções `Progress`, `Surprises & Discoveries`, `Decision Log` e `Outcomes & Retrospective` devem ser atualizadas durante a execução.

## Purpose / Big Picture

Depois deste plano, um desenvolvedor poderá iniciar o AgentCut localmente, criar um projeto, importar uma mídia, gerar metadados e proxy, criar uma sequência e aplicar operações determinísticas de timeline por API. O comportamento demonstrável será uma base real para o editor orientado a agentes, não um mock visual: o arquivo original permanecerá intacto, a operação terá log e undo, a repetição com a mesma idempotency key não duplicará o efeito e um conflito de versão retornará erro estruturado.

A primeira entrega não tentará implementar todos os recursos profissionais. Ela estabelecerá os contratos que permitem adicionar transcript, áudio, render e runtime de agentes sem acoplar essas capacidades à UI.

## Progress

- [x] (2026-08-04) Requisitos analisados e MVP delimitado.
- [x] (2026-08-04) Stack, limites arquiteturais e critérios de determinismo definidos.
- [x] (2026-08-04) Diagramas iniciais criados em `docs/architecture/components.mmd` e `docs/architecture/agent-flow.mmd`.
- [ ] Monorepo e ambiente Docker local criados.
- [ ] Schemas de tempo, projeto, sequência e operação implementados.
- [ ] Persistência, idempotência e optimistic concurrency implementadas.
- [ ] Pipeline de probe, proxy, thumbnail e waveform exercitado.
- [ ] UI inicial conectada à API.
- [ ] Vertical slice de agente, render e export implementado.
- [ ] Testes unitários, integração e E2E executados.

## Surprises & Discoveries

- Observação: a busca automática deste ambiente não pôde usar `ddgs`, pois o pacote não está instalado.
  Evidência: `web_search` retornou `ddgs package is not installed`; as decisões foram conferidas em documentações oficiais acessíveis diretamente.
- Observação: BullMQ oferece retries, prioridades, concorrência e recuperação, mas sua semântica prática é pelo menos uma entrega em caso extremo.
  Consequência: jobs devem ser idempotentes e a fonte de verdade deve permanecer no PostgreSQL.
- Observação: WebCodecs permite processamento de frames em Dedicated Workers, porém não deve ser requisito único de preview.
  Consequência: o player terá fallback por proxy e elemento de vídeo.
- Observação: determinismo byte a byte não deve ser prometido para qualquer encoder de hardware.
  Consequência: o produto separará o perfil CPU reprodutível do perfil acelerado.

## Decision Log

- Decision: usar monólito modular na primeira versão.
  Rationale: mantém o ciclo de desenvolvimento curto e permite extrair workers e serviços quando a carga justificar, sem distribuir o domínio antes de existirem contratos estáveis.
  Date/Author: 2026-08-04, Deep.
- Decision: usar TypeScript estrito no frontend, API, domínio e SDK.
  Rationale: timeline, schemas JSON, ferramentas e SDK compartilham tipos e validação em runtime.
  Date/Author: 2026-08-04, Deep.
- Decision: usar PostgreSQL, Redis/BullMQ, MinIO, FFmpeg e `ffprobe`.
  Rationale: composição local simples, persistência transacional, filas, storage S3 compatível e primitives maduras de mídia.
  Date/Author: 2026-08-04, Deep.
- Decision: representar tempo como fração racional serializada com strings.
  Rationale: evita drift de ponto flutuante em frame rates como 30000/1001 e torna arredondamento explícito.
  Date/Author: 2026-08-04, Deep.
- Decision: usar log de operações mais projeção materializada, em vez de event sourcing puro.
  Rationale: preserva auditoria e undo sem tornar leitura da timeline cara ou difícil para a UI.
  Date/Author: 2026-08-04, Deep.
- Decision: tratar OpenTimelineIO como intercâmbio futuro, não como modelo canônico.
  Rationale: o modelo interno precisa de aprovação, permissões, custos, confiança, inversas e auditoria.
  Date/Author: 2026-08-04, Deep.

## Outcomes & Retrospective

Ainda não há implementação da arquitetura completa descrita neste plano. A entrega mínima atual está em `index.html`, `css/` e `js/`: ela cobre preview local, timeline não destrutiva, planos determinísticos, aprovação, operações seguras, undo/redo, persistência de metadados e manifesto exportável. Backend, workers, FFmpeg integrado e modelos reais permanecem como próximos marcos, não como requisitos do MVP local.

## Context and Orientation

O diretório do projeto começa vazio. Os documentos de arquitetura ficam em `docs/architecture`. A aplicação será organizada em `apps/web`, `apps/api` e `apps/worker`; bibliotecas compartilhadas ficarão em `packages`.

A timeline é um estado versionado. Um `TimelineItem` referencia um asset original e contém um intervalo na sequência e um intervalo no asset. Uma operação é uma transição pequena e reversível entre duas versões. Uma precondição é uma afirmação que precisa continuar verdadeira, como a versão esperada de um clip. Uma idempotency key identifica uma intenção que só pode produzir um efeito uma vez no escopo definido.

## Plan of Work

Primeiro criar `package.json`, workspace, configurações TypeScript, lint, testes e Docker Compose. O Compose deve fornecer PostgreSQL, Redis e MinIO, com volumes nomeados e portas documentadas.

Depois criar `packages/time`, `packages/contracts`, `packages/project-schema`, `packages/operation-schema`, `packages/timeline-engine` e `packages/operation-engine`. O motor de tempo deve fazer soma, comparação, interseção, conversão para frame e serialização sem `number` para a parte temporal. O motor de operações deve validar, simular, aplicar e gerar inversas para inserir, mover, dividir, aparar, remover e desfazer clips.

Em seguida criar a API Fastify com health check, criação e leitura de projetos, criação e leitura de sequência, aplicação de operação e consulta do audit log. A escrita de operação deve usar transação, checar versão, registrar a idempotency key e atualizar a projeção. Uma chamada repetida deve devolver o resultado salvo anteriormente.

Depois criar `apps/worker` e `packages/media-pipeline`. O pipeline deve executar `ffprobe` e FFmpeg somente com arrays de argumentos, em diretório temporário seguro. O primeiro job deve importar ou registrar asset, calcular SHA-256, extrair metadados e produzir proxy. Waveform e thumbnails podem ser jobs independentes.

Por último criar uma UI mínima que lista projetos, mostra assets, abre uma sequência e exibe clips em uma timeline simplificada. Ela deve consumir o mesmo contrato da API e exibir operação, versão, autor, motivo, alerta e botão de undo.

O segundo vertical slice, depois da fundação, adicionará transcript, remoção de silêncios, plano de agente, dry run, aprovação, render preview e export 1080x1920.

## Concrete Steps

Executar todos os comandos a partir de `/home/mello/Área de trabalho/Pasta sem título`.

1. Verificar as ferramentas locais sem modificar arquivos do usuário:

    `node --version`
    `pnpm --version || corepack pnpm --version`
    `docker --version`
    `ffmpeg -version`
    `ffprobe -version`

2. Criar o workspace TypeScript e instalar somente dependências necessárias ao primeiro marco. Se `pnpm` não estiver disponível, habilitar o gerenciador por Corepack ou usar npm workspaces como fallback documentado.

3. Iniciar a infraestrutura:

    `docker compose -f infrastructure/docker/compose.yaml up -d`

4. Rodar migrações e testes do domínio:

    `pnpm typecheck`
    `pnpm lint`
    `pnpm test --run`

5. Exercitar a API:

    `curl -fsS http://localhost:3000/health`
    `curl -fsS -X POST http://localhost:3000/v1/projects -H 'content-type: application/json' -d '{"name":"Demo AgentCut"}'`

6. Exercitar o fluxo de operação com uma sequência e um clip. A segunda submissão deve devolver o mesmo `operation_id` ou o resultado persistido. Uma submissão com versão antiga deve responder HTTP 409 com código `TIMELINE_VERSION_CONFLICT`.

7. Exercitar mídia com um fixture gerado por FFmpeg. Confirmar por `ffprobe` que o proxy tem o formato esperado e que o SHA-256 do original não mudou.

## Validation and Acceptance

O primeiro marco passa quando:

- `GET /health` retorna HTTP 200.
- Um projeto e uma sequência podem ser criados e lidos.
- Uma operação de inserção, split, move, trim e delete passa por validação e atualiza a versão.
- O undo restaura o estado anterior da sequência.
- A mesma idempotency key não cria um segundo clip nem uma segunda entrada no log efetivo.
- Um conflito de versão não altera a projeção.
- Uma falha de validação não cria operação parcial.
- O asset original mantém o mesmo hash antes e depois do proxy.
- `pnpm typecheck`, `pnpm lint` e `pnpm test --run` terminam com sucesso.
- A UI consegue exibir a sequência e o histórico da operação.

No vertical slice completo, o cenário de aceitação será importar uma entrevista de pelo menos 30 minutos, transcrever, pedir um corte vertical de até 60 segundos, revisar e aprovar um plano, executar operações, desfazer, validar e exportar MP4 1080x1920 e SRT.

## Idempotence and Recovery

Todas as migrações devem ser versionadas e reaplicáveis com segurança. Jobs usam uma chave composta por tipo, asset hash, parâmetros normalizados e versão do worker. Arquivos temporários são removidos em sucesso ou falha. Falha de worker deixa o job como retryable ou failed, mas não altera a timeline sem uma operação transacional concluída.

Antes de migrações destrutivas, criar dump do PostgreSQL. Se a instalação parar no meio, derrubar somente os serviços do Compose, preservar volumes e executar novamente a etapa que falhou. O estado materializado pode ser reconstruído a partir do snapshot e do log quando essa rotina for implementada.

## Artifacts and Notes

- Arquitetura: `docs/architecture/agentcut-baseline.md`
- Componentes: `docs/architecture/components.mmd`
- Fluxo do agente: `docs/architecture/agent-flow.mmd`
- Este plano: `execplan/agentcut-mvp.md`
- Fontes técnicas consultadas: documentação oficial de FFmpeg/ffprobe, WebCodecs, BullMQ, OpenTelemetry, PostgreSQL e OpenTimelineIO.

## Interfaces and Dependencies

As interfaces iniciais devem ser pequenas e independentes da infraestrutura:

    type RationalTime = { value: string; timescale: string }

    interface OperationEngine {
      validate(state: ProjectState, operation: Operation): ValidationResult
      simulate(state: ProjectState, operations: Operation[]): SimulationResult
      apply(state: ProjectState, operation: Operation): AppliedOperation
      inverse(operation: Operation, result: AppliedOperation): Operation
    }

    interface MediaPipeline {
      probe(input: ResolvedMedia): Promise<MediaProbe>
      run(spec: PipelineSpec, signal?: AbortSignal): Promise<PipelineResult>
    }

    interface AgentTool<I, O> {
      definition: ToolDefinition
      execute(context: ToolContext, input: I): Promise<ToolResult<O>>
    }

Dependências principais: Fastify, TypeBox/Ajv, PostgreSQL com Drizzle ou SQL tipado, Redis/BullMQ, MinIO SDK, FFmpeg/ffprobe, React, TanStack Query, Zustand, Vitest, Playwright, OpenTelemetry e `ulid`. A implementação deve encapsular cada dependência atrás dos pacotes indicados para permitir substituição.
