// net.js — transport for world snapshots. Works in two environments:
//   • VS Code webview  -> receive via window 'message' (host uses postMessage)
//   • standalone web   -> Server-Sent Events from the Node server
// The same front-end code runs unchanged in both.

export function connect(onWorld, onStatus) {
  const inVsCode = typeof acquireVsCodeApi !== 'undefined';

  if (inVsCode) {
    const vscode = window.__vscode || (window.__vscode = acquireVsCodeApi());
    window.addEventListener('message', (e) => {
      const m = e.data;
      if (m && m.type === 'world') { onStatus && onStatus(true); onWorld(m.data); }
    });
    onStatus && onStatus(true);
    try { vscode.postMessage({ type: 'ready' }); } catch {}
    return () => {};
  }

  // standalone: EventSource auto-reconnects on drop
  let es;
  const open = () => {
    es = new EventSource('/events');
    es.onopen = () => onStatus && onStatus(true);
    es.onmessage = (e) => { try { onWorld(JSON.parse(e.data)); } catch {} };
    es.onerror = () => onStatus && onStatus(false);
  };
  open();
  return () => es && es.close();
}
