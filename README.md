# AgentCut Studio

MVP local de um editor de vídeo orientado a agentes de IA.

O MVP usa somente HTML5, CSS3, JavaScript puro e APIs nativas do navegador. Não exige backend, bundler, dependência ou modelo externo. Os arquivos importados permanecem apenas na memória da aba.

## Abrir diretamente

Abra `index.html` no navegador. A aplicação não precisa de npm, bundler ou conexão com a internet.

Também é possível usar um servidor local opcional, caso o navegador restrinja algum recurso ao abrir por `file://`:

```bash
cd "/home/mello/Área de trabalho/Pasta sem título"
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Estrutura

```text
index.html
css/styles.css
js/app.js
js/project.js
js/timeline.js
js/agent.js
assets/icons/README.md
docs/                 # documentação arquitetural preservada
```

Os scripts são carregados como scripts clássicos, em ordem, para que o arquivo funcione também diretamente via `file://`. O namespace global `window.AgentCut` separa o estado e as responsabilidades sem exigir módulos ou bundler.

## Funcionalidades

- Biblioteca local para vídeo, áudio e imagem.
- Preview com `URL.createObjectURL`, play, pause, seek, volume, velocidade e tela cheia.
- Timeline visual multipista com tracks de vídeo, áudio e texto.
- Inserção de clips por botão ou duplo clique.
- Seleção, remoção, zoom e playhead.
- Divisão não destrutiva no playhead, com bloqueio de tracks e undo/redo.
- Histórico em memória com desfazer e refazer.
- Persistência de metadados no `localStorage` usando `agentcut-project-v1`.
- Exportação de um manifesto `.agentcut.json` usando `Blob`.
- Runtime local baseado em regras, com contexto estruturado em `window.AgentCut.agent.getContext()`.
- Planos com aprovação explícita, execução de operações seguras e auditoria no histórico.
- Mudança de sequência para 1080 × 1920 quando o plano vertical é aprovado.
- Atalhos: Espaço, Ctrl/Cmd+S, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Delete e Escape.

## Limitações intencionais

- Nenhum arquivo binário é salvo no `localStorage`.
- Ao recarregar, os metadados são restaurados, mas os arquivos locais precisam ser importados novamente para o preview.
- O runtime não chama modelos reais. Ele é um adaptador determinístico local para validar o contrato agente, plano, aprovação e operação.
- A timeline é não destrutiva: divide e remove referências, mas não reencoda nem modifica os arquivos originais.
- Não há backend, banco de dados, render final, transcrição automática ou upload.
- Pedidos que dependem de análise de áudio, transcript ou visão ficam como plano revisável, sem execução inventada.

## Verificação manual

1. Abra `index.html`.
2. Importe um vídeo local.
3. Selecione o item na biblioteca e reproduza o preview.
4. Adicione o item à timeline por duplo clique ou pelo botão `Timeline`.
5. Selecione o clip, remova, desfaça e refaça.
6. Selecione um clipe, mova o playhead para dentro dele e digite `divida o clipe selecionado no playhead`.
7. Aprove o plano e confirme que dois clipes aparecem na timeline, com uma entrada de operação no histórico.
8. Use `Ctrl/Cmd+Z` para confirmar o undo. Teste também `crie um vídeo vertical` e aprove a mudança de sequência.
9. Digite `remova os silêncios` para confirmar que o pedido vira plano revisável, sem alegar uma análise inexistente.
10. Salve, recarregue a página e exporte o projeto para validar o JSON baixado.

## Contrato mínimo para agents

O estado observável fica em `window.AgentCut.getState()`. O contexto seguro para um agent é obtido por `window.AgentCut.agent.getContext()`. Ele informa assets, sequência, tracks, seleção, capacidades disponíveis e a política de aprovação. Operações mutáveis passam pelo fluxo de plano e aprovação, nunca por escrita direta no estado.

Os diagramas e a documentação arquitetural existentes em `docs/` foram preservados.
