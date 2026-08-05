# AgentCut

AgentCut is an agent-first local video editor. The main workflow is not a collection of manual editing buttons: you describe the result you want, the Director turns that brief into a complete edit mission, and one approval runs the safe steps in sequence.

The MVP is intentionally static and local. It uses HTML, CSS, plain JavaScript, and native browser APIs. There is no backend, bundler, package manager, external model, or upload service.

## The agent-first workflow

1. Import a source video into the local library.
2. Describe the outcome in the Agent Director, for example:

   `Turn this interview into a 45-second vertical reel with a strong hook, clean audio, and captions.`

3. AgentCut creates an **Edit Blueprint** with the source, delivery target, ordered steps, readiness, and analysis-dependent work.
4. Choose **Autopilot · one approval** and approve the blueprint once.
5. The Director runs the complete local mission as one reversible history command, updates the timeline, reports progress, and keeps undo available.
6. Review the resulting timeline and export the project manifest when ready.

The agent can choose the primary video, place it on an unlocked video track, switch the sequence to 9:16 when requested, preserve the source file, and record every decision. Steps that require transcription, waveform analysis, vision, captions, audio processing, or rendering are shown as **HELD**, never simulated as if they had run.

## Open locally

Open `index.html` in a browser. The app needs no npm install or internet connection.

An optional local server is useful when browser security restricts a `file://` feature:

```bash
cd "/home/mello/Área de trabalho/AgentCut"
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Structure

```text
index.html
css/styles.css
js/app.js
js/project.js
js/timeline.js
js/agent.js
assets/icons/README.md
docs/architecture/
execplan/
LICENSE
```

The scripts are loaded as classic scripts in dependency order, so the prototype also works when opened directly. The `window.AgentCut` namespace separates state, timeline, project, and agent responsibilities without a framework or bundler.

## Product surface

- Agent Director with a full-edit brief composer and brief starters.
- Persistent mission context showing source footage and delivery target.
- End-to-end Edit Blueprint with ordered steps and readiness states.
- One-approval autopilot for a complete safe local mission.
- Composite mission execution with progress, held-step reporting, audit history, undo, and redo.
- Deterministic local rules for full edits, vertical delivery, selected-clip removal, and splitting at the playhead.
- Local video, audio, and image library with preview, seek, volume, speed, and fullscreen controls.
- Non-destructive multitrack timeline with locked tracks and selection guards.
- `localStorage` metadata persistence using `agentcut-project-v1`.
- `.agentcut.json` manifest export through the native `Blob` API.
- Structured context through `window.AgentCut.agent.getContext()`, schema `agentcut-context-v2`.

## Intentional boundaries

- No remote LLM is called. The current Director is deterministic and local so every plan is inspectable and reproducible.
- No binary media is stored in `localStorage`. After reload, metadata is restored, but source files must be imported again for preview or execution.
- The timeline is non-destructive. It references and rearranges source media without changing the original files.
- There is no backend, database, final MP4 renderer, automatic transcription, waveform analysis, computer vision, or upload pipeline.
- Analysis-dependent steps remain visible in the blueprint and are marked **HELD**. AgentCut never claims to have removed silence, generated captions, polished audio, or selected highlights without the required media evidence.
- The static site intentionally has no `package.json`, so npm build and lint scripts are not part of the product.

## Manual verification

1. Open the app and import a local MP4.
2. In Agent Director, enter a complete brief such as `Turn this footage into a 45-second vertical reel with captions, clean audio, and no dead air.`
3. Confirm that the blueprint identifies the source, requests 9:16 delivery, and marks analysis-dependent steps as held.
4. Approve once and confirm that the source appears on the timeline, the sequence becomes `1080 × 1920 · 9:16`, progress is reported, and the mission log is updated.
5. Use undo and redo to verify that the entire mission is reversible as one edit.
6. Try `Create a vertical video up to 60 seconds.` and `Remove the selected clip.` to confirm that the original atomic operations still work.
7. Save, reload, and export the project manifest.

## Architecture

The current runtime is intentionally small:

- `project.js` owns state, persistence, snapshots, history, and manifest export.
- `agent.js` interprets the brief, creates the blueprint, renders mission state, and executes the composite full-edit command.
- `timeline.js` owns track-safe mutations and dispatches the composite agent operation.
- `app.js` binds browser events and renders the application shell.

The diagrams in `docs/architecture/` describe this local flow. The future architecture can add transcript, audio, vision, render, and export workers behind the same explicit blueprint contract without making the current UI pretend those capabilities already exist.

## License

AgentCut is released under the MIT License. See [LICENSE](LICENSE).
