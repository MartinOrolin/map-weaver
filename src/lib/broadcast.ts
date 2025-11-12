// BroadcastChannel for cross-tab communication
export type BroadcastMessage = 
  | { type: 'map_update'; worldId: string; mapId: string }
  | { type: 'map_deleted'; worldId: string; mapId: string }
  | { type: 'player_deleted'; worldId: string; playerId: string }
  | { type: 'creature_pov'; worldId: string; elementId: string; imageUrl: string; creatureName: string }
  | { type: 'player_update'; worldId: string; playerId: string }
  | { type: 'element_update'; worldId: string; mapId: string; elementId: string }
  | { type: 'world_update'; worldId: string };


const CHANNEL_NAME = 'dnd_map_updates';

class BroadcastManager {
  private channel: BroadcastChannel | null = null;
  private listeners: ((message: BroadcastMessage) => void)[] = [];

  init() {
    if (typeof BroadcastChannel !== 'undefined' && !this.channel) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        this.listeners.forEach(listener => listener(event.data));
      };
    }
  }

  subscribe(listener: (message: BroadcastMessage) => void) {
    this.init();
    this.listeners.push(listener);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  broadcast(message: BroadcastMessage) {
    this.init();
    this.channel?.postMessage(message);
  }

  close() {
    this.channel?.close();
    this.channel = null;
    this.listeners = [];
  }
}

export const broadcastManager = new BroadcastManager();
