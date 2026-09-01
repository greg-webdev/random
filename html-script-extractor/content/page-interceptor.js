/**
 * Page Interceptor (Runs in MAIN execution world at document_start)
 * Intercepts dynamic script creation, workers, fetch/XHR scripts, and document.write
 */
(() => {
  if (window.__HARVESTER_INTERCEPTOR_INSTALLED__) return;
  window.__HARVESTER_INTERCEPTOR_INSTALLED__ = true;

  const reportedUrls = new Set();
  const reportedInlines = new Set();

  function reportScript(data) {
    try {
      if (data.type === 'inline' || data.content) {
        const hash = data.content ? data.content.slice(0, 100) + '_' + data.content.length : Math.random().toString();
        if (reportedInlines.has(hash)) return;
        reportedInlines.add(hash);
      } else if (data.url) {
        if (reportedUrls.has(data.url)) return;
        reportedUrls.add(data.url);
      }

      window.dispatchEvent(new CustomEvent('__HARVESTER_SCRIPT_DETECTED__', {
        detail: {
          ...data,
          timestamp: Date.now()
        }
      }));
    } catch (e) {
      // Ignore serialization or event errors
    }
  }

  // 1. Hook document.createElement for <script>
  const origCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function(tagName, options) {
    const el = origCreateElement.call(this, tagName, options);
    if (typeof tagName === 'string' && tagName.toLowerCase() === 'script') {
      try {
        let capturedSrc = '';
        let capturedContent = '';

        // Monitor properties
        const srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (srcDesc && srcDesc.set) {
          // Wrapped dynamically per instance if needed
        }

        // Mutation listener when script is modified
        const notifyIfReady = () => {
          const src = el.src || el.getAttribute('src');
          const content = el.textContent || el.innerHTML || '';
          if (src && src !== capturedSrc) {
            capturedSrc = src;
            reportScript({
              category: 'dynamic_element',
              type: 'external',
              url: src,
              async: el.async,
              defer: el.defer,
              module: el.type === 'module'
            });
          } else if (!src && content && content !== capturedContent && content.trim().length > 0) {
            capturedContent = content;
            reportScript({
              category: 'dynamic_element',
              type: 'inline',
              content: content,
              module: el.type === 'module'
            });
          }
        };

        // Check attributes immediately or when appended
        setTimeout(notifyIfReady, 0);
        setTimeout(notifyIfReady, 100);
      } catch (err) {}
    }
    return el;
  };

  // 2. Hook document.write and document.writeln
  const origWrite = Document.prototype.write;
  Document.prototype.write = function(...args) {
    try {
      const html = args.join('');
      const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const attrs = match[1];
        const inlineCode = match[2];
        const srcMatch = /src=["']([^"']+)["']/i.exec(attrs);
        if (srcMatch && srcMatch[1]) {
          reportScript({
            category: 'document_write',
            type: 'external',
            url: new URL(srcMatch[1], document.baseURI || location.href).href
          });
        } else if (inlineCode.trim()) {
          reportScript({
            category: 'document_write',
            type: 'inline',
            content: inlineCode
          });
        }
      }
    } catch (e) {}
    return origWrite.apply(this, args);
  };

  const origWriteln = Document.prototype.writeln;
  Document.prototype.writeln = function(...args) {
    try {
      this.write(...args);
    } catch (e) {}
    return origWriteln.apply(this, args);
  };

  // 3. Hook Web Workers & SharedWorkers
  if (typeof window.Worker !== 'undefined') {
    const OrigWorker = window.Worker;
    window.Worker = function(scriptURL, options) {
      try {
        const fullUrl = new URL(scriptURL, location.href).href;
        reportScript({
          category: 'worker',
          type: 'external',
          url: fullUrl,
          workerType: 'WebWorker',
          options: options
        });
      } catch (e) {}
      return new OrigWorker(scriptURL, options);
    };
    window.Worker.prototype = OrigWorker.prototype;
  }

  if (typeof window.SharedWorker !== 'undefined') {
    const OrigSharedWorker = window.SharedWorker;
    window.SharedWorker = function(scriptURL, options) {
      try {
        const fullUrl = new URL(scriptURL, location.href).href;
        reportScript({
          category: 'worker',
          type: 'external',
          url: fullUrl,
          workerType: 'SharedWorker',
          options: options
        });
      } catch (e) {}
      return new OrigSharedWorker(scriptURL, options);
    };
    window.SharedWorker.prototype = OrigSharedWorker.prototype;
  }

  // 4. Hook Service Worker Registration
  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    const origRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function(scriptURL, options) {
      try {
        const fullUrl = new URL(scriptURL, location.href).href;
        reportScript({
          category: 'service_worker',
          type: 'external',
          url: fullUrl,
          scope: options ? options.scope : undefined
        });
      } catch (e) {}
      return origRegister.apply(this, arguments);
    };
  }

  // 5. Hook window.fetch for JS files or script requests
  if (window.fetch) {
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        let url = '';
        if (typeof input === 'string') {
          url = input;
        } else if (input && input.url) {
          url = input.url;
        }

        if (url) {
          const resolvedUrl = new URL(url, location.href).href;
          const isJs = /\.(js|mjs|cjs|ts|jsx|tsx)(\?.*)?$/i.test(resolvedUrl);
          const isScriptDest = init && (init.destination === 'script' || (init.headers && JSON.stringify(init.headers).includes('javascript')));
          
          if (isJs || isScriptDest) {
            reportScript({
              category: 'fetch_api',
              type: 'external',
              url: resolvedUrl,
              method: (init && init.method) || 'GET'
            });
          }
        }
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }

  // 6. Hook XMLHttpRequest
  if (window.XMLHttpRequest) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      try {
        if (url) {
          const resolvedUrl = new URL(url, location.href).href;
          if (/\.(js|mjs|cjs|ts|jsx|tsx)(\?.*)?$/i.test(resolvedUrl)) {
            reportScript({
              category: 'xhr_request',
              type: 'external',
              url: resolvedUrl,
              method: method
            });
          }
        }
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };
  }
})();
