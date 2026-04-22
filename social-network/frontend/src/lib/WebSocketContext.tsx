"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export type WSMsg = {
  type: "chat_message" | "group_message" | "notification" | string;
  sender_id?: number;
  recipient_id?: number;
  group_id?: number;
  content: string;
  created_at: string;
};

type WSContextType = {
  lastMessage: WSMsg | null;
  unreadNotifCount: number;
  unreadMsgCount: number;
  clearNotifCount: () => void;
  clearMsgCount: () => void;
  isConnected: boolean;
};

const WSContext = createContext<WSContextType>({
  lastMessage: null,
  unreadNotifCount: 0,
  unreadMsgCount: 0,
  clearNotifCount: () => {},
  clearMsgCount: () => {},
  isConnected: false,
});

export function useWS() {
  return useContext(WSContext);
}

let _globalSocket: WebSocket | null = null;

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [lastMessage, setLastMessage] = useState<WSMsg | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    // Get session_id — try localStorage first, then fetch from server
    let sessionId = localStorage.getItem("session_id");
    if (!sessionId) {
      try {
        const res = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          sessionId = data.session_id;
          if (sessionId) localStorage.setItem("session_id", sessionId);
        }
      } catch {}
    }

    if (!sessionId) {
      // Not authenticated — retry after 4s
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 4000);
      return;
    }

    // Connect directly to backend WebSocket (Next.js rewrites don't proxy WS)
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const url = `${proto}//${hostname}:8080/api/ws?session_id=${encodeURIComponent(sessionId)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    _globalSocket = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg: WSMsg = JSON.parse(event.data);
        setLastMessage(msg);
        if (msg.type === "notification") {
          setUnreadNotifCount((c) => c + 1);
        } else if (msg.type === "chat_message" || msg.type === "group_message") {
          setUnreadMsgCount((c) => c + 1);
        }
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      // Reconnect after 4s
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 4000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Small delay so cookie is ready after login
    const t = setTimeout(connect, 500);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <WSContext.Provider
      value={{
        lastMessage,
        unreadNotifCount,
        unreadMsgCount,
        clearNotifCount: () => setUnreadNotifCount(0),
        clearMsgCount: () => setUnreadMsgCount(0),
        isConnected,
      }}
    >
      {children}
    </WSContext.Provider>
  );
}
