"use client";
import { WebSocketProvider } from "@/lib/WebSocketContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <WebSocketProvider>{children}</WebSocketProvider>;
}
