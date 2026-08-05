(function () {
  "use strict";

  var AC = window.AgentCut = window.AgentCut || {};

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("pt-BR")
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
    if ((normalized.indexOf("remov") !== -1 || normalized.indexOf("exclu") !== -1 || normalized.indexOf("apague") !== -1) && (normalized.indexOf("selecion") !== -1 || normalized.indexOf("este clipe") !== -1 || normalized.indexOf("esse clipe") !== -1)) {
      return {
        title: "Remover clipe selecionado",
        steps: [
          "Confirmar o clipe selecionado e a track de origem.",
          "Verificar se a track está desbloqueada.",
          "Remover o clipe sem alterar o arquivo original.",
          "Registrar a operação e manter o undo disponível."
        ],
        operation: { type: "timeline.remove-selected" }
      };
    }
    if (normalized.indexOf("divid") !== -1 || normalized.indexOf("separ") !== -1 || normalized.indexOf("split") !== -1) {
      return {
        title: "Dividir clipe no playhead",
        steps: [
          "Confirmar o clipe selecionado e a posição atual do playhead.",
          "Validar que o playhead está dentro do clipe.",
          "Criar dois clipes não destrutivos no mesmo arquivo de origem.",
          "Registrar a operação e manter o undo disponível."
        ],
        operation: { type: "timeline.split-selected" }
      };
    }
    if (normalized.indexOf("silenc") !== -1 || normalized.indexOf("pausas") !== -1) {
      return {
        title: "Remoção de silêncios",
        steps: [
          "Analisar a faixa de áudio da sequência ativa.",
          "Encontrar silêncios maiores que 800 ms.",
          "Criar cortes nas regiões detectadas.",
          "Fechar os espaços da timeline preservando os links.",
          "Validar a sincronização audiovisual."
        ]
      };
    }
    if (normalized.indexOf("vertical") !== -1 || normalized.indexOf("9:16") !== -1 || normalized.indexOf("reels") !== -1 || normalized.indexOf("tiktok") !== -1) {
      return {
        title: "Reenquadramento vertical",
        steps: [
          "Alterar a proporção da sequência para 9:16.",
          "Identificar o assunto principal no material disponível.",
          "Centralizar o enquadramento em 1080 × 1920.",
          "Criar keyframes simulados quando o assunto se mover.",
          "Preparar a validação para publicação vertical."
        ],
        operation: {
          type: "sequence.set",
          values: { width: 1080, height: 1920, aspectRatio: "9:16" }
        }
      };
    }
    if (normalized.indexOf("legenda") !== -1 || normalized.indexOf("caption") !== -1 || normalized.indexOf("transcri") !== -1) {
      return {
        title: "Geração de legendas",
        steps: [
          "Usar a transcrição disponível ou solicitar uma análise de fala.",
          "Associar palavras a intervalos temporais.",
          "Quebrar as linhas respeitando a área segura.",
          "Aplicar um estilo de legenda dinâmica.",
          "Preparar exportação em SRT e VTT."
        ]
      };
    }
    if (normalized.indexOf("audio") !== -1 || normalized.indexOf("som") !== -1 || normalized.indexOf("volume") !== -1 || normalized.indexOf("ruido") !== -1) {
      return {
        title: "Ajuste de áudio",
        steps: [
          "Analisar níveis e possíveis trechos com ruído.",
          "Aplicar redução de ruído de forma não destrutiva.",
          "Normalizar o loudness para a meta do projeto.",
          "Verificar clipping e picos verdadeiros.",
          "Reproduzir uma prévia para revisão."
        ]
      };
    }
    if (normalized.indexOf("melhores") !== -1 || normalized.indexOf("melhor momento") !== -1 || normalized.indexOf("corte") !== -1 || normalized.indexOf("60 segundos") !== -1) {
      return {
        title: "Seleção de melhores momentos",
        steps: [
          "Inspecionar transcript, cenas e qualidade técnica.",
          "Pontuar clareza da fala, energia e força de abertura.",
          "Selecionar trechos sem repetições desnecessárias.",
          "Montar uma sequência de até 60 segundos.",
          "Apresentar o diff antes de qualquer alteração."
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
      var unknown = createMessage("assistant", "Não consegui transformar essa instrução em um plano. Descreva o resultado desejado com mais detalhes.");
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
    var assistantMessage = createMessage("assistant", planDefinition.operation ? "Plano criado. A operação ficará aguardando sua aprovação." : "Plano criado. Este pedido precisa de análise de mídia antes de executar qualquer alteração.");
    currentState.agent.messages.push(assistantMessage);
    currentState.agent.plans.push(plan);
    currentState.agent.status = "planned";

    var messageIds = [userMessage.id, assistantMessage.id];
    AC.project.commitCommand(currentState, {
      log: {
        type: "agent.plan.add",
        label: "Adicionar plano do agente",
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
    if (!plan) return { ok: false, message: "Nenhum plano disponível." };
    if (plan.status === "applied" || plan.status === "reviewed") {
      return { ok: false, message: "Este plano já foi encerrado." };
    }
    var previousPlanStatus = plan.status;
    var previousAgentStatus = currentState.agent.status;
    var execution = { ok: true, changed: false, message: "Plano marcado como revisado." };
    if (plan.operation) {
      execution = AC.timeline.applyAgentOperation(currentState, plan.operation);
      if (!execution.ok) {
        currentState.agent.status = "idle";
        currentState.agent.messages.push(createMessage("assistant", "Não executei o plano: " + execution.message));
        AC.project.touch(currentState, "agent.plan.blocked");
        return execution;
      }
    }

    var nextStatus = plan.operation ? "applied" : "reviewed";
    var responseMessage = createMessage("assistant", plan.operation ? execution.message + " O arquivo original continua intacto." : "Plano marcado como revisado. A execução depende de transcript, análise ou outro dado que ainda não está disponível.");
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
          label: nextStatus === "applied" ? "Aprovar plano do agente" : "Revisar plano do agente",
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
    author.textContent = message.role === "user" ? "Você" : "AgentCut Runtime";
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
      planStatus.textContent = latestPlan.status === "applied" ? "EXECUTADO" : latestPlan.status === "reviewed" ? "REVISADO" : latestPlan.executable ? "AGUARDANDO APROVAÇÃO" : "PLANO";
      planStatus.classList.toggle("is-approved", latestPlan.status === "reviewed" || latestPlan.status === "applied");
      planStatus.classList.toggle("is-applied", latestPlan.status === "applied");
      planSteps.replaceChildren();
      latestPlan.steps.forEach(function (step) {
        var li = document.createElement("li");
        li.textContent = step;
        planSteps.appendChild(li);
      });
      planConfidence.textContent = latestPlan.status === "applied" ? "Executado com undo disponível" : latestPlan.status === "reviewed" ? "Revisado, sem execução automática" : latestPlan.executable ? "Operação local segura, aprovação necessária" : "Requer dados de mídia, sem alteração automática";
      var approveButton = document.getElementById("approve-plan-button");
      if (approveButton) {
        approveButton.disabled = latestPlan.status === "applied" || latestPlan.status === "reviewed";
        approveButton.textContent = latestPlan.status === "applied" ? "Executado" : latestPlan.status === "reviewed" ? "Revisado" : latestPlan.executable ? "Aprovar e executar" : "Marcar como revisado";
      }
    } else {
      planCard.hidden = true;
    }

    status.classList.toggle("is-working", currentState.agent.status === "working");
    status.lastChild.textContent = currentState.agent.status === "planned" ? " Plano pronto" : currentState.agent.status === "working" ? " Preparando plano" : " Pronto";

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
      return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "agora";
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
