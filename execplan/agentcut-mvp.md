# AgentCut agent-first delivery plan

This plan tracks the static browser MVP as a real agent-first editing vertical slice.

## Purpose

Make the user's primary action a complete edit brief. AgentCut should understand the desired outcome, create an explicit blueprint, ask for one approval, and run the safe portion of the full mission without requiring the user to manually chain primitive operations.

## Delivered

- [x] Agent Director replaces the operation-first panel language.
- [x] Full-edit composer with outcome-oriented brief starters.
- [x] Persistent source and delivery mission context.
- [x] Deterministic full-edit intent matching for briefs such as vertical reels, YouTube cuts, social clips, product stories, and highlight reels.
- [x] Edit Blueprint with ordered steps and `ready`, `blocked`, `deferred`, and `skipped` states.
- [x] One-approval Autopilot flow.
- [x] Composite `agent.full-edit` operation with one history entry and full undo/redo.
- [x] Safe local execution that can select a source, add it to an unlocked video track, and apply a vertical 9:16 target.
- [x] Explicit held states for silence removal, captions, audio polish, highlights, and other analysis-dependent work.
- [x] Existing atomic remove, split, and sequence operations preserved.
- [x] Context schema advanced to `agentcut-context-v2` with mission state and media availability.
- [x] README, baseline architecture, flow diagrams, and license aligned with the product direction.

## Deliberate non-goals

- No remote LLM or hidden network request.
- No backend, database, npm toolchain, or external dependency.
- No automatic speech, audio, scene, or subject analysis.
- No MP4 rendering or export worker.
- No claim that held steps have run.

## Verification

The current acceptance path uses a real local MP4 and a clean headless Chrome profile:

1. Import the MP4 and wait for metadata/preview readiness.
2. Submit a complete brief requesting a vertical reel with captions, clean audio, and silence removal.
3. Confirm a full-edit plan, source binding, 9:16 target, and held analysis steps.
4. Approve once and confirm one clip, `1080 × 1920`, progress, history, and zero browser exceptions.
5. Undo and redo the complete mission.
6. Confirm atomic vertical reframing and selected-clip removal still work.

The project intentionally has no `package.json`; npm lint/build commands are not applicable to this static site.
