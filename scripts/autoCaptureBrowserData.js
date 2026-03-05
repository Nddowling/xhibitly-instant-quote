/**
 * Auto-Capture Browser Console Data
 *
 * SETUP:
 * 1. Open your browser console (F12)
 * 2. Copy and paste this entire script into the console
 * 3. The script will automatically capture GraphQL responses
 * 4. Click "Download All Data" button when you're done
 *
 * FEATURES:
 * - Automatically intercepts fetch/XHR requests
 * - Captures crashGameList responses
 * - Shows a floating button with capture count
 * - One-click download of all captured data
 */

(function() {
  'use strict';

  // Storage for captured data
  window.capturedCrashData = window.capturedCrashData || [];
  let captureCount = 0;

  // Create floating UI
  function createUI() {
    // Remove existing UI if present
    const existing = document.getElementById('crash-data-capturer');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'crash-data-capturer';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-width: 200px;
      cursor: move;
    `;

    container.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: 600; font-size: 14px;">
        📊 Auto Capture Active
      </div>
      <div id="capture-count" style="font-size: 24px; font-weight: 700; margin-bottom: 10px;">
        0 captured
      </div>
      <button id="download-btn" style="
        width: 100%;
        padding: 10px;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 5px;
        transition: transform 0.1s;
      ">
        ⬇️ Download All
      </button>
      <button id="clear-btn" style="
        width: 100%;
        padding: 8px;
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: transform 0.1s;
      ">
        🗑️ Clear Data
      </button>
      <button id="stop-btn" style="
        width: 100%;
        padding: 8px;
        background: rgba(255,77,77,0.8);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        margin-top: 5px;
        transition: transform 0.1s;
      ">
        ⏹️ Stop Capture
      </button>
    `;

    document.body.appendChild(container);

    // Make draggable
    let isDragging = false;
    let currentX, currentY, initialX, initialY;

    container.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      initialX = e.clientX - container.offsetLeft;
      initialY = e.clientY - container.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      container.style.left = currentX + 'px';
      container.style.top = currentY + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Button hover effects
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.05)');
      btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    });

    // Download button
    document.getElementById('download-btn').addEventListener('click', downloadData);

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm(`Clear ${window.capturedCrashData.length} captured items?`)) {
        window.capturedCrashData = [];
        captureCount = 0;
        updateUI();
        console.log('✓ Cleared all captured data');
      }
    });

    // Stop button
    document.getElementById('stop-btn').addEventListener('click', () => {
      if (confirm('Stop auto-capture and remove UI?')) {
        stopCapture();
      }
    });
  }

  function updateUI() {
    const countEl = document.getElementById('capture-count');
    if (countEl) {
      countEl.textContent = `${captureCount} captured`;
    }
  }

  function downloadData() {
    if (window.capturedCrashData.length === 0) {
      alert('No data captured yet!');
      return;
    }

    // Merge all captured responses
    const allGames = [];
    const seenIds = new Set();

    window.capturedCrashData.forEach(response => {
      let games = [];

      if (response.data?.crashGameList) {
        games = response.data.crashGameList;
      } else if (response.crashGameList) {
        games = response.crashGameList;
      } else if (Array.isArray(response)) {
        games = response;
      }

      games.forEach(game => {
        if (!seenIds.has(game.id)) {
          seenIds.add(game.id);
          allGames.push(game);
        }
      });
    });

    const output = {
      data: {
        crashGameList: allGames
      },
      _meta: {
        totalGames: allGames.length,
        totalResponses: window.capturedCrashData.length,
        capturedAt: new Date().toISOString()
      }
    };

    // Create download
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.href = url;
    a.download = `crash_data_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✓ Downloaded ${allGames.length} unique games from ${window.capturedCrashData.length} responses`);
  }

  function stopCapture() {
    const container = document.getElementById('crash-data-capturer');
    if (container) container.remove();

    // Restore original fetch
    if (window._originalFetch) {
      window.fetch = window._originalFetch;
    }

    console.log('✓ Auto-capture stopped');
    console.log(`Captured data is still available in window.capturedCrashData (${window.capturedCrashData.length} items)`);
  }

  // Intercept fetch requests
  const originalFetch = window.fetch;
  window._originalFetch = originalFetch;

  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    // Clone the response so we can read it twice
    const clonedResponse = response.clone();

    // Try to parse as JSON
    try {
      const data = await clonedResponse.json();

      // Check if it's crash game data
      if (data.data?.crashGameList || data.crashGameList) {
        window.capturedCrashData.push(data);
        captureCount++;
        updateUI();

        const gameCount = (data.data?.crashGameList || data.crashGameList).length;
        console.log(`✓ Auto-captured response #${captureCount} (${gameCount} games)`);
      }
    } catch (e) {
      // Not JSON or not crash data, ignore
    }

    return response;
  };

  // Also intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const data = JSON.parse(this.responseText);

        if (data.data?.crashGameList || data.crashGameList) {
          window.capturedCrashData.push(data);
          captureCount++;
          updateUI();

          const gameCount = (data.data?.crashGameList || data.crashGameList).length;
          console.log(`✓ Auto-captured XHR #${captureCount} (${gameCount} games)`);
        }
      } catch (e) {
        // Not JSON or not crash data, ignore
      }
    });

    return originalSend.apply(this, args);
  };

  // Initialize UI
  createUI();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          🚀 AUTO-CAPTURE ACTIVATED                       ║
╚═══════════════════════════════════════════════════════════╝

✓ Intercepting all fetch/XHR requests
✓ Will auto-capture crashGameList responses
✓ Floating UI added (bottom-right, draggable)

📝 Commands available:
   - Click "Download All" button to save captured data
   - window.capturedCrashData - array of all captured responses
   - Click "Stop Capture" to stop and remove UI

🎯 Just browse normally and data will be captured automatically!
  `);

})();
