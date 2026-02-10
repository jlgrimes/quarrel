import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WebSocket globally
const OPEN = 1;

class MockWebSocket {
  static OPEN = OPEN;
  readyState = OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

let mockWsInstance: MockWebSocket;

const MockWebSocketConstructor = vi.fn(() => {
  mockWsInstance = new MockWebSocket();
  return mockWsInstance;
});
Object.defineProperty(MockWebSocketConstructor, 'OPEN', { value: OPEN });

vi.stubGlobal('WebSocket', MockWebSocketConstructor);

// Must import after mocking WebSocket
const { wsClient } = await import('../../lib/ws');

beforeEach(() => {
  vi.clearAllMocks();
  wsClient.disconnect();
  wsClient.setToken(null);
});

describe('WebSocketClient', () => {
  it('does not connect without a token', () => {
    wsClient.connect();
    expect(MockWebSocketConstructor).not.toHaveBeenCalled();
  });

  it('connects when token is set', () => {
    wsClient.setToken('test-token');
    wsClient.connect();
    expect(MockWebSocketConstructor).toHaveBeenCalled();
  });

  it('sends auth event with token on open', () => {
    wsClient.setToken('test-token');
    wsClient.connect();
    mockWsInstance.simulateOpen();

    expect(mockWsInstance.sent).toHaveLength(1);
    const msg = JSON.parse(mockWsInstance.sent[0]);
    expect(msg.event).toBe('auth');
    expect(msg.data.token).toBe('test-token');
  });

  it('dispatches events to registered handlers', () => {
    const handler = vi.fn();
    wsClient.on('message:new', handler);
    wsClient.setToken('test-token');
    wsClient.connect();
    mockWsInstance.simulateOpen();

    mockWsInstance.simulateMessage({ event: 'message:new', data: { id: '1', content: 'hello' } });

    expect(handler).toHaveBeenCalledWith({ id: '1', content: 'hello' });
  });

  it('unsubscribes handler when cleanup is called', () => {
    const handler = vi.fn();
    const unsub = wsClient.on('message:new', handler);
    unsub();

    wsClient.setToken('test-token');
    wsClient.connect();
    mockWsInstance.simulateOpen();
    mockWsInstance.simulateMessage({ event: 'message:new', data: {} });

    expect(handler).not.toHaveBeenCalled();
  });

  it('send is safe when not connected', () => {
    // ws is null, send should be a no-op
    wsClient.setToken('test-token');
    expect(() => wsClient.send('test', {})).not.toThrow();
  });
});
