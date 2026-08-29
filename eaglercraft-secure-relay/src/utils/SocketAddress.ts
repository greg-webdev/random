import WebSocket from 'ws';

export class SocketAddress {
  private static readonly map: Map<WebSocket, string> = new Map();

  public static setAddress (socket: WebSocket, address: string): void {
    this.map.set(socket, address);
  }

  public static getAddress (socket: WebSocket): string {
    return this.map.get(socket) ?? 'unknown';
  }

  public static cleanSocket (socket: WebSocket): void {
    this.map.delete(socket);
  }
}
