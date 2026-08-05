(function () {
  "use strict";

  var AC = window.AgentCut = window.AgentCut || {};

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("en-US")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function createMessage(role, text) {
    return {
      id: AC.project.createId("message"),
      role: role,
      text: text,
      timestamp: AC.project.now()
    };
  }

  function matchPlan(text) {
    var normalized = normalize(text);
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
    var planDefinition = matchPlan(instruction);
    var userMessage = createMessage("user", instruction);
    currentState.agent.messages.push(userMessage);

    if (!planDefinition) {
      var unknown = createMessage("assistant", "I could not turn that instruction into a plan. Describe the desired result in more detail.");
      currentState.agent.messages.push(unknown);
      currentState.agent.status = "idle";
      AC.project.touch(currentState, "agent.message");
      return null;
    }

    var operation = planDefinition.operation ? Object.assign({}, planDefinition.operation) : null;
    if (operation && (operation.type === "timeline.remove-selected" || operation.type === "timeline.split-selected")) {
      var selected = AC.timeline.itemLocation(currentState, currentState.timeline.selectedItemId);
      operation.targetItemId = selected ? selected.item.id : null;
      operation.targetTrackId = selected ? selected.track.id : null;
    }
    var plan = {
      id: AC.project.createId("plan"),
      title: planDefinition.title,
      instruction: instruction,
      steps: planDefinition.steps,
      status: "awaiting_approval",
      operation: operation,
      executable: Boolean(operation),
      confidence: 0.91,
      createdAt: AC.project.now()
    };
    var assistantMessage = createMessage("assistant", planDefinition.operation ? "Plan created. The operation is waiting for your approval." : "Plan created. This request needs media analysis before any change can run.");
    currentState.agent.messages.push(assistantMessage);
    currentState.agent.plans.push(plan);
    currentState.agent.status = "planned";

    var messageIds = [userMessage.id, assistantMessage.id];
    AC.project.commitCommand(currentState, {
      log: {
        type: "agent.plan.add",
        label: "Add agent plan",
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
    var allowed = ["assistant", "copilot", "supervised"];
    currentState.agent.mode = allowed.indexOf(mode) !== -1 ? mode : "assistant";
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

  function approveLatest(currentState) {
    var plan = currentState.agent.plans[currentState.agent.plans.length - 1];
    if (!plan) return { ok: false, message: "No plan available." };
    if (plan.status === "applied" || plan.status === "reviewed") {
      return { ok: false, message: "This plan is already closed." };
    }
    var previousPlanStatus = plan.status;
    var previousAgentStatus = currentState.agent.status;
    var execution = { ok: true, changed: false, message: "Plan marked as reviewed." };
    if (plan.operation) {
      execution = AC.timeline.applyAgentOperation(currentState, plan.operation);
      if (!execution.ok) {
        currentState.agent.status = "idle";
        currentState.agent.messages.push(createMessage("assistant", "I did not execute the plan: " + execution.message));
        AC.project.touch(currentState, "agent.plan.blocked");
        return execution;
      }
    }

    var nextStatus = plan.operation ? "applied" : "reviewed";
    var responseMessage = createMessage("assistant", plan.operation ? execution.message + " The original file remains untouched." : "Plan marked as reviewed. Execution depends on a transcript, analysis, or other data that is not available yet.");
    var operationCommand = plan.operation && execution.changed ? currentState.history.undoStack[currentState.history.undoStack.length - 1] : null;
    var wrappedOperation = Boolean(operationCommand && operationCommand.log && operationCommand.log.type.indexOf("agent.operation.") === 0);

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
          label: nextStatus === "applied" ? "Approve agent plan" : "Review agent plan",
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
    return { ok: true, executed: Boolean(plan.operation), changed: Boolean(execution.changed), message: execution.message };
  }

  function getContext(currentState) {
    currentState = currentState || (typeof AC.getState === "function" ? AC.getState() : null);
    if (!currentState) return null;
    var selected = AC.timeline.itemLocation(currentState, currentState.timeline.selectedItemId);
    return {
      schema: "agentcut-context-v1",
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
      capabilities: ["timeline.remove-selected", "timeline.split-selected", "sequence.set"],
      policy: { approvalRequired: true, originalMediaImmutable: true, runtime: "local-rules" }
    };
  }

  function renderMessage(message) {
    var element = document.createElement("div");
    element.className = "agent-message " + (message.role === "user" ? "user" : "assistant");
    var bullet = document.createElement("div");
    bullet.className = "agent-message-bullet";
    bullet.innerHTML = '<svg aria-hidden="true"><use href="#icon-' + (message.role === "user" ? "spark" : "spark") + '"></use></svg>';
    var content = document.createElement("div");
    var author = document.createElement("strong");
    author.textContent = message.role === "user" ? "You" : "AgentCut Runtime";
    var text = document.createElement("p");
    text.textContent = message.text;
    content.appendChild(author);
    content.appendChild(text);
    element.appendChild(bullet);
    element.appendChild(content);
    return element;
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
    var historyCount = document.getElementById("agent-history-count");
    if (!messages || !mode || !status || !planCard || !planTitle || !planSteps || !historyList) return;

    mode.value = currentState.agent.mode;
    messages.replaceChildren();
    currentState.agent.messages.slice(-9).forEach(function (message) {
      messages.appendChild(renderMessage(message));
    });
    messages.scrollTop = messages.scrollHeight;

    var latestPlan = currentState.agent.plans[currentState.agent.plans.length - 1];
    if (latestPlan) {
      planCard.hidden = false;
      planTitle.textContent = latestPlan.title;
      planStatus.textContent = latestPlan.status === "applied" ? "APPLIED" : latestPlan.status === "reviewed" ? "REVIEWED" : latestPlan.executable ? "AWAITING APPROVAL" : "PLAN";
      planStatus.classList.toggle("is-approved", latestPlan.status === "reviewed" || latestPlan.status === "applied");
      planStatus.classList.toggle("is-applied", latestPlan.status === "applied");
      planSteps.replaceChildren();
      latestPlan.steps.forEach(function (step) {
        var li = document.createElement("li");
        li.textContent = step;
        planSteps.appendChild(li);
      });
      planConfidence.textContent = latestPlan.status === "applied" ? "Applied with undo available" : latestPlan.status === "reviewed" ? "Reviewed, no automatic execution" : latestPlan.executable ? "Safe local operation, approval required" : "Requires media data, no automatic change";
      var approveButton = document.getElementById("approve-plan-button");
      if (approveButton) {
        approveButton.disabled = latestPlan.status === "applied" || latestPlan.status === "reviewed";
        approveButton.textContent = latestPlan.status === "applied" ? "Applied" : latestPlan.status === "reviewed" ? "Reviewed" : latestPlan.executable ? "Approve and run" : "Mark as reviewed";
      }
    } else {
      planCard.hidden = true;
    }

    status.classList.toggle("is-working", currentState.agent.status === "working");
    status.lastChild.textContent = currentState.agent.status === "planned" ? " Plan ready" : currentState.agent.status === "working" ? " Preparing plan" : " Ready";

    var log = currentState.history.log.filter(function (entry) {
      return entry.type && entry.type.indexOf("agent.") === 0;
    }).slice(-5).reverse();
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
    render: render,
    normalize: normalize
  };
})();
