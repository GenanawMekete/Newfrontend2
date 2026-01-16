// Mobile Bingo App
class MobileBingoApp {
    constructor() {
        this.userId = null;
        this.username = 'Guest';
        this.balance = 0;
        this.selectedCards = new Set();
        this.gameState = 'IDLE';
        this.socket = null;
        this.currentView = 'game';
        this.selectedPattern = null;
        this.autoDaub = true;
        
        this.init();
    }

    init() {
        // Initialize mobile-specific features
        this.initMobileUI();
        this.initTelegram();
        this.connectSocket();
        this.initEventListeners();
        this.loadUserData();
        
        // Set initial view
        this.switchView('game');
    }

    initMobileUI() {
        // Initialize number grid for mobile
        this.initNumberGridMobile();
        
        // Initialize card grid for mobile
        this.initCardGridMobile();
        
        // Initialize recent numbers
        this.initRecentNumbers();
        
        // Update user info
        this.updateMobileUserInfo();
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            const tg = Telegram.WebApp;
            
            // Expand to full screen
            tg.expand();
            
            // Set theme colors
            this.setThemeColors(tg.themeParams);
            
            // Get user data
            const user = tg.initDataUnsafe?.user;
            if (user) {
                this.userId = user.id.toString();
                this.username = user.username || user.first_name || `User${user.id}`;
                
                // Update UI with user info
                this.updateMobileUserInfo();
            }
            
            // Handle back button
            tg.BackButton.onClick(() => {
                if (this.isModalOpen()) {
                    this.closeAllModals();
                } else {
                    tg.close();
                }
            });
            
            // Enable closing confirmation
            tg.enableClosingConfirmation();
            
        } else {
            // Fallback for browser testing
            this.userId = 'test_' + Date.now();
            this.username = 'Mobile Tester';
            this.updateMobileUserInfo();
        }
    }

    setThemeColors(themeParams) {
        // Set CSS variables based on Telegram theme
        if (themeParams.bg_color) {
            document.documentElement.style.setProperty('--bg-color', themeParams.bg_color);
        }
        if (themeParams.secondary_bg_color) {
            document.documentElement.style.setProperty('--card-bg', themeParams.secondary_bg_color);
        }
        if (themeParams.text_color) {
            document.documentElement.style.setProperty('--light-color', themeParams.text_color);
        }
    }

    connectSocket() {
        const socketUrl = this.getSocketUrl();
        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Socket event handlers
        this.socket.on('connect', () => {
            console.log('Mobile: Connected to server');
            this.showToast('Connected to game server');
            
            // Join as player
            this.socket.emit('player:join', {
                userId: this.userId,
                username: this.username
            });
        });

        this.socket.on('disconnect', () => {
            this.showToast('Disconnected from server', 'warning');
        });

        this.socket.on('game:state', (state) => {
            this.handleGameStateChange(state);
        });

        this.socket.on('game:countdown', (data) => {
            this.updateCountdownMobile(data);
        });

        this.socket.on('game:number:drawn', (data) => {
            this.handleNumberDrawnMobile(data);
        });

        this.socket.on('game:winner', (data) => {
            this.showWinnerModal(data);
        });

        this.socket.on('cards:grid', (grid) => {
            this.updateCardGridMobile(grid);
        });

        this.socket.on('player:cards', (cards) => {
            this.updatePlayerCardsMobile(cards);
        });

        this.socket.on('error', (error) => {
            this.showToast(error.message || 'Error', 'error');
        });
    }

    getSocketUrl() {
        // Auto-detect socket URL
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:3000';
        }
        return window.location.origin;
    }

    initEventListeners() {
        // Mobile navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // Menu button
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.openSideMenu();
        });

        // Close menu button
        document.getElementById('closeMenuBtn').addEventListener('click', () => {
            this.closeSideMenu();
        });

        // Game control buttons
        document.getElementById('selectCardsBtn').addEventListener('click', () => {
            this.openCardSelectModal();
        });

        document.getElementById('bingoBtn').addEventListener('click', () => {
            this.claimBingoMobile();
        });

        document.getElementById('autoDaubBtn').addEventListener('click', () => {
            this.toggleAutoDaub();
        });

        // Wallet actions
        document.querySelectorAll('.wallet-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleWalletAction(action);
            });
        });

        // Bingo letter filters
        document.querySelectorAll('.bingo-letter').forEach(letter => {
            letter.addEventListener('click', (e) => {
                this.filterNumbersByLetter(e.currentTarget.dataset.letter);
            });
        });

        // Swipe gestures
        this.initSwipeGestures();
        
        // Touch device optimizations
        this.initTouchOptimizations();
    }

    initSwipeGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        const minSwipeDistance = 50;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            // Horizontal swipe (for switching views)
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX > 0) {
                    // Swipe right - previous view
                    this.swipeToPreviousView();
                } else {
                    // Swipe left - next view
                    this.swipeToNextView();
                }
            }
            
            // Vertical swipe (for closing modals)
            if (Math.abs(deltaY) > minSwipeDistance && this.isModalOpen()) {
                if (deltaY > 0) {
                    // Swipe down - close modal
                    this.closeAllModals();
                }
            }
        });
    }

    initTouchOptimizations() {
        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // Prevent pull-to-refresh in modals
        document.addEventListener('touchmove', (e) => {
            if (this.isModalOpen()) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });

        // Update content
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
            if (container.id === `${viewName}View`) {
                container.classList.add('active');
            }
        });

        this.currentView = viewName;
        
        // Update specific view content
        switch(viewName) {
            case 'game':
                this.updateGameView();
                break;
            case 'cards':
                this.updateCardsView();
                break;
            case 'numbers':
                this.updateNumbersView();
                break;
            case 'wallet':
                this.updateWalletView();
                break;
        }
    }

    swipeToNextView() {
        const views = ['game', 'cards', 'numbers', 'wallet'];
        const currentIndex = views.indexOf(this.currentView);
        const nextIndex = (currentIndex + 1) % views.length;
        this.switchView(views[nextIndex]);
    }

    swipeToPreviousView() {
        const views = ['game', 'cards', 'numbers', 'wallet'];
        const currentIndex = views.indexOf(this.currentView);
        const prevIndex = (currentIndex - 1 + views.length) % views.length;
        this.switchView(views[prevIndex]);
    }

    handleGameStateChange(state) {
        this.gameState = state.state;
        
        // Update UI
        this.updateGamePhase(state.state);
        this.updateGameStats(state);
        
        // Handle specific states
        if (state.state === 'CARD_SELECTION') {
            this.openCardSelectModal();
        } else if (state.state === 'ACTIVE') {
            this.closeAllModals();
        } else if (state.state === 'ENDED') {
            // Already handled by winner modal
        }
    }

    updateGamePhase(state) {
        const phaseBadge = document.getElementById('phaseBadge');
        const phaseTimer = document.getElementById('phaseTimer');
        
        switch(state) {
            case 'IDLE':
                phaseBadge.textContent = 'Waiting';
                phaseTimer.textContent = '--';
                break;
            case 'CARD_SELECTION':
                phaseBadge.textContent = 'Select Cards';
                break;
            case 'ACTIVE':
                phaseBadge.textContent = 'Game Active';
                break;
            case 'ENDED':
                phaseBadge.textContent = 'Game Ended';
                phaseTimer.textContent = '--';
                break;
        }
    }

    updateCountdownMobile(data) {
        const phaseTimer = document.getElementById('phaseTimer');
        const selectionTime = document.getElementById('mobileSelectionTime');
        
        if (data.phase === 'CARD_SELECTION') {
            phaseTimer.textContent = `${data.timeLeft}s`;
            selectionTime.textContent = `${data.timeLeft}s`;
            
            // Update card selection modal if open
            if (document.getElementById('cardSelectModal').classList.contains('open')) {
                selectionTime.textContent = `${data.timeLeft}s`;
            }
        }
    }

    updateGameStats(status) {
        document.getElementById('mobilePlayerCount').textContent = status.playerCount || 0;
        document.getElementById('mobileCardCount').textContent = `${status.takenCards || 0}/400`;
        document.getElementById('mobileNumberCount').textContent = status.drawnNumbers?.length || 0;
        document.getElementById('drawnCount').textContent = status.drawnNumbers?.length || 0;
    }

    handleNumberDrawnMobile(data) {
        // Add to recent numbers
        this.addRecentNumberMobile(data.number);
        
        // Update numbers grid
        this.markNumberAsDrawn(data.number);
        
        // Show toast notification
        this.showNumberToast(data.number);
        
        // Update player cards if auto-daub is enabled
        if (this.autoDaub) {
            this.updateCardMarkings();
        }
        
        // Update drawn numbers list
        this.updateDrawnNumbersList(data.drawnNumbers);
    }

    addRecentNumberMobile(number) {
        const container = document.getElementById('mobileRecentNumbers');
        const letter = this.getNumberLetter(number);
        
        const numberEl = document.createElement('div');
        numberEl.className = 'recent-number-mobile';
        numberEl.innerHTML = `
            <div class="number-value">${number}</div>
            <div class="number-letter">${letter}</div>
        `;
        
        container.insertBefore(numberEl, container.firstChild);
        
        // Keep only 8 recent numbers
        if (container.children.length > 8) {
            container.removeChild(container.lastChild);
        }
    }

    getNumberLetter(number) {
        if (number <= 15) return 'B';
        if (number <= 30) return 'I';
        if (number <= 45) return 'N';
        if (number <= 60) return 'G';
        return 'O';
    }

    markNumberAsDrawn(number) {
        const cell = document.querySelector(`.number-cell-mobile[data-number="${number}"]`);
        if (cell) {
            cell.classList.add('drawn', 'recent');
            setTimeout(() => cell.classList.remove('recent'), 1000);
        }
    }

    showNumberToast(number) {
        const toast = document.getElementById('numberToast');
        const letter = this.getNumberLetter(number);
        
        document.getElementById('toastNumber').textContent = number;
        document.getElementById('toastLetter').textContent = letter;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    updateDrawnNumbersList(numbers) {
        const container = document.getElementById('drawnNumbersList');
        container.innerHTML = '';
        
        numbers.forEach((number, index) => {
            const div = document.createElement('div');
            div.className = 'drawn-number-item';
            div.innerHTML = `
                <span class="drawn-index">${index + 1}.</span>
                <span class="drawn-value">${number}</span>
                <span class="drawn-letter">${this.getNumberLetter(number)}</span>
            `;
            container.appendChild(div);
        });
    }

    updateCardGridMobile(grid) {
        const container = document.getElementById('cardGridMobile');
        if (!container) return;
        
        container.innerHTML = '';
        
        grid.forEach(card => {
            const cell = document.createElement('div');
            cell.className = 'grid-card-mobile';
            cell.dataset.cardId = card.id;
            cell.textContent = card.id;
            
            if (card.selected) {
                if (card.owner === this.userId) {
                    cell.classList.add('selected');
                    cell.onclick = () => this.showCardDetails(card.id);
                } else {
                    cell.classList.add('taken');
                    cell.onclick = null;
                }
            } else {
                cell.onclick = () => this.selectCardMobile(card.id);
            }
            
            container.appendChild(cell);
        });
        
        // Update available count
        const available = grid.filter(c => !c.selected).length;
        document.getElementById('mobileAvailableCount').textContent = available;
    }

    selectCardMobile(cardId) {
        if (this.gameState !== 'CARD_SELECTION') {
            this.showToast('Not in card selection phase', 'error');
            return;
        }
        
        if (this.selectedCards.size >= 4) {
            this.showToast('Maximum 4 cards allowed', 'error');
            return;
        }
        
        if (this.selectedCards.has(cardId)) {
            this.showToast('Card already selected', 'error');
            return;
        }
        
        this.socket.emit('card:select', {
            userId: this.userId,
            cardId: cardId
        });
    }

    autoSelectCardsMobile() {
        if (this.gameState !== 'CARD_SELECTION') {
            this.showToast('Not in card selection phase', 'error');
            return;
        }
        
        // Find available cards
        const availableCards = [];
        const cards = document.querySelectorAll('.grid-card-mobile:not(.taken):not(.selected)');
        
        cards.forEach(card => {
            if (availableCards.length < 4) {
                availableCards.push(parseInt(card.dataset.cardId));
            }
        });
        
        // Select cards
        availableCards.forEach(cardId => {
            this.selectCardMobile(cardId);
        });
        
        this.showToast(`Selected ${availableCards.length} cards`);
    }

    confirmSelectionMobile() {
        if (this.selectedCards.size === 0) {
            this.showToast('Please select at least one card', 'error');
            return;
        }
        
        this.closeCardSelectModal();
        this.showToast('Cards confirmed! Ready for game.');
    }

    claimBingoMobile() {
        if (this.selectedCards.size === 0) {
            this.showToast('You have no cards', 'error');
            return;
        }
        
        if (this.gameState !== 'ACTIVE') {
            this.showToast('Game not active', 'error');
            return;
        }
        
        // Open bingo claim modal with first selected card
        const cardId = Array.from(this.selectedCards)[0];
        this.openBingoClaimModal(cardId);
    }

    openBingoClaimModal(cardId) {
        const modal = document.getElementById('bingoClaimModalMobile');
        modal.classList.add('open');
        
        document.getElementById('claimCardIdMobile').textContent = cardId;
        
        // Reset pattern selection
        this.selectedPattern = null;
        document.querySelectorAll('.pattern-mobile').forEach(p => {
            p.classList.remove('selected');
        });
    }

    selectPatternMobile(pattern) {
        this.selectedPattern = pattern;
        
        document.querySelectorAll('.pattern-mobile').forEach(p => {
            p.classList.remove('selected');
        });
        
        document.querySelector(`.pattern-mobile[data-pattern="${pattern}"]`).classList.add('selected');
    }

    submitBingoClaimMobile() {
        if (!this.selectedPattern) {
            this.showToast('Please select a winning pattern', 'error');
            return;
        }
        
        const cardId = document.getElementById('claimCardIdMobile').textContent;
        
        this.socket.emit('bingo:claim', {
            userId: this.userId,
            cardId: parseInt(cardId),
            pattern: this.selectedPattern
        });
        
        this.closeBingoModalMobile();
    }

    showWinnerModal(data) {
        const modal = document.getElementById('winnerModalMobile');
        const message = document.getElementById('winnerMessageMobile');
        
        if (data.userId === this.userId) {
            message.textContent = '🎉 CONGRATULATIONS! YOU WON! 🎉';
            this.playWinSound();
        } else {
            message.textContent = `Player won with ${data.winType}!`;
        }
        
        document.getElementById('winnerCardId').textContent = data.cardId;
        document.getElementById('winnerPattern').textContent = data.winType;
        
        modal.classList.add('open');
        
        // Start next game countdown
        let countdown = 10;
        const timerEl = document.getElementById('nextGameTimer');
        
        const timer = setInterval(() => {
            countdown--;
            timerEl.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(timer);
                modal.classList.remove('open');
            }
        }, 1000);
    }

    // Modal controls
    openCardSelectModal() {
        document.getElementById('cardSelectModal').classList.add('open');
    }

    closeCardSelectModal() {
        document.getElementById('cardSelectModal').classList.remove('open');
    }

    closeBingoModalMobile() {
        document.getElementById('bingoClaimModalMobile').classList.remove('open');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-mobile.open').forEach(modal => {
            modal.classList.remove('open');
        });
    }

    isModalOpen() {
        return document.querySelector('.modal-mobile.open') !== null;
    }

    // Side menu controls
    openSideMenu() {
        document.getElementById('sideMenu').classList.add('open');
    }

    closeSideMenu() {
        document.getElementById('sideMenu').classList.remove('open');
    }

    // Utility methods
    showToast(message, type = 'info') {
        // In a real app, you'd use a proper toast library
        alert(message); // Simplified for now
    }

    updateMobileUserInfo() {
        document.getElementById('mobileUsername').textContent = this.username;
        document.getElementById('mobileUserId').textContent = `ID: ${this.userId?.substring(0, 8) || '--'}`;
        document.getElementById('mobileBalance').textContent = this.balance.toFixed(2);
        document.getElementById('walletBalance').textContent = this.balance.toFixed(2);
    }

    playWinSound() {
        // Play win sound
        const audio = new Audio('assets/sounds/win.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed:', e));
    }

    toggleAutoDaub() {
        this.autoDaub = !this.autoDaub;
        const btn = document.getElementById('autoDaubBtn');
        btn.textContent = this.autoDaub ? 'Auto Daub: ON' : 'Auto Daub: OFF';
        btn.style.background = this.autoDaub ? 'var(--success-color)' : 'var(--gray-color)';
    }

    // View-specific update methods
    updateGameView() {
        // Update game board display
        this.updateGameBoard();
    }

    updateCardsView() {
        // Update player cards display
        this.updatePlayerCardsDisplay();
        document.getElementById('myCardsCount').textContent = this.selectedCards.size;
    }

    updateNumbersView() {
        // Initialize numbers grid if not already done
        if (!this.numbersGridInitialized) {
            this.initNumberGridMobile();
            this.numbersGridInitialized = true;
        }
    }

    updateWalletView() {
        // Update wallet information
        // This would fetch from API in real implementation
    }

    initNumberGridMobile() {
        const container = document.getElementById('numbersGridMobile');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let num = 1; num <= 75; num++) {
            const cell = document.createElement('div');
            cell.className = 'number-cell-mobile';
            cell.dataset.number = num;
            cell.textContent = num;
            container.appendChild(cell);
        }
    }

    initCardGridMobile() {
        // Already handled by updateCardGridMobile
    }

    initRecentNumbers() {
        // Will be populated by socket events
    }

    updatePlayerCardsMobile(cardIds) {
        this.selectedCards = new Set(cardIds);
        this.updateSelectedCountMobile();
        this.updatePlayerCardsDisplay();
    }

    updateSelectedCountMobile() {
        document.getElementById('mobileSelectedCount').textContent = `${this.selectedCards.size}/4`;
    }

    updatePlayerCardsDisplay() {
        const container = document.getElementById('myCardsContainer');
        if (!container) return;
        
        if (this.selectedCards.size === 0) {
            container.innerHTML = `
                <div class="empty-cards">
                    <div class="empty-icon">🃏</div>
                    <p>No cards selected</p>
                    <button class="btn-primary" onclick="mobileApp.switchView('game')">
                        Select Cards Now
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        this.selectedCards.forEach(cardId => {
            const cardEl = this.createCardDisplay(cardId);
            container.appendChild(cardEl);
        });
    }

    createCardDisplay(cardId) {
        const div = document.createElement('div');
        div.className = 'mobile-bingo-card';
        div.dataset.cardId = cardId;
        div.innerHTML = `
            <div class="card-header">
                <span class="card-number">Card #${cardId}</span>
                <button class="card-action" onclick="mobileApp.viewCardDetails(${cardId})">
                    👁️ View
                </button>
            </div>
            <div class="card-mini-grid">
                <!-- Mini card representation -->
                <div class="mini-cell">B</div>
                <div class="mini-cell">I</div>
                <div class="mini-cell">N</div>
                <div class="mini-cell">G</div>
                <div class="mini-cell">O</div>
            </div>
        `;
        return div;
    }

    updateGameBoard() {
        const container = document.getElementById('gameBoardMobile');
        if (!container) return;
        
        if (this.gameState === 'ACTIVE' && this.selectedCards.size > 0) {
            // Show current game status and player cards
            container.innerHTML = `
                <div class="game-board-content">
                    <h3>Your Cards in Play</h3>
                    <div class="active-cards">
                        ${Array.from(this.selectedCards).map(cardId => 
                            `<div class="active-card">Card #${cardId}</div>`
                        ).join('')}
                    </div>
                    <div class="game-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text">Numbers drawn: 0/75</div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="waiting-screen">
                    <div class="waiting-icon">⏳</div>
                    <h3>Waiting for game to start</h3>
                    <p>Select cards when game begins</p>
                </div>
            `;
        }
    }

    filterNumbersByLetter(letter) {
        document.querySelectorAll('.bingo-letter').forEach(el => {
            el.classList.remove('active');
        });
        
        document.querySelector(`.bingo-letter[data-letter="${letter}"]`).classList.add('active');
        
        // Show only numbers for this letter
        const numbers = document.querySelectorAll('.number-cell-mobile');
        numbers.forEach(cell => {
            const num = parseInt(cell.dataset.number);
            let show = false;
            
            switch(letter) {
                case 'B': show = num <= 15; break;
                case 'I': show = num > 15 && num <= 30; break;
                case 'N': show = num > 30 && num <= 45; break;
                case 'G': show = num > 45 && num <= 60; break;
                case 'O': show = num > 60; break;
            }
            
            cell.style.display = show ? 'flex' : 'none';
        });
    }

    updateCardMarkings() {
        // Update markings on player's cards based on drawn numbers
        // This would fetch current drawn numbers and update card displays
    }

    handleWalletAction(action) {
        switch(action) {
            case 'deposit':
                this.showDepositModal();
                break;
            case 'withdraw':
                this.showWithdrawModal();
                break;
        }
    }

    showDepositModal() {
        this.showToast('Deposit feature coming soon!');
    }

    showWithdrawModal() {
        this.showToast('Withdraw feature coming soon!');
    }

    loadUserData() {
        // Load user data from localStorage or API
        const savedBalance = localStorage.getItem('bingo_balance');
        if (savedBalance) {
            this.balance = parseFloat(savedBalance);
            this.updateMobileUserInfo();
        }
        
        // Load game stats
        const gamesPlayed = localStorage.getItem('games_played') || 0;
        const gamesWon = localStorage.getItem('games_won') || 0;
        const totalWon = localStorage.getItem('total_won') || 0;
        
        document.getElementById('gamesPlayed').textContent = gamesPlayed;
        document.getElementById('gamesWon').textContent = gamesWon;
        document.getElementById('totalWon').textContent = totalWon;
    }

    saveUserData() {
        localStorage.setItem('bingo_balance', this.balance.toString());
        localStorage.setItem('bingo_username', this.username);
        localStorage.setItem('bingo_userId', this.userId);
    }
}

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
    window.mobileApp = new MobileBingoApp();
});

// Global helper functions
function switchToGameView() {
    window.mobileApp?.switchView('game');
}

function autoSelectCardsMobile() {
    window.mobileApp?.autoSelectCardsMobile();
}

function confirmSelectionMobile() {
    window.mobileApp?.confirmSelectionMobile();
}

function selectPatternMobile(pattern) {
    window.mobileApp?.selectPatternMobile(pattern);
}

function submitBingoClaimMobile() {
    window.mobileApp?.submitBingoClaimMobile();
}

function closeCardSelectModal() {
    window.mobileApp?.closeCardSelectModal();
}

function closeBingoModalMobile() {
    window.mobileApp?.closeBingoModalMobile();
}
