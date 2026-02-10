// Bridge to expose react-use-websocket's sendJsonMessage to non-React code (stores)
let sendFn: ((msg: Record<string, unknown>) => void) | null = null;

export function setWsSend(fn: (msg: Record<string, unknown>) => void) {
  sendFn = fn;
}

export function wsSend(event: string, data: unknown) {
  sendFn?.({ event, data });
}
