# AgentCut agent-first baseline

## Purpose

AgentCut is a local, static video editor whose primary interaction is an edit brief. The user describes the outcome, the local Director converts that intent into an explicit Edit Blueprint, and one approval runs the safe portion of the mission as a reversible composite command.

The current delivery optimizes for agent behavior and auditability instead of professional rendering breadth. The app is a real browser implementation, not a visual mock, but it deliberately does not claim to have transcript, audio, vision, or render workers.

## Product loop

```text
brief
  ↓
local project context
  ↓
Edit Blueprint: source, target, ordered steps, readiness, held work
  ↓
explicit approval
  ↓
composite full-edit operation
  ↓
timeline + mission progress + history + undo/redo
```

The Director treats one full-edit request as a mission rather than a sequence of unrelated assistant replies. The mission records the requested delivery, source asset, supported actions, analysis-dependent actions, and the reason a step is held.

## Current implementation

### Static application shell

`index.html` is the only document. `css/styles.css` provides the dark editing workspace and Agent Director treatment. The application uses no framework, module loader, bundler, package manager, backend, database, or network model.

### Project state

`js/project.js` owns the state graph:

- project metadata and dirty state;
- media metadata and in-memory object URLs;
- sequence settings;
- video, audio, and text tracks;
- selected media and timeline item;
- agent messages, plans, and the current mission;
- undo/redo snapshots and the exportable manifest.

Persisted metadata remains compatible with `agentcut-project-v1`. The new mission state is additive and is restored with defaults when an older local project is opened.

### Director runtime

`js/agent.js` owns the local agent contract:

1. normalize and classify the natural-language brief;
2. detect a full-edit intent before falling back to atomic commands;
3. choose the selected video or first available video as the source;
4. infer delivery intent such as vertical 9:16;
5. create an ordered blueprint with `ready`, `blocked`, `deferred`, and `skipped` states;
6. require explicit approval;
7. execute the safe local portion as one composite history command;
8. update progress and preserve a complete inverse operation.

The runtime exposes `window.AgentCut.agent.getContext()`, schema `agentcut-context-v2`. The context contains project, sequence, media availability, tracks, selection, mission state, capabilities, and the approval policy.

### Timeline engine

`js/timeline.js` owns timeline mutations and enforces track locks and selection preconditions. It supports:

- adding media to a track;
- removing the selected clip;
- splitting the selected clip at the playhead;
- changing sequence settings;
- dispatching `agent.full-edit` to the Director's composite executor;
- recalculating duration and rendering the visual timeline.

The composite command adds the selected source when necessary, selects it, applies the requested sequence target, updates the mission, and records before/after snapshots. Undo restores the entire mission, not only its last sub-step.

## Safety contract

- Approval is explicit. Autopilot means one approval for the whole mission, not silent mutation while the user is typing.
- Original media is immutable.
- Only known operations can mutate the project.
- Locked tracks reject changes.
- A plan captures its target before approval and can reject stale selections.
- Unsupported analysis is reported as held work, never fabricated as completed work.
- Every mutation is represented in the history log and remains undoable.

## Deliberate boundaries

The local MVP cannot safely perform work that requires evidence it does not have. Silence removal, highlight selection, caption generation, audio cleanup, subject tracking, and MP4 rendering are represented in the blueprint but remain held until future local workers provide the necessary evidence and artifacts.

This boundary is part of the product design: an agent-first editor must be transparent about what it knows, what it can change, and what still needs a media capability.

## Extension path

Future capabilities should plug into the same mission contract:

- transcript provider adds time-aligned speech evidence;
- waveform/audio analyzer adds measurable silence and loudness evidence;
- vision analyzer adds scene, subject, and framing evidence;
- render worker turns the approved timeline into MP4 and caption artifacts;
- quality control validates the exported result before delivery.

Each extension should contribute evidence and reversible operations to the blueprint. It should not bypass the approval, policy, history, or immutable-source boundaries.
