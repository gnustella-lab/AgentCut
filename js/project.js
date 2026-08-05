(function () {
  "use strict";

  var AC = window.AgentCut = window.AgentCut || {};
  var STORAGE_KEY = "agentcut-project-v1";

  function now() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    var value = "";
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      value = window.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    } else if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      value = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    } else {
      value = Math.random().toString(36).slice(2, 14);
    }
    return (prefix || "id") + "_" + value;
  }

  function cloneJSON(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createTracks() {
    return [
      {
        id: "video-track-1",
        type: "video",
        name: "Vídeo 1",
        locked: false,
        hidden: false,
        muted: false,
        items: []
      },
      {
        id: "audio-track-1",
        type: "audio",
        name: "Áudio 1",
        locked: false,
        hidden: false,
        muted: false,
        items: []
      },
      {
        id: "text-track-1",
        type: "text",
        name: "Texto 1",
        locked: false,
        hidden: false,
        muted: false,
        items: []
      }
    ];
  }

  function createInitialState(name) {
    var timestamp = now();
    return {
      project: {
        id: createId("project"),
        name: name || "Projeto sem título",
        createdAt: timestamp,
        updatedAt: timestamp,
        lastSavedAt: null,
        dirty: false,
        restored: false
      },
      media: [],
      selectedMediaId: null,
      previewKind: null,
      timeline: {
        duration: 0,
        zoom: 1,
        playhead: 0,
        selectedItemId: null,
        sequence: {
          width: 1920,
          height: 1080,
          fps: 30,
          aspectRatio: "16:9"
        },
        tracks: createTracks()
      },
      agent: {
        mode: "assistant",
        messages: [
          {
            id: createId("message"),
            role: "assistant",
            text: "Olá. Eu sou o runtime local do AgentCut. Posso propor um plano e executar apenas operações seguras depois da sua aprovação.",
            timestamp: timestamp
          }
        ],
        plans: [],
        status: "idle"
      },
      history: {
        undoStack: [],
        redoStack: [],
        log: []
      }
    };
  }

  function emitChange(detail) {
    window.dispatchEvent(new CustomEvent("agentcut:changed", { detail: detail || {} }));
  }

  function markDirty(state, reason) {
    state.project.dirty = true;
    state.project.updatedAt = now();
    emitChange({ reason: reason || "change" });
  }

  function touch(state, reason) {
    markDirty(state, reason);
  }

  function makeLogEntry(command, action) {
    var log = command.log || {};
    return {
      id: createId("log"),
      operationId: command.id || createId("operation"),
      type: log.type || "project.change",
      label: log.label || "Alteração no projeto",
      details: log.details || "",
      action: action || "apply",
      timestamp: now()
    };
  }

  function commitCommand(state, command) {
    if (!command || typeof command.undo !== "function" || typeof command.redo !== "function") {
      throw new Error("Comando de histórico inválido.");
    }
    command.id = command.id || createId("operation");
    state.history.undoStack.push(command);
    state.history.redoStack.length = 0;
    state.history.log.push(makeLogEntry(command, "apply"));
    markDirty(state, command.log && command.log.type ? command.log.type : "operation");
  }

  function undo(state) {
    var command = state.history.undoStack.pop();
    if (!command) {
      return false;
    }
    command.undo();
    state.history.redoStack.push(command);
    state.history.log.push(makeLogEntry(command, "undo"));
    markDirty(state, "undo");
    return true;
  }

  function redo(state) {
    var command = state.history.redoStack.pop();
    if (!command) {
      return false;
    }
    command.redo();
    state.history.undoStack.push(command);
    state.history.log.push(makeLogEntry(command, "redo"));
    markDirty(state, "redo");
    return true;
  }

  function sanitizeProject(state) {
    return {
      id: state.project.id,
      name: state.project.name,
      createdAt: state.project.createdAt,
      updatedAt: state.project.updatedAt,
      lastSavedAt: state.project.lastSavedAt,
      dirty: false
    };
  }

  function serializeState(state) {
    return {
      version: "1.0",
      project: sanitizeProject(state),
      media: state.media.map(function (item) {
        return {
          id: item.id,
          name: item.name,
          size: item.size,
          type: item.type,
          duration: item.duration,
          importedAt: item.importedAt,
          width: item.width || null,
          height: item.height || null,
          needsReimport: true
        };
      }),
      timeline: cloneJSON(state.timeline),
      agent: {
        mode: state.agent.mode,
        messages: cloneJSON(state.agent.messages),
        plans: cloneJSON(state.agent.plans),
        status: "idle"
      },
      history: {
        log: cloneJSON(state.history.log)
      },
      savedAt: now()
    };
  }

  function save(state) {
    try {
      var payload = serializeState(state);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      state.project.dirty = false;
      state.project.lastSavedAt = now();
      state.project.updatedAt = state.project.lastSavedAt;
      emitChange({ reason: "saved" });
      return true;
    } catch (error) {
      emitChange({ reason: "save-error", error: error });
      return false;
    }
  }

  function normalizeSequence(savedSequence) {
    var source = savedSequence || {};
    var width = Math.round(Number(source.width));
    var height = Math.round(Number(source.height));
    var fps = Math.round(Number(source.fps));
    if (!Number.isFinite(width) || width < 1 || width > 7680) width = 1920;
    if (!Number.isFinite(height) || height < 1 || height > 7680) height = 1080;
    if (!Number.isFinite(fps) || fps < 1 || fps > 120) fps = 30;
    return {
      width: width,
      height: height,
      fps: fps,
      aspectRatio: source.aspectRatio === "9:16" ? "9:16" : "16:9"
    };
  }

  function normalizeTimeline(savedTimeline) {
    var fallback = {
      duration: 0,
      zoom: 1,
      playhead: 0,
      selectedItemId: null,
      sequence: normalizeSequence(null),
      tracks: createTracks()
    };
    if (!savedTimeline || !Array.isArray(savedTimeline.tracks)) {
      return fallback;
    }
    var result = {
      duration: Number(savedTimeline.duration) || 0,
      zoom: Math.min(2.5, Math.max(0.5, Number(savedTimeline.zoom) || 1)),
      playhead: Math.max(0, Number(savedTimeline.playhead) || 0),
      selectedItemId: savedTimeline.selectedItemId || null,
      sequence: normalizeSequence(savedTimeline.sequence),
      tracks: []
    };
    savedTimeline.tracks.forEach(function (track, index) {
      if (!track || !track.id) {
        return;
      }
      result.tracks.push({
        id: track.id,
        type: track.type || "video",
        name: track.name || "Track " + (index + 1),
        locked: Boolean(track.locked),
        hidden: Boolean(track.hidden),
        muted: Boolean(track.muted),
        items: Array.isArray(track.items) ? track.items.map(function (item) {
          return {
            id: item.id || createId("clip"),
            mediaId: item.mediaId || null,
            type: item.type || track.type || "video",
            name: item.name || "Clip sem nome",
            start: Math.max(0, Number(item.start) || 0),
            duration: Math.max(0.1, Number(item.duration) || 5),
            estimatedDuration: Boolean(item.estimatedDuration)
          };
        }) : []
      });
    });
    if (!result.tracks.length) {
      result.tracks = createTracks();
    }
    return result;
  }

  function restore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var saved = JSON.parse(raw);
      var state = createInitialState(saved.project && saved.project.name ? saved.project.name : "Projeto sem título");
      state.project = Object.assign(state.project, {
        id: saved.project && saved.project.id ? saved.project.id : state.project.id,
        name: saved.project && saved.project.name ? saved.project.name : state.project.name,
        createdAt: saved.project && saved.project.createdAt ? saved.project.createdAt : state.project.createdAt,
        updatedAt: saved.project && saved.project.updatedAt ? saved.project.updatedAt : state.project.updatedAt,
        lastSavedAt: saved.project && saved.project.lastSavedAt ? saved.project.lastSavedAt : saved.savedAt || null,
        dirty: false,
        restored: true
      });
      state.media = Array.isArray(saved.media) ? saved.media.map(function (item) {
        return Object.assign({}, item, {
          file: null,
          objectUrl: null,
          needsReimport: true
        });
      }) : [];
      state.timeline = normalizeTimeline(saved.timeline);
      state.agent = Object.assign(state.agent, saved.agent || {});
      state.agent.status = "idle";
      state.history.log = saved.history && Array.isArray(saved.history.log) ? saved.history.log : [];
      state.history.undoStack = [];
      state.history.redoStack = [];
      return state;
    } catch (error) {
      return null;
    }
  }

  function revokeMediaUrls(state) {
    state.media.forEach(function (item) {
      if (item.objectUrl) {
        window.URL.revokeObjectURL(item.objectUrl);
        item.objectUrl = null;
      }
    });
  }

  function safeFilename(name) {
    var base = String(name || "projeto-sem-titulo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return (base || "projeto-sem-titulo") + ".agentcut.json";
  }

  function exportProject(state) {
    var payload = {
      version: "1.0",
      project: sanitizeProject(state),
      media: serializeState(state).media,
      timeline: cloneJSON(state.timeline),
      agentHistory: cloneJSON(state.agent.messages),
      agentPlans: cloneJSON(state.agent.plans),
      operationHistory: cloneJSON(state.history.log),
      exportedAt: now()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = window.URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(state.project.name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () {
      window.URL.revokeObjectURL(url);
    }, 1000);
    return payload;
  }

  AC.project = {
    STORAGE_KEY: STORAGE_KEY,
    now: now,
    createId: createId,
    cloneJSON: cloneJSON,
    createInitialState: createInitialState,
    emitChange: emitChange,
    markDirty: markDirty,
    touch: touch,
    commitCommand: commitCommand,
    undo: undo,
    redo: redo,
    serializeState: serializeState,
    save: save,
    restore: restore,
    revokeMediaUrls: revokeMediaUrls,
    exportProject: exportProject
  };
})();
