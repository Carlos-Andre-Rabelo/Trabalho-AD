import { Response } from 'express';

export interface SseClient {
  id: string;
  collectionId: string;
  res: Response;
  connectedAt: Date;
}

class SseManager {
  private clients: Map<string, SseClient> = new Map();

  addClient(id: string, collectionId: string, res: Response): () => void {
    const client: SseClient = {
      id,
      collectionId,
      res,
      connectedAt: new Date(),
    };

    this.clients.set(id, client);

    // Keepalive ping a cada 20 segundos para manter conexões móveis vivas
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (err) {
        clearInterval(keepAliveTimer);
        this.removeClient(id);
      }
    }, 20000);

    const cleanup = () => {
      clearInterval(keepAliveTimer);
      this.removeClient(id);
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);

    // Notifica contagem atual de clientes conectados para a coleta
    this.broadcast(collectionId, 'sync:clients', {
      connectedClients: this.getConnectedCount(collectionId),
    });

    return cleanup;
  }

  removeClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      const collectionId = client.collectionId;
      this.clients.delete(id);
      this.broadcast(collectionId, 'sync:clients', {
        connectedClients: this.getConnectedCount(collectionId),
      });
    }
  }

  broadcast(collectionId: string, eventName: string, data: any) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (client.collectionId === collectionId) {
        try {
          client.res.write(payload);
        } catch (err) {
          this.removeClient(id);
        }
      }
    }
  }

  getConnectedCount(collectionId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.collectionId === collectionId) {
        count++;
      }
    }
    return count;
  }
}

export const sseManager = new SseManager();
