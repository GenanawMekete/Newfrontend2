// Socket.IO connection management
class SocketManager {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    connect(url) {
        this.socket = io(url, {
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
            timeout: 10000
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.reconnectAttempts = 0;
            this.onConnect?.();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.onDisconnect?.(reason);
        });

        this.socket.on('connect_error', (error) => {
            console.log('Socket connection error:', error);
            this.onConnectError?.(error);
        });

        this.socket.on('reconnect_attempt', (attempt) => {
            console.log('Reconnection attempt:', attempt);
            this.reconnectAttempts = attempt;
            this.onReconnectAttempt?.(attempt);
        });

        this.socket.on('reconnect', (attempt) => {
            console.log('Reconnected after', attempt, 'attempts');
            this.onReconnect?.(attempt);
        });

        this.socket.on('reconnect_failed', () => {
            console.log('Reconnection failed');
            this.onReconnectFailed?.();
        });
    }

    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.error('Socket not connected');
        }
    }

    on(event, handler) {
        this.socket?.on(event, handler);
    }

    off(event, handler) {
        this.socket?.off(event, handler);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}
