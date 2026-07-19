import { watch, type FSWatcher } from "node:fs";

import { WebSocket, WebSocketServer } from "ws";

export const FIGMA_BRIDGE_PORT = 4288;

type ActivateWorkspaceMessage = {
  type: "activate-workspace";
  rootPath: string;
};

type SubscribeMessage = {
  type: "subscribe";
  requestId: string;
};

type ExportFigmaCollectionMessage = {
  type: "export-figma-collection";
  requestId: string;
  collection: {
    name: string;
    modes: string[];
    tokens: Array<{
      name: string;
      type: "color" | "number" | "boolean" | "string";
      values: Record<string, string | number | boolean>;
    }>;
  };
};

type BridgeMessage = ActivateWorkspaceMessage | SubscribeMessage | ExportFigmaCollectionMessage;
type WorkspaceReader = (rootPath: string) => Promise<unknown>;
type FigmaCollectionExporter = (rootPath: string, collection: ExportFigmaCollectionMessage["collection"]) => Promise<unknown>;

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "TokenCraft could not read the active workspace.";
}

function parseMessage(value: WebSocket.RawData): BridgeMessage | null {
  try {
    const message = JSON.parse(value.toString()) as Partial<BridgeMessage>;
    if (message.type === "activate-workspace" && typeof message.rootPath === "string" && message.rootPath.length > 0 && message.rootPath.length <= 4096) {
      return message as ActivateWorkspaceMessage;
    }
    if (message.type === "subscribe" && typeof message.requestId === "string" && message.requestId.length > 0) {
      return message as SubscribeMessage;
    }
    if (
      message.type === "export-figma-collection"
      && typeof message.requestId === "string"
      && message.requestId.length > 0
      && message.collection
      && typeof message.collection.name === "string"
      && Array.isArray(message.collection.modes)
      && Array.isArray(message.collection.tokens)
    ) {
      return message as ExportFigmaCollectionMessage;
    }
  } catch {
    // Invalid messages are rejected below.
  }

  return null;
}

export function startFigmaBridge(
  readWorkspace: WorkspaceReader,
  exportFigmaCollection: FigmaCollectionExporter,
  port = FIGMA_BRIDGE_PORT,
) {
  const subscribers = new Set<WebSocket>();
  const server = new WebSocketServer({ host: "::1", port, maxPayload: 16 * 1024 });
  let activeRootPath: string | null = null;
  let activeWorkspaceController: WebSocket | null = null;
  let watcher: FSWatcher | null = null;
  let watchedRootPath: string | null = null;
  let refreshTimer: NodeJS.Timeout | undefined;
  let resolveReady: (() => void) | undefined;
  let rejectReady: ((error: Error) => void) | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  server.once("listening", () => resolveReady?.());
  server.on("error", (error) => rejectReady?.(error));

  function stopWatching() {
    watcher?.close();
    watcher = null;
    watchedRootPath = null;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }

  async function broadcastActiveWorkspace() {
    if (!activeRootPath || subscribers.size === 0) return;

    try {
      const workspace = await readWorkspace(activeRootPath);
      for (const socket of subscribers) send(socket, { type: "workspace-updated", workspace });
    } catch (error) {
      for (const socket of subscribers) send(socket, { type: "workspace-error", message: errorMessage(error) });
    }
  }

  function watchActiveWorkspace() {
    if (!activeRootPath || subscribers.size === 0 || watchedRootPath === activeRootPath) return;
    stopWatching();

    try {
      watcher = watch(activeRootPath, { recursive: true }, () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          void broadcastActiveWorkspace();
        }, 150);
      });
      watchedRootPath = activeRootPath;
    } catch {
      // Reading still works; file watching is retried the next time the active workspace changes.
    }
  }

  async function setActiveWorkspace(rootPath: string, controller: WebSocket) {
    await readWorkspace(rootPath);
    activeRootPath = rootPath;
    activeWorkspaceController = controller;
    watchActiveWorkspace();
    await broadcastActiveWorkspace();
  }

  function clearActiveWorkspace(controller: WebSocket) {
    if (activeWorkspaceController !== controller) return;

    activeWorkspaceController = null;
    activeRootPath = null;
    stopWatching();
    for (const subscriber of subscribers) {
      send(subscriber, { type: "workspace-error", message: "Open a TokenCraft workspace before connecting Figma." });
    }
  }

  function removeSubscriber(socket: WebSocket) {
    subscribers.delete(socket);
    if (subscribers.size === 0) stopWatching();
  }

  server.on("connection", (socket) => {
    socket.on("message", async (rawMessage) => {
      const message = parseMessage(rawMessage);
      if (!message) {
        send(socket, { type: "error", message: "Invalid TokenCraft bridge message." });
        return;
      }

      if (message.type === "activate-workspace") {
        try {
          await setActiveWorkspace(message.rootPath, socket);
          send(socket, { type: "workspace-activated" });
        } catch (error) {
          send(socket, { type: "workspace-error", message: errorMessage(error) });
        }
        return;
      }

      if (message.type === "export-figma-collection") {
        if (!activeRootPath) {
          send(socket, { type: "figma-collection-export-error", requestId: message.requestId, message: "Open a TokenCraft workspace before exporting from Figma." });
          return;
        }
        try {
          await exportFigmaCollection(activeRootPath, message.collection);
          send(socket, { type: "figma-collection-exported", requestId: message.requestId, name: message.collection.name });
          await broadcastActiveWorkspace();
        } catch (error) {
          send(socket, { type: "figma-collection-export-error", requestId: message.requestId, message: errorMessage(error) });
        }
        return;
      }

      if (!activeRootPath) {
        send(socket, { type: "workspace-error", requestId: message.requestId, message: "Open a TokenCraft workspace before connecting Figma." });
        return;
      }

      try {
        const workspace = await readWorkspace(activeRootPath);
        subscribers.add(socket);
        watchActiveWorkspace();
        send(socket, { type: "workspace", requestId: message.requestId, workspace });
      } catch (error) {
        send(socket, { type: "workspace-error", requestId: message.requestId, message: errorMessage(error) });
      }
    });

    socket.on("close", () => {
      clearActiveWorkspace(socket);
      removeSubscriber(socket);
    });
    socket.on("error", () => {
      clearActiveWorkspace(socket);
      removeSubscriber(socket);
    });
  });

  return {
    ready,
    close() {
      stopWatching();
      subscribers.clear();
      server.close();
    },
  };
}
