/**
 * Content Script
 * Gathers DOM script elements, inline scripts, rendered HTML, and performance timing entries
 */
(() => {
  if (window.__HARVESTER_CONTENT_SCRIPT_LOADED__) return;
  window.__HARVESTER_CONTENT_SCRIPT_LOADED__ = true;

  // Extract page data function
  window.__extractHarvesterData = function() {
    let doctypeStr = '<!DOCTYPE html>';
    if (document.doctype) {
      doctypeStr = '<!DOCTYPE ' + document.doctype.name +
        (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
        (!document.doctype.publicId && document.doctype.systemId ? ' SYSTEM' : '') +
        (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') +
        '>';
    }
    const renderedHtml = `${doctypeStr}\n${document.documentElement ? document.documentElement.outerHTML : ''}`;

    // Script elements in DOM
    const scriptElements = Array.from(document.querySelectorAll('script'));
    const domScripts = scriptElements.map((el, idx) => {
      const src = el.src || el.getAttribute('src');
      const content = el.textContent || el.innerHTML || '';
      let resolvedUrl = '';
      if (src) {
        try {
          resolvedUrl = new URL(src, document.baseURI || location.href).href;
        } catch (e) {
          resolvedUrl = src;
        }
      }
      return {
        index: idx,
        id: el.id || null,
        type: resolvedUrl ? 'external' : 'inline',
        url: resolvedUrl,
        rawSrc: el.getAttribute('src') || null,
        content: resolvedUrl ? '' : content,
        charCount: resolvedUrl ? 0 : content.length,
        isModule: el.type === 'module',
        isAsync: Boolean(el.async),
        isDefer: Boolean(el.defer),
        noModule: Boolean(el.noModule),
        integrity: el.getAttribute('integrity') || null,
        crossOrigin: el.getAttribute('crossorigin') || null,
        location: el.closest('head') ? 'head' : (el.closest('body') ? 'body' : 'other')
      };
    });

    // Resource Timing API scripts
    let perfScripts = [];
    try {
      perfScripts = performance.getEntriesByType('resource')
        .filter(r => r.initiatorType === 'script' || /\.(js|mjs|cjs)(\?.*)?$/i.test(r.name))
        .map(r => ({
          url: r.name,
          duration: Math.round(r.duration || 0),
          transferSize: r.transferSize || 0,
          decodedBodySize: r.decodedBodySize || 0
        }));
    } catch (e) {}

    return {
      success: true,
      pageUrl: window.location.href,
      pageTitle: document.title || window.location.hostname,
      baseUri: document.baseURI,
      renderedHtml: renderedHtml,
      domScripts: domScripts,
      perfScripts: perfScripts,
      timestamp: Date.now()
    };
  };

  // Message listener for popup & background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_PAGE_DATA') {
      try {
        const data = window.__extractHarvesterData();
        sendResponse(data);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return false;
  });
})();
