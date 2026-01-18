import { CONFIG } from './config.js';

export class SocketManager {
    constructor(app) {
        this.app = app;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.messageQueue = [];
    }
    
    connect() {
        try {
            this.socket = new WebSocket(CONFIG.SERVER_URL);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.processMessageQueue();
                
                // Send connection info
                this.send({
                    type: 'player_join',
                    playerId: this.app.playerId
                });
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.handleDisconnection();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.handleDisconnection();
        }
    }
    
    handleDisconnection() {
        // Try to reconnect
        if (this.reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            const delay = CONFIG.RECONNECT_INTERVAL * this.reconnectAttempts;
            
            console.log(`Reconnecting in ${delay/1000} seconds... (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.app.uiManager.showNotification('Connection lost. Please refresh.', 'error');
        }
    }
    
    send(message) {
        if (this.isConnected && this.socket) {
            this.socket.send(JSON.stringify(message));
        } else {
            // Queue message for when connection is restored
            this.messageQueue.push(message);
            console.log('Message queued:', message);
        }
    }
    
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.socket.send(JSON.stringify(message));
        }
    }
    
    handleMessage(data) {
        console.log('Received message:', data);
        
        switch(data.type) {
            case 'game_state':
                this.handleGameState(data);
                break;
                
            case 'player_count':
                this.app.updatePlayersCount(data.count);
                break;
                
            case 'card_selection_result':
                this.handleCardSelectionResult(data);
                break;
                
            case 'game_start':
                this.app.startGame(data);
                break;
                
            case 'number_drawn':
                this.app.handleNumberDrawn(data.number);
                break;
                
            case 'bingo_validated':
                this.app.showWinner(data.winner);
                break;
                
            case 'error':
                this.app.uiManager.showNotification(data.message, 'error');
                break;
                
            case 'player_joined':
                this.app.uiManager.showNotification(`${data.playerName} joined the game`);
                break;
                
            case 'player_left':
                this.app.uiManager.showNotification(`${data.playerName} left the game`);
                break;
        }
    }
    
    handleGameState(data) {
        // Update game state from server
        if (data.state === 'card_selection' && this.app.gameState !== 'card_selection') {
            this.app.startCardSelection();
        } else if (data.state === 'playing' && this.app.gameState === 'card_selection') {
            this.app.uiManager.showGameScreen();
        }
    }
    
    handleCardSelectionResult(data) {
        if (data.success) {
            this.app.uiManager.showNotification('Cards confirmed! Waiting for other players...');
        } else {
            this.app.uiManager.showNotification(data.message, 'error');
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}
