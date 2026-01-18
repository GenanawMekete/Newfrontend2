// Game Engine for Bingo Logic
class GameEngine {
    constructor() {
        this.gameState = {
            phase: 'IDLE', // IDLE, CARD_SELECTION, ACTIVE, ENDED
            gameId: null,
            startTime: null,
            endTime: null,
            drawnNumbers: [],
            players: new Map(),
            selectedCards: new Map(),
            winner: null,
            winType: null,
            prizePool: 0,
            countdown: 0,
            autoRestartTimer: null
        };
        
        this.playerState = {
            userId: Config.getUserId(),
            username: Config.getUsername(),
            selectedCards: new Set(),
            balance: Config.loadFromStorage(Config.STORAGE.BALANCE, 1000),
            stats: Config.loadFromStorage(Config.STORAGE.STATS, {
                gamesPlayed: 0,
                gamesWon: 0,
                totalWon: 0,
                totalSpent: 0,
                winRate: 0
            })
        };
        
        this.cardState = {
            cards: new Map(), // cardId -> card data
            takenCards: new Set(),
            availableCards: new Set(),
            cardGrid: []
        };
        
        this.uiState = {
            currentView: 'game',
            autoDaub: Config.initializeSettings().autoDaub,
            soundEnabled: Config.initializeSettings().soundEnabled,
            notifications: Config.initializeSettings().notifications,
            lastNumberDrawn: null,
            recentNumbers: [],
            numberHistory: []
        };
        
        this.init();
    }
    
    init() {
        // Initialize card grid
        this.initializeCardGrid();
        
        // Load saved state
        this.loadSavedState();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start auto-refresh for game status
        this.startStatusRefresh();
    }
    
    initializeCardGrid() {
        // Generate card grid state (400 cards)
        this.cardState.cardGrid = [];
        for (let i = 1; i <= Config.GAME.TOTAL_CARDS; i++) {
            this.cardState.cardGrid.push({
                id: i,
                selected: false,
                owner: null,
                selectedAt: null,
                numbers: this.generateCardNumbers(i)
            });
            this.cardState.availableCards.add(i);
        }
    }
    
    generateCardNumbers(cardId) {
        // Generate unique bingo card numbers based on card ID
        const numbers = [];
        const ranges = Config.BINGO_CARD.COLUMN_RANGES;
        
        // Use cardId as seed for deterministic generation
        const seed = cardId * 123456789;
        const random = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };
        
        // Generate numbers for each column
        Object.keys(ranges).forEach((letter, colIndex) => {
            const range = ranges[letter];
            const columnNumbers = new Set();
            
            // Generate 5 unique numbers for this column
            while (columnNumbers.size < 5) {
                const rand = random(seed + colIndex * 100 + columnNumbers.size * 10);
                const num = Math.floor(rand * (range.max - range.min + 1)) + range.min;
                columnNumbers.add(num);
            }
            
            // Add to numbers array
            const sortedNumbers = Array.from(columnNumbers).sort((a, b) => a - b);
            sortedNumbers.forEach((num, rowIndex) => {
                if (!numbers[rowIndex]) numbers[rowIndex] = [];
                numbers[rowIndex][colIndex] = num;
            });
        });
        
        // Set free space
        numbers[2][2] = 'FREE';
        
