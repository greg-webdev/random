// client.js - LiveCanvas Real-time Client Engine

(function () {
  // DOM Elements
  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d');
  const cursorOverlay = document.getElementById('cursorOverlay');
  const lanAddress = document.getElementById('lanAddress');
  const shareLanBtn = document.getElementById('shareLanBtn');
  const copyHint = document.getElementById('copyHint');
  const userCountText = document.getElementById('userCountText');
  const usernameInput = document.getElementById('usernameInput');
  const myColorDot = document.getElementById('myColorDot');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValueText = document.getElementById('sizeValueText');
  const sizeIndicatorDot = document.getElementById('sizeIndicatorDot');
  const customColorPicker = document.getElementById('customColorPicker');
  const activityFeed = document.getElementById('activityFeed');
  const connectionBanner = document.getElementById('connectionBanner');
  const connectionText = document.getElementById('connectionText');

  // App State
  let ws = null;
  let selfUser = {
    clientId: '',
    username: 'Painter',
    color: '#3b82f6',
  };

  let currentTool = 'pen'; // 'pen', 'highlighter', 'eraser', 'ping'
  let currentColor = '#3b82f6';
  let currentSize = 6;

  let isDrawing = false;
  let currentStrokePoints = [];
  let strokesHistory = [];

  const remoteCursors = new Map(); // clientId -> DOM Element
  let fullShareUrl = '';

  // Audio Synth for Sonar Ping
  const audioCtx = window.AudioContext ? new AudioContext() : null;

  function playPingSound() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // Ignore audio policy limits
    }
  }

  // Canvas High-DPI Setup
  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(dpr, dpr);
    redrawAllStrokes();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- WebSocket Connection & Handlers ---
  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    connectionBanner.classList.remove('hidden');
    connectionText.textContent = 'Connecting to LiveCanvas server...';

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connectionBanner.classList.add('hidden');
      showToast('Connected to LiveCanvas board! 🎨');
    };

    ws.onclose = () => {
      connectionBanner.classList.remove('hidden');
      connectionText.textContent = 'Disconnected. Reconnecting in 2 seconds...';
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = () => {
      connectionBanner.classList.remove('hidden');
      connectionText.textContent = 'Server connection error.';
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  }

  function handleServerMessage(data) {
    switch (data.type) {
      case 'init': {
        selfUser = data.self;
        currentColor = selfUser.color;
        usernameInput.value = selfUser.username;
        myColorDot.style.backgroundColor = selfUser.color;
        updateUserCount(data.onlineCount);

        // Update active palette swatch
        document.querySelectorAll('.color-swatch').forEach(swatch => {
          if (swatch.getAttribute('data-color') === selfUser.color) {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
          }
        });

        // Set share URL
        fullShareUrl = `http://${data.localIp}:${data.port}`;
        lanAddress.textContent = fullShareUrl;

        // Render existing strokes
        strokesHistory = data.history || [];
        redrawAllStrokes();
        break;
      }

      case 'user_joined': {
        updateUserCount(data.onlineCount);
        showToast(`👋 ${data.user.username} joined the board!`);
        break;
      }

      case 'user_left': {
        updateUserCount(data.onlineCount);
        showToast(`👋 ${data.username} left`);
        removeCursor(data.clientId);
        break;
      }

      case 'user_updated': {
        if (data.user.clientId === selfUser.clientId) {
          selfUser = data.user;
        } else {
          updateCursorInfo(data.user);
        }
        break;
      }

      case 'cursor': {
        updateRemoteCursor(data);
        break;
      }

      case 'draw_segment': {
        renderSegment(data.segment);
        break;
      }

      case 'draw_stroke': {
        strokesHistory.push(data.stroke);
        renderCompleteStroke(data.stroke);
        break;
      }

      case 'sync_history': {
        strokesHistory = data.history || [];
        redrawAllStrokes();
        break;
      }

      case 'clear': {
        strokesHistory = [];
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        showToast(`🧹 ${data.username} cleared the canvas`);
        break;
      }

      case 'ping': {
        showSonarPing(data.x, data.y, data.username, data.color);
        break;
      }

      case 'chat': {
        showFloatingReaction(data.text, data.x || window.innerWidth / 2, data.y || window.innerHeight / 2);
        showToast(`${data.username}: ${data.text}`);
        break;
      }
    }
  }

  function updateUserCount(count) {
    if (userCountText) {
      userCountText.textContent = `${count} Online`;
    }
  }

  // --- Remote Cursor Rendering ---
  function updateRemoteCursor(data) {
    let cursorElem = remoteCursors.get(data.clientId);

    if (!cursorElem) {
      cursorElem = document.createElement('div');
      cursorElem.className = 'live-cursor';
      cursorElem.innerHTML = `
        <svg class="cursor-pointer" viewBox="0 0 24 24">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86a.5.5 0 0 0-.85.35z"/>
        </svg>
        <span class="cursor-badge">${escapeHtml(data.username)}</span>
      `;
      cursorOverlay.appendChild(cursorElem);
      remoteCursors.set(data.clientId, cursorElem);
    }

    cursorElem.style.setProperty('--user-color', data.color || '#6366f1');
    cursorElem.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;

    const badge = cursorElem.querySelector('.cursor-badge');
    if (badge && badge.textContent !== data.username) {
      badge.textContent = data.username;
    }
  }

  function updateCursorInfo(user) {
    const cursorElem = remoteCursors.get(user.clientId);
    if (cursorElem) {
      cursorElem.style.setProperty('--user-color', user.color);
      const badge = cursorElem.querySelector('.cursor-badge');
      if (badge) badge.textContent = user.username;
    }
  }

  function removeCursor(clientId) {
    const cursorElem = remoteCursors.get(clientId);
    if (cursorElem) {
      cursorElem.remove();
      remoteCursors.delete(clientId);
    }
  }

  // --- Drawing Engine ---
  function getCanvasPos(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX, y: clientY };
  }

  function startDrawing(e) {
    if (e.button !== 0 && !e.touches) return; // Only left click for drawing
    if (currentTool === 'ping') {
      const pos = getCanvasPos(e);
      triggerPing(pos.x, pos.y);
      return;
    }

    isDrawing = true;
    const pos = getCanvasPos(e);
    currentStrokePoints = [pos];

    // Initial point
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, currentSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = currentTool === 'eraser' ? '#09090b' : currentColor;
    if (currentTool === 'highlighter') {
      ctx.fillStyle = hexToRgba(currentColor, 0.4);
    }
    ctx.fill();
  }

  function handlePointerMove(e) {
    const pos = getCanvasPos(e);

    // Send cursor position (throttled)
    sendCursorPosition(pos.x, pos.y);

    if (!isDrawing) return;

    const prevPoint = currentStrokePoints[currentStrokePoints.length - 1];
    currentStrokePoints.push(pos);

    // Live segment
    const segment = {
      x1: prevPoint.x,
      y1: prevPoint.y,
      x2: pos.x,
      y2: pos.y,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
    };

    renderSegment(segment);
    sendSegment(segment);
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentStrokePoints.length > 0) {
      const stroke = {
        points: currentStrokePoints,
        color: currentColor,
        size: currentSize,
        tool: currentTool,
      };

      strokesHistory.push(stroke);
      sendStroke(stroke);
    }

    currentStrokePoints = [];
  }

  function renderSegment(seg) {
    ctx.save();
    ctx.beginPath();

    if (seg.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = seg.size * 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (seg.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hexToRgba(seg.color, 0.35);
      ctx.lineWidth = seg.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = seg.size;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.restore();
  }

  function renderCompleteStroke(stroke) {
    if (!stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.beginPath();

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.size * 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hexToRgba(stroke.color, 0.35);
      ctx.lineWidth = stroke.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const points = stroke.points;
    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        // Smooth bezier interpolation
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function redrawAllStrokes() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    strokesHistory.forEach(renderCompleteStroke);
  }

  // --- Network Event Dispatchers ---
  let lastCursorSendTime = 0;
  function sendCursorPosition(x, y) {
    const now = performance.now();
    if (now - lastCursorSendTime < 30) return; // ~33fps broadcast rate
    lastCursorSendTime = now;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'cursor',
        x: Math.round(x),
        y: Math.round(y),
      }));
    }
  }

  function sendSegment(segment) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'draw_segment',
        segment,
      }));
    }
  }

  function sendStroke(stroke) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'draw_stroke',
        stroke,
      }));
    }
  }

  // --- Sonar Ping Feature ---
  function triggerPing(x, y) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
        x: Math.round(x),
        y: Math.round(y),
      }));
    }
  }

  function showSonarPing(x, y, username, color) {
    playPingSound();

    const pingElem = document.createElement('div');
    pingElem.className = 'sonar-ping';
    pingElem.style.left = x + 'px';
    pingElem.style.top = y + 'px';
    pingElem.style.setProperty('--ping-color', color || '#f59e0b');

    pingElem.innerHTML = `
      <div class="sonar-ring"></div>
      <div class="sonar-ring"></div>
      <div class="sonar-ring"></div>
      <span class="sonar-label">🎯 ${escapeHtml(username)}</span>
    `;

    cursorOverlay.appendChild(pingElem);
    setTimeout(() => pingElem.remove(), 2000);
  }

  // --- Floating Emoji Reactions ---
  function triggerReaction(emoji) {
    const x = window.innerWidth / 2 + (Math.random() * 120 - 60);
    const y = window.innerHeight / 2 + 100;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat',
        text: emoji,
        x,
        y,
      }));
    }
  }

  function showFloatingReaction(emoji, x, y) {
    const rx = document.createElement('div');
    rx.className = 'floating-emoji';
    rx.textContent = emoji;
    rx.style.left = x + 'px';
    rx.style.top = y + 'px';

    cursorOverlay.appendChild(rx);
    setTimeout(() => rx.remove(), 2000);
  }

  // --- Event Listeners ---

  // Mouse & Touch events
  canvas.addEventListener('mousedown', startDrawing);
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', stopDrawing);

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDrawing(e);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handlePointerMove(e);
  }, { passive: false });

  window.addEventListener('touchend', stopDrawing);

  // Right click anywhere to Ping!
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    triggerPing(pos.x, pos.y);
  });

  // Hotkeys
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'p' || e.key === 'P') {
      selectTool('pen');
    } else if (e.key === 'h' || e.key === 'H') {
      selectTool('highlighter');
    } else if (e.key === 'e' || e.key === 'E') {
      selectTool('eraser');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      triggerUndo();
    }
  });

  // Tool Buttons
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      selectTool(tool);
    });
  });

  function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    const targetBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (tool === 'eraser') {
      canvas.style.cursor = 'cell';
    } else if (tool === 'ping') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }

  // Color Swatches
  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const col = swatch.getAttribute('data-color');
      setColor(col);
      document.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });

  customColorPicker?.addEventListener('input', (e) => {
    setColor(e.target.value);
    document.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
  });

  function setColor(col) {
    currentColor = col;
    if (currentTool === 'eraser') {
      selectTool('pen');
    }
    updateProfile({ color: col });
    sizeIndicatorDot.style.backgroundColor = col;
    myColorDot.style.backgroundColor = col;
  }

  // Brush Size
  sizeSlider?.addEventListener('input', (e) => {
    currentSize = parseInt(e.target.value, 10);
    sizeValueText.textContent = `${currentSize}px`;
    sizeIndicatorDot.style.width = Math.max(currentSize, 4) + 'px';
    sizeIndicatorDot.style.height = Math.max(currentSize, 4) + 'px';
  });

  // User Profile Name Editing
  usernameInput?.addEventListener('change', (e) => {
    const newName = e.target.value.trim() || 'Painter';
    e.target.value = newName;
    updateProfile({ username: newName });
    showToast(`Updated display name to ${newName}`);
  });

  function updateProfile(patch) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'update_profile',
        ...patch,
      }));
    }
  }

  // Top Controls
  undoBtn?.addEventListener('click', triggerUndo);

  function triggerUndo() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'undo' }));
    }
  }

  clearBtn?.addEventListener('click', () => {
    if (confirm('Clear the entire board for everyone?')) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'clear' }));
      }
    }
  });

  saveBtn?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `livecanvas-artwork-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Saved artwork to your downloads! 🖼️');
  });

  // Local Network Share Pill
  shareLanBtn?.addEventListener('click', () => {
    const targetUrl = fullShareUrl || `http://${location.host}`;
    navigator.clipboard.writeText(targetUrl).then(() => {
      copyHint.textContent = '✓ Copied!';
      copyHint.style.background = 'rgba(16, 185, 129, 0.4)';
      showToast(`Copied LAN URL (${targetUrl}) to clipboard!`);
      setTimeout(() => {
        copyHint.textContent = 'Copy';
        copyHint.style.background = 'rgba(16, 185, 129, 0.25)';
      }, 2000);
    });
  });

  // Reaction Bar
  document.querySelectorAll('.rx-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      triggerReaction(emoji);
    });
  });

  // Toast System
  function showToast(message) {
    if (!activityFeed) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    activityFeed.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Utilities
  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start connection
  connectWebSocket();
})();
