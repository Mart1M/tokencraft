import type {
  CollectionSyncStatus,
  FigmaOnlyCollection,
  ImportSummary,
  TokenCraftWorkspace,
  ToMain,
  ToUi,
} from "./protocol";

const rootElement = document.getElementById("app");
const TOKENCRAFT_BRIDGE_URL = "ws://localhost:4288";

if (!rootElement) throw new Error("TokenCraft Figma plugin root is missing.");
const root = rootElement;

let workspace: TokenCraftWorkspace | null = null;
let socket: WebSocket | null = null;
let isConnected = false;
let statuses = new Map<string, CollectionSyncStatus>();
let figmaOnlyCollections: FigmaOnlyCollection[] = [];
let importSummary: ImportSummary | undefined;

function post(message: ToMain) {
  parent.postMessage({ pluginMessage: message }, "*");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character] ?? character);
}

function setMessage(message: string) {
  const element = document.getElementById("message");
  if (element) {
    element.textContent = message;
    element.parentElement?.classList.toggle("has-message", Boolean(message));
  }
}

function syncCollections() {
  if (!workspace) return;
  post({ type: "inspect-collections", tokens: workspace.tokens, collections: workspace.collections });
}

function statusLabel(status: CollectionSyncStatus | undefined) {
  if (!status) return "Checking";
  if (status.state === "not-imported") return "Not in Figma";
  if (status.state === "out-of-sync") return "Needs sync";
  return "Sync";
}

function collectionAction(status: CollectionSyncStatus | undefined) {
  if (!status) return { label: "Checking…", disabled: true };
  if (status.state === "not-imported") return { label: "Import", disabled: false };
  if (status.state === "out-of-sync") return { label: "Synchronize", disabled: false };
  return { label: "Sync", disabled: true };
}

function render() {
  const collectionMarkup = workspace
    ? workspace.collections.map((collection) => {
        const status = statuses.get(collection.id);
        const action = collectionAction(status);
        return `
          <div class="collection-card">
            <div class="collection-copy">
              <div class="collection-title"><strong>${escapeHtml(collection.name)}</strong><span class="status-badge ${status?.state ?? "checking"}">${statusLabel(status)}</span></div>
            </div>
            <button class="button ${status?.state === "not-imported" ? "button-primary" : "button-secondary"}" data-collection-id="${escapeHtml(collection.id)}" type="button" ${action.disabled ? "disabled" : ""}>${action.label}</button>
          </div>`;
      }).join("")
    : "";
  const summaryIssues = importSummary
    ? [
        ...importSummary.skipped.map((item) => `${item.token}: ${item.reason}`),
        ...importSummary.errors,
      ]
    : [];
  const summaryMarkup = importSummary
    ? `<div class="summary"><strong>Import complete</strong> — ${importSummary.created} created, ${importSummary.updated} updated, ${importSummary.aliased} aliases linked.${summaryIssues.length ? `<ul>${summaryIssues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>` : ""}</div>`
    : "";
  const figmaOnlyMarkup = figmaOnlyCollections.length
    ? `
      <div class="section-title figma-only-title"><h2>In Figma only</h2></div>
      <div class="collections">
        ${figmaOnlyCollections.map((collection) => `
          <div class="collection-card">
            <div class="collection-copy">
              <div class="collection-title"><strong>${escapeHtml(collection.name)}</strong><span class="status-badge not-imported">Figma only</span></div>
            </div>
            <button class="button button-primary" data-figma-collection-id="${escapeHtml(collection.id)}" type="button">Export</button>
          </div>`).join("")}
      </div>`
    : "";

  root.innerHTML = `
    <header class="header">
      <div class="logo" aria-hidden="true">
        <svg width="15" height="17" viewBox="0 0 21 24" fill="none"><path d="M19.6184 5.17157L21 5.95306V18.0469L19.6202 18.8271L19.6204 18.8273L10.4999 24L1.37963 18.8273L1.37985 18.8271L0 18.0469V5.95306L1.3814 5.17157L10.4999 0L19.6184 5.17157ZM2.25998 6.79059L1.81294 7.04341V16.9564L10.4999 21.8826L18.7398 17.2094L19.1871 16.9564V7.04341L18.7398 6.79059L10.4999 2.1172L2.25998 6.79059ZM6.35836 10.6653C6.22802 11.0872 6.15653 11.5354 6.15653 11.9999L6.15763 12.1002C6.20329 14.2007 7.67969 15.9405 9.63126 16.345V19.3616L3.55042 15.9119V9.07272L6.35836 10.6653ZM17.4496 15.9119L11.3687 19.3616V16.345C13.3203 15.9405 14.7967 14.2007 14.8424 12.1002L14.8435 11.9999C14.8435 11.5353 14.7711 11.0872 14.6408 10.6653L17.4496 9.07272V15.9119ZM16.5292 7.56486L13.7974 9.11429C13.0264 8.19699 11.8936 7.60354 10.6234 7.56734L10.4999 7.56576C9.17962 7.56578 7.9974 8.16716 7.20154 9.11429L4.46995 7.56486L10.4999 4.14561L16.5292 7.56486ZM13.1027 12.1368C13.0329 13.5426 11.8942 14.6605 10.4999 14.6605C9.10558 14.6604 7.96711 13.5426 7.89732 12.1368L7.89378 11.9999C7.89379 11.5296 8.01249 11.0902 8.22043 10.7087L8.30962 10.558C8.77479 9.82327 9.58241 9.33935 10.4999 9.33932L10.5913 9.3409C11.5317 9.37396 12.347 9.91582 12.7793 10.7087L12.8533 10.8542C13.0154 11.2003 13.106 11.5883 13.106 11.9999L13.1027 12.1368Z" fill="white"/></svg>
      </div>
      <div class="brand"><h1>Tokencraft</h1></div>
      <span class="status-dot ${isConnected ? "connected" : ""}" title="${isConnected ? "Connected" : "Not connected"}"></span>
    </header>
    <main>
      <section class="connection-panel">
        <div><span class="eyebrow">Active workspace</span><strong>${workspace ? escapeHtml(workspace.rootPath) : "Open a workspace in TokenCraft"}</strong></div>
        <button class="button button-secondary" id="connect" type="button">${isConnected ? "Reconnect" : "Connect"}</button>
      </section>
      <div class="section-title"><h2>Collections</h2>${workspace ? `<button class="text-button" id="check" type="button">Refresh</button>` : ""}</div>
      ${workspace
        ? `<div class="collections">${collectionMarkup}</div>`
        : `<div class="empty">Open a workspace in TokenCraft.</div>`}
      ${summaryMarkup}
      ${figmaOnlyMarkup}
    </main>
    <footer><span id="message"></span></footer>`;

  document.getElementById("connect")?.addEventListener("click", connect);
  document.getElementById("check")?.addEventListener("click", syncCollections);
  document.querySelectorAll<HTMLButtonElement>("[data-collection-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!workspace || !button.dataset.collectionId) return;
      importSummary = undefined;
      setMessage("Updating Figma Variables…");
      post({
        type: "import-tokens",
        tokens: workspace.tokens,
        collections: workspace.collections,
        selectedCollectionIds: [button.dataset.collectionId],
      });
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-figma-collection-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const figmaCollectionId = button.dataset.figmaCollectionId;
      if (!figmaCollectionId) return;
      button.disabled = true;
      setMessage("Preparing the Figma collection for export…");
      post({ type: "prepare-figma-export", figmaCollectionId });
    });
  });
}

function getRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function disconnect(message: string) {
  if (socket) socket.close();
  socket = null;
  isConnected = false;
  render();
  setMessage(message);
}

function connect() {
  socket?.close();
  setMessage("Connecting to TokenCraft’s active workspace…");
  const nextSocket = new WebSocket(TOKENCRAFT_BRIDGE_URL);
  socket = nextSocket;

  nextSocket.addEventListener("open", () => {
    if (socket !== nextSocket) return;
    nextSocket.send(JSON.stringify({ type: "subscribe", requestId: getRequestId() }));
  });
  nextSocket.addEventListener("message", (event) => {
    if (socket !== nextSocket) return;
    try {
      const message = JSON.parse(String(event.data)) as {
        type?: string;
        workspace?: TokenCraftWorkspace;
        message?: string;
        name?: string;
      };
      if ((message.type === "workspace" || message.type === "workspace-updated") && message.workspace) {
        workspace = message.workspace;
        isConnected = true;
        statuses = new Map();
        importSummary = undefined;
        render();
        setMessage(message.type === "workspace-updated" ? "TokenCraft updated the active workspace." : "Connected to the active workspace.");
        syncCollections();
        return;
      }
      if (message.type === "workspace-error" || message.type === "error") {
        disconnect(message.message ?? "TokenCraft has no active workspace.");
        return;
      }
      if (message.type === "figma-collection-exported") {
        setMessage(`${message.name ?? "Figma collection"} was exported to TokenCraft.`);
        syncCollections();
        return;
      }
      if (message.type === "figma-collection-export-error") {
        render();
        setMessage(message.message ?? "TokenCraft could not export this Figma collection.");
      }
    } catch {
      disconnect("TokenCraft sent an invalid bridge response.");
    }
  });
  nextSocket.addEventListener("error", () => {
    if (socket === nextSocket) disconnect("TokenCraft is not running locally.");
  });
  nextSocket.addEventListener("close", () => {
    if (socket === nextSocket) disconnect("The TokenCraft bridge disconnected.");
  });
}

window.addEventListener("message", (event: MessageEvent<{ pluginMessage?: ToUi }>) => {
  const message = event.data.pluginMessage;
  if (!message) return;
  if (message.type === "collection-statuses") {
    statuses = new Map(message.statuses.map((status) => [status.collectionId, status]));
    render();
  }
  if (message.type === "figma-only-collections") {
    figmaOnlyCollections = message.collections;
    render();
  }
  if (message.type === "figma-collection-export") {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      render();
      setMessage("Reconnect to TokenCraft before exporting this collection.");
      return;
    }
    socket.send(JSON.stringify({
      type: "export-figma-collection",
      requestId: getRequestId(),
      collection: message.export,
    }));
  }
  if (message.type === "import-complete") {
    importSummary = message.summary;
    render();
  }
});

render();
connect();
