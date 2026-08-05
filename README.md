# AgentCut Studio

A local MVP of an AI-agent-oriented video editor.

The MVP uses only HTML5, CSS3, plain JavaScript, and native browser APIs. It requires no backend, bundler, dependency, or external model. Imported files remain only in the tab's memory.

## Open directly

Open `index.html` in a browser. The application needs no npm, bundler, or internet connection.

You can also use an optional local server if the browser restricts a feature when opening through `file://`:

```bash
cd "/home/mello/Área de trabalho/Pasta sem título"
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
docs/                 # preserved architecture documentation
```

The scripts are loaded as classic scripts, in order, so the file also works directly through `file://`. The global `window.AgentCut` namespace separates state and responsibilities without requiring modules or a bundler.

## Features

- Local library for video, audio, and image files.
- Preview with `URL.createObjectURL`, play, pause, seek, volume, playback speed, and fullscreen.
- Visual multitrack timeline with video, audio, and text tracks.
- Add clips with a button or double-click.
- Selection, removal, zoom, and playhead controls.
- Non-destructive splitting at the playhead, with track locking and undo/redo.
- In-memory history with undo and redo.
- Metadata persistence in `localStorage` using `agentcut-project-v1`.
- Export of an `.agentcut.json` manifest through `Blob`.
- Local rules-based runtime with structured context from `window.AgentCut.agent.getContext()`.
- Plans with explicit approval, safe-operation execution, and history auditing.
- Switch to a 1080 × 1920 sequence when the vertical plan is approved.
- Shortcuts: Space, Ctrl/Cmd+S, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Delete, and Escape.

## Intentional limitations

- No binary file is saved in `localStorage`.
- After reload, metadata is restored, but local files must be imported again for preview.
- The runtime does not call real models. It is a deterministic local adapter for validating the agent, plan, approval, and operation contract.
- The timeline is non-destructive: it splits and removes references, but does not re-encode or modify original files.
- There is no backend, database, final render, automatic transcription, or upload.
- Requests that depend on audio analysis, transcripts, or vision remain reviewable plans, without invented execution.

## Manual verification

1. Open `index.html`.
2. Import a local video.
3. Select the item in the library and play the preview.
4. Add the item to the timeline by double-clicking or using the `Timeline` button.
5. Select the clip, remove it, undo, and redo.
6. Select a clip, move the playhead inside it, and enter `split the selected clip at the playhead`.
7. Approve the plan and confirm that two clips appear in the timeline with an operation entry in history.
8. Use `Ctrl/Cmd+Z` to verify undo. Also test `create a vertical video` and approve the sequence change.
9. Enter `remove silences` to confirm that the request becomes a reviewable plan without claiming an analysis that did not happen.
10. Save, reload the page, and export the project to validate the downloaded JSON.

## Minimum agent contract

Observable state is available through `window.AgentCut.getState()`. A safe context for an agent is available through `window.AgentCut.agent.getContext()`. It reports assets, sequence, tracks, selection, available capabilities, and the approval policy. Mutable operations always go through the plan-and-approval flow, never through direct state writes.

The existing diagrams and architecture documentation in `docs/` are preserved.

## License

AgentCut is released under the MIT License. See [LICENSE](LICENSE).
