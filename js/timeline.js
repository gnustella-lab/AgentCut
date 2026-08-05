(function () {
  "use strict";

  var AC = window.AgentCut = window.AgentCut || {};
  var PIXELS_PER_SECOND = 92;
  var LABEL_WIDTH = 160;
  var MIN_CANVAS_WIDTH = 920;
  var bound = false;

  function state() {
    return typeof AC.getState === "function" ? AC.getState() : null;
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function formatSeconds(seconds) {
    var value = Math.max(0, Number(seconds) || 0);
    var minutes = Math.floor(value / 60);
    var secs = Math.floor(value % 60);
    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function trackById(currentState, trackId) {
    return currentState.timeline.tracks.find(function (track) {
      return track.id === trackId;
    });
  }

  function itemLocation(currentState, itemId) {
    for (var i = 0; i < currentState.timeline.tracks.length; i += 1) {
      var track = currentState.timeline.tracks[i];
      var index = track.items.findIndex(function (item) { return item.id === itemId; });
      if (index !== -1) {
        return { track: track, index: index, item: track.items[index] };
      }
    }
    return null;
  }

  function canSplitSelected(currentState) {
    var location = itemLocation(currentState, currentState.timeline.selectedItemId);
    if (!location || location.track.locked) return false;
    if (location.item.estimatedDuration) return false;
    var start = Number(location.item.start) || 0;
    var end = start + (Number(location.item.duration) || 0);
    var playhead = Number(currentState.timeline.playhead) || 0;
    return playhead > start + 0.05 && playhead < end - 0.05;
  }

  function updateSplitAvailability(currentState) {
    var splitButton = document.getElementById("split-selected-button");
    if (splitButton) splitButton.disabled = !canSplitSelected(currentState);
  }

  function recalculateDuration(currentState) {
    var duration = 0;
    currentState.timeline.tracks.forEach(function (track) {
      track.items.forEach(function (item) {
        duration = Math.max(duration, Number(item.start) + Number(item.duration));
      });
    });
    currentState.timeline.duration = Math.max(0, duration);
    if (currentState.timeline.playhead > duration) {
      currentState.timeline.playhead = duration;
    }
    return duration;
  }

  function nextStart(track) {
    return track.items.reduce(function (last, item) {
      return Math.max(last, Number(item.start) + Number(item.duration));
    }, 0);
  }

  function trackTypeForMedia(media) {
    if (!media) {
      return "video";
    }
    if (media.type.indexOf("audio/") === 0) {
      return "audio";
    }
    return "video";
  }

  function clipClass(type) {
    if (type === "audio") return "audio-clip";
    if (type === "text") return "text-clip";
    return "video-clip";
  }

  function trackIcon(type) {
    if (type === "audio") return "#icon-music";
    if (type === "text") return "#icon-spark";
    return "#icon-video";
  }

  function setPlayhead(currentState, value, notify) {
    var duration = Math.max(0, Number(currentState.timeline.duration) || 0);
    currentState.timeline.playhead = Math.min(Math.max(0, Number(value) || 0), duration || Math.max(0, Number(value) || 0));
    updatePlayhead(currentState);
    updateSplitAvailability(currentState);
    if (notify) {
      emit("agentcut:seek", { time: currentState.timeline.playhead });
    }
  }

  function updatePlayhead(currentState) {
    var playhead = document.getElementById("timeline-playhead");
    if (!playhead) return;
    playhead.style.left = (LABEL_WIDTH + currentState.timeline.playhead * PIXELS_PER_SECOND * currentState.timeline.zoom) + "px";
  }

  function renderRuler(currentState, contentWidth) {
    var ruler = document.getElementById("timeline-ruler");
    if (!ruler) return;
    ruler.replaceChildren();

    var spacer = document.createElement("div");
    spacer.className = "ruler-spacer";
    spacer.textContent = "TRACKS";
    ruler.appendChild(spacer);

    var scale = document.createElement("div");
    scale.className = "ruler-scale";
    scale.style.width = contentWidth + "px";
    var duration = Math.max(60, currentState.timeline.duration || 0);
    var step = currentState.timeline.zoom < 0.8 ? 10 : 5;
    for (var seconds = 0; seconds <= duration + step; seconds += step) {
      var tick = document.createElement("div");
      tick.className = "ruler-tick" + (seconds % (step * 2) === 0 ? " major" : "");
      tick.style.left = (seconds * PIXELS_PER_SECOND * currentState.timeline.zoom) + "px";
      var label = document.createElement("span");
      label.textContent = formatSeconds(seconds);
      tick.appendChild(label);
      scale.appendChild(tick);
    }
    ruler.appendChild(scale);
  }

  function makeTrackLabel(track) {
    var label = document.createElement("div");
    label.className = "track-label";

    var main = document.createElement("div");
    main.className = "track-label-main";
    var color = document.createElement("span");
    color.className = "track-color" + (track.type === "audio" ? " audio" : track.type === "text" ? " text" : "");
    color.setAttribute("aria-hidden", "true");
    var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", trackIcon(track.type));
    icon.appendChild(use);
    icon.style.width = "12px";
    icon.style.height = "12px";
    icon.style.color = track.type === "audio" ? "var(--timeline-audio)" : track.type === "text" ? "var(--timeline-text)" : "var(--timeline-video)";
    var name = document.createElement("span");
    name.className = "track-name";
    name.textContent = track.name;
    main.appendChild(color);
    main.appendChild(icon);
    main.appendChild(name);

    var controls = document.createElement("div");
    controls.className = "track-controls";
    var lockButton = document.createElement("button");
    lockButton.className = "track-control" + (track.locked ? " is-active" : "");
    lockButton.type = "button";
    lockButton.dataset.trackAction = "lock";
    lockButton.dataset.trackId = track.id;
    lockButton.setAttribute("aria-label", track.locked ? "Desbloquear " + track.name : "Bloquear " + track.name);
    lockButton.title = track.locked ? "Desbloquear track" : "Bloquear track";
    lockButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-' + (track.locked ? "lock" : "unlock") + '"></use></svg>';
    var visibilityButton = document.createElement("button");
    visibilityButton.className = "track-control" + (track.hidden || track.muted ? " is-active" : "");
    visibilityButton.type = "button";
    visibilityButton.dataset.trackAction = track.type === "audio" ? "mute" : "hide";
    visibilityButton.dataset.trackId = track.id;
    visibilityButton.setAttribute("aria-label", track.type === "audio" ? (track.muted ? "Unmute audio" : "Mute audio") : (track.hidden ? "Show track" : "Hide track"));
    visibilityButton.title = track.type === "audio" ? (track.muted ? "Unmute audio" : "Mute audio") : (track.hidden ? "Show track" : "Hide track");
    visibilityButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-' + ((track.hidden || track.muted) ? "eye-off" : "eye") + '"></use></svg>';
    controls.appendChild(lockButton);
    controls.appendChild(visibilityButton);
    label.appendChild(main);
    label.appendChild(controls);
    return label;
  }

  function makeClip(currentState, track, item) {
    var clip = document.createElement("div");
    clip.className = "timeline-clip " + clipClass(item.type) + (currentState.timeline.selectedItemId === item.id ? " is-selected" : "");
    var media = currentState.media.find(function (asset) { return asset.id === item.mediaId; });
    if (!media || !media.file) {
      clip.classList.add("is-missing");
    }
    clip.dataset.itemId = item.id;
    clip.dataset.trackId = track.id;
    clip.setAttribute("role", "button");
    clip.setAttribute("tabindex", "0");
    clip.setAttribute("aria-label", item.name + ", start " + formatSeconds(item.start) + ", duration " + formatSeconds(item.duration));
    clip.style.left = (item.start * PIXELS_PER_SECOND * currentState.timeline.zoom) + "px";
    clip.style.width = Math.max(82, item.duration * PIXELS_PER_SECOND * currentState.timeline.zoom) + "px";

    var name = document.createElement("span");
    name.className = "clip-name";
    name.textContent = item.name;
    var meta = document.createElement("span");
    meta.className = "clip-meta";
    meta.textContent = formatSeconds(item.start) + " · " + formatSeconds(item.duration);
    clip.appendChild(name);
    clip.appendChild(meta);
    return clip;
  }

  function render(currentState) {
    if (!currentState) return;
    var canvas = document.getElementById("timeline-canvas");
    var rows = document.getElementById("timeline-rows");
    if (!canvas || !rows) return;
    recalculateDuration(currentState);
    var contentWidth = Math.max(MIN_CANVAS_WIDTH - LABEL_WIDTH, Math.ceil(Math.max(60, currentState.timeline.duration) * PIXELS_PER_SECOND * currentState.timeline.zoom) + 180);
    canvas.style.width = (LABEL_WIDTH + contentWidth) + "px";
    renderRuler(currentState, contentWidth);
    rows.replaceChildren();

    currentState.timeline.tracks.forEach(function (track) {
      var row = document.createElement("div");
      row.className = "timeline-row";
      row.dataset.trackId = track.id;
      row.appendChild(makeTrackLabel(track));
      var lane = document.createElement("div");
      lane.className = "track-lane";
      lane.dataset.trackId = track.id;
      if (track.locked) {
        lane.classList.add("is-locked");
      }
      if (track.hidden || track.muted) {
        lane.style.opacity = "0.48";
      }
      track.items.forEach(function (item) {
        lane.appendChild(makeClip(currentState, track, item));
      });
      row.appendChild(lane);
      rows.appendChild(row);
    });

    updatePlayhead(currentState);
    var zoomValue = document.getElementById("timeline-zoom-value");
    if (zoomValue) zoomValue.textContent = Math.round(currentState.timeline.zoom * 100) + "%";
    var sequence = currentState.timeline.sequence || { width: 1920, height: 1080, fps: 30 };
    var sequenceBadge = document.getElementById("sequence-badge");
    if (sequenceBadge) sequenceBadge.textContent = sequence.width + " × " + sequence.height + " · " + sequence.fps + " fps";
    updateSplitAvailability(currentState);
    if (!bound) bindEvents();
  }

  function bindEvents() {
    var rows = document.getElementById("timeline-rows");
    var scroll = document.getElementById("timeline-scroll");
    if (!rows || !scroll) return;
    bound = true;

    var splitButton = document.getElementById("split-selected-button");
    if (splitButton) {
      splitButton.addEventListener("click", function () {
        var result = splitSelected(state());
        if (!result.ok) {
          emit("agentcut:toast", { message: result.message, tone: "error" });
        }
      });
    }

    rows.addEventListener("click", function (event) {
      var currentState = state();
      if (!currentState) return;
      var trackButton = event.target.closest("[data-track-action]");
      if (trackButton) {
        event.stopPropagation();
        var track = trackById(currentState, trackButton.dataset.trackId);
        if (!track) return;
        var action = trackButton.dataset.trackAction;
        var previous = {
          locked: track.locked,
          hidden: track.hidden,
          muted: track.muted
        };
        if (action === "lock") track.locked = !track.locked;
        if (action === "hide") track.hidden = !track.hidden;
        if (action === "mute") track.muted = !track.muted;
        var after = { locked: track.locked, hidden: track.hidden, muted: track.muted };
        AC.project.commitCommand(currentState, {
          log: {
            type: "timeline.track.update",
            label: (action === "lock" ? "Update lock" : action === "mute" ? "Update audio" : "Update visibility"),
            details: track.name
          },
          undo: function () { Object.assign(track, previous); },
          redo: function () { Object.assign(track, after); }
        });
        return;
      }

      var clip = event.target.closest(".timeline-clip");
      if (clip) {
        currentState.timeline.selectedItemId = clip.dataset.itemId;
        emit("agentcut:selection", { itemId: clip.dataset.itemId });
        AC.project.emitChange({ reason: "selection" });
        return;
      }

      var lane = event.target.closest(".track-lane");
      if (lane) {
        var rect = lane.getBoundingClientRect();
        var x = Math.max(0, event.clientX - rect.left);
        setPlayhead(currentState, x / (PIXELS_PER_SECOND * currentState.timeline.zoom), true);
      }
    });

    rows.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var clip = event.target.closest(".timeline-clip");
      if (!clip) return;
      event.preventDefault();
      var currentState = state();
      currentState.timeline.selectedItemId = clip.dataset.itemId;
      emit("agentcut:selection", { itemId: clip.dataset.itemId });
      AC.project.emitChange({ reason: "selection" });
    });

    scroll.addEventListener("scroll", function () {
      var ruler = document.getElementById("timeline-ruler");
      if (ruler) ruler.style.transform = "translateX(" + (-scroll.scrollLeft) + "px)";
    });
  }

  function addMediaToTimeline(currentState, mediaId) {
    var media = currentState.media.find(function (item) { return item.id === mediaId; });
    if (!media) return false;
    var type = trackTypeForMedia(media);
    var track = currentState.timeline.tracks.find(function (item) { return item.type === type && !item.locked; });
    if (!track) {
      window.dispatchEvent(new CustomEvent("agentcut:toast", { detail: { message: "No unlocked track exists for this media type.", tone: "error" } }));
      return false;
    }
    var duration = Number(media.duration) > 0 ? Number(media.duration) : 5;
    var item = {
      id: AC.project.createId("clip"),
      mediaId: media.id,
      type: type,
      name: media.name,
      start: nextStart(track),
      duration: duration,
      estimatedDuration: !(Number(media.duration) > 0)
    };
    var index = track.items.length;
    track.items.push(item);
    recalculateDuration(currentState);
    currentState.timeline.selectedItemId = item.id;
    AC.project.commitCommand(currentState, {
      log: {
        type: "timeline.clip.add",
        label: "Add clip",
        details: media.name
      },
      undo: function () {
        var found = track.items.findIndex(function (candidate) { return candidate.id === item.id; });
        if (found !== -1) track.items.splice(found, 1);
        if (currentState.timeline.selectedItemId === item.id) currentState.timeline.selectedItemId = null;
        recalculateDuration(currentState);
      },
      redo: function () {
        if (!track.items.some(function (candidate) { return candidate.id === item.id; })) {
          track.items.splice(Math.min(index, track.items.length), 0, item);
        }
        currentState.timeline.selectedItemId = item.id;
        recalculateDuration(currentState);
      }
    });
    emit("agentcut:toast", { message: "Clip added to " + track.name + ".", tone: "success" });
    return true;
  }

  function removeSelected(currentState, options) {
    options = options || {};
    var location = itemLocation(currentState, currentState.timeline.selectedItemId);
    if (!location) return false;
    var track = location.track;
    var item = location.item;
    var index = location.index;
    if (track.locked) {
      if (!options.silent) emit("agentcut:toast", { message: "Unlock the track before removing this clip.", tone: "error" });
      return false;
    }
    track.items.splice(index, 1);
    currentState.timeline.selectedItemId = null;
    recalculateDuration(currentState);
    AC.project.commitCommand(currentState, {
      log: {
        type: options.logType || "timeline.clip.remove",
        label: options.logLabel || "Remove clip",
        details: options.logDetails || item.name
      },
      undo: function () {
        track.items.splice(Math.min(index, track.items.length), 0, item);
        currentState.timeline.selectedItemId = item.id;
        recalculateDuration(currentState);
      },
      redo: function () {
        var found = track.items.findIndex(function (candidate) { return candidate.id === item.id; });
        if (found !== -1) track.items.splice(found, 1);
        currentState.timeline.selectedItemId = null;
        recalculateDuration(currentState);
      }
    });
    if (!options.silent) emit("agentcut:toast", { message: "Clip removed from the timeline.", tone: "success" });
    return true;
  }

  function splitSelected(currentState, options) {
    options = options || {};
    var location = itemLocation(currentState, currentState.timeline.selectedItemId);
    if (!location) return { ok: false, message: "Select a clip before splitting." };
    if (location.track.locked) return { ok: false, message: "Unlock the track before splitting this clip." };
    if (location.item.estimatedDuration) return { ok: false, message: "Wait for the real duration to load before splitting." };
    var start = Number(location.item.start) || 0;
    var end = start + (Number(location.item.duration) || 0);
    var playhead = Number(currentState.timeline.playhead) || 0;
    if (playhead <= start + 0.05 || playhead >= end - 0.05) {
      return { ok: false, message: "Move the playhead inside the clip to split it." };
    }
    var track = location.track;
    var beforeItems = track.items.slice();
    var beforeSelected = currentState.timeline.selectedItemId;
    var left = Object.assign({}, location.item, { duration: playhead - start });
    var right = Object.assign({}, location.item, {
      id: AC.project.createId("clip"),
      start: playhead,
      duration: end - playhead
    });
    track.items.splice(location.index, 1, left, right);
    var afterItems = track.items.slice();
    currentState.timeline.selectedItemId = right.id;
    recalculateDuration(currentState);
    AC.project.commitCommand(currentState, {
      log: {
        type: options.logType || "timeline.clip.split",
        label: options.logLabel || "Split clip",
        details: options.logDetails || location.item.name + " at " + formatSeconds(playhead)
      },
      undo: function () {
        track.items.splice(0, track.items.length);
        beforeItems.forEach(function (item) { track.items.push(item); });
        currentState.timeline.selectedItemId = beforeSelected;
        recalculateDuration(currentState);
      },
      redo: function () {
        track.items.splice(0, track.items.length);
        afterItems.forEach(function (item) { track.items.push(item); });
        currentState.timeline.selectedItemId = right.id;
        recalculateDuration(currentState);
      }
    });
    if (!options.silent) emit("agentcut:toast", { message: "Clip split at the playhead.", tone: "success" });
    return { ok: true, firstId: left.id, secondId: right.id };
  }

  function setSequence(currentState, values, options) {
    options = options || {};
    var previous = Object.assign({ width: 1920, height: 1080, fps: 30, aspectRatio: "16:9" }, currentState.timeline.sequence || {});
    var next = Object.assign({}, previous, values || {});
    next.width = Math.max(1, Math.min(7680, Math.round(Number(next.width) || previous.width)));
    next.height = Math.max(1, Math.min(7680, Math.round(Number(next.height) || previous.height)));
    next.fps = Math.max(1, Math.min(120, Math.round(Number(next.fps) || previous.fps)));
    next.aspectRatio = next.aspectRatio === "9:16" ? "9:16" : "16:9";
    if (previous.width === next.width && previous.height === next.height && previous.fps === next.fps && previous.aspectRatio === next.aspectRatio) {
      return { ok: true, changed: false, sequence: next };
    }
    currentState.timeline.sequence = next;
    AC.project.commitCommand(currentState, {
      log: {
        type: options.logType || "timeline.sequence.update",
        label: options.logLabel || "Update sequence",
        details: options.logDetails || next.width + " × " + next.height
      },
      undo: function () { currentState.timeline.sequence = Object.assign({}, previous); },
      redo: function () { currentState.timeline.sequence = Object.assign({}, next); }
    });
    if (!options.silent) emit("agentcut:toast", { message: "Sequence settings updated.", tone: "success" });
    return { ok: true, changed: true, sequence: next };
  }

  function applyAgentOperation(currentState, operation) {
    if (!operation || !operation.type) return { ok: false, message: "This plan has no executable operation." };
    if ((operation.type === "timeline.remove-selected" || operation.type === "timeline.split-selected") && Object.prototype.hasOwnProperty.call(operation, "targetItemId")) {
      if (!operation.targetItemId || currentState.timeline.selectedItemId !== operation.targetItemId) {
        return { ok: false, message: "The selection changed since the plan was created. Review the clip before approving." };
      }
    }
    if (operation.type === "agent.full-edit") {
      return AC.agent && typeof AC.agent.executeFullEdit === "function" ? AC.agent.executeFullEdit(currentState, operation) : { ok: false, message: "The full-edit runtime is not available." };
    }
    if (operation.type === "timeline.remove-selected") {
      var removed = removeSelected(currentState, { silent: true, logType: "agent.operation.remove", logLabel: "Agent removed clip" });
      return removed ? { ok: true, changed: true, message: "Selected clip removed." } : { ok: false, message: "Could not remove the selected clip." };
    }
    if (operation.type === "timeline.split-selected") {
      var split = splitSelected(currentState, { silent: true, logType: "agent.operation.split", logLabel: "Agent split clip" });
      return split.ok ? { ok: true, changed: true, message: "Clip split at the playhead." } : split;
    }
    if (operation.type === "sequence.set") {
      var sequence = setSequence(currentState, operation.values, { silent: true, logType: "agent.operation.sequence", logLabel: "Agent updated sequence", logDetails: "9:16 · 1080 × 1920" });
      return { ok: true, changed: sequence.changed, message: sequence.changed ? "Sequence set to 9:16." : "The sequence was already set to 9:16." };
    }
    return { ok: false, message: "Unrecognized agent operation." };
  }

  function addTrack(currentState, type) {
    var normalized = type === "audio" || type === "text" ? type : "video";
    var count = currentState.timeline.tracks.filter(function (track) { return track.type === normalized; }).length + 1;
    var label = normalized === "audio" ? "Audio " : normalized === "text" ? "Text " : "Video ";
    var track = {
      id: AC.project.createId(normalized + "-track"),
      type: normalized,
      name: label + count,
      locked: false,
      hidden: false,
      muted: false,
      items: []
    };
    var index = currentState.timeline.tracks.length;
    currentState.timeline.tracks.push(track);
    AC.project.commitCommand(currentState, {
      log: {
        type: "timeline.track.add",
        label: "Add track",
        details: track.name
      },
      undo: function () {
        var found = currentState.timeline.tracks.findIndex(function (candidate) { return candidate.id === track.id; });
        if (found !== -1) currentState.timeline.tracks.splice(found, 1);
      },
      redo: function () {
        if (!currentState.timeline.tracks.some(function (candidate) { return candidate.id === track.id; })) {
          currentState.timeline.tracks.splice(Math.min(index, currentState.timeline.tracks.length), 0, track);
        }
      }
    });
    return track;
  }

  function setZoom(currentState, delta) {
    currentState.timeline.zoom = Math.min(2.5, Math.max(0.5, currentState.timeline.zoom + delta));
    AC.project.emitChange({ reason: "timeline-zoom" });
  }

  function updateEstimatedDurations(currentState, media) {
    if (!media || !Number(media.duration)) return;
    var changed = false;
    currentState.timeline.tracks.forEach(function (track) {
      track.items.forEach(function (item) {
        if (item.mediaId === media.id && item.estimatedDuration) {
          item.duration = Number(media.duration);
          item.estimatedDuration = false;
          changed = true;
        }
      });
    });
    if (changed) {
      recalculateDuration(currentState);
      AC.project.emitChange({ reason: "media-duration" });
    }
  }

  AC.timeline = {
    render: render,
    addMediaToTimeline: addMediaToTimeline,
    removeSelected: removeSelected,
    splitSelected: splitSelected,
    setSequence: setSequence,
    applyAgentOperation: applyAgentOperation,
    addTrack: addTrack,
    setZoom: setZoom,
    setPlayhead: setPlayhead,
    updatePlayhead: updatePlayhead,
    updateSplitAvailability: updateSplitAvailability,
    recalculateDuration: recalculateDuration,
    updateEstimatedDurations: updateEstimatedDurations,
    itemLocation: itemLocation,
    formatSeconds: formatSeconds,
    PIXELS_PER_SECOND: PIXELS_PER_SECOND
  };
})();
