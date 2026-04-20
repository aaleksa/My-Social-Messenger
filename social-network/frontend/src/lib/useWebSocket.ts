"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type WSMessage = {
  type: string;
  sender_id?: number;
  recipient_id?: number;
  group_id?: number;
  content: string;
  created_at: string;
};

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  // Always keep ref up-to-date without re-running the effect
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/api/ws`);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch {}
    };

    return () => socket.close();
  }, []); // run only once

  const send = useCallback((msg: WSMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}
