const io = require('socket.io-client');
const config = require('../config');

class ProChatPlatformClient {
  constructor() {
    this.baseUrl = config.platform.url.replace(/\/$/, '');
    this.username = config.platform.username;
    this.password = config.platform.password;
    this.token = null;
    this.currentUser = null;
    this.socket = null;
    this.onlineUserIds = new Set();
    this.listeners = {
      worldMessage: [],
      directMessage: [],
      presenceUpdate: [],
      statusChange: []
    };
    this.isConnected = false;
  }

  async login() {
    console.log(`[Platform] Logging in as "${this.username}" at ${this.baseUrl}...`);
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      this.token = data.token;
      this.currentUser = data.user;
      console.log(`✅ [Platform] Logged in successfully as "${this.currentUser.display_name}" (ID: ${this.currentUser.id})`);
      this.notifyStatusChange('LOGGED_IN');
      return data;
    } catch (err) {
      console.error('❌ [Platform] Login error:', err.message);
      this.notifyStatusChange('LOGIN_ERROR');
      throw err;
    }
  }

  connectSocket() {
    if (!this.token) {
      throw new Error('Cannot connect socket: not authenticated');
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    console.log(`[Platform] Connecting Socket.IO to ${this.baseUrl}...`);
    this.socket = io(this.baseUrl, {
      auth: { token: this.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity
    });

    this.socket.on('connect', () => {
      console.log('✅ [Platform] Socket.IO connected! Socket ID:', this.socket.id);
      this.isConnected = true;
      this.notifyStatusChange('CONNECTED');
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ [Platform] Socket disconnected:', reason);
      this.isConnected = false;
      this.notifyStatusChange('DISCONNECTED');
    });

    this.socket.on('presence_update', (data) => {
      const ids = data.onlineUserIds || [];
      this.onlineUserIds = new Set(ids);
      this.listeners.presenceUpdate.forEach(cb => cb(this.onlineUserIds));
    });

    this.socket.on('new_world_message', (msg) => {
      this.listeners.worldMessage.forEach(cb => cb(msg));
    });

    this.socket.on('new_direct_message', (msg) => {
      this.listeners.directMessage.forEach(cb => cb(msg));
    });

    this.socket.on('error_message', (err) => {
      console.warn('⚠️ [Platform] Socket error message:', err);
    });
  }

  sendWorldMessage(content) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot send world message: Socket not connected');
      return false;
    }
    this.socket.emit('send_world_message', { content });
    return true;
  }

  sendDirectMessage(recipientId, content) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot send direct message: Socket not connected');
      return false;
    }
    this.socket.emit('send_direct_message', { recipientId, content });
    return true;
  }

  markRead(senderId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_read', { senderId });
    }
  }

  async searchUsers(query = '') {
    try {
      const res = await fetch(`${this.baseUrl}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      return data.users || [];
    } catch (e) {
      console.error('searchUsers error:', e.message);
      return [];
    }
  }

  async getWorldMessages() {
    try {
      const res = await fetch(`${this.baseUrl}/api/messages/world`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      return data.messages || [];
    } catch (e) {
      console.error('getWorldMessages error:', e.message);
      return [];
    }
  }

  async getDirectMessages(otherUserId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/messages/direct/${otherUserId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      return data.messages || [];
    } catch (e) {
      console.error('getDirectMessages error:', e.message);
      return [];
    }
  }

  onWorldMessage(cb) { this.listeners.worldMessage.push(cb); }
  onDirectMessage(cb) { this.listeners.directMessage.push(cb); }
  onPresenceUpdate(cb) { this.listeners.presenceUpdate.push(cb); }
  onStatusChange(cb) { this.listeners.statusChange.push(cb); }

  notifyStatusChange(status) {
    this.listeners.statusChange.forEach(cb => cb(status));
  }
}

module.exports = new ProChatPlatformClient();

