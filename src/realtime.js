import { createClient } from '@supabase/supabase-js';

// Zero-database Realtime Co-op via Supabase Broadcast + Presence
export class CoopRealtime {
  constructor({ onStatusChange, onRemoteAction, onRemoteCursor, onRemoteEmote, onSyncState }) {
    this.onStatusChange = onStatusChange;
    this.onRemoteAction = onRemoteAction;
    this.onRemoteCursor = onRemoteCursor;
    this.onRemoteEmote = onRemoteEmote;
    this.onSyncState = onSyncState;

    this.client = null;
    this.channel = null;
    this.clientId = Math.random().toString(36).slice(2, 10);
    this.playerName = localStorage.getItem('hammy_player') || 'Kamu';
    this.roomCode = this.getInitialRoom();
    this.onlineCount = 1;
    this.peers = [];
  }

  getInitialRoom() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('room');
    if (fromUrl) return fromUrl.toUpperCase().slice(0, 20);
    const saved = localStorage.getItem('hammy_room');
    if (saved) return saved;
    const generated = `MOCHI-${Math.floor(10 + Math.random() * 89)}`;
    localStorage.setItem('hammy_room', generated);
    return generated;
  }

  getCredentials() {
    const url =
      import.meta.env.VITE_SUPABASE_URL ||
      localStorage.getItem('hammy_sb_url') ||
      '';
    const key =
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      localStorage.getItem('hammy_sb_key') ||
      '';
    return { url: url.trim(), key: key.trim() };
  }

  saveCredentials(url, key) {
    localStorage.setItem('hammy_sb_url', url.trim());
    localStorage.setItem('hammy_sb_key', key.trim());
  }

  async connect(roomCode = this.roomCode, playerName = this.playerName) {
    this.roomCode = roomCode.toUpperCase().trim() || 'MOCHI-77';
    this.playerName = playerName.trim() || 'Kamu';
    localStorage.setItem('hammy_room', this.roomCode);
    localStorage.setItem('hammy_player', this.playerName);

    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set('room', this.roomCode);
    window.history.replaceState({}, '', urlObj.toString());

    const { url, key } = this.getCredentials();
    if (!url || !key) {
      this.onStatusChange({ connected: false, onlineCount: 1, peers: [], reason: 'no-keys' });
      return false;
    }

    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    this.client = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 15 } },
    });

    this.channel = this.client.channel(`hammy-room:${this.roomCode}`, {
      config: { presence: { key: this.clientId } },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        const entries = Object.values(state).flat();
        this.onlineCount = entries.length || 1;
        this.peers = entries.filter((p) => p.clientId !== this.clientId);
        this.onStatusChange({
          connected: true,
          onlineCount: this.onlineCount,
          peers: this.peers,
        });
      })
      .on('broadcast', { event: 'action' }, ({ payload }) => {
        if (payload?.senderId === this.clientId) return;
        this.onRemoteAction(payload);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (payload?.senderId === this.clientId) return;
        this.onRemoteCursor(payload);
      })
      .on('broadcast', { event: 'emote' }, ({ payload }) => {
        if (payload?.senderId === this.clientId) return;
        this.onRemoteEmote(payload);
      })
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        if (payload?.senderId === this.clientId) return;
        this.onSyncState(payload);
      });

    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          clientId: this.clientId,
          name: this.playerName,
          joinedAt: Date.now(),
        });
      }
    });

    return true;
  }

  send(event, payload) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        senderId: this.clientId,
        senderName: this.playerName,
      },
    });
  }
}
