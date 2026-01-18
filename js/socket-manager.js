// Socket.IO Manager for Real-time Communication
class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = Config.SERVER.RECONNECT_ATTEMPTS;
        this.reconnectDelay = Config.SERVER.RECONNECT_DELAY;
        this.heartbeatInterval = null;
        this.eventHandlers = new Map();
        this.pendingMessages = [];
        
        // Connection state
        this.connectionState = {
            connected: false,
            reconnecting: false,
            lastPing: null,
            latency: null
        };
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupNetworkMonitoring();
    }
    
    connect() {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return;
        }
        
        try {
            const socketUrl = Config.SERVER.SOCKET_URL;
            console.log('Connecting to socket server:', socketUrl);
            
            this.socket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay,
                timeout: 10000,
                autoConnect: true,
                forceNew: false,
                multiplex: true
            });
            
            this.setupSocketEvents();
            this.updateNetworkStatus('Connecting...');
            
        } catch (error) {
            console.error('Failed to connect to socket:', error);
            this.handleConnectionError(error);
        }
    }
    
    setupSocketEvents() {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', () => this.handleConnect());
        this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
        this.socket.on('connect_error', (error) => this.handleConnectError(error));
        
        // Reconnection events
        this.socket.on('reconnect', (attempt) => this.handleReconnect(attempt));
        this.socket.on('reconnect_attempt', (attempt) => this.handleReconnectAttempt(attempt));
        this.socket.on('reconnecting', (attempt) => this.handleReconnecting(attempt));
        this.socket.on('reconnect_failed', () => this.handleReconnectFailed());
        
        // Custom game events
        this.socket.on('game:status', (data) => this.emitEvent('game:status', data));
        this.socket.on('game:state', (data) => this.emitEvent('game:state', data));
        this.socket.on('game:countdown', (data) => this.emitEvent('game:countdown', data));
        this.socket.on('game:number:drawn', (data) => this.emitEvent('game:number:drawn', data));
        this.socket.on('game:winner', (data) => this.emitEvent('game:winner', data));
        this.socket.on('game:cancelled', (data) => this.emitEvent('game:cancelled', data));
        
        this.socket.on('cards:grid', (data) => this.emitEvent('cards:grid', data));
        this.socket.on('player:cards', (data) => this.emitEvent('player:cards', data));
        this.socket.on('card:selected', (data) => this.emitEvent('card:selected', data));
        
        this.socket.on('player:joined', (data) => this.emitEvent('player:joined', data));
        this.socket.on('player:left', (data) => this.emitEvent('player:left', data));
        
        this.socket.on('error', (error) => this.emitEvent('error', error));
        this.socket.on('notification', (data) => this.emitEvent('notification', data));
        
        // Ping/pong for latency measurement
        this.socket.on('pong', (latency) => {
            this.connectionState.latency = latency;
            this.connectionState.lastPing = Date.now();
            this.emitEvent('latency', latency);
        });
    }
    
    handleConnect() {
        console.log('Socket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionState.connected = true;
        this.connectionState.reconnecting = false;
        
        this.updateNetworkStatus('Connected');
        this.emitEvent('connected');
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Join as player
        this.joinGame();
        
        // Process pending messages
        this.processPendingMessages();
    }
    
    handleDisconnect(reason) {
        console.log('Socket disconnected:', reason);
        this.isConnected = false;
        this.connectionState.connected = false;
        
        this.updateNetworkStatus('Disconnected');
        this.emitEvent('disconnected', { reason });
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        if (reason === 'io server disconnect') {
            // The server has disconnected, try to reconnect
            this.socket.connect();
        }
    }
    
    handleConnectError(error) {
        console.error('Socket connection error:', error);
        this.updateNetworkStatus('Connection Failed');
        this.emitEvent('connection:error', { error });
    }
    
    handleReconnect(attempt) {
        console.log('Reconnected after', attempt, 'attempts');
        this.reconnectAttempts = 0;
        this.connectionState.reconnecting = false;
        this.updateNetworkStatus('Reconnected');
        this.emitEvent('reconnected', { attempt });
    }
    
    handleReconnectAttempt(attempt) {
        console.log('Reconnection attempt:', attempt);
        this.reconnectAttempts = attempt;
        this.connectionState.reconnecting = true;
        this.updateNetworkStatus(`Reconnecting (${attempt}/${this.maxReconnectAttempts})`);
        this.emitEvent('reconnect:attempt', { attempt });
    }
    
    handleReconnecting(attempt) {
        console.log('Reconnecting...', attempt);
        this.connectionState.reconnecting = true;
        this.emitEvent('reconnecting', { attempt });
    }
    
    handleReconnectFailed() {
        console.error('Reconnection failed');
        this.connectionState.reconnecting = false;
        this.updateNetworkStatus('Connection Lost');
        this.emitEvent('reconnect:failed');
        
        // Try to reconnect after a delay
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, 5000);
    }
    
    handleConnectionError(error) {
        console.error('Connection setup error:', error);
        this.updateNetworkStatus('Connection Error');
        this.emitEvent('connection:error', { error });
        
        // Fallback to polling if websocket fails
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('Trying fallback connection...');
                this.connect();
            }
        }, 2000);
    }
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                const startTime = Date.now();
                this.socket.emit('ping', startTime);
            }
        }, Config.SERVER.HEARTBEAT_INTERVAL);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    joinGame() {
        if (!this.isConnected) return;
        
        const userId = Config.getUserId();
        const username = Config.getUsername();
        
        this.socket.emit('player:join', {
            userId,
            username,
            device: Config.getDeviceInfo()
        });
    }
    
    selectCard(cardId) {
        if (!this.isConnected) {
            this.queueMessage('card:select', { cardId });
            return false;
        }
        
        const userId = Config.getUserId();
        this.socket.emit('card:select', {
            userId,
            cardId: parseInt(cardId)
        });
        return true;
    }
    
    claimBingo(cardId, pattern) {
        if (!this.isConnected) {
            this.queueMessage('bingo:claim', { cardId, pattern });
            return false;
        }
        
        const userId = Config.getUserId();
        this.socket.emit('bingo:claim', {
            userId,
            cardId: parseInt(cardId),
            pattern
        });
        return true;
    }
    
    requestCardGrid() {
        if (!this.isConnected) return false;
        
        this.socket.emit('cards:grid:request');
        return true;
    }
    
    requestGameStatus() {
        if (!this.isConnected) return false;
        
        this.socket.emit('game:status:request');
        return true;
    }
    
    sendChatMessage(message) {
        if (!this.isConnected) {
            this.queueMessage('chat:message', { message });
            return false;
        }
        
        const userId = Config.getUserId();
        const username = Config.getUsername();
        
        this.socket.emit('chat:message', {
            userId,
            username,
            message,
            timestamp: Date.now()
        });
        return true;
    }
    
    // Event handling
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (!this.eventHandlers.has(event)) return;
        
        const handlers = this.eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }
    
    emitEvent(event, data) {
        if (!this.eventHandlers.has(event)) return;
        
        const handlers = this.eventHandlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
    
    // Message queue for offline mode
    queueMessage(event, data) {
        this.pendingMessages.push({
            event,
            data,
            timestamp: Date.now(),
            attempts: 0
        });
        
        // Save to localStorage for persistence
        this.savePendingMessages();
        
        // Show offline notification
        this.emitEvent('offline:message', { event, data });
    }
    
    processPendingMessages() {
        if (this.pendingMessages.length === 0 || !this.isConnected) return;
        
        const processed = [];
        
        this.pendingMessages.forEach((message, index) => {
            if (message.attempts >= 3) {
                processed.push(index);
                return;
            }
            
            try {
                this.socket.emit(message.event, message.data);
                message.attempts++;
                processed.push(index);
            } catch (error) {
                console.error('Failed to send pending message:', error);
            }
        });
        
        // Remove processed messages
        processed.reverse().forEach(index => {
            this.pendingMessages.splice(index, 1);
        });
        
        this.savePendingMessages();
    }
    
    savePendingMessages() {
        Config.saveToStorage('pending_messages', this.pendingMessages);
    }
    
    loadPendingMessages() {
        this.pendingMessages = Config.loadFromStorage('pending_messages', []);
    }
    
    // Network monitoring
    setupNetworkMonitoring() {
        window.addEventListener('online', () => this.handleNetworkOnline());
        window.addEventListener('offline', () => this.handleNetworkOffline());
        
        // Check initial network status
        if (!navigator.onLine) {
            this.handleNetworkOffline();
        }
    }
    
    handleNetworkOnline() {
        console.log('Network is online');
        this.updateNetworkStatus('Online');
        this.emitEvent('network:online');
        
        // Try to reconnect socket
        if (!this.isConnected) {
            setTimeout(() => this.connect(), 1000);
        }
    }
    
    handleNetworkOffline() {
        console.log('Network is offline');
        this.updateNetworkStatus('Offline');
        this.emitEvent('network:offline');
    }
    
    updateNetworkStatus(status) {
        const networkElement = document.getElementById('networkStatus');
        if (!networkElement) return;
        
        networkElement.textContent = status;
        
        if (status.includes('Connected') || status.includes('Online')) {
            networkElement.className = 'network-status online';
            setTimeout(() => {
                networkElement.style.display = 'none';
            }, 3000);
        } else if (status.includes('Offline') || status.includes('Disconnected')) {
            networkElement.className = 'network-status offline';
            networkElement.style.display = 'block';
        } else {
            networkElement.className = 'network-status';
            networkElement.style.display = 'block';
        }
    }
    
    // Public methods
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.stopHeartbeat();
        this.isConnected = false;
        this.connectionState.connected = false;
    }
    
    reconnect() {
        this.disconnect();
        setTimeout(() => this.connect(), 1000);
    }
    
    getConnectionState() {
        return { ...this.connectionState };
    }
    
    getLatency() {
        return this.connectionState.latency;
    }
    
    isReconnecting() {
        return this.connectionState.reconnecting;
    }
    
    // Debug methods
    logConnectionInfo() {
        console.log('Socket Connection Info:', {
            connected: this.isConnected,
            reconnecting: this.connectionState.reconnecting,
            reconnectAttempts: this.reconnectAttempts,
            latency: this.connectionState.latency,
            pendingMessages: this.pendingMessages.length
        });
    }
}

// Export as singleton
let socketInstance = null;

function getSocketManager() {
    if (!socketInstance) {
        socketInstance = new SocketManager();
    }
    return socketInstance;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SocketManager, getSocketManager };
} else {
    window.SocketManager = SocketManager;
    window.getSocketManager = getSocketManager;
}
