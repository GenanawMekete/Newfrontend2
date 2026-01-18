// Main Application Entry Point
import { UIManager } from './ui-manager.js';
import { CardManager } from './card-manager.js';
import { AudioManager } from './audio-manager.js';
import { SocketManager } from './socket-manager.js';
import { GameEngine } from './game-engine.js';
import { OfflineManager } from './offline-manager.js';
import { CONFIG, GAME_STATES } from './config.js';

class BingoApp {
    constructor() {
        // Initialize managers
        this.uiManager = new UIManager();
        this.cardManager = new CardManager();
        this.audioManager = new AudioManager();
        this.socketManager = new SocketManager();
        this.gameEngine = new GameEngine();
        this.offlineManager = new OfflineManager();
        
        // Application state
        this.state = {
            gameState: GAME_STATES.IDLE,
            selectedCards: new Set(),
            availableCards: new Set(),
            userData: null,
            gameData: null,
            isOnline: navigator.onLine,
            theme: CONFIG.DEFAULT_THEME,
            soundEnabled: CONFIG.AUDIO_ENABLED
        };
        
        // Initialize Telegram Web App
        this.tg = window.Telegram.WebApp;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.handleCardSelect = this.handleCardSelect.bind(this);
        this.handleCardPreview = this.handleCardPreview.bind(this);
        this.handleConfirmSelection = this.handleConfirmSelection.bind(this);
        this.handleClearSelection = this.handleClearSelection.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleThemeToggle = this.handleThemeToggle.bind(this);
        this.handleSoundToggle = this.handleSoundToggle.bind(this);
        
        // Initialize service worker
        this.registerServiceWorker();
    }
    
