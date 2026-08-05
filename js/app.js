(function () {
  "use strict";

  var AC = window.AgentCut = window.AgentCut || {};
  var currentState;
  var statusTimer;

  function getState() {
    return currentState;
  }

  AC.getState = getState;

  function $(id) {
    return document.getElementById(id);
  }

  function formatBytes(value) {
    var bytes = Number(value) || 0;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function formatDuration(value) {
    return AC.timeline.formatSeconds(value);
  }

  function typeLabel(type) {
    if (!type) return "FILE";
    if (type.indexOf("video/") === 0) return "VIDEO";
    if (type.indexOf("audio/") === 0) return "AUDIO";
    if (type.indexOf("image/") === 0) return "IMAGE";
    return "FILE";
  }

  function mediaHasLockedClip(mediaId) {
    return currentState.timeline.tracks.some(function (track) {
      return track.locked && track.items.some(function (item) { return item.mediaId === mediaId; });
    });
  }

  function formatTimecode(seconds) {
    var value = Math.max(0, Number(seconds) || 0);
    var hours = Math.floor(value / 3600);
    var minutes = Math.floor((value % 3600) / 60);
    var secs = Math.floor(value % 60);
    var frames = Math.floor((value % 1) * 30);
    return [hours, minutes, secs].map(function (part) { return String(part).padStart(2, "0"); }).join(":") + ":" + String(frames).padStart(2, "0");
  }

  function showToast(message, tone) {
    var container = $("toast-container");
    if (!container) return;
    var toast = document.createElement("div");
    toast.className = "toast" + (tone ? " is-" + tone : "");
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(5px)";
      window.setTimeout(function () { toast.remove(); }, 180);
    }, 3000);
  }

  function announce(message) {
    var live = $("live-region");
    if (live) live.textContent = message;
  }

  function setStatus(kind, label) {
    var element = $("project-status");
    if (!element) return;
    element.className = "status-pill status-" + kind;
    element.querySelector(".status-label").textContent = label;
    if (statusTimer) window.clearTimeout(statusTimer);
    if (kind === "saved") {
      statusTimer = window.setTimeout(function () {
        if (!currentState.project.dirty) setStatus("ready", "Project ready");
      }, 2600);
    }
  }

  function renderStatus() {
    if (!currentState) return;
    if (currentState.project.dirty) {
      setStatus("dirty", "Project changed");
    } else {
      setStatus("ready", "Project ready");
    }
    $("project-name-display").textContent = currentState.project.name;
  }

  function renderMediaLibrary() {
    var list = $("media-list");
    var empty = $("media-empty-state");
    var search = $("media-search");
    var count = $("media-count");
    if (!list || !empty || !search) return;
    var query = String(search.value || "").trim().toLocaleLowerCase("en-US");
    var assets = currentState.media.filter(function (item) {
      return !query || item.name.toLocaleLowerCase("en-US").indexOf(query) !== -1;
    });
    var previousItems = list.querySelectorAll(".media-item");
    previousItems.forEach(function (item) { item.remove(); });
    empty.hidden = assets.length > 0;
    count.textContent = currentState.media.length + (currentState.media.length === 1 ? " file" : " files");
    $("clear-media-search").hidden = !query;

    assets.forEach(function (media) {
      var item = document.createElement("article");
      item.className = "media-item" + (currentState.selectedMediaId === media.id ? " is-selected" : "");
      item.dataset.mediaId = media.id;
      item.tabIndex = 0;
      item.setAttribute("role", "group");
      item.setAttribute("aria-label", "Select " + media.name);

      var thumb = document.createElement("div");
      thumb.className = "media-thumb " + (media.type.indexOf("audio/") === 0 ? "audio-thumb" : media.type.indexOf("image/") === 0 ? "image-thumb" : "video-thumb");
      if (media.type.indexOf("image/") === 0 && media.objectUrl) {
        var image = document.createElement("img");
        image.src = media.objectUrl;
        image.alt = "Thumbnail of " + media.name;
        thumb.appendChild(image);
      } else {
        var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("aria-hidden", "true");
        var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", media.type.indexOf("audio/") === 0 ? "#icon-music" : media.type.indexOf("image/") === 0 ? "#icon-image" : "#icon-video");
        icon.appendChild(use);
        thumb.appendChild(icon);
      }
      var type = document.createElement("span");
      type.className = "thumb-type";
      type.textContent = typeLabel(media.type).slice(0, 3);
      thumb.appendChild(type);

      var details = document.createElement("div");
      details.className = "media-details";
      var name = document.createElement("div");
      name.className = "media-name";
      name.title = media.name;
      name.textContent = media.name;
      var meta = document.createElement("div");
      meta.className = "media-meta";
      var kind = document.createElement("span");
      kind.textContent = typeLabel(media.type);
      var duration = document.createElement("span");
      duration.textContent = Number(media.duration) > 0 ? formatDuration(media.duration) : "duration pending";
      var size = document.createElement("span");
      size.textContent = formatBytes(media.size);
      meta.appendChild(kind);
      meta.appendChild(duration);
      meta.appendChild(size);
      details.appendChild(name);
      details.appendChild(meta);

      if (media.needsReimport && !media.file) {
        var warning = document.createElement("span");
        warning.className = "media-reimport";
        warning.innerHTML = '<svg aria-hidden="true"><use href="#icon-upload"></use></svg> Reimport for preview';
        details.appendChild(warning);
      }

      var actions = document.createElement("div");
      actions.className = "media-actions-row";
      var addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "media-action add-action";
      addButton.dataset.mediaAction = "add";
      addButton.dataset.mediaId = media.id;
      addButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-plus"></use></svg> Timeline';
      var removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "media-action remove-action";
      removeButton.dataset.mediaAction = "remove";
      removeButton.dataset.mediaId = media.id;
      removeButton.disabled = mediaHasLockedClip(media.id);
      removeButton.title = removeButton.disabled ? "Unlock the track before removing" : "Remove media and clips";
      removeButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-trash"></use></svg> Remove';
      actions.appendChild(addButton);
      actions.appendChild(removeButton);
      details.appendChild(actions);
      item.appendChild(thumb);
      item.appendChild(details);
      list.appendChild(item);
    });
  }

  function renderInspector() {
    var location = AC.timeline.itemLocation(currentState, currentState.timeline.selectedItemId);
    var name = $("selection-name");
    var type = $("selection-type");
    var duration = $("selection-duration");
    var position = $("selection-position");
    var remove = $("remove-selected-button");
    if (!name || !type || !duration || !position || !remove) return;
    if (!location) {
      name.textContent = "No item selected";
      type.textContent = "--";
      duration.textContent = "--";
      position.textContent = "--";
      remove.disabled = true;
      return;
    }
    name.textContent = location.item.name;
    type.textContent = typeLabel(location.item.type === "audio" ? "audio/" : location.item.type === "text" ? "text/" : "video/");
    duration.textContent = formatDuration(location.item.duration);
    position.textContent = formatDuration(location.item.start);
    remove.disabled = location.track.locked;
    remove.title = location.track.locked ? "Unlock the track before removing" : "Remove selected clip";
  }

  function renderActivity() {
    var list = $("agent-history-list");
    if (!list) return;
    var log = currentState.history.log.slice(-7).reverse();
    list.replaceChildren();
    log.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "history-item " + (entry.type.indexOf("agent.") === 0 ? "agent" : entry.type.indexOf("media.") === 0 ? "media" : "timeline");
      var body = document.createElement("div");
      var label = document.createElement("strong");
      label.textContent = entry.label;
      var detail = document.createElement("time");
      detail.textContent = (entry.action === "undo" ? "Undone · " : entry.action === "redo" ? "Redone · " : "") + formatClock(entry.timestamp) + (entry.details ? " · " + entry.details : "");
      body.appendChild(label);
      body.appendChild(detail);
      item.appendChild(body);
      list.appendChild(item);
    });
  }

  function formatClock(value) {
    try {
      return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "now";
    }
  }

  function renderAll() {
    renderStatus();
    renderMediaLibrary();
    AC.timeline.render(currentState);
    AC.agent.render(currentState);
    renderInspector();
    renderActivity();
    updateUndoRedoButtons();
    updateTransportDisplay();
  }

  function updateUndoRedoButtons() {
    $("undo-button").disabled = currentState.history.undoStack.length === 0;
    $("redo-button").disabled = currentState.history.redoStack.length === 0;
  }

  function getActiveMediaElement() {
    if (currentState.previewKind === "audio") return $("audio-preview");
    if (currentState.previewKind === "video") return $("preview-video");
    return null;
  }

  function loadSelectedMedia(media) {
    var video = $("preview-video");
    var image = $("preview-image");
    var audio = $("audio-preview");
    var audioVisual = $("audio-preview-visual");
    var empty = $("preview-empty");
    var title = $("preview-title");
    var resolution = $("preview-resolution");
    if (!video || !image || !audio || !audioVisual || !empty || !title) return;
    video.pause();
    audio.pause();
    video.removeAttribute("src");
    audio.removeAttribute("src");
    video.load();
    audio.load();
    image.removeAttribute("src");
    video.hidden = true;
    image.hidden = true;
    audioVisual.hidden = true;
    empty.hidden = false;
    currentState.previewKind = null;
    title.textContent = media ? media.name : "No media selected";
    resolution.textContent = "-- × --";

    if (!media) {
      updateTransportDisplay();
      return;
    }
    if (!media.file || !media.objectUrl) {
      showToast("This asset was restored as metadata only. Reimport the file to preview it.", "error");
      return;
    }
    empty.hidden = true;
    if (media.type.indexOf("video/") === 0) {
      currentState.previewKind = "video";
      video.hidden = false;
      video.src = media.objectUrl;
      video.load();
      video.playbackRate = Number($("playback-speed").value) || 1;
      video.volume = Number($("volume-control").value) || 1;
    } else if (media.type.indexOf("image/") === 0) {
      currentState.previewKind = "image";
      image.hidden = false;
      image.src = media.objectUrl;
      resolution.textContent = (media.width && media.height) ? media.width + " × " + media.height : "IMAGE";
    } else if (media.type.indexOf("audio/") === 0) {
      currentState.previewKind = "audio";
      audioVisual.hidden = false;
      $("audio-preview-name").textContent = media.name;
      audio.src = media.objectUrl;
      audio.load();
      audio.playbackRate = Number($("playback-speed").value) || 1;
      audio.volume = Number($("volume-control").value) || 1;
      resolution.textContent = "AUDIO";
    }
    updateTransportDisplay();
  }

  function selectMedia(mediaId) {
    var media = currentState.media.find(function (item) { return item.id === mediaId; });
    currentState.selectedMediaId = media ? media.id : null;
    currentState.timeline.selectedItemId = null;
    loadSelectedMedia(media || null);
    AC.project.emitChange({ reason: "media-selection" });
  }

  function loadMetadata(media) {
    if (!media || !media.file || !media.objectUrl) return;
    if (media.type.indexOf("image/") === 0) {
      var image = new Image();
      image.onload = function () {
        media.width = image.naturalWidth;
        media.height = image.naturalHeight;
        media.duration = 5;
        media.metadataStatus = "ready";
        AC.timeline.updateEstimatedDurations(currentState, media);
        AC.project.emitChange({ reason: "media-metadata" });
      };
      image.onerror = function () { media.metadataStatus = "error"; };
      image.src = media.objectUrl;
      return;
    }
    var probe = document.createElement(media.type.indexOf("audio/") === 0 ? "audio" : "video");
    probe.preload = "metadata";
    probe.onloadedmetadata = function () {
      media.duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      media.width = probe.videoWidth || null;
      media.height = probe.videoHeight || null;
      media.metadataStatus = "ready";
      AC.timeline.updateEstimatedDurations(currentState, media);
      if (currentState.selectedMediaId === media.id) {
        var resolution = $("preview-resolution");
        if (resolution && media.width && media.height) resolution.textContent = media.width + " × " + media.height;
      }
      AC.project.emitChange({ reason: "media-metadata" });
      probe.removeAttribute("src");
      probe.load();
    };
    probe.onerror = function () { media.metadataStatus = "error"; AC.project.emitChange({ reason: "media-metadata-error" }); };
    probe.src = media.objectUrl;
  }

  function isAcceptedFile(file) {
    return file && (file.type.indexOf("video/") === 0 || file.type.indexOf("audio/") === 0 || file.type.indexOf("image/") === 0);
  }

  function importFiles(fileList) {
    Array.prototype.forEach.call(fileList || [], function (file) {
      if (!isAcceptedFile(file)) {
        showToast("Unsupported type: " + file.name, "error");
        return;
      }
      var record = {
        id: AC.project.createId("asset"),
        name: file.name,
        size: file.size,
        type: file.type,
        duration: 0,
        importedAt: AC.project.now(),
        width: null,
        height: null,
        metadataStatus: "reading",
        needsReimport: false,
        file: file,
        objectUrl: window.URL.createObjectURL(file)
      };
      var index = currentState.media.length;
      currentState.media.push(record);
      currentState.selectedMediaId = record.id;
      AC.project.commitCommand(currentState, {
        log: {
          type: "media.import",
          label: "Import media",
          details: record.name
        },
        undo: function () {
          var found = currentState.media.findIndex(function (candidate) { return candidate.id === record.id; });
          if (found !== -1) currentState.media.splice(found, 1);
          if (currentState.selectedMediaId === record.id) currentState.selectedMediaId = null;
        },
        redo: function () {
          if (!currentState.media.some(function (candidate) { return candidate.id === record.id; })) {
            currentState.media.splice(Math.min(index, currentState.media.length), 0, record);
          }
          currentState.selectedMediaId = record.id;
        }
      });
      loadMetadata(record);
      loadSelectedMedia(record);
      announce("Media imported: " + record.name);
    });
  }

  function removeMedia(mediaId) {
    var index = currentState.media.findIndex(function (item) { return item.id === mediaId; });
    if (index === -1) return;
    var media = currentState.media[index];
    var affected = [];
    currentState.timeline.tracks.forEach(function (track) {
      track.items.forEach(function (item, itemIndex) {
        if (item.mediaId === mediaId) affected.push({ track: track, item: item, index: itemIndex });
      });
    });
    if (affected.some(function (entry) { return entry.track.locked; })) {
      showToast("Unlock the associated tracks before removing this media.", "error");
      return;
    }
    var previousSelectedMediaId = currentState.selectedMediaId;
    var previousSelectedItemId = currentState.timeline.selectedItemId;
    affected.forEach(function (entry) {
      var itemIndex = entry.track.items.findIndex(function (item) { return item.id === entry.item.id; });
      if (itemIndex !== -1) entry.track.items.splice(itemIndex, 1);
    });
    currentState.media.splice(index, 1);
    if (currentState.selectedMediaId === mediaId) {
      currentState.selectedMediaId = null;
      loadSelectedMedia(null);
    }
    if (currentState.timeline.selectedItemId && affected.some(function (entry) { return entry.item.id === currentState.timeline.selectedItemId; })) {
      currentState.timeline.selectedItemId = null;
    }
    AC.timeline.recalculateDuration(currentState);
    AC.project.commitCommand(currentState, {
      log: {
        type: "media.remove",
        label: "Remove media",
        details: media.name
      },
      undo: function () {
        currentState.media.splice(Math.min(index, currentState.media.length), 0, media);
        affected.forEach(function (entry) {
          entry.track.items.splice(Math.min(entry.index, entry.track.items.length), 0, entry.item);
        });
        if (previousSelectedMediaId === media.id) {
          currentState.selectedMediaId = media.id;
          loadSelectedMedia(media);
        }
        if (affected.some(function (entry) { return entry.item.id === previousSelectedItemId; })) {
          currentState.timeline.selectedItemId = previousSelectedItemId;
        }
        AC.timeline.recalculateDuration(currentState);
      },
      redo: function () {
        var found = currentState.media.findIndex(function (item) { return item.id === media.id; });
        if (found !== -1) currentState.media.splice(found, 1);
        affected.forEach(function (entry) {
          var itemIndex = entry.track.items.findIndex(function (item) { return item.id === entry.item.id; });
          if (itemIndex !== -1) entry.track.items.splice(itemIndex, 1);
        });
        if (currentState.selectedMediaId === media.id) {
          currentState.selectedMediaId = null;
          loadSelectedMedia(null);
        }
        if (currentState.timeline.selectedItemId && affected.some(function (entry) { return entry.item.id === currentState.timeline.selectedItemId; })) {
          currentState.timeline.selectedItemId = null;
        }
        AC.timeline.recalculateDuration(currentState);
      }
    });
    showToast("Media removed from the library and timeline.", "success");
  }

  function updateTransportDisplay() {
    var element = getActiveMediaElement();
    var duration = element && Number.isFinite(element.duration) ? element.duration : 0;
    var current = element && Number.isFinite(element.currentTime) ? element.currentTime : currentState.timeline.playhead;
    $("current-time").textContent = formatDuration(current);
    $("total-time").textContent = formatDuration(duration || currentState.timeline.duration);
    $("preview-timecode").textContent = formatTimecode(current);
    $("player-seek").value = duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
    AC.timeline.updatePlayhead(currentState);
    AC.timeline.updateSplitAvailability(currentState);
    var playButton = $("play-pause-button");
    if (element && !element.paused) {
      playButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-pause"></use></svg>';
      playButton.setAttribute("aria-label", "Pause");
      playButton.title = "Pause (Space)";
    } else {
      playButton.innerHTML = '<svg aria-hidden="true"><use href="#icon-play"></use></svg>';
      playButton.setAttribute("aria-label", "Play");
      playButton.title = "Play (Space)";
    }
  }

  function togglePlayback() {
    var element = getActiveMediaElement();
    if (!element) {
      showToast("Select a video or audio to play.", "error");
      return;
    }
    if (element.paused) {
      element.play().catch(function () { showToast("The browser blocked autoplay. Click again to start.", "error"); });
    } else {
      element.pause();
    }
    updateTransportDisplay();
  }

  function skip(seconds) {
    var element = getActiveMediaElement();
    if (!element) return;
    element.currentTime = Math.max(0, Math.min(element.duration || Infinity, element.currentTime + seconds));
    updateTransportDisplay();
  }

  function seekFromControl() {
    var element = getActiveMediaElement();
    if (!element || !Number.isFinite(element.duration)) return;
    element.currentTime = (Number($("player-seek").value) / 1000) * element.duration;
    currentState.timeline.playhead = element.currentTime;
    AC.timeline.updatePlayhead(currentState);
    updateTransportDisplay();
  }

  function chooseNewProject() {
    if (currentState.project.dirty && !window.confirm("The current project has unsaved changes. Create a new project anyway?")) return;
    var name = window.prompt("New project name", "Untitled project");
    if (name === null) return;
    AC.project.revokeMediaUrls(currentState);
    currentState = AC.project.createInitialState(name.trim() || "Untitled project");
    renderAll();
    loadSelectedMedia(null);
    setStatus("ready", "Project ready");
    announce("New project created");
    showToast("New project created.", "success");
  }

  function saveProject() {
    setStatus("saving", "Saving");
    var success = AC.project.save(currentState);
    if (success) {
      setStatus("saved", "Saved");
      announce("Project saved to local storage");
      showToast("Metadata saved locally.", "success");
    } else {
      setStatus("error", "Error");
      showToast("Could not save to localStorage.", "error");
    }
  }

  function exportProject() {
    try {
      AC.project.exportProject(currentState);
      announce("Project exported as JSON");
      showToast(".agentcut.json file generated.", "success");
    } catch (error) {
      setStatus("error", "Error");
      showToast("Could not export the project.", "error");
    }
  }

  function handleAgentSubmit(event) {
    event.preventDefault();
    var input = $("agent-input");
    var text = input.value.trim();
    if (!text) return;
    currentState.agent.status = "working";
    AC.project.emitChange({ reason: "agent-working" });
    window.setTimeout(function () {
      var plan = AC.agent.submit(currentState, text);
      input.value = "";
      if (plan) {
        showToast(plan.executable ? "Plan created and awaiting approval." : "Plan created, with no automatic execution.", "success");
        announce("Agent plan created: " + plan.title);
      } else {
        showToast("The agent needs more detail to create a plan.", "error");
      }
    }, 180);
  }

  function addTrack() {
    var value = window.prompt("New track type: video, audio, or text", "video");
    if (value === null) return;
    var normalized = AC.agent.normalize(value);
    var type = normalized.indexOf("audio") !== -1 ? "audio" : (normalized.indexOf("text") !== -1 || normalized.indexOf("texto") !== -1) ? "text" : "video";
    AC.timeline.addTrack(currentState, type);
    showToast("New track added.", "success");
  }

  function bindMediaEvents() {
    $("import-video-button").addEventListener("click", function () { $("video-input").click(); });
    $("import-audio-button").addEventListener("click", function () { $("audio-input").click(); });
    $("empty-import-button").addEventListener("click", function () { $("video-input").click(); });
    $("video-input").addEventListener("change", function (event) { importFiles(event.target.files); event.target.value = ""; });
    $("audio-input").addEventListener("change", function (event) { importFiles(event.target.files); event.target.value = ""; });
    $("media-search").addEventListener("input", renderMediaLibrary);
    $("clear-media-search").addEventListener("click", function () { $("media-search").value = ""; renderMediaLibrary(); });
    $("media-list").addEventListener("click", function (event) {
      var action = event.target.closest("[data-media-action]");
      if (action) {
        event.stopPropagation();
        if (action.dataset.mediaAction === "add") AC.timeline.addMediaToTimeline(currentState, action.dataset.mediaId);
        if (action.dataset.mediaAction === "remove") removeMedia(action.dataset.mediaId);
        return;
      }
      var item = event.target.closest(".media-item");
      if (item) selectMedia(item.dataset.mediaId);
    });
    $("media-list").addEventListener("dblclick", function (event) {
      var item = event.target.closest(".media-item");
      if (item) AC.timeline.addMediaToTimeline(currentState, item.dataset.mediaId);
    });
    $("media-list").addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var item = event.target.closest(".media-item");
      if (!item || event.target !== item) return;
      event.preventDefault();
      selectMedia(item.dataset.mediaId);
    });
  }

  function bindPlayerEvents() {
    [$("preview-video"), $("audio-preview")].forEach(function (element) {
      ["loadedmetadata", "timeupdate", "play", "pause", "ended", "durationchange"].forEach(function (eventName) {
        element.addEventListener(eventName, function () {
          if (eventName === "timeupdate") currentState.timeline.playhead = element.currentTime || 0;
          updateTransportDisplay();
        });
      });
    });
    $("play-pause-button").addEventListener("click", togglePlayback);
    $("skip-back-button").addEventListener("click", function () { skip(-5); });
    $("skip-forward-button").addEventListener("click", function () { skip(5); });
    $("player-seek").addEventListener("input", seekFromControl);
    $("volume-control").addEventListener("input", function (event) {
      var value = Number(event.target.value);
      $("preview-video").volume = value;
      $("audio-preview").volume = value;
    });
    $("playback-speed").addEventListener("change", function (event) {
      var value = Number(event.target.value);
      $("preview-video").playbackRate = value;
      $("audio-preview").playbackRate = value;
    });
    $("fullscreen-button").addEventListener("click", function () {
      var stage = $("preview-stage");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen();
    });
  }

  function bindProjectEvents() {
    $("new-project-button").addEventListener("click", chooseNewProject);
    $("save-project-button").addEventListener("click", saveProject);
    $("export-project-button").addEventListener("click", exportProject);
    $("undo-button").addEventListener("click", function () { if (AC.project.undo(currentState)) announce("Change undone"); });
    $("redo-button").addEventListener("click", function () { if (AC.project.redo(currentState)) announce("Change redone"); });
    $("remove-selected-button").addEventListener("click", function () { AC.timeline.removeSelected(currentState); });
    $("add-track-button").addEventListener("click", addTrack);
    $("zoom-in-button").addEventListener("click", function () { AC.timeline.setZoom(currentState, 0.1); });
    $("zoom-out-button").addEventListener("click", function () { AC.timeline.setZoom(currentState, -0.1); });
    $("agent-mode").addEventListener("change", function (event) { AC.agent.setMode(currentState, event.target.value); });
    $("agent-form").addEventListener("submit", handleAgentSubmit);
    $("agent-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $("agent-form").requestSubmit();
      }
    });
    $("approve-plan-button").addEventListener("click", function () {
      var result = AC.agent.approveLatest(currentState);
      if (result && result.ok) {
        showToast(result.executed ? "Plan approved and applied. Undo remains available." : "Plan marked as reviewed. No operation was applied.", "success");
      } else if (result && result.message) {
        showToast(result.message, "error");
      }
    });
    document.querySelectorAll("[data-agent-example]").forEach(function (button) {
      button.addEventListener("click", function () {
        $("agent-input").value = button.dataset.agentExample;
        $("agent-input").focus();
      });
    });
    document.querySelectorAll("[data-collapse]").forEach(function (button) {
      button.addEventListener("click", function () {
        var panel = button.dataset.collapse === "media" ? $("media-panel") : $("agent-panel");
        panel.classList.toggle("is-collapsed");
        button.setAttribute("aria-expanded", String(!panel.classList.contains("is-collapsed")));
      });
    });
  }

  function bindKeyboardEvents() {
    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      var commandKey = event.ctrlKey || event.metaKey;
      if (commandKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveProject();
        return;
      }
      if (typing) return;
      if (commandKey && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        AC.project.redo(currentState);
        return;
      }
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        AC.project.undo(currentState);
        return;
      }
      if (event.key === "Delete") {
        AC.timeline.removeSelected(currentState);
        return;
      }
      if (event.key === "Escape") {
        currentState.timeline.selectedItemId = null;
        AC.project.emitChange({ reason: "selection-clear" });
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key === "/") {
        event.preventDefault();
        $("media-search").focus();
      }
    });
  }

  function bindGlobalEvents() {
    window.addEventListener("agentcut:changed", function (event) {
      renderAll();
      if (event.detail && event.detail.reason === "save-error") {
        setStatus("error", "Error");
      }
    });
    window.addEventListener("agentcut:toast", function (event) {
      if (event.detail) showToast(event.detail.message, event.detail.tone);
    });
    window.addEventListener("agentcut:selection", renderInspector);
    window.addEventListener("agentcut:seek", function (event) {
      var element = getActiveMediaElement();
      if (element && Number.isFinite(event.detail.time)) {
        element.currentTime = event.detail.time;
      }
      updateTransportDisplay();
    });
  }

  function initialize() {
    currentState = AC.project.restore() || AC.project.createInitialState("Untitled project");
    bindGlobalEvents();
    bindMediaEvents();
    bindPlayerEvents();
    bindProjectEvents();
    bindKeyboardEvents();
    renderAll();
    if (currentState.project.restored) {
      showToast("Project restored. Reimport local files to preview media.", "success");
      announce("Project restored from local storage");
    }
    window.addEventListener("beforeunload", function () {
      AC.project.revokeMediaUrls(currentState);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
