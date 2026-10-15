import { useEffect, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket, type SocketEvent } from "../services/socketService";

// ─── Connect/disconnect Socket.IO for the lifetime of the component ───────────
export function useSocketConnection(active = true) {
  useEffect(() => {
    if (!active) return;
    connectSocket();
    return () => disconnectSocket();
  }, [active]);
}

// ─── Subscribe to a single Socket.IO event ────────────────────────────────────
export function useSocketEvent<T = unknown>(
  event: SocketEvent,
  handler: (payload: T) => void,
  deps: React.DependencyList = [],
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const fn = (payload: T) => handlerRef.current(payload);
    socket.on(event, fn);
    return () => { socket.off(event, fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

// ─── Subscribe to multiple events at once ─────────────────────────────────────
export function useSocketEvents(
  handlers: Partial<Record<SocketEvent, (payload: unknown) => void>>,
) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const socket = getSocket();
    const fns: Record<string, (p: unknown) => void> = {};
    for (const [event, fn] of Object.entries(ref.current)) {
      if (fn) {
        fns[event] = (p: unknown) => ref.current[event as SocketEvent]?.(p);
        socket.on(event, fns[event]);
      }
    }
    return () => {
      for (const [event, fn] of Object.entries(fns)) {
        socket.off(event, fn);
      }
    };
  }, []);
}
