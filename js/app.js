// Main Application Entry Point
class BingoApp {
    constructor() {
        this.initialized = false;
        this.modules = {};
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize modules
            await this.initializeModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize Telegram Web App
            this.initTelegramWebApp();
            
            // Connect to server
            this.connectToServer();
            
            // Initialize service worker
            this.initServiceWorker();
            
            // Hide loading screen
            setTimeout(() => {
                this.hideLoadingScreen();
                this.initialized = true;
                
                // Show welcome message
                this.showWelcomeMessage();
            }, 1000);
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showErrorScreen(error);
        }
    }
    
    async initializeModules() {
        // Initialize all modules
        this.modules.config = Config;
        this.modules.socket = getSocketManager();
        this.modules.game = getGameEngine();
        this.modules.cards = getCardManager();
        this.modules.ui = getUIManager();
        this.modules.audio = getAudioManager();
        this.modules.offline = getOfflineManager();
        
        // Wait for modules to be ready
        await Promise.all([
            this.modules.socket,
            this.modules.game,
            this.modules.cards,
            this.modules.ui,
            this.modules.audio,
            this.modules.offline
        ]);
        
        console.log('All modules initialized');
    }
    
    setupEventListeners() {
        // Socket events
        this.modules.socket.on('connected', () => this.handleSocketConnected());
        this.modules.socket.on('disconnected', () => this.handleSocketDisconnected());
        this.modules.socket.on('error', (error) => this.handleSocketError(error));
        
        // Game events
        document.addEventListener('game:status:updated', (e) => this.handleGameStatusUpdate(e));
        document.addEventListener('game:state:changed', (e) => this.handleGameStateChange(e));
        document.addEventListener('number:drawn', (e) => this.handleNumberDrawn(e));
        document.addEventListener('game:winner', (e) => this.handleGameWinner(e));
        
        // UI events
        document.addEventListener('view:changed', (e) => this.handleViewChange(e));
        document.addEventListener('modal:opened', (e) => this.handleModalOpened(e));
        document.addEventListener('toast:shown', (e) => this.handleToastShown(e));
        
        // App lifecycle events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
        
        // Custom app events
        this.setupCustomEventListeners();
    }
    
    setupCustomEventListeners() {
        // Card selection
        document.addEventListener('card:select:click', (e) => {
            this.modules.ui.showCardSelection();
        });
        
        // Bingo claim
        document.addEventListener('bingo:claim:click', (e) => {
            this.modules.ui.showBingoClaim(e.detail?.cardId);
        });
        
        // Quick select
        document.addEventListener('quick:select:click', () => {
            this.quickSelectCards();
        });
        
        // Auto daub toggle
        document.addEventListener('auto:daub:toggle', (e) => {
            this.toggleAutoDaub(e.detail?.enabled);
        });
        
        // Sound toggle
        document.addEventListener('sound:toggle', (e) => {
            this.toggleSound(e.detail?.enabled);
        });
    }
    
    initTelegramWebApp() {
        if (Config.TELEGRAM.ENABLED) {
            const tg = Telegram.WebApp;
            
            // Expand to full screen
            tg.expand();
            
            // Set theme colors
            this.applyTelegramTheme(tg.themeParams);
            
            // Enable closing confirmation
            tg.enableClosingConfirmation();
            
            // Setup back button
            tg.BackButton.onClick(() => {
                if (this.modules.ui.getCurrentView() !== 'game') {
                    this.modules.ui.switchView('game');
                } else {
                    tg.close();
                }
            });
            
            // Show back button if not on game view
            document.addEventListener('view:changed', (e) => {
                if (e.detail.newView !== 'game') {
                    tg.BackButton.show();
                } else {
                    tg.BackButton.hide();
                }
            });
            
            console.log('Telegram Web App initialized');
        }
    }
    
    applyTelegramTheme(themeParams) {
        if (!themeParams) return;
        
        // Apply Telegram theme colors
        if (themeParams.bg_color) {
            document.documentElement.style.setProperty('--bg-color', themeParams.bg_color);
        }
        
        if (themeParams.secondary_bg_color) {
            document.documentElement.style.setProperty('--surface-color', themeParams.secondary_bg_color);
        }
        
        if (themeParams.text_color) {
            document.documentElement.style.setProperty('--text-color', themeParams.text_color);
        }
        
        if (themeParams.button_color) {
            document.documentElement.style.setProperty('--primary-color', themeParams.button_color);
        }
        
        if (themeParams.button_text_color) {
            document.documentElement.style.setProperty('--text-color', themeParams.button_text_color);
        }
    }
    
    connectToServer() {
        this.modules.socket.connect();
    }
    
    async initServiceWorker() {
        if ('serviceWorker' in navigator && Config.FEATURES.PUSH_NOTIFICATIONS) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registered:', registration);
                
                // Request notification permission
                if (Notification.permission === 'default') {
                    const permission = await Notification.requestPermission();
                    console.log('Notification permission:', permission);
                }
                
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }
    
    // Event Handlers
    handleSocketConnected() {
        console.log('Socket connected');
        this.modules.ui.showToast('Connected to game server', { type: 'success' });
        
        // Update network status
        this.updateNetworkStatus(true);
    }
    
    handleSocketDisconnected() {
        console.log('Socket disconnected');
        this.modules.ui.showToast('Disconnected from server', { type: 'warning' });
        
        // Update network status
        this.updateNetworkStatus(false);
    }
    
    handleSocketError(error) {
        console.error('Socket error:', error);
        this.modules.ui.showToast(`Connection error: ${error.message}`, { type: 'error' });
    }
    
    handleGameStatusUpdate(e) {
        const gameState = e.detail;
        
        // Update UI with game status
        this.updateGameStatusUI(gameState);
        
        // Check if we need to show card selection
        if (gameState.phase === 'CARD_SELECTION') {
            this.showCardSelectionIfNeeded();
        }
    }
    
    handleGameStateChange(e) {
        const { oldPhase, newPhase, gameId } = e.detail;
        
        console.log(`Game phase changed: ${oldPhase} -> ${newPhase}`);
        
        // Show notification for phase changes
        if (newPhase === 'CARD_SELECTION') {
            this.modules.ui.showToast('Card selection started!', { type: 'info' });
            this.modules.ui.vibrate([100, 50, 100]);
        } else if (newPhase === 'ACTIVE') {
            this.modules.ui.showToast('Game started!', { type: 'success' });
            this.modules.ui.vibrate([200]);
        } else if (newPhase === 'ENDED') {
            this.modules.ui.showToast('Game ended', { type: 'info' });
        }
    }
    
    handleNumberDrawn(e) {
        const { number, letter } = e.detail;
        
        // Update UI
        this.modules.ui.showNumberDrawn(number, letter);
        
        // Play sound
        this.modules.audio.play('number_drawn');
        
        // Vibrate
        this.modules.ui.vibrate([100]);
    }
    
    handleGameWinner(e) {
        const winnerData = e.detail;
        
        // Show winner modal
        this.modules.ui.showWinner(winnerData);
        
        // Play win sound
        this.modules.audio.play('win');
        
        // Vibrate
        this.modules.ui.vibrate([200, 100, 200]);
    }
    
    handleViewChange(e) {
        const { oldView, newView } = e.detail;
        console.log(`View changed: ${oldView} -> ${newView}`);
        
        // Update page title
        const titles = {
            'game': 'Game - Geeze Bingo',
            'cards': 'My Cards - Geeze Bingo',
            'numbers': 'Numbers - Geeze Bingo',
            'wallet': 'Wallet - Geeze Bingo'
        };
        
        document.title = titles[newView] || 'Geeze Bingo';
    }
    
    handleModalOpened(e) {
        console.log(`Modal opened: ${e.detail.modalId}`);
    }
    
    handleToastShown(e) {
        console.log(`Toast shown: ${e.detail.id}`, e.detail.message);
    }
    
    handleOnline() {
        console.log('App is online');
        this.updateNetworkStatus(true);
        
        // Try to reconnect
        this.connectToServer();
    }
    
    handleOffline() {
        console.log('App is offline');
        this.updateNetworkStatus(false);
        
        this.modules.ui.showToast('You are offline', { type: 'warning' });
    }
    
    handleBeforeUnload() {
        // Save app state before leaving
        this.saveAppState();
        
        // Disconnect socket
        this.modules.socket.disconnect();
    }
    
    // UI Update Methods
    updateGameStatusUI(gameState) {
        // Update player count
        const playersCount = gameState.players?.size || 0;
        this.updateElement('playersCount', playersCount);
        
        // Update cards count
        const cardsCount = gameState.selectedCards?.size || 0;
        this.updateElement('cardsCount', `${cardsCount}/${Config.GAME.TOTAL_CARDS}`);
        
        // Update numbers count
        const numbersCount = gameState.drawnNumbers?.length || 0;
        this.updateElement('numbersCount', numbersCount);
        
        // Update prize pool
        const prizePool = gameState.prizePool || 0;
        this.updateElement('prizePool', prizePool.toFixed(2));
        
        // Update phase indicator
        this.updatePhaseIndicator(gameState.phase);
        
        // Update countdown timer
        if (gameState.countdown > 0) {
            this.updateElement('phaseTimer', `${gameState.countdown}s`);
            
            // Update progress bar
            const progress = (gameState.countdown / Config.GAME.CARD_SELECTION_TIME) * 100;
            const progressBar = document.getElementById('phaseProgress');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }
    }
    
    updatePhaseIndicator(phase) {
        const indicator = document.getElementById('phaseIndicator');
        if (!indicator) return;
        
        // Remove all phase classes
        indicator.classList.remove('waiting', 'selection', 'active', 'ended');
        
        // Add current phase class
        indicator.classList.add(phase.toLowerCase());
        
        // Update text
        const phaseText = {
            'IDLE': 'Waiting for game',
            'CARD_SELECTION': 'Card Selection',
            'ACTIVE': 'Game Active',
            'ENDED': 'Game Ended'
        };
        
        this.updateElement('phaseBadge', phaseText[phase] || phase);
    }
    
    updateNetworkStatus(online) {
        const statusElement = document.getElementById('networkStatus');
        if (!statusElement) return;
        
        if (online) {
            statusElement.textContent = 'Online';
            statusElement.className = 'network-status online';
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'network-status offline';
            statusElement.style.display = 'block';
        }
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    // Game Actions
    quickSelectCards() {
        const gameEngine = this.modules.game;
        const canSelect = gameEngine.quickSelectCards();
        
        if (canSelect) {
            this.modules.ui.showToast('Cards selected automatically', { type: 'success' });
        }
    }
    
    showCardSelectionIfNeeded() {
        const gameEngine = this.modules.game;
        const playerState = gameEngine.getPlayerState();
        
        // Show card selection if player has no cards
        if (playerState.selectedCards.size === 0) {
            setTimeout(() => {
                this.modules.ui.showCardSelection();
            }, 1000);
        }
    }
    
    toggleAutoDaub(enabled = null) {
        const current = this.modules.game.getUIState().autoDaub;
        const newState = enabled !== null ? enabled : !current;
        
        this.modules.game.setAutoDaub(newState);
        
        // Update UI
        const button = document.getElementById('autoDaubBtn');
        if (button) {
            button.textContent = newState ? 'Auto Daub: ON' : 'Auto Daub: OFF';
            button.classList.toggle('active', newState);
        }
        
        this.modules.ui.showToast(
            `Auto daub ${newState ? 'enabled' : 'disabled'}`,
            { type: 'info' }
        );
    }
    
    toggleSound(enabled = null) {
        const current = this.modules.game.getUIState().soundEnabled;
        const newState = enabled !== null ? enabled : !current;
        
        this.modules.game.setSoundEnabled(newState);
        
        // Update UI
        const button = document.getElementById('soundToggle');
        if (button) {
            const icon = button.querySelector('.sound-icon');
            if (icon) {
                icon.textContent = newState ? '🔊' : '🔇';
            }
        }
        
        // Play test sound if enabling
        if (newState && !current) {
            this.modules.audio.play('button_click');
        }
    }
    
    // App State Management
    saveAppState() {
        try {
            // Save game state
            const gameState = this.modules.game.getGameState();
            const playerState = this.modules.game.getPlayerState();
            const cardState = this.modules.game.getCardState();
            
            const appState = {
                timestamp: Date.now(),
                gameState: {
                    phase: gameState.phase,
                    gameId: gameState.gameId,
                    drawnNumbers: gameState.drawnNumbers,
                    countdown: gameState.countdown
                },
                playerState: {
                    selectedCards: Array.from(playerState.selectedCards),
                    balance: playerState.balance,
                    stats: playerState.stats
                },
                cardState: {
                    takenCards: Array.from(cardState.takenCards)
                }
            };
            
            Config.saveToStorage('app_state', appState);
            console.log('App state saved');
            
        } catch (error) {
            console.error('Failed to save app state:', error);
        }
    }
    
    loadAppState() {
        try {
            const appState = Config.loadFromStorage('app_state');
            if (!appState) return;
            
            // Check if state is not too old (1 hour)
            const oneHour = 60 * 60 * 1000;
            if (Date.now() - appState.timestamp > oneHour) {
                console.log('App state is too old, ignoring');
                return;
            }
            
            console.log('Loaded app state from:', new Date(appState.timestamp).toLocaleString());
            return appState;
            
        } catch (error) {
            console.error('Failed to load app state:', error);
            return null;
        }
    }
    
    // UI Methods
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('appContainer');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
        
        if (appContainer) {
            appContainer.style.display = 'none';
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('appContainer');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        if (appContainer) {
            appContainer.style.display = 'block';
        }
    }
    
    showErrorScreen(error) {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div class="error-screen">
                    <div class="error-icon">❌</div>
                    <h2 class="error-title">Failed to Load</h2>
                    <p class="error-message">${error.message || 'Unknown error'}</p>
                    <button class="btn-primary" onclick="location.reload()">
                        Retry
                    </button>
                </div>
            `;
        }
    }
    
    showWelcomeMessage() {
        const username = Config.getUsername();
        const isFirstVisit = !Config.loadFromStorage('has_visited');
        
        if (isFirstVisit) {
            this.modules.ui.showToast(`Welcome to Geeze Bingo, ${username}! 🎉`, {
                type: 'success',
                duration: 5000
            });
            
            Config.saveToStorage('has_visited', true);
        } else {
            this.modules.ui.showToast(`Welcome back, ${username}!`, {
                type: 'info',
                duration: 3000
            });
        }
    }
    
    // Public API Methods
    openCardSelection() {
        return this.modules.ui.showCardSelection();
    }
    
    closeCardSelection() {
        return this.modules.ui.hideModal('cardSelectionModal');
    }
    
    claimBingo(cardId = null) {
        return this.modules.ui.showBingoClaim(cardId);
    }
    
    closeBingoClaim() {
        return this.modules.ui.hideModal('bingoClaimModal');
    }
    
    showWalletView() {
        this.modules.ui.switchView('wallet');
    }
    
    showDepositModal() {
        this.modules.ui.showModal('depositModal');
    }
    
    showWithdrawModal() {
        this.modules.ui.showModal('withdrawModal');
    }
    
    showRulesModal() {
        this.modules.ui.showModal('rulesModal');
    }
    
    closeRulesModal() {
        this.modules.ui.hideModal('rulesModal');
    }
    
    // Debug methods
    debug() {
        console.group('Bingo App Debug Info');
        
        console.log('App initialized:', this.initialized);
        console.log('Config:', Config);
        console.log('Modules:', Object.keys(this.modules));
        
        if (this.modules.game) {
            console.log('Game State:', this.modules.game.getGameState());
            console.log('Player State:', this.modules.game.getPlayerState());
        }
        
        if (this.modules.socket) {
            console.log('Socket State:', this.modules.socket.getConnectionState());
        }
        
        if (this.modules.ui) {
            console.log('UI State:', this.modules.ui.getCurrentView());
        }
        
        console.groupEnd();
    }
}

// Global app instance
let appInstance = null;

function getApp() {
    if (!appInstance) {
        appInstance = new BingoApp();
    }
    return appInstance;
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize app
    window.app = getApp();
    
    // Make app globally available
    window.BingoApp = BingoApp;
    window.getApp = getApp;
    
    // Global helper functions
    window.openCardSelection = () => app.openCardSelection();
    window.closeCardSelection = () => app.closeCardSelection();
    window.claimBingo = (cardId) => app.claimBingo(cardId);
    window.closeBingoClaim = () => app.closeBingoClaim();
    window.showWalletView = () => app.showWalletView();
    window.showDepositModal = () => app.showDepositModal();
    window.showWithdrawModal = () => app.showWithdrawModal();
    window.showRulesModal = () => app.showRulesModal();
    window.closeRulesModal = () => app.closeRulesModal();
    window.toggleAutoDaub = (enabled) => app.toggleAutoDaub(enabled);
    window.toggleSound = (enabled) => app.toggleSound(enabled);
    
    console.log('Bingo App initialized');
});

// Handle service worker messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        switch (type) {
            case 'NEW_GAME':
                app.modules.ui.showToast('New game starting soon!', { type: 'info' });
                break;
                
            case 'NUMBER_DRAWN':
                if (data) {
                    app.modules.ui.showNumberDrawn(data.number, data.letter);
                }
                break;
                
            case 'WINNER':
                if (data) {
                    app.modules.ui.showWinner(data);
                }
                break;
        }
    });
}

// Handle app install
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    
    // Stash the event so it can be triggered later
    window.deferredPrompt = e;
    
    // Show install button
    const installButton = document.getElementById('installButton');
    if (installButton) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', () => {
            // Show the install prompt
            e.prompt();
            
            // Wait for the user to respond to the prompt
            e.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted install');
                } else {
                    console.log('User dismissed install');
                }
                window.deferredPrompt = null;
            });
        });
    }
});

// Handle app installed
window.addEventListener('appinstalled', () => {
    console.log('App installed successfully');
    window.deferredPrompt = null;
    
    // Hide install button
    const installButton = document.getElementById('installButton');
    if (installButton) {
        installButton.style.display = 'none';
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BingoApp, getApp };
}
