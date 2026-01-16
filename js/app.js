// Main Application Logic
class BingoApp {
    constructor() {
        this.userId = null;
        this.username = 'Guest';
        this.balance = 0;
        this.selectedCards = new Set();
        this.gameState = 'IDLE';
        this.socket = null;
        this.countdownInterval = null;
        this.selectedPattern = null;
        this.claimingCardId = null;
        
        this.init();
    }

    init() {
        // Initialize Telegram Web App if available
        this.initTelegram();
        
        // Connect to WebSocket
        this.connectSocket();
        
        // Initialize UI components
        this.initUI();
        
        // Load initial data
        this.loadInitialData();
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            const tg = Telegram.WebApp;
            
            // Expand web app to full screen
            tg.expand();
            
            // Set up theme
            document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#0f172a');
            document.documentElement.style.setProperty('--card-bg', tg.themeParams.secondary_bg_color || '#1e293b');
            
            // Get user data
            const user = tg.initDataUnsafe?.user;
            if (user) {
                this.userId = user.id.toString();
                this.username = user.username || user.first_name;
                this.updateUserInfo();
            }
            
            // Enable closing confirmation
            tg.enableClosingConfirmation();
            
            // Handle back button
            tg.BackButton.onClick(() => {
                tg.close();
            });
        } else {
            // Fallback for browser testing
            this.userId = 'test_' + Math.random().toString(36).substr(2, 9);
            this.username = 'Test User';
            this.updateUserInfo();
        }
    }

    connectSocket() {
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : window.location.origin;
            
        this.socket = io(socketUrl);
        
        // Socket event handlers
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('player:join', {
                userId: this.userId,
                username: this.username
            });
        });
        
        this.socket.on('game:status', (status) => {
            this.updateGameStatus(status);
        });
        
        this.socket.on('game:state', (state) => {
            this.handleGameStateChange(state);
        });
        
        this.socket.on('game:countdown', (data) => {
            this.updateCountdown(data);
        });
        
        this.socket.on('game:number:drawn', (data) => {
            this.handleNumberDrawn(data);
        });
        
        this.socket.on('game:winner', (data) => {
            this.handleWinner(data);
        });
        
        this.socket.on('game:cancelled', (data) => {
            this.handleGameCancelled(data);
        });
        
        this.socket.on('cards:grid', (grid) => {
            this.updateCardGrid(grid);
        });
        
        this.socket.on('player:cards', (cards) => {
            this.updatePlayerCards(cards);
        });
        
        this.socket.on('card:selected', (data) => {
            this.handleCardSelected(data);
        });
        
        this.socket.on('error', (error) => {
            this.showError(error.message);
        });
    }

    initUI() {
        // Initialize number grid
        this.initNumberGrid();
        
        // Initialize card selector
        this.initCardSelector();
        
        // Initialize event listeners
        this.initEventListeners();
    }

    initNumberGrid() {
        const grid = document.getElementById('numbersGrid');
        grid.innerHTML = '';
        
        // Create numbers 1-75 in their respective columns
        for (let num = 1; num <= 75; num++) {
            const div = document.createElement('div');
            div.className = 'number-cell';
            div.dataset.number = num;
            div.textContent = num;
            
            // Determine column
            let column = '';
            if (num <= 15) column = 'B';
            else if (num <= 30) column = 'I';
            else if (num <= 45) column = 'N';
            else if (num <= 60) column = 'G';
            else column = 'O';
            
            div.dataset.column = column;
            grid.appendChild(div);
        }
    }

    initCardSelector() {
        const selector = document.getElementById('cardGridSelector');
        selector.innerHTML = '';
        
        // Create 400 card cells
        for (let i = 1; i <= 400; i++) {
            const cell = document.createElement('div');
            cell.className = 'card-cell';
            cell.dataset.cardId = i;
            cell.textContent = i;
            cell.onclick = () => this.selectCard(i);
            selector.appendChild(cell);
        }
    }

    initEventListeners() {
        // Auto select cards button
        document.querySelector('.btn-secondary').addEventListener('click', () => {
            this.autoSelectCards();
        });
        
        // Bingo claim modal close
        document.getElementById('bingoClaimModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeBingoModal();
            }
        });
        
        // Card grid modal close
        document.getElementById('cardGridModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    loadInitialData() {
        // Request current game status
        this.socket.emit('cards:grid:request');
        
        // Fetch user balance
        this.fetchUserBalance();
    }

    updateUserInfo() {
        document.getElementById('username').textContent = this.username;
        document.getElementById('balance').textContent = this.balance.toFixed(2);
    }

    updateGameStatus(status) {
        this.gameState = status.state;
        
        // Update UI elements
        document.getElementById('playerCount').textContent = status.playerCount || 0;
        document.getElementById('cardCount').textContent = `${status.takenCards || 0}/400`;
        document.getElementById('numberCount').textContent = status.drawnNumbers?.length || 0;
        
        // Update state indicator
        const indicator = document.querySelector('.state-indicator');
        const stateText = document.getElementById('stateText');
        
        switch(status.state) {
            case 'IDLE':
                indicator.className = 'state-indicator';
                stateText.textContent = 'Waiting for next game';
                break;
            case 'CARD_SELECTION':
                indicator.className = 'state-indicator selection';
                stateText.textContent = 'Card Selection Phase';
                break;
            case 'ACTIVE':
                indicator.className = 'state-indicator active';
                stateText.textContent = 'Game Active';
                break;
            case 'ENDED':
                indicator.className = 'state-indicator';
                stateText.textContent = 'Game Ended';
                break;
        }
    }

    handleGameStateChange(state) {
        const selectionView = document.getElementById('cardSelectionView');
        const gameView = document.getElementById('gamePlayView');
        const winnerView = document.getElementById('winnerAnnouncement');
        
        switch(state.state) {
            case 'CARD_SELECTION':
                selectionView.style.display = 'block';
                gameView.style.display = 'none';
                winnerView.style.display = 'none';
                
                // Reset selection
                this.selectedCards.clear();
                this.updateSelectedCount();
                this.clearCardSelection();
                break;
                
            case 'ACTIVE':
                selectionView.style.display = 'none';
                gameView.style.display = 'block';
                winnerView.style.display = 'none';
                break;
                
            case 'ENDED':
                selectionView.style.display = 'none';
                gameView.style.display = 'none';
                winnerView.style.display = 'block';
                break;
                
            default:
                selectionView.style.display = 'none';
                gameView.style.display = 'none';
                winnerView.style.display = 'none';
        }
    }

    updateCountdown(data) {
        if (data.phase === 'CARD_SELECTION') {
            document.getElementById('selectionTime').textContent = data.timeLeft;
            document.getElementById('countdown').querySelector('.countdown-timer').textContent = data.timeLeft;
        }
    }

    handleNumberDrawn(data) {
        // Add to drawn numbers display
        const container = document.getElementById('drawnNumbers');
        const numberDiv = document.createElement('div');
        numberDiv.className = 'drawn-number recent';
        numberDiv.textContent = data.number;
        container.appendChild(numberDiv);
        
        // Keep only last 20 numbers
        const numbers = container.children;
        if (numbers.length > 20) {
            container.removeChild(numbers[0]);
        }
        
        // Mark number in grid
        const gridNumber = document.querySelector(`.number-cell[data-number="${data.number}"]`);
        if (gridNumber) {
            gridNumber.classList.add('drawn');
        }
        
        // Add to recent numbers
        this.addRecentNumber(data.number);
        
        // Update player cards
        this.updatePlayerCardMarkings();
        
        // Remove recent class after animation
        setTimeout(() => {
            numberDiv.classList.remove('recent');
        }, 1000);
    }

    addRecentNumber(number) {
        const container = document.getElementById('recentNumbers');
        const div = document.createElement('div');
        div.className = 'recent-number';
        div.textContent = number;
        container.insertBefore(div, container.firstChild);
        
        // Keep only 10 recent numbers
        if (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    updatePlayerCardMarkings() {
        // This would update markings on player's cards
        // In a real implementation, you'd fetch current drawn numbers
        // and update each card's marked cells
    }

    handleWinner(data) {
        const winnerView = document.getElementById('winnerAnnouncement');
        const message = document.getElementById('winnerMessage');
        
        if (data.userId === this.userId) {
            message.textContent = '🎉 Congratulations! YOU WON! 🎉';
            this.playWinSound();
        } else {
            message.textContent = `Player ${data.username || data.userId} won with ${data.winType}!`;
        }
        
        winnerView.style.display = 'flex';
        
        // Start next game countdown
        let countdown = 10;
        const countdownEl = document.getElementById('nextGameCountdown');
        countdownEl.textContent = countdown;
        
        const timer = setInterval(() => {
            countdown--;
            countdownEl.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(timer);
            }
        }, 1000);
    }

    handleGameCancelled(data) {
        this.showNotification(`Game cancelled: ${data.reason}`);
        
        // Auto start new game after delay
        setTimeout(() => {
            this.socket.emit('cards:grid:request');
        }, 5000);
    }

    updateCardGrid(grid) {
        // Update card selector
        grid.forEach(card => {
            const cell = document.querySelector(`.card-cell[data-card-id="${card.id}"]`);
            if (cell) {
                if (card.selected) {
                    cell.classList.add('taken');
                    cell.onclick = null;
                } else {
                    cell.classList.remove('taken');
                    cell.onclick = () => this.selectCard(card.id);
                }
                
                if (card.owner === this.userId) {
                    cell.classList.add('selected');
                } else {
                    cell.classList.remove('selected');
                }
            }
        });
        
        // Update full grid modal
        this.updateFullCardGrid(grid);
    }

    updateFullCardGrid(grid) {
        const container = document.getElementById('fullCardGrid');
        container.innerHTML = '';
        
        grid.forEach(card => {
            const cell = document.createElement('div');
            cell.className = 'grid-card';
            cell.textContent = card.id;
            
            if (card.selected) {
                if (card.owner === this.userId) {
                    cell.classList.add('owned');
                } else {
                    cell.classList.add('taken');
                }
            }
            
            container.appendChild(cell);
        });
    }

    updatePlayerCards(cardIds) {
        this.selectedCards = new Set(cardIds);
        this.updateSelectedCount();
        
        // Display player's cards
        this.displayPlayerCards(cardIds);
    }

    displayPlayerCards(cardIds) {
        const container = document.getElementById('playerCards');
        container.innerHTML = '';
        
        cardIds.forEach(cardId => {
            // In real implementation, fetch card details from server
            const cardEl = this.createCardElement(cardId);
            container.appendChild(cardEl);
        });
    }

    createCardElement(cardId) {
        const div = document.createElement('div');
        div.className = 'bingo-card';
        div.dataset.cardId = cardId;
        div.innerHTML = `
            <div class="bingo-header">
                <div>B</div>
                <div>I</div>
                <div>N</div>
                <div>G</div>
                <div>O</div>
            </div>
            <div class="card-content">
                <!-- Card numbers would be loaded here -->
                Card #${cardId}
            </div>
        `;
        return div;
    }

    handleCardSelected(data) {
        if (data.userId === this.userId) {
            this.selectedCards.add(data.cardId);
            this.updateSelectedCount();
        }
        
        // Update card in grid
        const cell = document.querySelector(`.card-cell[data-card-id="${data.cardId}"]`);
        if (cell) {
            cell.classList.add('taken');
            cell.onclick = null;
        }
    }

    selectCard(cardId) {
        if (this.selectedCards.size >= 4) {
            this.showError('Maximum 4 cards allowed');
            return;
        }
        
        if (this.selectedCards.has(cardId)) {
            this.showError('Card already selected');
            return;
        }
        
        this.socket.emit('card:select', {
            userId: this.userId,
            cardId: cardId
        });
    }

    autoSelectCards() {
        if (this.gameState !== 'CARD_SELECTION') {
            this.showError('Not in card selection phase');
            return;
        }
        
        // Find available cards
        const availableCards = [];
        const cardCells = document.querySelectorAll('.card-cell:not(.taken)');
        
        cardCells.forEach(cell => {
            if (availableCards.length < 4) {
                const cardId = parseInt(cell.dataset.cardId);
                availableCards.push(cardId);
            }
        });
        
        // Select cards
        availableCards.forEach(cardId => {
            this.selectCard(cardId);
        });
    }

    confirmSelection() {
        if (this.selectedCards.size === 0) {
            this.showError('Please select at least one card');
            return;
        }
        
        this.showNotification('Cards confirmed! Ready for game start.');
    }

    claimBingo() {
        if (this.selectedCards.size === 0) {
            this.showError('You have no cards');
            return;
        }
        
        // Open bingo claim modal
        this.openBingoClaimModal();
    }

    openBingoClaimModal() {
        const modal = document.getElementById('bingoClaimModal');
        modal.classList.add('active');
        
        // Reset pattern selection
        this.selectedPattern = null;
        document.querySelectorAll('.pattern').forEach(p => {
            p.classList.remove('selected');
        });
        
        // For now, use first selected card
        const cardId = Array.from(this.selectedCards)[0];
        this.claimingCardId = cardId;
        document.getElementById('selectedCardId').textContent = cardId;
    }

    closeBingoModal() {
        document.getElementById('bingoClaimModal').classList.remove('active');
        this.selectedPattern = null;
        this.claimingCardId = null;
    }

    selectPattern(pattern) {
        this.selectedPattern = pattern;
        
        document.querySelectorAll('.pattern').forEach(p => {
            p.classList.remove('selected');
        });
        
        document.querySelector(`.pattern[data-pattern="${pattern}"]`).classList.add('selected');
    }

    submitBingoClaim() {
        if (!this.selectedPattern || !this.claimingCardId) {
            this.showError('Please select a winning pattern');
            return;
        }
        
        this.socket.emit('bingo:claim', {
            userId: this.userId,
            cardId: this.claimingCardId,
            pattern: this.selectedPattern
        });
        
        this.closeBingoModal();
    }

    viewCardGrid() {
        document.getElementById('cardGridModal').classList.add('active');
    }

    closeModal() {
        document.getElementById('cardGridModal').classList.remove('active');
    }

    updateSelectedCount() {
        document.getElementById('selectedCount').textContent = this.selectedCards.size;
    }

    clearCardSelection() {
        document.querySelectorAll('.card-cell').forEach(cell => {
            cell.classList.remove('selected');
        });
    }

    fetchUserBalance() {
        // In real implementation, fetch from API
        this.balance = 1000; // Example balance
        this.updateUserInfo();
    }

    playWinSound() {
        // Play win sound if available
        const audio = new Audio('assets/sounds/win.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
    }

    showError(message) {
        // Simple error notification
        alert(message);
    }

    showNotification(message) {
        // Simple notification
        console.log('Notification:', message);
        // In real implementation, use toast notification
    }
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.bingoApp = new BingoApp();
});

// Global functions for HTML onclick handlers
function confirmSelection() {
    window.bingoApp.confirmSelection();
}

function autoSelectCards() {
    window.bingoApp.autoSelectCards();
}

function claimBingo() {
    window.bingoApp.claimBingo();
}

function viewCardGrid() {
    window.bingoApp.viewCardGrid();
}

function closeModal() {
    window.bingoApp.closeModal();
}

function closeBingoModal() {
    window.bingoApp.closeBingoModal();
}

function selectPattern(pattern) {
    window.bingoApp.selectPattern(pattern);
}

function submitBingoClaim() {
    window.bingoApp.submitBingoClaim();
}
