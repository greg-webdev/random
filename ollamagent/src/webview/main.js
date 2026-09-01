(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // Elements
  const statusIndicator = document.getElementById('statusIndicator');
  const statusDot = statusIndicator?.querySelector('.status-dot');
  const modelSelect = document.getElementById('modelSelect');
  const autonomousToggle = document.getElementById('autonomousToggle');
  const historyBtn = document.getElementById('historyBtn');
  const exportBtn = document.getElementById('exportBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const historyDrawer = document.getElementById('historyDrawer');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
  const historySearch = document.getElementById('historySearch');
  const historyList = document.getElementById('historyList');
  const chatMessages = document.getElementById('chatMessages');
  const emptyState = document.getElementById('emptyState');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const sendIcon = sendBtn?.querySelector('.send-icon');
  const stopIcon = sendBtn?.querySelector('.stop-icon');
  const attachContextBtn = document.getElementById('attachContextBtn');
  const saveCurrentSessionBtn = document.getElementById('saveCurrentSessionBtn');
  const contextBanner = document.getElementById('contextBanner');
  const activeFileName = document.getElementById('activeFileName');
  const activeSelectionInfo = document.getElementById('activeSelectionInfo');
  const removeContextBtn = document.getElementById('removeContextBtn');

  let isStreaming = false;
  let currentAssistantBubble = null;
  let currentThinkingBox = null;
  let currentRawAssistantText = '';
  let activeContext = null;
  let savedSessions = [];

  // Initialize
  vscode.postMessage({ type: 'ready' });

  // Auto resize textarea
  chatInput?.addEventListener('input', () => {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Keybindings
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn?.addEventListener('click', () => {
    if (isStreaming) {
      vscode.postMessage({ type: 'stop' });
    } else {
      handleSend();
    }
  });

  // History Drawer Toggle
  historyBtn?.addEventListener('click', () => {
    if (historyDrawer) {
      const isHidden = historyDrawer.classList.contains('hidden');
      if (isHidden) {
        historyDrawer.classList.remove('hidden');
        vscode.postMessage({ type: 'getSessions' });
      } else {
        historyDrawer.classList.add('hidden');
      }
    }
  });

  closeHistoryBtn?.addEventListener('click', () => {
    historyDrawer?.classList.add('hidden');
  });

  clearAllHistoryBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'clearAllSessions' });
  });

  historySearch?.addEventListener('input', (e) => {
    const query = (e.target.value || '').toLowerCase();
    renderHistoryList(savedSessions.filter(s =>
      s.title?.toLowerCase().includes(query) ||
      s.model?.toLowerCase().includes(query)
    ));
  });

  // Export and Save Actions
  exportBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'exportChat' });
  });

  saveCurrentSessionBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'saveCurrentSession' });
    saveCurrentSessionBtn.innerHTML = '<span>✓ Saved</span>';
    setTimeout(() => {
      saveCurrentSessionBtn.innerHTML = '<span>💾 Save</span>';
    }, 1500);
  });

  newChatBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'newChat' });
    resetChatUI();
  });

  clearChatBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'clear' });
    resetChatUI();
  });

  modelSelect?.addEventListener('change', (e) => {
    const target = e.target;
    if (target && target.value) {
      vscode.postMessage({ type: 'setModel', model: target.value });
    }
  });

  autonomousToggle?.addEventListener('change', (e) => {
    const target = e.target;
    vscode.postMessage({ type: 'setAutonomous', enabled: target.checked });
  });

  attachContextBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'requestContext' });
  });

  removeContextBtn?.addEventListener('click', () => {
    activeContext = null;
    if (contextBanner) contextBanner.classList.add('hidden');
  });

  // Quick Action Buttons
  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      vscode.postMessage({ type: 'quickAction', action });
    });
  });

  function resetChatUI() {
    if (chatMessages) {
      chatMessages.innerHTML = '';
      if (emptyState) {
        chatMessages.appendChild(emptyState);
        emptyState.classList.remove('hidden');
      }
    }
    currentAssistantBubble = null;
    currentThinkingBox = null;
    currentRawAssistantText = '';
  }

  function handleSend() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    setStreamingState(true);
    prepareAssistantMessage();

    vscode.postMessage({
      type: 'send',
      text,
      context: activeContext,
    });
  }

  function setStreamingState(streaming) {
    isStreaming = streaming;
    if (sendBtn) {
      if (streaming) {
        sendBtn.classList.add('stopping');
        sendIcon?.classList.add('hidden');
        stopIcon?.classList.remove('hidden');
        sendBtn.title = 'Stop Generation';
      } else {
        sendBtn.classList.remove('stopping');
        sendIcon?.classList.remove('hidden');
        stopIcon?.classList.add('hidden');
        sendBtn.title = 'Send message (Enter)';
      }
    }
  }

  function appendUserMessage(text) {
    if (emptyState) emptyState.classList.add('hidden');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message message-user';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    msgDiv.appendChild(bubble);
    chatMessages?.appendChild(msgDiv);
    scrollToBottom();
  }

  function prepareAssistantMessage() {
    if (emptyState) emptyState.classList.add('hidden');

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message message-assistant';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '<span class="loading-placeholder" style="color:#9ca3af;font-style:italic;">Connecting to Ollama...</span>';

    msgDiv.appendChild(bubble);
    chatMessages?.appendChild(msgDiv);

    currentAssistantBubble = bubble;
    currentThinkingBox = null;
    currentRawAssistantText = '';
    scrollToBottom();
  }

  function handleThinking(thought) {
    if (!currentAssistantBubble) return;

    // Clear initial loading text
    const placeholder = currentAssistantBubble.querySelector('.loading-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    if (!currentThinkingBox) {
      currentThinkingBox = document.createElement('div');
      currentThinkingBox.className = 'thinking-box';

      const header = document.createElement('div');
      header.className = 'thinking-header';
      header.innerHTML = '<span>🧠</span><span>Thinking Process</span>';

      const content = document.createElement('div');
      content.className = 'thinking-content';

      currentThinkingBox.appendChild(header);
      currentThinkingBox.appendChild(content);

      header.addEventListener('click', () => {
        content.classList.toggle('hidden');
      });

      currentAssistantBubble.parentElement?.insertBefore(currentThinkingBox, currentAssistantBubble);
    }

    const contentDiv = currentThinkingBox.querySelector('.thinking-content');
    if (contentDiv) {
      contentDiv.textContent += thought;
      contentDiv.scrollTop = contentDiv.scrollHeight;
    }
  }

  function handleToken(token) {
    if (!currentAssistantBubble) {
      prepareAssistantMessage();
    }

    const placeholder = currentAssistantBubble?.querySelector('.loading-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    currentRawAssistantText += token;
    if (currentAssistantBubble) {
      currentAssistantBubble.innerHTML = renderMarkdown(currentRawAssistantText);
      attachCodeActionListeners(currentAssistantBubble);
    }
    scrollToBottom();
  }

  function handleToolStart(toolCall) {
    if (!currentAssistantBubble) return;

    const placeholder = currentAssistantBubble.querySelector('.loading-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    const toolBox = document.createElement('div');
    toolBox.className = 'tool-box';
    toolBox.id = `tool-${Date.now()}`;

    const toolName = escapeHtml(toolCall.function?.name || 'tool');
    const header = document.createElement('div');
    header.className = 'tool-header';
    header.innerHTML = `<span>⚡ Tool: <strong>${toolName}</strong></span><span class="tool-status">Running...</span>`;

    const content = document.createElement('div');
    content.className = 'tool-content';
    const argsStr = typeof toolCall.function?.arguments === 'object'
      ? JSON.stringify(toolCall.function.arguments, null, 2)
      : String(toolCall.function?.arguments || '');
    content.textContent = `Parameters:\n${argsStr}`;

    header.addEventListener('click', () => {
      content.classList.toggle('hidden');
    });

    toolBox.appendChild(header);
    toolBox.appendChild(content);

    currentAssistantBubble.parentElement?.insertBefore(toolBox, currentAssistantBubble);
    scrollToBottom();
  }

  function handleToolResult(result) {
    const toolBoxes = document.querySelectorAll('.tool-box');
    const lastToolBox = toolBoxes[toolBoxes.length - 1];
    if (lastToolBox) {
      if (result.error) {
        lastToolBox.classList.add('tool-error');
      }
      const statusSpan = lastToolBox.querySelector('.tool-status');
      if (statusSpan) {
        statusSpan.textContent = result.error ? 'Failed' : 'Success';
      }
      const content = lastToolBox.querySelector('.tool-content');
      if (content) {
        content.textContent += `\n\nOutput:\n${result.output}`;
      }
    }
    scrollToBottom();
  }

  function handleTurnStart(turn) {
    if (turn > 1) {
      if (currentRawAssistantText.trim()) {
        prepareAssistantMessage();
      }
    }
  }

  function renderHistoryList(sessions) {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No saved chats found.</div>';
      return;
    }

    sessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const top = document.createElement('div');
      top.className = 'history-item-top';

      const title = document.createElement('div');
      title.className = 'history-item-title';
      title.textContent = s.title || 'Untitled Session';

      const delBtn = document.createElement('button');
      delBtn.className = 'history-item-delete';
      delBtn.innerHTML = '×';
      delBtn.title = 'Delete chat session';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: 'deleteSession', id: s.id });
      };

      top.appendChild(title);
      top.appendChild(delBtn);

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';

      const badges = document.createElement('div');
      badges.className = 'history-item-badges';

      const modelBadge = document.createElement('span');
      modelBadge.className = 'history-model-badge';
      modelBadge.textContent = s.model || 'model';

      const countBadge = document.createElement('span');
      countBadge.className = 'history-msg-count';
      countBadge.textContent = `${s.messageCount || 0} msgs`;

      badges.appendChild(modelBadge);
      badges.appendChild(countBadge);

      const timeSpan = document.createElement('span');
      timeSpan.textContent = s.timeDisplay || '';

      meta.appendChild(badges);
      meta.appendChild(timeSpan);

      item.appendChild(top);
      item.appendChild(meta);

      item.onclick = () => {
        vscode.postMessage({ type: 'loadSession', id: s.id });
        historyDrawer?.classList.add('hidden');
      };

      historyList.appendChild(item);
    });
  }

  function loadConversationMessages(messages) {
    resetChatUI();
    if (!messages || messages.length === 0) return;

    if (emptyState) emptyState.classList.add('hidden');

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        appendUserMessage(msg.content);
      } else if (msg.role === 'assistant') {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message message-assistant';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = renderMarkdown(msg.content);
        attachCodeActionListeners(bubble);

        msgDiv.appendChild(bubble);
        chatMessages?.appendChild(msgDiv);
      } else if (msg.role === 'tool') {
        const toolBox = document.createElement('div');
        toolBox.className = 'tool-box';

        const header = document.createElement('div');
        header.className = 'tool-header';
        header.innerHTML = `<span>⚡ Tool Result</span><span class="tool-status">Completed</span>`;

        const content = document.createElement('div');
        content.className = 'tool-content';
        content.textContent = msg.content;

        header.addEventListener('click', () => {
          content.classList.toggle('hidden');
        });

        toolBox.appendChild(header);
        toolBox.appendChild(content);

        chatMessages?.appendChild(toolBox);
      }
    });

    scrollToBottom();
  }

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMarkdown(md) {
    if (!md) return '';

    // Extract code blocks first
    const codeBlocks = [];
    let formatted = md.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = codeBlocks.length;
      codeBlocks.push({ lang: lang || 'text', code });
      return `%%CODEBLOCK_${id}%%`;
    });

    // Inline formatting
    formatted = escapeHtml(formatted)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 4px;border-radius:3px;">$1</code>')
      .replace(/^### (.*$)/gim, '<h4 style="margin:8px 0 4px;font-size:13px;color:#818cf8;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="margin:10px 0 6px;font-size:14px;color:#a78bfa;">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 style="margin:12px 0 8px;font-size:15px;color:#c084fc;">$1</h2>')
      .replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left:16px;">$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    formatted = `<p>${formatted}</p>`;

    // Re-inject formatted code blocks
    codeBlocks.forEach((block, idx) => {
      const codeHtml = `<div class="code-block-wrapper">
        <div class="code-header">
          <span>${escapeHtml(block.lang)}</span>
          <div class="code-actions">
            <button class="code-action-btn copy-code" data-code="${encodeURIComponent(block.code)}">Copy</button>
            <button class="code-action-btn insert-code" data-code="${encodeURIComponent(block.code)}">Insert</button>
            <button class="code-action-btn apply-code" data-code="${encodeURIComponent(block.code)}">Apply</button>
          </div>
        </div>
        <pre><code class="language-${escapeHtml(block.lang)}">${escapeHtml(block.code)}</code></pre>
      </div>`;
      formatted = formatted.replace(`%%CODEBLOCK_${idx}%%`, codeHtml);
    });

    return formatted;
  }

  function attachCodeActionListeners(container) {
    container.querySelectorAll('.copy-code').forEach((btn) => {
      btn.onclick = () => {
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        navigator.clipboard.writeText(code);
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 1500);
      };
    });

    container.querySelectorAll('.insert-code').forEach((btn) => {
      btn.onclick = () => {
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        vscode.postMessage({ type: 'insertCode', code });
      };
    });

    container.querySelectorAll('.apply-code').forEach((btn) => {
      btn.onclick = () => {
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        vscode.postMessage({ type: 'applyCode', code });
      };
    });
  }

  // Handle messages from Extension Host
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'init': {
        if (autonomousToggle && msg.autonomous !== undefined) {
          autonomousToggle.checked = msg.autonomous;
        }
        break;
      }

      case 'models': {
        if (modelSelect) {
          modelSelect.innerHTML = '';
          const models = msg.models || [];
          const running = msg.runningModels || [];

          if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">No Ollama models found</option>';
            statusDot?.classList.remove('online');
            if (statusIndicator) statusIndicator.title = 'No models found';
          } else {
            models.forEach((m) => {
              const opt = document.createElement('option');
              opt.value = m.name;
              const isRunning = running.includes(m.name);
              opt.textContent = isRunning ? `⚡ ${m.name} (Active in RAM)` : m.name;
              if (m.name === msg.selectedModel) {
                opt.selected = true;
              }
              modelSelect.appendChild(opt);
            });
            statusDot?.classList.add('online');
            if (statusIndicator) statusIndicator.title = `Connected to Ollama (${models.length} models)`;
          }
        }
        break;
      }

      case 'status': {
        if (statusDot) {
          if (msg.online) {
            statusDot.classList.add('online');
            if (statusIndicator) statusIndicator.title = `Connected: ${msg.endpoint}`;
          } else {
            statusDot.classList.remove('online');
            if (statusIndicator) statusIndicator.title = `Disconnected: ${msg.error || msg.endpoint}`;
          }
        }
        break;
      }

      case 'context': {
        activeContext = msg.context;
        if (activeContext && contextBanner) {
          if (activeFileName) activeFileName.textContent = activeContext.fileName || 'Active File';
          if (activeSelectionInfo) {
            activeSelectionInfo.textContent = activeContext.selection
              ? `(Lines ${activeContext.startLine}-${activeContext.endLine})`
              : `(${activeContext.languageId})`;
          }
          contextBanner.classList.remove('hidden');
        }
        break;
      }

      case 'sessions': {
        savedSessions = msg.sessions || [];
        renderHistoryList(savedSessions);
        break;
      }

      case 'loadConversation': {
        loadConversationMessages(msg.messages);
        break;
      }

      case 'turnStart': {
        handleTurnStart(msg.turn);
        break;
      }

      case 'thinking': {
        handleThinking(msg.thought);
        break;
      }

      case 'token': {
        handleToken(msg.token);
        break;
      }

      case 'toolStart': {
        handleToolStart(msg.toolCall);
        break;
      }

      case 'toolResult': {
        handleToolResult(msg.result);
        break;
      }

      case 'complete': {
        setStreamingState(false);
        const placeholder = currentAssistantBubble?.querySelector('.loading-placeholder');
        if (placeholder) {
          placeholder.remove();
        }
        if (currentAssistantBubble && !currentRawAssistantText.trim()) {
          currentAssistantBubble.innerHTML = '<span style="color:#10b981;font-size:11.5px;">✓ Action completed successfully.</span>';
        }
        currentAssistantBubble = null;
        currentThinkingBox = null;
        break;
      }

      case 'error': {
        setStreamingState(false);
        if (currentAssistantBubble) {
          const placeholder = currentAssistantBubble.querySelector('.loading-placeholder');
          if (placeholder) placeholder.remove();
          currentAssistantBubble.innerHTML += `<div style="color:#ef4444;margin-top:8px;font-weight:600;">⚠️ Error: ${escapeHtml(msg.error)}</div>`;
        }
        currentAssistantBubble = null;
        currentThinkingBox = null;
        break;
      }
    }
  });
})();