    // Initialize the application
    async init() {
        try {
            // Initialize Telegram Web App
            this.initTelegram();
            
            // Initialize UI
            this.uiManager.init();
            
            // Initialize audio
            await this.audioManager.init();
            
            // Load user preferences
            this.loadPreferences();
            
            // Initialize card grid
            await this.initCardGrid();
            
            // Check online status
            this.initOnlineStatus();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize game if returning player
            await this.checkExistingGame();
            
            console.log('Bingo App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.uiManager.showError('Failed to initialize application. Please refresh the page.');
        }
    }
    
    // Initialize Telegram Web App
    initTelegram() {
        if (this.tg) {
            // Expand the web app to full height
            this.tg.expand();
            
            // Set theme colors
            this.tg.setHeaderColor('#17212b');
            this.tg.setBackgroundColor('#17212b');
            
            // Enable closing confirmation
            this.tg.enableClosingConfirmation();
            
            // Get user data
            this.state.userData = this.tg.initDataUnsafe?.user || null;
            
            // Update UI with user info
            if (this.state.userData) {
                this.uiManager.updateUserInfo(this.state.userData);
            }
            
            // Handle back button
            this.tg.BackButton.onClick(() => {
                if (this.state.gameState === GAME_STATES.PLAYING) {
                    this.showExitConfirmation();
                } else {
                    this.tg.close();
                }
            });
        }
    }
    
    // Initialize card grid with numbers 1-400
    async initCardGrid() {
        try {
            // Show loading state
            this.uiManager.showLoading('Loading available cards...');
            
            // Get available cards from server or local cache
            const availableCards = await this.cardManager.getAvailableCards();
            this.state.availableCards = new Set(availableCards);
            
            // Generate card grid
            this.uiManager.generateCardGrid(
                CONFIG.MAX_CARDS,
                this.state.availableCards,
                this.handleCardClick,
                this.handleCardPreview
            );
            
            // Update stats
            this.uiManager.updateStats({
                totalCards: CONFIG.MAX_CARDS,
                availableCards: availableCards.length,
                selectedCards: this.state.selectedCards.size
            });
            
        } catch (error) {
            console.error('Failed to initialize card grid:', error);
            this.uiManager.showError('Failed to load cards. Please try again.');
        }
    }
    
    // Handle card click
    handleCardClick(cardNumber) {
        if (!this.state.availableCards.has(cardNumber)) {
            this.uiManager.showToast('This card is not available', 'error');
            return;
        }
        
        if (this.state.selectedCards.has(cardNumber)) {
            // Remove from selection
            this.state.selectedCards.delete(cardNumber);
            this.uiManager.updateCardSelection(cardNumber, false);
            this.audioManager.play('button-click');
        } else {
            // Check max selection limit
            if (this.state.selectedCards.size >= CONFIG.MAX_SELECTION) {
                this.uiManager.showToast(
                    `You can only select up to ${CONFIG.MAX_SELECTION} cards`,
                    'warning'
                );
                return;
            }
            
            // Add to selection
            this.state.selectedCards.add(cardNumber);
            this.uiManager.updateCardSelection(cardNumber, true);
            this.audioManager.play('card-select');
        }
        
        // Update selection count
        this.uiManager.updateSelectionCount(this.state.selectedCards.size);
        
        // Save selection
        this.saveSelection();
    }
    
    // Handle card preview
    async handleCardPreview(cardNumber) {
        try {
            // Show loading in modal
            this.uiManager.showCardPreviewLoading(cardNumber);
            
            // Get card data
            const cardData = await this.cardManager.getCardData(cardNumber);
            
            // Display card preview
            this.uiManager.displayCardPreview(cardNumber, cardData);
            
            // Show modal
            this.uiManager.showCardPreviewModal();
            
        } catch (error) {
            console.error('Failed to load card preview:', error);
            this.uiManager.showError('Failed to load card details.');
        }
    }
    
    // Handle confirm selection
    async handleConfirmSelection() {
        if (this.state.selectedCards.size === 0) {
            this.uiManager.showToast('Please select at least one card', 'warning');
            return;
        }
        
        try {
            // Validate selected cards
            const validationResults = await this.cardManager.validateCards(
                Array.from(this.state.selectedCards)
            );
            
            // Check if all cards are valid
            const invalidCards = validationResults.filter(result => !result.valid);
            
            if (invalidCards.length > 0) {
                this.uiManager.showToast(
                    'Some selected cards are no longer available',
                    'error'
                );
                return;
            }
            
            // Start the game
            await this.startGame();
            
        } catch (error) {
            console.error('Failed to confirm selection:', error);
            this.uiManager.showError('Failed to start game. Please try again.');
        }
    }
    
    // Start the game
    async startGame() {
        try {
            // Update game state
            this.state.gameState = GAME_STATES.PLAYING;
            
            // Initialize game engine
            await this.gameEngine.init(Array.from(this.state.selectedCards));
            
            // Switch to game board view
            this.uiManager.showGameBoard();
            
            // Start WebSocket connection
            await this.socketManager.connect();
            
            // Save game state
            this.saveGameState();
            
            // Play start sound
            this.audioManager.play('win');
            
            // Show success message
            this.uiManager.showToast('Game started! Good luck!', 'success');
            
            // Update Telegram back button
            if (this.tg) {
                this.tg.BackButton.show();
            }
            
        } catch (error) {
            console.error('Failed to start game:', error);
            this.uiManager.showError('Failed to start game. Please try again.');
        }
    }
    
    // Handle clear selection
    handleClearSelection() {
        this.state.selectedCards.clear();
        this.uiManager.clearCardSelection();
        this.uiManager.updateSelectionCount(0);
        this.saveSelection();
        this.audioManager.play('button-click');
    }
    
    // Handle search
    handleSearch(searchTerm) {
        this.uiManager.filterCards(searchTerm);
    }
    
    // Handle theme toggle
    handleThemeToggle() {
        const themes = Object.values(CONFIG.THEMES);
        const currentIndex = themes.indexOf(this.state.theme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        
        this.state.theme = nextTheme;
        this.uiManager.setTheme(nextTheme);
        this.savePreferences();
        
        // Update icon
        const icon = nextTheme === 'dark' ? '🌙' : '☀️';
        document.querySelector('.theme-icon').textContent = icon;
    }
    
    // Handle sound toggle
    handleSoundToggle() {
        this.state.soundEnabled = !this.state.soundEnabled;
        this.audioManager.setEnabled(this.state.soundEnabled);
        
        // Update icon
        const icon = this.state.soundEnabled ? '🔊' : '🔇';
        document.querySelector('.sound-icon').textContent = icon;
        
        this.savePreferences();
    }
    
    // Save selection to local storage
    saveSelection() {
        const selection = Array.from(this.state.selectedCards);
        localStorage.setItem(
            CONFIG.STORAGE_KEYS.SELECTED_CARDS,
            JSON.stringify(selection)
        );
    }
    
    // Save preferences to local storage
    savePreferences() {
        const prefs = {
            theme: this.state.theme,
            soundEnabled: this.state.soundEnabled,
            volume: this.audioManager.getVolume()
        };
        
        localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER_PREFERENCES,
            JSON.stringify(prefs)
        );
    }
    
    // Load preferences from local storage
    loadPreferences() {
        try {
            const prefs = JSON.parse(
                localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES)
            ) || {};
            
            if (prefs.theme) {
                this.state.theme = prefs.theme;
                this.uiManager.setTheme(prefs.theme);
            }
            
            if (prefs.soundEnabled !== undefined) {
                this.state.soundEnabled = prefs.soundEnabled;
                this.audioManager.setEnabled(prefs.soundEnabled);
            }
            
            if (prefs.volume) {
                this.audioManager.setVolume(prefs.volume);
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    }
    
    // Save game state
    saveGameState() {
        const gameState = {
            selectedCards: Array.from(this.state.selectedCards),
            gameState: this.state.gameState,
            gameData: this.gameEngine.getState(),
            timestamp: Date.now()
        };
        
        localStorage.setItem(
            CONFIG.STORAGE_KEYS.GAME_STATE,
            JSON.stringify(gameState)
        );
    }
    
    // Check for existing game
    async checkExistingGame() {
        try {
            const savedState = localStorage.getItem(CONFIG.STORAGE_KEYS.GAME_STATE);
            
            if (savedState) {
                const gameState = JSON.parse(savedState);
                const isExpired = Date.now() - gameState.timestamp > CONFIG.CACHE_TTL;
                
                if (!isExpired && gameState.gameState === GAME_STATES.PLAYING) {
                    // Restore game
                    this.state.selectedCards = new Set(gameState.selectedCards);
                    this.state.gameState = gameState.gameState;
                    
                    // Update UI
                    this.uiManager.updateCardSelectionFromSet(this.state.selectedCards);
                    this.uiManager.updateSelectionCount(this.state.selectedCards.size);
                    
                    // Start game
                    await this.startGame();
                }
            }
        } catch (error) {
            console.error('Failed to restore game:', error);
        }
    }
    
    // Show exit confirmation
    showExitConfirmation() {
        if (confirm('Are you sure you want to exit the game? Your progress will be saved.')) {
            this.saveGameState();
            if (this.tg) {
                this.tg.close();
            }
        }
    }
    
    // Initialize online status monitoring
    initOnlineStatus() {
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.uiManager.updateOnlineStatus(true);
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.uiManager.updateOnlineStatus(false);
        });
        
        this.uiManager.updateOnlineStatus(this.state.isOnline);
    }
    
