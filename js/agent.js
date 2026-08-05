(function () {
  "use strict";

  var AC = window.AgentCut = window.AgentCut || {};

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("en-US")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function includesAny(value, terms) {
    return terms.some(function (term) { return value.indexOf(term) !== -1; });
  }

  function clone(value) {
    return AC.project.cloneJSON(value);
  }

  function createMessage(role, text) {
    return {
      id: AC.project.createId("message"),
      role: role,
      text: text,
      timestamp: AC.project.now()
    };
  }

  function findPrimaryMedia(currentState) {
    var selected = currentState.media.find(function (media) { return media.id === currentState.selectedMediaId; });
    if (selected && selected.type.indexOf("video/") === 0) return selected;
    return currentState.media.find(function (media) { return media.type.indexOf("video/") === 0; }) || null;
  }

  function isFullEditBrief(normalized) {
    var hasVerb = includesAny(normalized, ["edit", "turn", "make", "create", "transform", "produce", "prepare", "build", "polish", "shape"]);
    var hasSource = includesAny(normalized, ["this footage", "this video", "this interview", "this clip", "the footage", "the interview"]);
    var hasWholeIntent = includesAny(normalized, ["whole", "entire", "full edit", "from start to finish", "end to end", "end-to-end"]);
    var hasFormatIntent = includesAny(normalized, ["vertical reel", "social clip", "youtube cut", "highlight reel", "product video", "short video", "polished social", "make a video"]);
    return hasVerb && (hasSource || hasWholeIntent || hasFormatIntent);
  }

  function createFullEditDefinition(currentState, normalized) {
    if (!isFullEditBrief(normalized)) return null;

    var media = findPrimaryMedia(currentState);
    var wantsVertical = includesAny(normalized, ["vertical", "9:16", "reel", "reels", "tiktok", "shorts", "portrait"]);
    var wantsCaptions = includesAny(normalized, ["caption", "subtitle", "subtitl", "transcri", "legenda"]);
    var wantsSilenceRemoval = includesAny(normalized, ["silence", "dead air", "pause", "pauses", "remove the gaps"]);
    var wantsAudioPolish = includesAny(normalized, ["clean audio", "polish audio", "audio", "sound", "noise", "loudness"]);
    var wantsHighlights = includesAny(normalized, ["highlight", "best moments", "strongest moments", "short", "hook", "opening"]);
    var target = wantsVertical ? "9:16 vertical delivery" : includesAny(normalized, ["16:9", "youtube", "product video"]) ? "16:9 landscape delivery" : "Source aspect ratio";
    var steps = [];

    function addStep(label, status, detail) {
      steps.push({ label: label, status: status, detail: detail || "" });
    }

    addStep(
      "Choose the primary video source",
      media ? "ready" : "blocked",
      media ? media.name : "Import a source video before running this mission."
    );
    addStep(
      "Build a complete editable cut",
      media ? "ready" : "blocked",
      "Keep the original media immutable and make the timeline the working copy."
    );
    if (wantsHighlights) {
      addStep("Shape the narrative around the strongest moments", "deferred", "Needs transcript or scene analysis in the local MVP.");
    } else {
      addStep("Preserve the story and establish a clean first pass", media ? "ready" : "blocked", "Start from the full source so the edit remains reviewable.");
    }
    if (wantsVertical) {
      addStep("Set delivery to 9:16 vertical", media ? "ready" : "blocked", "1080 × 1920 sequence target.");
    } else {
      addStep("Keep the requested delivery framing", "skipped", target);
    }
    if (wantsSilenceRemoval) {
      addStep("Remove dead air and long pauses", "deferred", "Needs waveform or transcript analysis before it can cut safely.");
    }
    if (wantsAudioPolish) {
      addStep("Polish dialogue and loudness", "deferred", "Needs audio analysis and a render worker.");
    }
    if (wantsCaptions) {
      addStep("Generate captions and safe-area styling", "deferred", "Needs transcription and caption rendering.");
    }
    addStep(
      "Prepare a reviewable delivery",
      media ? "ready" : "blocked",
      "Leave the timeline, blueprint, and undo history ready for review."
    );

    var workflow = {
      id: AC.project.createId("workflow"),
      title: wantsVertical ? "Full edit · vertical delivery" : "Full edit mission",
      status: "awaiting_approval",
      stage: media ? "Blueprint ready to run" : "Waiting for source footage",
      progress: 0,
      source: media ? media.name : "Waiting for footage",
      target: target,
      completed: 0,
      total: steps.length,
      deferred: steps.filter(function (step) { return step.status === "deferred"; }).length,
      steps: steps
    };
    return {
      kind: "full-edit",
      title: workflow.title,
      steps: steps.map(function (step) { return step.label; }),
      workflow: workflow,
      operation: {
        type: "agent.full-edit",
        mediaId: media ? media.id : null,
        sequence: wantsVertical ? { width: 1080, height: 1920, aspectRatio: "9:16" } : null,
        requested: {
          vertical: wantsVertical,
          captions: wantsCaptions,
          silenceRemoval: wantsSilenceRemoval,
          audioPolish: wantsAudioPolish,
          highlights: wantsHighlights
        },
        workflow: clone(workflow)
      }
    };
  }

  function matchPlan(currentState, text) {
    var normalized = normalize(text);
    var fullEdit = createFullEditDefinition(currentState, normalized);
    if (fullEdit) return fullEdit;

    if ((normalized.indexOf("remov") !== -1 || normalized.indexOf("exclu") !== -1 || normalized.indexOf("apague") !== -1 || normalized.indexOf("delet") !== -1 || normalized.indexOf("erase") !== -1) && (normalized.indexOf("selecion") !== -1 || normalized.indexOf("selected") !== -1 || normalized.indexOf("este clipe") !== -1 || normalized.indexOf("esse clipe") !== -1 || normalized.indexOf("this clip") !== -1)) {
      return {
        title: "Remove selected clip",
        steps: [
          "Confirm the selected clip and its source track.",
          "Verify that the track is unlocked.",
          "Remove the clip without changing the original file.",
          "Log the operation and keep undo available."
        ],
        operation: { type: "timeline.remove-selected" }
      };
    }
    if (normalized.indexOf("divid") !== -1 || normalized.indexOf("separ") !== -1 || normalized.indexOf("split") !== -1) {
      return {
        title: "Split clip at playhead",
        steps: [
          "Confirm the selected clip and the current playhead position.",
          "Validate that the playhead is inside the clip.",
          "Create two non-destructive clips from the same source file.",
          "Log the operation and keep undo available."
        ],
        operation: { type: "timeline.split-selected" }
      };
    }
    if (normalized.indexOf("silenc") !== -1 || normalized.indexOf("paus") !== -1) {
      return {
        title: "Remove silences",
        steps: [
          "Analyze the active sequence audio track.",
          "Find silences longer than 800 ms.",
          "Create cuts in the detected regions.",
          "Close timeline gaps while preserving links.",
          "Validate audiovisual synchronization."
        ]
      };
    }
    if (normalized.indexOf("vertical") !== -1 || normalized.indexOf("9:16") !== -1 || normalized.indexOf("reels") !== -1 || normalized.indexOf("tiktok") !== -1) {
      return {
        title: "Vertical reframing",
        steps: [
          "Change the sequence aspect ratio to 9:16.",
          "Identify the main subject in the available material.",
          "Center the framing at 1080 × 1920.",
          "Create simulated keyframes when the subject moves.",
          "Prepare validation for vertical publishing."
        ],
        operation: {
          type: "sequence.set",
          values: { width: 1080, height: 1920, aspectRatio: "9:16" }
        }
      };
    }
    if (normalized.indexOf("legenda") !== -1 || normalized.indexOf("caption") !== -1 || normalized.indexOf("subtitl") !== -1 || normalized.indexOf("transcri") !== -1) {
      return {
        title: "Generate captions",
        steps: [
          "Use the available transcript or request speech analysis.",
          "Associate words with time ranges.",
          "Break lines within the safe area.",
          "Apply a dynamic caption style.",
          "Prepare SRT and VTT exports."
        ]
      };
    }
    if (normalized.indexOf("audio") !== -1 || normalized.indexOf("som") !== -1 || normalized.indexOf("sound") !== -1 || normalized.indexOf("volume") !== -1 || normalized.indexOf("noise") !== -1 || normalized.indexOf("ruido") !== -1) {
      return {
        title: "Adjust audio",
        steps: [
          "Analyze levels and possible noisy sections.",
          "Apply non-destructive noise reduction.",
          "Normalize loudness to the project target.",
          "Check clipping and true peaks.",
          "Play a preview for review."
        ]
      };
    }
    if (normalized.indexOf("melhores") !== -1 || normalized.indexOf("melhor momento") !== -1 || normalized.indexOf("best") !== -1 || normalized.indexOf("highlight") !== -1 || normalized.indexOf("corte") !== -1 || normalized.indexOf("cut") !== -1 || normalized.indexOf("60 segundos") !== -1) {
      return {
        title: "Select highlights",
        steps: [
          "Inspect the transcript, scenes, and technical quality.",
          "Score speech clarity, energy, and opening strength.",
          "Select sections without unnecessary repetition.",
          "Build a sequence up to 60 seconds.",
          "Present the diff before any change."
        ]
      };
    }
    return null;
  }

  function submit(currentState, text) {
    var instruction = String(text || "").trim();
    if (!instruction) return null;
    var planDefinition = matchPlan(currentState, instruction);
    var userMessage = createMessage("user", instruction);
    currentState.agent.messages.push(userMessage);

    if (!planDefinition) {
      var unknown = createMessage("assistant", "I could not turn that brief into an edit mission. Describe the outcome, audience, format, or finishing style you want.");
      currentState.agent.messages.push(unknown);
      currentState.agent.status = "idle";
      AC.project.touch(currentState, "agent.message");
      return null;
    }

    var operation = planDefinition.operation ? clone(planDefinition.operation) : null;
    if (operation && operation.type === "agent.full-edit" && !operation.mediaId) {
      operation = null;
    }
    if (operation && (operation.type === "timeline.remove-selected" || operation.type === "timeline.split-selected")) {
      var selected = AC.timeline.itemLocation(currentState, currentState.timeline.selectedItemId);
      operation.targetItemId = selected ? selected.item.id : null;
      operation.targetTrackId = selected ? selected.track.id : null;
    }
    var plan = {
      id: AC.project.createId("plan"),
      kind: planDefinition.kind || "operation",
      title: planDefinition.title,
      instruction: instruction,
      steps: planDefinition.steps,
      workflow: planDefinition.workflow ? clone(planDefinition.workflow) : null,
      status: "awaiting_approval",
      operation: operation,
      executable: Boolean(operation),
      confidence: planDefinition.kind === "full-edit" ? 0.86 : 0.91,
      createdAt: AC.project.now()
    };
    if (operation) operation.planId = plan.id;
    if (plan.workflow) currentState.agent.workflow = clone(plan.workflow);
    var assistantText;
    if (plan.kind === "full-edit") {
      assistantText = operation ? "I mapped the brief into a complete edit mission. Approve once and I will run the supported steps in sequence." : "I mapped the brief, but I need a source video before this mission can run.";
    } else {
      assistantText = plan.operation ? "Plan created. The operation is waiting for your approval." : "Plan created. This request needs media analysis before any change can run.";
    }
    var assistantMessage = createMessage("assistant", assistantText);
    currentState.agent.messages.push(assistantMessage);
    currentState.agent.plans.push(plan);
    currentState.agent.status = "planned";

    var messageIds = [userMessage.id, assistantMessage.id];
    AC.project.commitCommand(currentState, {
      log: {
        type: "agent.plan.add",
        label: plan.kind === "full-edit" ? "Create edit mission" : "Add agent plan",
        details: plan.title
      },
      undo: function () {
        currentState.agent.messages = currentState.agent.messages.filter(function (message) {
          return messageIds.indexOf(message.id) === -1;
        });
        currentState.agent.plans = currentState.agent.plans.filter(function (candidate) { return candidate.id !== plan.id; });
        currentState.agent.status = "idle";
      },
      redo: function () {
        currentState.agent.messages.push(userMessage, assistantMessage);
        currentState.agent.plans.push(plan);
        currentState.agent.status = "planned";
      }
    });
    return plan;
  }

  function setMode(currentState, mode) {
    var allowed = ["autonomous", "assistant", "copilot", "supervised"];
    currentState.agent.mode = allowed.indexOf(mode) !== -1 ? mode : "autonomous";
    AC.project.touch(currentState, "agent.mode");
  }

  function addMessageIfMissing(currentState, message) {
    if (!currentState.agent.messages.some(function (candidate) { return candidate.id === message.id; })) {
      currentState.agent.messages.push(message);
    }
  }

  function removeMessage(currentState, message) {
    currentState.agent.messages = currentState.agent.messages.filter(function (candidate) { return candidate.id !== message.id; });
  }

  function nextTrackStart(track) {
    return track.items.reduce(function (last, item) {
      return Math.max(last, Number(item.start) + Number(item.duration));
    }, 0);
  }

  function runFullEdit(currentState, operation) {
    var media = currentState.media.find(function (candidate) { return candidate.id === operation.mediaId; });
    if (!media) return { ok: false, message: "The source video is no longer available. Import it again and rebuild the mission." };
    if (!media.file || !media.objectUrl) return { ok: false, message: "Reimport the source video before running this mission." };

    var track = currentState.timeline.tracks.find(function (candidate) { return candidate.type === "video" && !candidate.locked; });
    if (!track) return { ok: false, message: "The mission needs an unlocked video track." };
    var plan = currentState.agent.plans.find(function (candidate) { return candidate.id === operation.planId; });
    var beforeTimeline = clone(currentState.timeline);
    var beforeSelectedMediaId = currentState.selectedMediaId;
    var beforeWorkflow = clone(currentState.agent.workflow);
    var beforePlanWorkflow = plan && plan.workflow ? clone(plan.workflow) : null;
    var clip = null;
    currentState.timeline.tracks.some(function (candidate) {
      clip = candidate.items.find(function (item) { return item.mediaId === media.id; }) || clip;
      return Boolean(clip);
    });
    if (!clip) {
      clip = {
        id: AC.project.createId("clip"),
        mediaId: media.id,
        type: "video",
        name: media.name,
        start: nextTrackStart(track),
        duration: Number(media.duration) > 0 ? Number(media.duration) : 5,
        estimatedDuration: !(Number(media.duration) > 0)
      };
      track.items.push(clip);
    }
    currentState.selectedMediaId = media.id;
    currentState.timeline.selectedItemId = clip.id;
    if (operation.sequence) {
      currentState.timeline.sequence = Object.assign({}, currentState.timeline.sequence, operation.sequence);
    }
    AC.timeline.recalculateDuration(currentState);

    var nextWorkflow = clone(operation.workflow || beforeWorkflow);
    nextWorkflow.status = "applied";
    nextWorkflow.stage = nextWorkflow.deferred ? "Draft ready · analysis steps held" : "Full edit ready for review";
    nextWorkflow.steps = nextWorkflow.steps.map(function (step) {
      if (step.status === "ready") return Object.assign({}, step, { status: "done" });
      return step;
    });
    nextWorkflow.completed = nextWorkflow.steps.filter(function (step) { return step.status === "done"; }).length;
    nextWorkflow.deferred = nextWorkflow.steps.filter(function (step) { return step.status === "deferred"; }).length;
    nextWorkflow.total = nextWorkflow.steps.length;
    nextWorkflow.progress = nextWorkflow.total ? Math.round((nextWorkflow.completed / nextWorkflow.total) * 100) : 100;
    currentState.agent.workflow = nextWorkflow;
    if (plan) plan.workflow = clone(nextWorkflow);

    var afterTimeline = clone(currentState.timeline);
    var afterSelectedMediaId = currentState.selectedMediaId;
    var afterWorkflow = clone(currentState.agent.workflow);
    var afterPlanWorkflow = plan && plan.workflow ? clone(plan.workflow) : null;
    AC.project.commitCommand(currentState, {
      log: {
        type: "agent.workflow.run",
        label: "Run full edit mission",
        details: nextWorkflow.title
      },
      undo: function () {
        currentState.timeline = clone(beforeTimeline);
        currentState.selectedMediaId = beforeSelectedMediaId;
        currentState.agent.workflow = clone(beforeWorkflow);
        if (plan && beforePlanWorkflow) plan.workflow = clone(beforePlanWorkflow);
      },
      redo: function () {
        currentState.timeline = clone(afterTimeline);
        currentState.selectedMediaId = afterSelectedMediaId;
        currentState.agent.workflow = clone(afterWorkflow);
        if (plan && afterPlanWorkflow) plan.workflow = clone(afterPlanWorkflow);
      }
    });
    var deferred = nextWorkflow.deferred;
    return {
      ok: true,
      changed: true,
      message: deferred ? "The editable draft is ready. " + deferred + " analysis-dependent steps are held for a future media worker." : "The complete local edit mission is ready for review.",
      deferred: deferred,
      completed: nextWorkflow.completed,
      total: nextWorkflow.total
    };
  }

  function approveLatest(currentState) {
    var plan = currentState.agent.plans[currentState.agent.plans.length - 1];
    if (!plan) return { ok: false, message: "No edit mission available." };
    if (plan.status === "applied" || plan.status === "reviewed") {
      return { ok: false, message: "This mission is already closed." };
    }
    var previousPlanStatus = plan.status;
    var previousAgentStatus = currentState.agent.status;
    var execution = { ok: true, changed: false, message: "Plan marked as reviewed." };
    var canExecute = Boolean(plan.operation && plan.executable && currentState.agent.mode !== "assistant");
    if (canExecute) {
      execution = AC.timeline.applyAgentOperation(currentState, plan.operation);
      if (!execution.ok) {
        currentState.agent.status = "idle";
        currentState.agent.messages.push(createMessage("assistant", "I did not run the mission: " + execution.message));
        AC.project.touch(currentState, "agent.plan.blocked");
        return execution;
      }
    }

    var nextStatus = canExecute ? "applied" : "reviewed";
    var responseText;
    if (plan.kind === "full-edit" && nextStatus === "applied") {
      responseText = execution.message + " Undo remains available for the full mission.";
    } else {
      responseText = plan.operation ? execution.message + " The original file remains untouched." : "Plan marked as reviewed. Execution depends on a transcript, analysis, or other data that is not available yet.";
    }
    var responseMessage = createMessage("assistant", responseText);
    var operationCommand = plan.operation && execution.changed ? currentState.history.undoStack[currentState.history.undoStack.length - 1] : null;
    var wrappedOperation = Boolean(operationCommand && operationCommand.log && (operationCommand.log.type.indexOf("agent.operation.") === 0 || operationCommand.log.type.indexOf("agent.workflow.") === 0));

    if (wrappedOperation) {
      var undoOperation = operationCommand.undo;
      var redoOperation = operationCommand.redo;
      operationCommand.undo = function () {
        undoOperation();
        plan.status = previousPlanStatus;
        currentState.agent.status = previousAgentStatus;
        removeMessage(currentState, responseMessage);
      };
      operationCommand.redo = function () {
        redoOperation();
        plan.status = nextStatus;
        currentState.agent.status = "idle";
        addMessageIfMissing(currentState, responseMessage);
      };
    }

    plan.status = nextStatus;
    currentState.agent.status = "idle";
    currentState.agent.messages.push(responseMessage);

    if (wrappedOperation) {
      AC.project.touch(currentState, "agent.plan.applied");
    } else {
      AC.project.commitCommand(currentState, {
        log: {
          type: "agent.plan.approval",
          label: nextStatus === "applied" ? "Approve edit mission" : "Review agent plan",
          details: plan.title
        },
        undo: function () {
          plan.status = previousPlanStatus;
          currentState.agent.status = previousAgentStatus;
          removeMessage(currentState, responseMessage);
        },
        redo: function () {
          plan.status = nextStatus;
          currentState.agent.status = "idle";
          addMessageIfMissing(currentState, responseMessage);
        }
      });
    }
    return {
      ok: true,
      executed: canExecute,
      changed: Boolean(execution.changed),
      message: execution.message,
      deferred: execution.deferred || 0
    };
  }

  function getContext(currentState) {
    currentState = currentState || (typeof AC.getState === "function" ? AC.getState() : null);
    if (!currentState) return null;
    var selected = AC.timeline.itemLocation(currentState, currentState.timeline.selectedItemId);
    return {
      schema: "agentcut-context-v2",
      project: {
        id: currentState.project.id,
        name: currentState.project.name,
        dirty: currentState.project.dirty
      },
      sequence: AC.project.cloneJSON(currentState.timeline.sequence || { width: 1920, height: 1080, fps: 30, aspectRatio: "16:9" }),
      media: currentState.media.map(function (media) {
        return {
          id: media.id,
          name: media.name,
          type: media.type,
          duration: media.duration,
          width: media.width,
          height: media.height,
          availableForPreview: Boolean(media.file && media.objectUrl)
        };
      }),
      timeline: {
        duration: currentState.timeline.duration,
        playhead: currentState.timeline.playhead,
        tracks: currentState.timeline.tracks.map(function (track) {
          return {
            id: track.id,
            type: track.type,
            name: track.name,
            locked: track.locked,
            hidden: track.hidden,
            muted: track.muted,
            items: AC.project.cloneJSON(track.items)
          };
        })
      },
      selection: selected ? { trackId: selected.track.id, item: AC.project.cloneJSON(selected.item) } : null,
      mission: AC.project.cloneJSON(currentState.agent.workflow || {}),
      capabilities: ["agent.full-edit", "timeline.remove-selected", "timeline.split-selected", "sequence.set"],
      policy: { approvalRequired: true, originalMediaImmutable: true, runtime: "local-rules", oneApprovalRunsMission: true }
    };
  }

  function renderMessage(message) {
    var element = document.createElement("div");
    element.className = "agent-message " + (message.role === "user" ? "user" : "assistant");
    var bullet = document.createElement("div");
    bullet.className = "agent-message-bullet";
    bullet.innerHTML = '<svg aria-hidden="true"><use href="#icon-spark"></use></svg>';
    var content = document.createElement("div");
    var author = document.createElement("strong");
    author.textContent = message.role === "user" ? "You" : "AgentCut Director";
    var text = document.createElement("p");
    text.textContent = message.text;
    content.appendChild(author);
    content.appendChild(text);
    element.appendChild(bullet);
    element.appendChild(content);
    return element;
  }

  function renderStep(step) {
    var value = typeof step === "string" ? { label: step, status: "ready", detail: "" } : step;
    var li = document.createElement("li");
    li.className = "plan-step plan-step-" + (value.status || "ready");
    var label = document.createElement("span");
    label.className = "plan-step-label";
    label.textContent = value.label;
    var state = document.createElement("span");
    state.className = "plan-step-state";
    state.textContent = value.status === "done" ? "DONE" : value.status === "deferred" ? "HELD" : value.status === "blocked" ? "BLOCKED" : value.status === "skipped" ? "SKIP" : "READY";
    li.appendChild(label);
    li.appendChild(state);
    if (value.detail) {
      var detail = document.createElement("small");
      detail.textContent = value.detail;
      li.appendChild(detail);
    }
    return li;
  }

  function renderWorkflow(currentState, latestPlan) {
    var workflow = latestPlan && latestPlan.workflow ? latestPlan.workflow : currentState.agent.workflow;
    var progressCard = document.getElementById("agent-progress-card");
    var sourceLabel = document.getElementById("agent-source-label");
    var targetLabel = document.getElementById("agent-target-label");
    if (!progressCard || !sourceLabel || !targetLabel) return;
    var sourceMedia = findPrimaryMedia(currentState);
    sourceLabel.textContent = workflow && workflow.source ? workflow.source : sourceMedia ? sourceMedia.name : "Waiting for footage";
    targetLabel.textContent = workflow && workflow.target ? workflow.target : "Brief not set";
    if (!workflow || !workflow.id) {
      progressCard.hidden = true;
      return;
    }
    progressCard.hidden = false;
    var progress = Math.max(0, Math.min(100, Number(workflow.progress) || 0));
    var stage = document.getElementById("agent-progress-stage");
    var value = document.getElementById("agent-progress-value");
    var bar = document.getElementById("agent-progress-bar");
    var detail = document.getElementById("agent-progress-detail");
    if (stage) stage.textContent = workflow.stage || "Mission ready";
    if (value) value.textContent = progress + "%";
    if (bar) bar.style.width = progress + "%";
    if (detail) {
      detail.textContent = workflow.completed + " of " + workflow.total + " steps ready" + (workflow.deferred ? " · " + workflow.deferred + " held for analysis" : "");
    }
  }

  function render(currentState) {
    if (!currentState) return;
    var messages = document.getElementById("agent-messages");
    var mode = document.getElementById("agent-mode");
    var status = document.getElementById("agent-status");
    var planCard = document.getElementById("agent-plan-card");
    var planTitle = document.getElementById("agent-plan-title");
    var planStatus = document.getElementById("agent-plan-status");
    var planSteps = document.getElementById("agent-plan-steps");
    var planConfidence = document.getElementById("agent-plan-confidence");
    var historyList = document.getElementById("agent-history-list");
    if (!messages || !mode || !status || !planCard || !planTitle || !planSteps || !historyList) return;

    mode.value = currentState.agent.mode;
    messages.replaceChildren();
    currentState.agent.messages.slice(-7).forEach(function (message) {
      messages.appendChild(renderMessage(message));
    });
    messages.scrollTop = messages.scrollHeight;

    var latestPlan = currentState.agent.plans[currentState.agent.plans.length - 1];
    if (latestPlan) {
      planCard.hidden = false;
      planTitle.textContent = latestPlan.title;
      if (latestPlan.kind === "full-edit") {
        planStatus.textContent = latestPlan.status === "applied" ? "EDIT COMPLETE" : latestPlan.executable ? "READY TO RUN" : "WAITING FOR SOURCE";
      } else {
        planStatus.textContent = latestPlan.status === "applied" ? "APPLIED" : latestPlan.status === "reviewed" ? "REVIEWED" : latestPlan.executable ? "AWAITING APPROVAL" : "PLAN";
      }
      planStatus.classList.toggle("is-approved", latestPlan.status === "reviewed" || latestPlan.status === "applied");
      planStatus.classList.toggle("is-applied", latestPlan.status === "applied");
      planSteps.replaceChildren();
      (latestPlan.workflow && latestPlan.workflow.steps ? latestPlan.workflow.steps : latestPlan.steps).forEach(function (step) {
        planSteps.appendChild(renderStep(step));
      });
      if (latestPlan.kind === "full-edit") {
        planConfidence.textContent = currentState.agent.mode === "assistant" ? "Plan only mode, no changes will run" : latestPlan.executable ? "One approval runs the complete local mission" : "Import a source video to unlock this mission";
      } else {
        planConfidence.textContent = latestPlan.status === "applied" ? "Applied with undo available" : latestPlan.status === "reviewed" ? "Reviewed, no automatic execution" : latestPlan.executable ? "Safe local operation, approval required" : "Requires media data, no automatic change";
      }
      var approveButton = document.getElementById("approve-plan-button");
      if (approveButton) {
        approveButton.disabled = latestPlan.status === "applied" || latestPlan.status === "reviewed" || !latestPlan.executable;
        approveButton.textContent = currentState.agent.mode === "assistant" ? "Mark as reviewed" : latestPlan.kind === "full-edit" ? (latestPlan.status === "applied" ? "Edit complete" : latestPlan.executable ? "Approve & run edit" : "Import footage first") : (latestPlan.status === "applied" ? "Applied" : latestPlan.status === "reviewed" ? "Reviewed" : latestPlan.executable ? "Approve and run" : "Mark as reviewed");
      }
    } else {
      planCard.hidden = true;
    }

    renderWorkflow(currentState, latestPlan);
    status.classList.toggle("is-working", currentState.agent.status === "working");
    status.lastChild.textContent = currentState.agent.status === "planned" ? " Plan ready" : currentState.agent.status === "working" ? " Running mission" : " Ready";

    var log = currentState.history.log.filter(function (entry) {
      return entry.type && entry.type.indexOf("agent.") === 0;
    }).slice(-6).reverse();
    historyList.replaceChildren();
    log.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "history-item agent";
      var body = document.createElement("div");
      var label = document.createElement("strong");
      label.textContent = entry.label;
      var time = document.createElement("time");
      time.textContent = formatTime(entry.timestamp);
      body.appendChild(label);
      body.appendChild(time);
      item.appendChild(body);
      historyList.appendChild(item);
    });
    var historyCount = document.getElementById("agent-history-count");
    if (historyCount) historyCount.textContent = String(log.length);
  }

  function formatTime(value) {
    try {
      return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "now";
    }
  }

  AC.agent = {
    submit: submit,
    setMode: setMode,
    approveLatest: approveLatest,
    getContext: getContext,
    executeFullEdit: runFullEdit,
    render: render,
    normalize: normalize,
    matchPlan: matchPlan
  };
})();
