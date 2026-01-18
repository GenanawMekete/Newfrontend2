// Socket Manager - Handles WebSocket connections for real-time updates
import { CONFIG } from './config.js';

export class SocketManager {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = CONFIG.WS_MAX_RETRIES;
        this.reconnectDelay = CONFIG.WS_RECONNECT_DELAY;
        this.isConnected = false;
        this.eventListeners = new Map();
        this.pendingMessages = [];
    }
    
    // Connect to WebSocket server
    async connect() {
        if (this.socket && this.isConnected) {
            console.log('Already connected to WebSocket');
            return;
        }
        
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(CONFIG.WS_URL);
                
                this.socket.onopen = () => {
                    console.log('WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Send pending messages
                    this.flushPendingMessages();
                    
                    // Trigger connection event
                    this.emit('connected');
                    
                    resolve();
                };
                
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', error);
                    }
                };
                
                this.socket.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    
                    // Attempt reconnection
                    if (event.code !== 1000) { // Don't reconnect on normal closure
                        this.attemptReconnect();
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                };
                
            } catch (error) {
                console.error('Failed to create WebSocket connection:', error);
                reject(error);
            }
        });
    }
    
    // Disconnect from WebSocket server
    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'User initiated disconnect');
            this.socket = null;
            this.isConnected = false;
        }
    }
    
    // Send message through WebSocket
    send(event, data = {}) {
        const message = {
            event,
            data,
            timestamp: Date.now()
        };
        
        if (this.isConnected && this.socket) {
            try {
                this.socket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
                // Queue message for later
                this.pendingMessages.push(message);
            }
        } else {
            // Queue message for when connection is established
            this.pendingMessages.push(message);
        }
    }
    
    // Send pending messages
    flushPendingMessages() {
        while (this.pendingMessages.length > 0) {
            const message = this.pendingMessages.shift();
            if (this.socket && this.isConnected) {
                try {
                    this.socket.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Failed to send pending message:', error);
                    // Re-add to pending if fails
                    this.pendingMessages.unshift(message);
                    break;
                }
            } else {
                // Re-add to pending if not connected
                this.pendingMessages.unshift(message);
                break;
            }
        }
    }
    
    // Handle incoming messages
    handleMessage(message) {
        const { event, data } = message;
        
        // Emit event to listeners
        this.emit(event, data);
        
        // Handle specific game events
        switch (event) {
            case 'number_drawn':
                this.handleNumberDrawn(data);
                break;
                
            case 'game_started':
                this.handleGameStarted(data);
                break;
                
            case 'game_ended':
                this.handleGameEnded(data);
                break;
                
            case 'player_joined':
                this.handlePlayerJoined(data);
                break;
                
            case 'player_left':
                this.handlePlayerLeft(data);
                break;
                
            case 'bingo_called':
                this.handleBingoCalled(data);
                break;
        }
    }
    
    // Handle number drawn event
    handleNumberDrawn(data) {
        const { number, letter } = data;
        
        // Update UI with new number
        this.emit('ui:number_drawn', { number, letter });
        
        // Check if any player has bingo
        this.send('check_bingo', { number });
    }
    
    // Handle game started event
    handleGameStarted(data) {
        const { gameId, players, settings } = data;
        
        // Update UI
        this.emit('ui:game_started', { gameId, players, settings });
    }
    
    // Handle game ended event
    handleGameEnded(data) {
        const { winner, winningCard, numbersCalled } = data;
        
        // Update UI
        this.emit('ui:game_ended', { winner, winningCard, numbersCalled });
    }
    
    // Handle player joined event
    handlePlayerJoined(data) {
        const { player, totalPlayers } = data;
        
        // Update UI
        this.emit('ui:player_joined', { player, totalPlayers });
    }
    
    // Handle player left event
    handlePlayerLeft(data) {
        const { player, totalPlayers } = data;
        
        // Update UI
        this.emit('ui:player_left', { player, totalPlayers });
    }
    
    // Handle bingo called event
    handleBingoCalled(data) {
        const { player, cardNumber, pattern } = data;
        
        // Update UI
        this.emit('ui:bingo_called', { player, cardNumber, pattern });
    }
    
    // Attempt to reconnect
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            this.emit('reconnection_failed');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect().catch(error => {
                    console.error('Reconnection attempt failed:', error);
                });
            }
        }, delay);
    }
    
    // Add event listener
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    // Remove event listener
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    // Emit event to listeners
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    // Join a game room
    joinGame(gameId, playerData) {
        this.send('join_game', {
            gameId,
            player: playerData
        });
    }
    
    // Leave a game room
    leaveGame(gameId) {
        this.send('leave_game', { gameId });
    }
    
    // Call bingo
    callBingo(gameId, cardNumber, pattern) {
        this.send('call_bingo', {
            gameId,
            cardNumber,
            pattern
        });
    }
    
    // Get connection status
    getStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            pendingMessages: this.pendingMessages.length
        };
    }
    
    // Clean up
    destroy() {
        this.disconnect();
        this.eventListeners.clear();
        this.pendingMessages = [];
    }
}
