# Build the AgentCut MVP vertical slice

This is a living plan. The `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections should be updated during execution.

## Purpose / Big Picture

After this plan, a developer will be able to start AgentCut locally, create a project, import media, generate metadata and a proxy, create a sequence, and apply deterministic timeline operations through an API. The demonstrable behavior will be a real foundation for an agent-oriented editor, not a visual mock: the original file will remain intact, the operation will be logged and undoable, repeating the same idempotency key will not duplicate the effect, and a version conflict will return a structured error.

The first delivery will not attempt to implement every professional feature. It will establish the contracts needed to add transcripts, audio, rendering, and an agent runtime without coupling those capabilities to the UI.

## Progress

- [x] (2026-08-04) Requirements analyzed and MVP scoped.
- [x] (2026-08-04) Stack, architectural boundaries, and determinism criteria defined.
- [x] (2026-08-04) Initial diagrams created in `docs/architecture/components.mmd` and `docs/architecture/agent-flow.mmd`.
- [ ] Monorepo and local Docker environment created.
- [ ] Time, project, sequence, and operation schemas implemented.
- [ ] Persistence, idempotency, and optimistic concurrency implemented.
- [ ] Probe, proxy, thumbnail, and waveform pipeline exercised.
- [ ] Initial UI connected to the API.
- [ ] Agent, render, and export vertical slice implemented.
- [ ] Unit, integration, and E2E tests executed.

## Surprises & Discoveries

- Observation: automatic search in this environment could not use `ddgs` because the package is not installed.
  Evidence: `web_search` returned `ddgs package is not installed`; decisions were checked against official documentation accessed directly.
- Observation: BullMQ provides retries, priorities, concurrency, and recovery, but its practical semantics are at-least-once delivery in the extreme case.
  Consequence: jobs must be idempotent and PostgreSQL must remain the source of truth.
- Observation: WebCodecs enables frame processing in Dedicated Workers, but it should not be the only preview requirement.
  Consequence: the player will have a proxy and HTML video fallback.
- Observation: byte-for-byte determinism should not be promised for every hardware encoder.
  Consequence: the product will separate a reproducible CPU profile from an accelerated profile.

## Decision Log

- Decision: use a modular monolith for the first version.
  Rationale: it keeps the development cycle short and allows workers and services to be extracted when load justifies it, without distributing the domain before stable contracts exist.
  Date/Author: 2026-08-04, Deep.
- Decision: use strict TypeScript in the frontend, API, domain, and SDK.
  Rationale: the timeline, JSON schemas, tools, and SDK share types and runtime validation.
  Date/Author: 2026-08-04, Deep.
- Decision: use PostgreSQL, Redis/BullMQ, MinIO, FFmpeg, and `ffprobe`.
  Rationale: simple local composition, transactional persistence, queues, S3-compatible storage, and mature media primitives.
  Date/Author: 2026-08-04, Deep.
- Decision: represent time as a serialized rational fraction using strings.
  Rationale: it avoids floating-point drift at frame rates such as 30000/1001 and makes rounding explicit.
  Date/Author: 2026-08-04, Deep.
- Decision: use an operation log plus materialized projection instead of pure event sourcing.
  Rationale: it preserves auditing and undo without making timeline reads expensive or difficult for the UI.
  Date/Author: 2026-08-04, Deep.
- Decision: treat OpenTimelineIO as future interchange, not the canonical model.
  Rationale: the internal model needs approval, permissions, costs, confidence, inverses, and auditing.
  Date/Author: 2026-08-04, Deep.

## Outcomes & Retrospective

The complete architecture described in this plan is not implemented yet. The current minimum delivery is in `index.html`, `css/`, and `js/`: it covers local preview, a non-destructive timeline, deterministic plans, approval, safe operations, undo/redo, metadata persistence, and an exportable manifest. The backend, workers, integrated FFmpeg, and real models remain future milestones, not requirements for the local MVP.

## Context and Orientation

The project directory starts empty. Architecture documents live in `docs/architecture`. The application will be organized into `apps/web`, `apps/api`, and `apps/worker`; shared libraries will live in `packages`.

The timeline is versioned state. A `TimelineItem` references an original asset and contains a range in the sequence and a range in the asset. An operation is a small, reversible transition between two versions. A precondition is an assertion that must remain true, such as the expected version of a clip. An idempotency key identifies an intent that can produce an effect only once within the defined scope.

## Plan of Work

First create `package.json`, the workspace, TypeScript configuration, linting, tests, and Docker Compose. Compose should provide PostgreSQL, Redis, and MinIO with named volumes and documented ports.

Then create `packages/time`, `packages/contracts`, `packages/project-schema`, `packages/operation-schema`, `packages/timeline-engine`, and `packages/operation-engine`. The time engine must perform addition, comparison, intersection, frame conversion, and serialization without using `number` for temporal values. The operation engine must validate, simulate, apply, and generate inverses for inserting, moving, splitting, trimming, removing, and undoing clips.

Next create the Fastify API with a health check, project creation and reads, sequence creation and reads, operation application, and audit-log queries. Operation writes must use a transaction, check the version, record the idempotency key, and update the projection. A repeated call must return the previously stored result.

Then create `apps/worker` and `packages/media-pipeline`. The pipeline must run `ffprobe` and FFmpeg only with argument arrays in a safe temporary directory. The first job must import or register an asset, calculate SHA-256, extract metadata, and produce a proxy. Waveforms and thumbnails can be independent jobs.

Finally create a minimal UI that lists projects, shows assets, opens a sequence, and displays clips in a simplified timeline. It must consume the same API contract and display the operation, version, author, reason, alert, and undo button.

The second vertical slice, after the foundation, will add transcripts, silence removal, an agent plan, dry run, approval, preview rendering, and 1080x1920 export.

## Concrete Steps

Run all commands from `/home/mello/Área de trabalho/Pasta sem título`.

1. Verify local tools without modifying user files:

    `node --version`
    `pnpm --version || corepack pnpm --version`
    `docker --version`
    `ffmpeg -version`
    `ffprobe -version`

2. Create the TypeScript workspace and install only the dependencies needed for the first milestone. If `pnpm` is unavailable, enable the package manager through Corepack or use npm workspaces as a documented fallback.

3. Start the infrastructure:

    `docker compose -f infrastructure/docker/compose.yaml up -d`

4. Run domain migrations and tests:

    `pnpm typecheck`
    `pnpm lint`
    `pnpm test --run`

5. Exercise the API:

    `curl -fsS http://localhost:3000/health`
    `curl -fsS -X POST http://localhost:3000/v1/projects -H 'content-type: application/json' -d '{"name":"Demo AgentCut"}'`

