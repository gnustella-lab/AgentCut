# AgentCut, architectural baseline

Status: architectural baseline for the full version. The repository also contains a functional local MVP, without a backend, for validating the agent → plan → approval → operation flow.

## Purpose

AgentCut will be a non-destructive video editor in which humans and agents use the same project state. The source of truth will be a deterministic timeline representation accompanied by atomic operations, versions, preconditions, inverses, and auditing. The visual interface, SDK, and external agents will be clients of this core, not parallel implementations of editing logic.

## Assumptions

- The first product is a desktop-first web application, with a separate API and local or distributed workers.
- The MVP prioritizes a reproducible local experience. Collaboration, publishing, and distributed rendering are deferred to later phases.
- Original files are immutable and content-addressed with SHA-256.
- The system supports local and hosted models through adapters. No AI provider is a domain requirement.
- Determinism means the same render plan every time. Byte-for-byte export will be guaranteed in a reproducible CPU profile with a pinned toolchain. Hardware acceleration will be marked as non-bit-exact.

## Architecture

The first version uses a modular monolith, not a fleet of microservices. The API, domain, and runtime are separated by modules and contracts. Workers execute heavy tasks through queues. When operational needs arise, each module can be extracted without changing public contracts.

Layers:

1. `apps/web`: React UI, player, library, timeline, transcript, and agent panel.
2. `apps/api`: authentication, REST, WebSocket, policies, project domain, and operations.
3. `apps/worker`: media, analysis, render, and quality-control jobs.
4. `packages/timeline-engine`: time model and invariants.
5. `packages/operation-engine`: validation, application, inversion, dry runs, and conflicts.
6. `packages/agent-runtime`: context, planning, catalog, policy, execution, approval, and review.
7. `packages/media-pipeline`: typed abstraction over `ffprobe`, FFmpeg, codecs, and filters.
8. `packages/render-engine`: compiler from the timeline to Render IR and an executable pipeline.
9. `packages/contracts`: JSON schemas, events, errors, and OpenAPI contracts.
10. `packages/sdk`: TypeScript client for applications and external agents.

Local infrastructure: PostgreSQL, Redis, MinIO, and FFmpeg. PostgreSQL stores materialized state, the operation log, analyses, and audit data. Redis and BullMQ orchestrate jobs. MinIO provides a local S3 API for originals, proxies, and exports.

## Timeline

Time is rational, not a JavaScript `number`. The JSON form is:

    { "value": "24000", "timescale": "1001" }

The time library normalizes fractions, compares values without floating point, and converts to frames or samples with explicit rounding. Each clip has a `timeline_range` and a `source_range`; duration is derived and validated. Tracks, effects, keyframes, masks, audio links, and semantic tags live in sequence state.

Persistence uses an operation log plus a materialized projection. Each operation records the actor, parameters, preconditions, previous state, next state, reason, confidence, tool version, idempotency key, and inverse operation. Snapshots reduce reconstruction cost. The domain does not depend on the UI.

## Agent runtime

The cycle is: understand, inspect, plan, simulate, request approval according to policy, execute, validate, review, and present. The model never writes directly to the database. It produces typed tool calls. Every mutable tool creates atomic operations through the `OperationEngine`.

The runtime has adapters for planning, transcription, vision, embeddings, audio, and generation. The MVP includes a deterministic planner for testing and an adapter compatible with structured chat APIs. Transcript text, OCR, and media descriptions are untrusted evidence, never system instructions.

## Rendering

The timeline is compiled into a versioned `RenderPlan`. The plan resolves assets by hash, normalizes timebases, assembles video and audio tracks, applies effects, composes captions, and defines codecs. `MediaPipeline` creates argument lists and never concatenates shell strings. `ffprobe` validates inputs and outputs.

The cache uses the asset hash, snapshot, Render IR, preset, and toolchain. The manifest records hashes, parameters, logs, costs, and artifacts. The reproducible profile uses CPU, fixed metadata, and explicitly defined codec parameters.

## Security

All access is limited by workspace and project. Uploads pass size limits, real MIME checks, `ffprobe`, safe naming, a temporary directory, and hash-based storage. Workers run in a sandbox with an isolated working directory, without a shell, and with CPU, memory, process, and network limits.

Agents receive their own permissions and budgets. Policy can block deletion, external sending, publishing, resolution changes, operation counts, cost, and rendering. An operation is denied before touching state when approval is missing. Media URLs are signed and expire.

## MVP

The MVP delivers project creation, video and audio import, probing, proxies, thumbnails, waveform, a basic multitrack timeline, a player, cut, move, split, trim, delete, undo, adapter-based transcription, transcript editing, silence removal, captions, vertical reframing, normalization, agent plans, dry runs, approval, execution, auditing, validation, preview, MP4 1080x1920, and SRT/VTT.

The following remain outside the MVP: real-time collaboration, full branches and merges, advanced tracking, background removal, a model marketplace, publishing, distributed rendering, all professional scopes, and GPU bit-exactness.

## Integration decisions

- FFmpeg and `ffprobe` sit behind `MediaPipeline` because of the breadth of filters and the need to test generated arguments.
- BullMQ is used for the MVP because it provides Redis queues, retries, priorities, concurrency, progress, and worker recovery. The database remains the source of truth and idempotency is guaranteed by the domain. Temporal is a future option for long-running workflows with many human pauses.
- OpenTimelineIO will be an interchange adapter, not the canonical model, because the AgentCut domain must include operations, approval, permissions, costs, and auditing.
- WebCodecs will be used opportunistically for preview inside Dedicated Workers, with HTML video and proxy fallback. Export remains in a worker.
- OpenTelemetry will instrument the API and workers. Critical instrumentation will not depend on the browser's experimental status.

## Design criteria

A change is complete only when its operation has been validated, persisted with preconditions, recorded in the audit log, made reversible when applicable, and included in a consistent state projection. Job failures must not partially change the timeline.
