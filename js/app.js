import { CONFIG, GAME_STATES, STORAGE_KEYS } from './config.js';
import { SocketManager } from './socket-manager.js';
import { GameEngine } from './game-engine.js';
import { CardManager } from './card-manager.js';
import { UIManager } from './ui-manager.js';
import { AudioManager } from './audio-manager.js';
import { OfflineManager } from './offline-manager.js';

class BingoApp {
    constructor() {
        this.telegram = window.Telegram?.WebApp;
        this.gameState = GAME_STATES.LOBBY;
        this.playerId = null;
        this.selectedCards = [];
        this.gameData = null;
        
        // Initialize managers
        this.uiManager = new UIManager(this);
        this.cardManager = new CardManager(this);
        this.gameEngine = new GameEngine(this);
        this.audioManager = new AudioManager();
        this.offlineManager = new OfflineManager();
        this.socketManager = new SocketManager(this);
        
        this.init();
    }
    
    async init() {
        // Initialize offline capabilities
        await this.offlineManager.init();
        
        // Load saved state
        this.loadSavedState();
        
        // Initialize Telegram Web App
        if (this.telegram) {
            this.initTelegram();
        } else {
            // Fallback for testing outside Telegram
            console.log('Running outside Telegram');
            this.playerId = this.generatePlayerId();
            this.uiManager.showNotification('Running in test mode');
        }
        
        // Initialize UI
        this.uiManager.init();
        
        // Initialize card manager
        this.cardManager.init();
        
        // Connect to WebSocket server
        this.socketManager.connect();
        
        // Start initial state
        this.startCardSelection();
    }
    
    initTelegram() {
        this.telegram.expand();
        this.telegram.enableClosingConfirmation();
        
        // Set theme params
        const themeParams = this.telegram.themeParams;
        document.documentElement.style.setProperty('--primary-color', themeParams.button_color || '#4a6fa5');
        document.documentElement.style.setProperty('--background-color', themeParams.bg_color || '#f5f7fa');
        document.documentElement.style.setProperty('--text-color', themeParams.text_color || '#333333');
        
        // Get user data
        const user = this.telegram.initDataUnsafe?.user;
        if (user) {
            this.playerId = user.id.toString();
            this.uiManager.updatePlayerInfo(user);
        } else {
            this.playerId = this.generatePlayerId();
        }
        
        // Handle back button
        this.telegram.BackButton.onClick(() => {
            this.handleBackButton();
        });
        
        this.telegram.BackButton.show();
    }
    
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }
    
    loadSavedState() {
        const savedState = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
        const savedCards = localStorage.getItem(STORAGE_KEYS.SELECTED_CARDS);
        
        if (savedState) {
            this.gameState = savedState;
        }
        
        if (savedCards) {
            this.selectedCards = JSON.parse(savedCards);
        }
        
        this.playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID) || this.playerId;
    }
    
    saveState() {
        localStorage.setItem(STORAGE_KEYS.GAME_STATE, this.gameState);
        localStorage.setItem(STORAGE_KEYS.SELECTED_CARDS, JSON.stringify(this.selectedCards));
        localStorage.setItem(STORAGE_KEYS.PLAYER_ID, this.playerId);
    }
    
    startCardSelection() {
        this.gameState = GAME_STATES.CARD_SELECTION;
        this.saveState();
        this.uiManager.showCardSelectionScreen();
        this.gameEngine.startSelectionTimer(CONFIG.CARD_SELECTION_TIME);
    }
    
    confirmCardSelection() {
        if (this.selectedCards.length === 0) {
            this.uiManager.showNotification('Please select at least one card');
            return;
        }
        
        this.audioManager.play('cardSelect');
        
        // Send selection to server
        this.socketManager.send({
            type: 'card_selection',
            playerId: this.playerId,
            cards: this.selectedCards
        });
        
        this.uiManager.showGameScreen();
        this.gameState = GAME_STATES.PLAYING;
        this.saveState();
    }
    
    startGame(gameData) {
        this.gameData = gameData;
        this.gameEngine.startGame(gameData);
    }
    
    handleNumberDrawn(number) {
        this.audioManager.play('numberDrawn');
        this.uiManager.updateLastNumber(number);
        this.cardManager.markNumberOnCards(number);
        this.gameEngine.checkForBingo();
    }
    
    declareBingo() {
        this.audioManager.play('bingo');
        this.gameState = GAME_STATES.ROUND_END;
        this.saveState();
        
        // Send bingo claim to server
        this.socketManager.send({
            type: 'bingo_claim',
            playerId: this.playerId,
            cards: this.selectedCards
        });
        
        this.uiManager.showBingoButton(false);
    }
    
    showWinner(winnerData) {
        this.audioManager.play('win');
        this.gameState = GAME_STATES.GAME_END;
        this.uiManager.showWinnerScreen(winnerData);
        
        // Schedule auto-restart
        setTimeout(() => {
            this.restartGame();
        }, CONFIG.AUTO_RESTART_DELAY);
    }
    
    restartGame() {
        this.selectedCards = [];
        this.gameData = null;
        this.gameState = GAME_STATES.LOBBY;
        this.saveState();
        
        this.uiManager.showCardSelectionScreen();
        this.cardManager.generateSelectionCards();
    }
    
    handleBackButton() {
        switch(this.gameState) {
            case GAME_STATES.PLAYING:
                this.uiManager.showConfirmationModal('Leave Game', 'Are you sure you want to leave the current game?', () => {
                    this.restartGame();
                });
                break;
            case GAME_STATES.CARD_SELECTION:
                this.uiManager.showConfirmationModal('Leave Lobby', 'Are you sure you want to leave?', () => {
                    if (this.telegram) {
                        this.telegram.close();
                    }
                });
                break;
            default:
                if (this.telegram) {
                    this.telegram.close();
                }
        }
    }
    
    updatePlayersCount(count) {
        this.uiManager.updatePlayersCount(count);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bingoApp = new BingoApp();
});

export { BingoApp };