        return numbers;
    }
    
    loadSavedState() {
        // Load selected cards from storage
        const savedCards = Config.loadFromStorage(
            Config.STORAGE.SELECTED_CARDS + '_' + this.playerState.userId,
            []
        );
        
        savedCards.forEach(cardId => {
            this.playerState.selectedCards.add(cardId);
        });
        
        // Update UI with saved state
        this.updateUICards();
    }
    
    saveState() {
        // Save selected cards
        Config.saveToStorage(
            Config.STORAGE.SELECTED_CARDS + '_' + this.playerState.userId,
            Array.from(this.playerState.selectedCards)
        );
        
        // Save player stats
        Config.saveToStorage(Config.STORAGE.STATS, this.playerState.stats);
        
        // Save balance
        Config.saveToStorage(Config.STORAGE.BALANCE, this.playerState.balance);
    }
    
    setupEventListeners() {
        // Listen to socket events
        const socket = getSocketManager();
        
        socket.on('game:status', (data) => this.handleGameStatus(data));
        socket.on('game:state', (data) => this.handleGameState(data));
        socket.on('game:countdown', (data) => this.handleCountdown(data));
        socket.on('game:number:drawn', (data) => this.handleNumberDrawn(data));
        socket.on('game:winner', (data) => this.handleWinner(data));
        socket.on('game:cancelled', (data) => this.handleGameCancelled(data));
        
        socket.on('cards:grid', (data) => this.handleCardGrid(data));
        socket.on('player:cards', (data) => this.handlePlayerCards(data));
        socket.on('card:selected', (data) => this.handleCardSelected(data));
        
        socket.on('error', (error) => this.handleError(error));
        socket.on('notification', (data) => this.handleNotification(data));
        
        // Listen to UI events
        document.addEventListener('view:change', (e) => this.handleViewChange(e));
        document.addEventListener('card:select:click', (e) => this.handleCardSelectClick(e));
        document.addEventListener('bingo:claim:click', (e) => this.handleBingoClaimClick(e));
    }
    
    // Event Handlers
    handleGameStatus(data) {
        this.gameState.phase = data.state;
        this.gameState.gameId = data.gameId;
        this.gameState.drawnNumbers = data.drawnNumbers || [];
        this.gameState.players = new Map(Object.entries(data.players || {}));
        this.gameState.selectedCards = new Map(Object.entries(data.selectedCards || {}));
        this.gameState.prizePool = data.prizePool || 0;
        
        // Update taken cards
        this.updateTakenCards();
        
        // Update UI
        this.updateGameStatusUI();
        this.emitEvent('game:status:updated', this.gameState);
    }
    
    handleGameState(data) {
        const oldPhase = this.gameState.phase;
        this.gameState.phase = data.state;
        this.gameState.gameId = data.gameId;
        
        if (data.state === 'CARD_SELECTION') {
            this.gameState.startTime = Date.now();
            this.gameState.countdown = Config.GAME.CARD_SELECTION_TIME;
            this.startCountdown();
        } else if (data.state === 'ACTIVE') {
            this.gameState.countdown = 0;
            this.stopCountdown();
        } else if (data.state === 'ENDED') {
            this.gameState.endTime = Date.now();
            this.stopCountdown();
        }
        
        // Update UI
        this.updateGamePhaseUI();
        this.emitEvent('game:state:changed', {
            oldPhase,
            newPhase: data.state,
            gameId: data.gameId
        });
    }
    
    handleCountdown(data) {
        if (data.phase === 'CARD_SELECTION') {
            this.gameState.countdown = data.timeLeft;
            this.updateCountdownUI(data.timeLeft);
            
            if (data.timeLeft <= 0 && this.gameState.phase === 'CARD_SELECTION') {
                this.handleCardSelectionEnd();
            }
        }
    }
    
    handleNumberDrawn(data) {
        const number = data.number;
        const letter = Config.getNumberLetter(number);
        
        // Add to drawn numbers
        this.gameState.drawnNumbers.push(number);
        
        // Update recent numbers
        this.uiState.recentNumbers.unshift({ number, letter, timestamp: Date.now() });
        if (this.uiState.recentNumbers.length > 10) {
            this.uiState.recentNumbers.pop();
        }
        
        // Update number history
        this.uiState.numberHistory.push({
            number,
            letter,
            gameId: this.gameState.gameId,
            timestamp: Date.now()
        });
        
        this.uiState.lastNumberDrawn = { number, letter };
        
        // Update UI
        this.updateDrawnNumbersUI();
        this.updateNumberGridUI();
        
        // Check for auto-daub
        if (this.uiState.autoDaub) {
            this.autoDaubNumbers();
        }
        
        // Emit event
        this.emitEvent('number:drawn', {
            number,
            letter,
            drawnNumbers: this.gameState.drawnNumbers,
            totalDrawn: this.gameState.drawnNumbers.length
        });
        
        // Play sound
        if (this.uiState.soundEnabled) {
            this.playSound('number_drawn');
        }
    }
    
    handleWinner(data) {
        this.gameState.winner = data.userId;
        this.gameState.winType = data.winType;
        this.gameState.phase = 'ENDED';
        this.gameState.endTime = Date.now();
        
        // Update player stats if winner is current user
        if (data.userId === this.playerState.userId) {
            this.playerState.stats.gamesWon++;
            this.playerState.stats.totalWon += data.prize || 0;
            this.playerState.balance += data.prize || 0;
            this.saveState();
        }
        
        // Update all players' stats
        this.playerState.stats.gamesPlayed++;
        this.playerState.stats.winRate = this.playerState.stats.gamesWon / this.playerState.stats.gamesPlayed * 100;
        this.saveState();
        
        // Show winner modal
        this.showWinnerModal(data);
        
        // Start auto-restart timer
        this.startAutoRestart();
        
        // Emit event
        this.emitEvent('game:winner', data);
        
        // Play win sound
        if (this.uiState.soundEnabled) {
            this.playSound('win');
        }
    }
    
    handleGameCancelled(data) {
        this.gameState.phase = 'IDLE';
        this.gameState.drawnNumbers = [];
        this.gameState.winner = null;
        this.gameState.winType = null;
        
        // Reset selected cards for next game
        this.resetForNextGame();
        
        // Show notification
        this.showNotification('Game cancelled: ' + data.reason, 'warning');
        
        // Emit event
        this.emitEvent('game:cancelled', data);
    }
    
    handleCardGrid(data) {
        // Update card grid with server data
        data.forEach(card => {
            const index = card.id - 1;
            if (this.cardState.cardGrid[index]) {
                this.cardState.cardGrid[index].selected = card.selected;
                this.cardState.cardGrid[index].owner = card.owner;
                this.cardState.cardGrid[index].selectedAt = card.selectedAt;
                
                if (card.selected) {
                    this.cardState.takenCards.add(card.id);
                    this.cardState.availableCards.delete(card.id);
                } else {
                    this.cardState.takenCards.delete(card.id);
                    this.cardState.availableCards.add(card.id);
                }
            }
        });
        
        // Update UI
        this.updateCardGridUI();
        this.emitEvent('cards:grid:updated', this.cardState.cardGrid);
    }
    
    handlePlayerCards(data) {
        // Update player's selected cards
        this.playerState.selectedCards = new Set(data);
        this.saveState();
        
        // Update UI
        this.updatePlayerCardsUI();
        this.emitEvent('player:cards:updated', Array.from(this.playerState.selectedCards));
    }
    
    handleCardSelected(data) {
        // Update card state
        const cardId = data.cardId;
        const userId = data.userId;
        
        const cardIndex = cardId - 1;
        if (this.cardState.cardGrid[cardIndex]) {
            this.cardState.cardGrid[cardIndex].selected = true;
            this.cardState.cardGrid[cardIndex].owner = userId;
            this.cardState.cardGrid[cardIndex].selectedAt = Date.now();
            
            this.cardState.takenCards.add(cardId);
            this.cardState.availableCards.delete(cardId);
        }
        
        // If it's our card, add to selected cards
        if (userId === this.playerState.userId) {
            this.playerState.selectedCards.add(cardId);
            this.saveState();
            this.updatePlayerCardsUI();
        }
        
        // Update UI
        this.updateCardGridUI();
        this.emitEvent('card:selected:by-player', data);
    }
    
    // Game Logic Methods
    selectCard(cardId) {
        // Validate card selection
        if (this.gameState.phase !== 'CARD_SELECTION') {
            this.showNotification('Card selection is not active', 'error');
            return false;
        }
        
        if (this.playerState.selectedCards.size >= Config.GAME.MAX_CARDS_PER_PLAYER) {
            this.showNotification(`Maximum ${Config.GAME.MAX_CARDS_PER_PLAYER} cards allowed`, 'error');
            return false;
        }
        
        if (this.playerState.selectedCards.has(cardId)) {
            this.showNotification('Card already selected', 'error');
            return false;
        }
        
        if (this.cardState.takenCards.has(cardId)) {
            this.showNotification('Card already taken by another player', 'error');
            return false;
        }
        
        // Send selection to server
        const socket = getSocketManager();
        const success = socket.selectCard(cardId);
        
        if (success) {
            // Optimistically update UI
            this.playerState.selectedCards.add(cardId);
            this.updatePlayerCardsUI();
            this.updateCardGridUI();
            
            // Play sound
            if (this.uiState.soundEnabled) {
                this.playSound('card_select');
            }
            
            return true;
        }
        
        return false;
    }
    
    claimBingo(cardId, pattern) {
        // Validate bingo claim
        if (this.gameState.phase !== 'ACTIVE') {
            this.showNotification('Game is not active', 'error');
            return false;
        }
        
        if (!this.playerState.selectedCards.has(cardId)) {
            this.showNotification('You do not own this card', 'error');
            return false;
        }
        
        if (!Config.isValidBingoPattern(pattern)) {
            this.showNotification('Invalid bingo pattern', 'error');
            return false;
        }
        
        // Verify the claim locally first
        const card = this.cardState.cardGrid[cardId - 1];
        if (!card) {
            this.showNotification('Card not found', 'error');
            return false;
        }
        
        const isValidClaim = this.verifyBingoClaim(cardId, pattern);
        if (!isValidClaim) {
            this.showNotification('Invalid bingo claim - pattern not completed', 'warning');
            return false;
        }
        
        // Send claim to server
        const socket = getSocketManager();
        const success = socket.claimBingo(cardId, pattern);
        
        if (success) {
            this.showNotification('Bingo claim submitted!', 'success');
            return true;
        }
        
        return false;
    }
    
    verifyBingoClaim(cardId, pattern) {
        const card = this.cardState.cardGrid[cardId - 1];
        if (!card) return false;
        
        const numbers = card.numbers;
        const drawnNumbers = this.gameState.drawnNumbers;
        
        // Convert pattern to check
        switch (pattern) {
            case 'full_house':
                // All numbers marked
                for (let row = 0; row < 5; row++) {
                    for (let col = 0; col < 5; col++) {
                        if (numbers[row][col] === 'FREE') continue;
                        if (!drawnNumbers.includes(numbers[row][col])) {
                            return false;
                        }
                    }
                }
                return true;
                
            case 'four_corners':
                // Four corners marked
                const corners = [
                    numbers[0][0], numbers[0][4],
                    numbers[4][0], numbers[4][4]
                ];
                return corners.every(num => 
                    num === 'FREE' || drawnNumbers.includes(num)
                );
                
            case 'line_1':
            case 'line_2':
            case 'line_3':
            case 'line_4':
            case 'line_5':
                // Specific row
                const rowIndex = parseInt(pattern.split('_')[1]) - 1;
                return numbers[rowIndex].every(num => 
                    num === 'FREE' || drawnNumbers.includes(num)
                );
                
            case 'diagonal_1':
                // Main diagonal
                for (let i = 0; i < 5; i++) {
                    const num = numbers[i][i];
                    if (num !== 'FREE' && !drawnNumbers.includes(num)) {
                        return false;
                    }
                }
                return true;
                
            case 'diagonal_2':
                // Anti-diagonal
                for (let i = 0; i < 5; i++) {
                    const num = numbers[i][4 - i];
                    if (num !== 'FREE' && !drawnNumbers.includes(num)) {
                        return false;
                    }
                }
                return true;
        }
        
        return false;
    }
    
    autoDaubNumbers() {
        // Automatically mark numbers on player's cards
        this.playerState.selectedCards.forEach(cardId => {
            const card = this.cardState.cardGrid[cardId - 1];
            if (card) {
                // Card marking is handled by UI updates
                this.updateCardMarkingsUI(cardId);
            }
        });
    }
    
    // UI Update Methods
    updateGameStatusUI() {
        const playersCount = this.gameState.players.size;
        const cardsCount = this.cardState.takenCards.size;
        const numbersCount = this.gameState.drawnNumbers.length;
        const prizePool = this.gameState.prizePool;
        
        // Update DOM elements
        this.updateElement('playersCount', playersCount);
        this.updateElement('cardsCount', `${cardsCount}/${Config.GAME.TOTAL_CARDS}`);
        this.updateElement('numbersCount', numbersCount);
        this.updateElement('prizePool', prizePool);
    }
    
    updateGamePhaseUI() {
        const phase = this.gameState.phase;
        const phaseElement = document.getElementById('phaseIndicator');
        
        if (!phaseElement) return;
        
        // Remove all phase classes
        phaseElement.classList.remove('waiting', 'selection', 'active', 'ended');
        
        // Add current phase class
        switch (phase) {
            case 'IDLE':
                phaseElement.classList.add('waiting');
                this.updateElement('phaseBadge', 'Waiting');
                break;
            case 'CARD_SELECTION':
                phaseElement.classList.add('selection');
                this.updateElement('phaseBadge', 'Card Selection');
                break;
            case 'ACTIVE':
                phaseElement.classList.add('active');
                this.updateElement('phaseBadge', 'Game Active');
                break;
            case 'ENDED':
                phaseElement.classList.add('ended');
                this.updateElement('phaseBadge', 'Game Ended');
                break;
        }
    }
    
    updateCountdownUI(timeLeft) {
        const timerElement = document.getElementById('phaseTimer');
        if (timerElement) {
            timerElement.textContent = `${timeLeft}s`;
            
            // Update progress bar
            const progressElement = document.getElementById('phaseProgress');
            if (progressElement) {
                const progress = (timeLeft / Config.GAME.CARD_SELECTION_TIME) * 100;
                progressElement.style.width = `${progress}%`;
            }
        }
    }
    
    updateDrawnNumbersUI() {
        const recentList = document.getElementById('recentList');
        const drawnList = document.getElementById('drawnList');
        
        if (!recentList && !drawnList) return;
        
        // Update recent numbers
        if (recentList) {
            recentList.innerHTML = this.uiState.recentNumbers
                .slice(0, 8)
                .map(num => `
                    <div class="recent-number-item">
                        <div class="number">${num.number}</div>
                        <div class="letter">${num.letter}</div>
                    </div>
                `).join('');
        }
        
        // Update full drawn list
        if (drawnList) {
            drawnList.innerHTML = this.gameState.drawnNumbers
                .map((num, index) => {
                    const letter = Config.getNumberLetter(num);
                    return `
                        <div class="drawn-number-item">
                            <span class="drawn-index">${index + 1}.</span>
                            <span class="drawn-value">${num}</span>
                            <span class="drawn-letter">${letter}</span>
                        </div>
                    `;
                }).join('');
        }
        
        // Update counts
        this.updateElement('recentCount', this.gameState.drawnNumbers.length);
        this.updateElement('totalDrawn', `${this.gameState.drawnNumbers.length}/75`);
        
        if (this.uiState.lastNumberDrawn) {
            this.updateElement('lastNumber', 
                `${this.uiState.lastNumberDrawn.number} (${this.uiState.lastNumberDrawn.letter})`);
        }
    }
    
    updateNumberGridUI() {
        const numbersGrid = document.getElementById('numbersGrid');
        if (!numbersGrid) return;
        
        numbersGrid.innerHTML = '';
        
        for (let num = 1; num <= 75; num++) {
            const isDrawn = this.gameState.drawnNumbers.includes(num);
            const letter = Config.getNumberLetter(num);
            
            const numberElement = document.createElement('div');
            numberElement.className = `number-cell ${isDrawn ? 'drawn' : ''}`;
            numberElement.dataset.number = num;
            numberElement.innerHTML = `
                <div class="number">${num}</div>
                <div class="letter">${letter}</div>
            `;
            
            numbersGrid.appendChild(numberElement);
        }
    }
    
    updateCardGridUI() {
        const cardGrid = document.getElementById('cardGrid');
        if (!cardGrid) return;
        
        cardGrid.innerHTML = '';
        
        this.cardState.cardGrid.forEach(card => {
            const isSelected = this.playerState.selectedCards.has(card.id);
            const isTaken = this.cardState.takenCards.has(card.id);
            const isAvailable = this.cardState.availableCards.has(card.id);
            
            const cardElement = document.createElement('div');
            cardElement.className = `grid-card ${isSelected ? 'selected' : ''} ${isTaken ? 'taken' : ''}`;
            cardElement.dataset.cardId = card.id;
            cardElement.textContent = card.id;
            
            if (isAvailable && this.gameState.phase === 'CARD_SELECTION') {
                cardElement.onclick = () => this.selectCard(card.id);
            } else {
                cardElement.style.cursor = 'default';
            }
            
            cardGrid.appendChild(cardElement);
        });
        
        // Update available count
        this.updateElement('availableCards', this.cardState.availableCards.size);
    }
    
    updatePlayerCardsUI() {
        const cardsContainer = document.getElementById('cardsContainer');
        const selectedCount = document.getElementById('selectedCardsCount');
        
        if (selectedCount) {
            selectedCount.textContent = 
                `${this.playerState.selectedCards.size}/${Config.GAME.MAX_CARDS_PER_PLAYER}`;
        }
        
        if (!cardsContainer) return;
        
        if (this.playerState.selectedCards.size === 0) {
            cardsContainer.innerHTML = `
                <div class="empty-cards">
                    <div class="empty-icon">🃏</div>
                    <h3>No Cards Selected</h3>
                    <p>Select cards during the card selection phase to play</p>
                    <button class="btn-primary" onclick="app.openCardSelection()">
                        Select Cards Now
                    </button>
                </div>
            `;
            return;
        }
        
        cardsContainer.innerHTML = '';
        this.playerState.selectedCards.forEach(cardId => {
            const card = this.cardState.cardGrid[cardId - 1];
            if (!card) return;
            
            const markedCount = this.countMarkedNumbers(cardId);
            const totalNumbers = 24; // 25 cells minus FREE space
            
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item';
            cardElement.dataset.cardId = cardId;
            cardElement.innerHTML = `
                <div class="card-item-header">
                    <div class="card-item-number">Card #${cardId}</div>
                    <div class="card-item-actions">
                        <button class="btn-small" onclick="app.viewCardDetails(${cardId})">
                            View
                        </button>
                        <button class="btn-small" onclick="app.claimBingoFromCard(${cardId})">
                            Claim
                        </button>
                    </div>
                </div>
                <div class="card-item-body">
                    <div class="card-markings">
                        ${this.generateCardMarkingsHTML(card)}
                    </div>
                </div>
                <div class="card-item-footer">
                    <div class="progress">
                        <div class="progress-label">
                            <span>Marked: ${markedCount}/${totalNumbers}</span>
                            <span>${Math.round((markedCount / totalNumbers) * 100)}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-value" 
                                 style="width: ${(markedCount / totalNumbers) * 100}%"></div>
                        </div>
                    </div>
                </div>
            `;
            
            cardsContainer.appendChild(cardElement);
        });
    }
    
    generateCardMarkingsHTML(card) {
        let html = '';
        for (let row = 0; row < 5; row++) {
            html += '<div class="marking-row">';
            for (let col = 0; col < 5; col++) {
                const num = card.numbers[row][col];
                const isMarked = num === 'FREE' || this.gameState.drawnNumbers.includes(num);
                const isFree = num === 'FREE';
                
                html += `
                    <div class="marking-cell ${isMarked ? 'marked' : ''} ${isFree ? 'free' : ''}">
                        ${isFree ? 'FREE' : num}
                    </div>
                `;
            }
            html += '</div>';
        }
        return html;
    }
    
    countMarkedNumbers(cardId) {
        const card = this.cardState.cardGrid[cardId - 1];
        if (!card) return 0;
        
        let count = 0;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const num = card.numbers[row][col];
                if (num === 'FREE' || this.gameState.drawnNumbers.includes(num)) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // Timer Methods
    startCountdown() {
        this.stopCountdown();
        
        if (this.gameState.phase === 'CARD_SELECTION') {
            this.countdownInterval = setInterval(() => {
                if (this.gameState.countdown > 0) {
                    this.gameState.countdown--;
                    this.updateCountdownUI(this.gameState.countdown);
                    
                    if (this.gameState.countdown <= 10 && this.uiState.soundEnabled) {
                        this.playSound('countdown');
                    }
                } else {
                    this.stopCountdown();
                }
            }, 1000);
        }
    }
    
    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }
    
    startAutoRestart() {
        this.clearAutoRestart();
        
        this.autoRestartTimer = setTimeout(() => {
            this.resetForNextGame();
            this.emitEvent('game:auto-restart');
        }, Config.GAME.AUTO_RESTART_DELAY);
    }
    
    clearAutoRestart() {
        if (this.autoRestartTimer) {
            clearTimeout(this.autoRestartTimer);
            this.autoRestartTimer = null;
        }
    }
    
    startStatusRefresh() {
        // Refresh game status every 5 seconds
        this.statusRefreshInterval = setInterval(() => {
            if (getSocketManager().isConnected) {
                getSocketManager().requestGameStatus();
            }
        }, 5000);
    }
    
    // Helper Methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    updateTakenCards() {
        this.cardState.takenCards.clear();
        this.cardState.availableCards.clear();
        
        for (let i = 1; i <= Config.GAME.TOTAL_CARDS; i++) {
            if (this.gameState.selectedCards.has(i.toString())) {
                this.cardState.takenCards.add(i);
            } else {
                this.cardState.availableCards.add(i);
            }
        }
    }
    
    resetForNextGame() {
        // Reset game state (keep player stats)
        this.gameState.drawnNumbers = [];
        this.gameState.winner = null;
        this.gameState.winType = null;
        this.gameState.prizePool = 0;
        this.gameState.countdown = 0;
        
        // Reset card state (keep taken cards until new game starts)
        this.updateTakenCards();
        
        // Reset UI state
        this.uiState.recentNumbers = [];
        this.uiState.lastNumberDrawn = null;
        
        // Update UI
        this.updateGameStatusUI();
        this.updateDrawnNumbersUI();
        this.updateNumberGridUI();
        
        this.emitEvent('game:reset');
    }
    
    showWinnerModal(data) {
        const modal = document.getElementById('winnerModal');
        if (!modal) return;
        
        const isWinner = data.userId === this.playerState.userId;
        
        document.getElementById('winnerName').textContent = 
            isWinner ? 'YOU!' : (data.username || `Player ${data.userId}`);
        document.getElementById('winnerCard').textContent = data.cardId;
        document.getElementById('winnerPattern').textContent = 
            this.formatWinType(data.winType);
        document.getElementById('winnerPrize').textContent = 
            data.prize ? `${data.prize.toFixed(2)}` : '-';
        
        document.getElementById('winnerMessage').textContent = isWinner
            ? '🎉 CONGRATULATIONS! YOU WON! 🎉'
            : `${data.username || 'A player'} won the game!`;
        
        // Start countdown for next game
        let countdown = Math.floor(Config.GAME.AUTO_RESTART_DELAY / 1000);
        const timerElement = document.getElementById('nextGameTimer');
        
        const timer = setInterval(() => {
            countdown--;
            if (timerElement) timerElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(timer);
                modal.classList.remove('active');
            }
        }, 1000);
        
        modal.classList.add('active');
    }
    
    formatWinType(winType) {
        const types = {
            'full_house': 'Full House',
            'four_corners': 'Four Corners',
            'line_1': 'Top Line',
            'line_2': 'Second Line',
            'line_3': 'Third Line',
            'line_4': 'Fourth Line',
            'line_5': 'Bottom Line',
            'diagonal_1': 'Main Diagonal',
            'diagonal_2': 'Anti-Diagonal'
        };
        return types[winType] || winType;
    }
    
    showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">${this.getNotificationIcon(type)}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        // Emit event
        this.emitEvent('notification', { message, type });
    }
    
    getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    
    playSound(soundName) {
        if (!this.uiState.soundEnabled) return;
        
        // This would play actual sound files
        // For now, just log
        console.log('Playing sound:', soundName);
        
        // Emit event for audio manager
        this.emitEvent('sound:play', { sound: soundName });
    }
    
    // Event System
    emitEvent(event, data) {
        const customEvent = new CustomEvent(event, { detail: data });
        document.dispatchEvent(customEvent);
    }
    
    // Public API
    getGameState() {
        return { ...this.gameState };
    }
    
    getPlayerState() {
        return { ...this.playerState };
    }
    
    getCardState() {
        return { ...this.cardState };
    }
    
    getUIState() {
        return { ...this.uiState };
    }
    
    setAutoDaub(enabled) {
        this.uiState.autoDaub = enabled;
        Config.saveToStorage('auto_daub', enabled);
    }
    
    setSoundEnabled(enabled) {
        this.uiState.soundEnabled = enabled;
        Config.saveToStorage('sound_enabled', enabled);
    }
    
    setNotifications(enabled) {
        this.uiState.notifications = enabled;
        Config.saveToStorage('notifications', enabled);
    }
    
    changeView(viewName) {
        this.uiState.currentView = viewName;
        this.emitEvent('view:changed', { view: viewName });
    }
    
    quickSelectCards() {
        if (this.gameState.phase !== 'CARD_SELECTION') {
            this.showNotification('Not in card selection phase', 'error');
            return;
        }
        
        if (this.playerState.selectedCards.size >= Config.GAME.MAX_CARDS_PER_PLAYER) {
            this.showNotification('Already have maximum cards', 'error');
            return;
        }
        
        const availableCards = Array.from(this.cardState.availableCards);
        const cardsToSelect = Math.min(
            Config.GAME.MAX_CARDS_PER_PLAYER - this.playerState.selectedCards.size,
            availableCards.length
        );
        
        // Select random available cards
        for (let i = 0; i < cardsToSelect; i++) {
            if (availableCards.length === 0) break;
            
            const randomIndex = Math.floor(Math.random() * availableCards.length);
            const cardId = availableCards[randomIndex];
            
            this.selectCard(cardId);
            availableCards.splice(randomIndex, 1);
        }
        
        this.showNotification(`Selected ${cardsToSelect} cards`, 'success');
    }
}

// Export singleton
let gameEngineInstance = null;

function getGameEngine() {
    if (!gameEngineInstance) {
        gameEngineInstance = new GameEngine();
    }
    return gameEngineInstance;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameEngine, getGameEngine };
} else {
    window.GameEngine = GameEngine;
    window.getGameEngine = getGameEngine;
}