    // Sync offline data when back online
    async syncOfflineData() {
        if (this.offlineManager.hasPendingActions()) {
            try {
                await this.offlineManager.sync();
                this.uiManager.showToast('Synced offline data', 'success');
            } catch (error) {
                console.error('Failed to sync offline data:', error);
            }
        }
    }
    
    // Register service worker
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration);
                })
                .catch(error => {
                    console.error('ServiceWorker registration failed:', error);
                });
        }
    }
    
    // Set up event listeners
    setupEventListeners() {
        // Card selection
        document.addEventListener('cardSelected', (event) => {
            this.handleCardClick(event.detail);
        });
        
        // Card preview
        document.addEventListener('cardPreview', (event) => {
            this.handleCardPreview(event.detail);
        });
        
        // Buttons
        document.getElementById('confirmSelection').addEventListener('click', this.handleConfirmSelection);
        document.getElementById('clearSelection').addEventListener('click', this.handleClearSelection);
        document.getElementById('toggleTheme').addEventListener('click', this.handleThemeToggle);
        document.getElementById('toggleSound').addEventListener('click', this.handleSoundToggle);
        
        // Search
        const searchInput = document.getElementById('cardSearch');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', () => {
            this.handleSearch(searchInput.value);
        });
        
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.handleSearch('');
            searchInput.focus();
        });
        
        // Modal
        document.getElementById('closePreview').addEventListener('click', () => {
            this.uiManager.hideCardPreviewModal();
        });
        
        document.getElementById('closePreviewBtn').addEventListener('click', () => {
            this.uiManager.hideCardPreviewModal();
        });
        
        document.getElementById('selectPreviewCard').addEventListener('click', () => {
            const cardNumber = parseInt(document.getElementById('previewCardNumber').textContent);
            if (!this.state.selectedCards.has(cardNumber)) {
                this.handleCardClick(cardNumber);
            }
            this.uiManager.hideCardPreviewModal();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.uiManager.isModalVisible()) {
                    this.uiManager.hideCardPreviewModal();
                }
            }
        });
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new BingoApp();
    window.bingoApp = app; // Make available globally for debugging
    app.init();
});