6. Exercise the operation flow with a sequence and a clip. The second submission should return the same `operation_id` or the persisted result. A submission with an old version should return HTTP 409 with code `TIMELINE_VERSION_CONFLICT`.

7. Exercise media with an FFmpeg-generated fixture. Use `ffprobe` to confirm that the proxy has the expected format and that the original SHA-256 has not changed.

## Validation and Acceptance

The first milestone passes when:

- `GET /health` returns HTTP 200.
- A project and a sequence can be created and read.
- Insert, split, move, trim, and delete operations pass validation and update the version.
- Undo restores the previous sequence state.
- The same idempotency key does not create a second clip or a second effective log entry.
- A version conflict does not change the projection.
- A validation failure does not create a partial operation.
- The original asset keeps the same hash before and after proxy creation.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test --run` finish successfully.
- The UI can display the sequence and the operation history.

In the complete vertical slice, the acceptance scenario will import an interview of at least 30 minutes, transcribe it, request a vertical cut of up to 60 seconds, review and approve a plan, execute operations, undo, validate, and export MP4 1080x1920 and SRT.

## Idempotence and Recovery

All migrations must be versioned and safely replayable. Jobs use a key composed of type, asset hash, normalized parameters, and worker version. Temporary files are removed on success or failure. A worker failure leaves the job retryable or failed, but does not change the timeline without a completed transactional operation.

Before destructive migrations, create a PostgreSQL dump. If installation stops midway, bring down only the Compose services, preserve volumes, and rerun the failed step. Materialized state can be rebuilt from the snapshot and log once that routine is implemented.

## Artifacts and Notes

- Architecture: `docs/architecture/agentcut-baseline.md`
- Components: `docs/architecture/components.mmd`
- Agent flow: `docs/architecture/agent-flow.mmd`
- This plan: `execplan/agentcut-mvp.md`
- Technical sources consulted: official documentation for FFmpeg/ffprobe, WebCodecs, BullMQ, OpenTelemetry, PostgreSQL, and OpenTimelineIO.

## Interfaces and Dependencies

Initial interfaces should be small and independent of infrastructure:

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

Main dependencies: Fastify, TypeBox/Ajv, PostgreSQL with Drizzle or typed SQL, Redis/BullMQ, the MinIO SDK, FFmpeg/ffprobe, React, TanStack Query, Zustand, Vitest, Playwright, OpenTelemetry, and `ulid`. The implementation should encapsulate each dependency behind the indicated packages to allow replacement.
