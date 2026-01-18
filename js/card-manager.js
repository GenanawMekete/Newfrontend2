// Card Manager for Bingo Card Operations
class CardManager {
    constructor() {
        this.cards = new Map();
        this.selectedCards = new Set();
        this.cardCache = new Map();
        this.cardTemplates = new Map();
        
        this.init();
    }
    
    init() {
        // Pre-generate card templates for quick rendering
        this.generateCardTemplates();
        
        // Load cached cards
        this.loadCachedCards();
    }
    
    generateCardTemplates() {
        // Generate HTML templates for different card states
        const states = ['default', 'selected', 'marked', 'winning'];
        
        states.forEach(state => {
            const template = this.createCardTemplate(state);
            this.cardTemplates.set(state, template);
        });
    }
    
    createCardTemplate(state) {
        // Create a reusable card template
        const template = document.createElement('div');
        template.className = `bingo-card-template ${state}`;
        template.style.display = 'none';
        
        // Add card structure
        template.innerHTML = `
            <div class="card-header">
                <div class="card-letter B">B</div>
                <div class="card-letter I">I</div>
                <div class="card-letter N">N</div>
                <div class="card-letter G">G</div>
                <div class="card-letter O">O</div>
            </div>
            <div class="card-grid">
                <!-- Numbers will be populated dynamically -->
            </div>
            <div class="card-footer">
                <div class="card-id"></div>
                <div class="card-status"></div>
            </div>
        `;
        
        return template;
    }
    
    generateCard(cardId, seed = null) {
        // Generate a bingo card with given ID
        if (this.cardCache.has(cardId)) {
            return this.cardCache.get(cardId);
        }
        
        const numbers = this.generateCardNumbers(cardId, seed);
        const card = {
            id: cardId,
            numbers: numbers,
            hash: this.generateCardHash(numbers),
            markings: this.createMarkingsGrid(),
            markedCount: 0,
            owner: null,
            selected: false,
            winPatterns: new Set()
        };
        
        // Cache the card
        this.cardCache.set(cardId, card);
        this.cards.set(cardId, card);
        
        return card;
    }
    
    generateCardNumbers(cardId, seed = null) {
        // Generate unique numbers for a bingo card
        const numbers = Array(5).fill().map(() => Array(5).fill(0));
        const ranges = Config.BINGO_CARD.COLUMN_RANGES;
        
        // Use cardId as seed for deterministic generation
        const useSeed = seed || cardId * 123456789;
        const random = (s) => {
            const x = Math.sin(s) * 10000;
            return x - Math.floor(x);
        };
        
        // Generate numbers for each column
        Object.keys(ranges).forEach((letter, colIndex) => {
            const range = ranges[letter];
            const columnNumbers = new Set();
            
            // Generate 5 unique numbers for this column
            while (columnNumbers.size < 5) {
                const rand = random(useSeed + colIndex * 100 + columnNumbers.size * 10);
                const num = Math.floor(rand * (range.max - range.min + 1)) + range.min;
                columnNumbers.add(num);
            }
            
            // Add to numbers array (sorted)
            const sortedNumbers = Array.from(columnNumbers).sort((a, b) => a - b);
            sortedNumbers.forEach((num, rowIndex) => {
                numbers[rowIndex][colIndex] = num;
            });
        });
        
        // Set free space
        numbers[2][2] = 'FREE';
        
        return numbers;
    }
    
    generateCardHash(numbers) {
        // Generate a unique hash for the card
        const flatNumbers = numbers.flat()
            .filter(n => n !== 'FREE')
            .sort((a, b) => a - b);
        
        return flatNumbers.join('-');
    }
    
    createMarkingsGrid() {
        // Create a 5x5 grid for tracking marked numbers
        return Array(5).fill().map(() => Array(5).fill(false));
    }
    
    markNumber(cardId, number) {
        // Mark a number on the card
        const card = this.cards.get(cardId);
        if (!card) return false;
        
        let marked = false;
        
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (card.numbers[row][col] === number) {
                    if (!card.markings[row][col]) {
                        card.markings[row][col] = true;
                        card.markedCount++;
                        marked = true;
                        
                        // Check for win patterns
                        this.checkWinPatterns(card);
                    }
                    break;
                }
            }
        }
        
        return marked;
    }
    
    checkWinPatterns(card) {
        // Check all possible win patterns
        card.winPatterns.clear();
        
        // Check rows
        for (let row = 0; row < 5; row++) {
            if (this.checkRow(card, row)) {
                card.winPatterns.add(`line_${row + 1}`);
            }
        }
        
        // Check columns
        for (let col = 0; col < 5; col++) {
            if (this.checkColumn(card, col)) {
                card.winPatterns.add(`column_${col + 1}`);
            }
        }
        
        // Check diagonals
        if (this.checkDiagonal(card, true)) {
            card.winPatterns.add('diagonal_1');
        }
        
        if (this.checkDiagonal(card, false)) {
            card.winPatterns.add('diagonal_2');
        }
        
        // Check four corners
        if (this.checkFourCorners(card)) {
            card.winPatterns.add('four_corners');
        }
        
        // Check full house
        if (this.checkFullHouse(card)) {
            card.winPatterns.add('full_house');
        }
        
        return card.winPatterns;
    }
    
    checkRow(card, row) {
        for (let col = 0; col < 5; col++) {
            if (!card.markings[row][col] && card.numbers[row][col] !== 'FREE') {
                return false;
            }
        }
        return true;
    }
    
    checkColumn(card, col) {
        for (let row = 0; row < 5; row++) {
            if (!card.markings[row][col] && card.numbers[row][col] !== 'FREE') {
                return false;
            }
        }
        return true;
    }
    
    checkDiagonal(card, main = true) {
        for (let i = 0; i < 5; i++) {
            const col = main ? i : 4 - i;
            if (!card.markings[i][col] && card.numbers[i][col] !== 'FREE') {
                return false;
            }
        }
        return true;
    }
    
    checkFourCorners(card) {
        const corners = [
            [0, 0], [0, 4],
            [4, 0], [4, 4]
        ];
        
        return corners.every(([row, col]) => 
            card.markings[row][col] || card.numbers[row][col] === 'FREE'
        );
    }
    
    checkFullHouse(card) {
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (!card.markings[row][col] && card.numbers[row][col] !== 'FREE') {
                    return false;
                }
            }
        }
        return true;
    }
    
    getAvailableWinPatterns(cardId) {
        const card = this.cards.get(cardId);
        if (!card) return new Set();
        
        return new Set(card.winPatterns);
    }
    
    renderCard(cardId, container, options = {}) {
        // Render a card to the DOM
        const card = this.cards.get(cardId) || this.generateCard(cardId);
        if (!card) return null;
        
        const {
            showId = true,
            showStatus = true,
            interactive = false,
            compact = false,
            markedNumbers = []
        } = options;
        
        // Create card element
        const cardElement = document.createElement('div');
        cardElement.className = `bingo-card ${compact ? 'compact' : ''} ${interactive ? 'interactive' : ''}`;
        cardElement.dataset.cardId = cardId;
        
        // Add header with BINGO letters
        const header = document.createElement('div');
        header.className = 'card-header';
        ['B', 'I', 'N', 'G', 'O'].forEach(letter => {
            const letterDiv = document.createElement('div');
            letterDiv.className = `card-letter ${letter}`;
            letterDiv.textContent = letter;
            header.appendChild(letterDiv);
        });
        cardElement.appendChild(header);
        
        // Add grid with numbers
        const grid = document.createElement('div');
        grid.className = 'card-grid';
        
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const cell = document.createElement('div');
                cell.className = 'card-cell';
                
                const number = card.numbers[row][col];
                const isMarked = card.markings[row][col] || 
                                markedNumbers.includes(number) || 
                                number === 'FREE';
                const isFree = number === 'FREE';
                
                if (isMarked) cell.classList.add('marked');
                if (isFree) cell.classList.add('free');
                
                cell.textContent = isFree ? 'FREE' : number;
                cell.dataset.number = number;
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                grid.appendChild(cell);
            }
        }
        
        cardElement.appendChild(grid);
        
        // Add footer
        if (showId || showStatus) {
            const footer = document.createElement('div');
            footer.className = 'card-footer';
            
            if (showId) {
                const idDiv = document.createElement('div');
                idDiv.className = 'card-id';
                idDiv.textContent = `Card #${cardId}`;
                footer.appendChild(idDiv);
            }
            
            if (showStatus) {
                const statusDiv = document.createElement('div');
                statusDiv.className = 'card-status';
                statusDiv.textContent = this.getCardStatus(card);
                footer.appendChild(statusDiv);
            }
            
            cardElement.appendChild(footer);
        }
        
        // Add event listeners if interactive
        if (interactive) {
            cardElement.addEventListener('click', () => {
                this.handleCardClick(cardId);
            });
        }
        
        // Append to container
        if (container) {
            container.innerHTML = '';
            container.appendChild(cardElement);
        }
        
        return cardElement;
    }
    
    renderCardMini(cardId, container) {
        // Render a mini version of the card
        const card = this.cards.get(cardId);
        if (!card || !container) return null;
        
        const miniCard = document.createElement('div');
        miniCard.className = 'card-mini';
        miniCard.dataset.cardId = cardId;
        
        let html = '<div class="mini-grid">';
        for (let row = 0; row < 5; row++) {
            html += '<div class="mini-row">';
            for (let col = 0; col < 5; col++) {
                const isMarked = card.markings[row][col];
                const isFree = card.numbers[row][col] === 'FREE';
                
                html += `<div class="mini-cell ${isMarked ? 'marked' : ''} ${isFree ? 'free' : ''}"></div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        
        miniCard.innerHTML = html;
        container.appendChild(miniCard);
        
        return miniCard;
    }
    
    renderCardGrid(container, cards, options = {}) {
        // Render multiple cards in a grid
        if (!container || !cards || cards.length === 0) return;
        
        const {
            columns = 4,
            gap = '10px',
            cardWidth = '200px',
            interactive = false
        } = options;
        
        // Set up grid container
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        container.style.gap = gap;
        container.style.width = '100%';
        
        // Clear container
        container.innerHTML = '';
        
        // Add cards
        cards.forEach(cardId => {
            const cardContainer = document.createElement('div');
            cardContainer.className = 'card-grid-item';
            cardContainer.style.width = cardWidth;
            
            this.renderCard(cardId, cardContainer, { 
                showId: true, 
                showStatus: false,
                interactive,
                compact: true 
            });
            
            container.appendChild(cardContainer);
        });
    }
    
    getCardStatus(card) {
        if (!card) return 'Unknown';
        
        if (card.winPatterns.size > 0) {
            return 'BINGO!';
        }
        
        const percentage = (card.markedCount / 24) * 100; // 24 numbers (excluding FREE)
        return `${card.markedCount}/24 (${Math.round(percentage)}%)`;
    }
    
    selectCard(cardId) {
        // Select a card
        if (this.selectedCards.has(cardId)) {
            return false; // Already selected
        }
        
        this.selectedCards.add(cardId);
        const card = this.cards.get(cardId);
        if (card) {
            card.selected = true;
        }
        
        this.saveSelectedCards();
        return true;
    }
    
    deselectCard(cardId) {
        // Deselect a card
        if (!this.selectedCards.has(cardId)) {
            return false;
        }
        
        this.selectedCards.delete(cardId);
        const card = this.cards.get(cardId);
        if (card) {
            card.selected = false;
        }
        
        this.saveSelectedCards();
        return true;
    }
    
    clearSelection() {
        // Clear all selected cards
        this.selectedCards.forEach(cardId => {
            const card = this.cards.get(cardId);
            if (card) {
                card.selected = false;
            }
        });
        
        this.selectedCards.clear();
        this.saveSelectedCards();
    }
    
    getSelectedCards() {
        return Array.from(this.selectedCards);
    }
    
    getSelectedCount() {
        return this.selectedCards.size;
    }
    
    canSelectMore() {
        return this.selectedCards.size < Config.GAME.MAX_CARDS_PER_PLAYER;
    }
    
    saveSelectedCards() {
        // Save selected cards to localStorage
        const userId = Config.getUserId();
        const key = `selected_cards_${userId}`;
        
        Config.saveToStorage(key, Array.from(this.selectedCards));
    }
    
    loadSelectedCards() {
        // Load selected cards from localStorage
        const userId = Config.getUserId();
        const key = `selected_cards_${userId}`;
        
        const savedCards = Config.loadFromStorage(key, []);
        this.selectedCards = new Set(savedCards);
        
        // Update card states
        savedCards.forEach(cardId => {
            const card = this.cards.get(cardId);
            if (card) {
                card.selected = true;
            }
        });
        
        return this.selectedCards;
    }
    
    loadCachedCards() {
        // Load cached cards from localStorage
        const cached = Config.loadFromStorage('cached_cards', {});
        
        Object.entries(cached).forEach(([cardId, cardData]) => {
            this.cards.set(parseInt(cardId), cardData);
            this.cardCache.set(parseInt(cardId), cardData);
        });
    }
    
    saveCachedCards() {
        // Save cards to localStorage for caching
        const cache = {};
        
        this.cardCache.forEach((card, cardId) => {
            cache[cardId] = {
                id: card.id,
                numbers: card.numbers,
                hash: card.hash,
                markings: card.markings,
                markedCount: card.markedCount,
                winPatterns: Array.from(card.winPatterns)
            };
        });
        
        Config.saveToStorage('cached_cards', cache);
    }
    
    markNumbersOnCards(numbers) {
        // Mark multiple numbers on all cards
        const results = {
            cardsMarked: 0,
            totalMarks: 0,
            winningCards: []
        };
        
        this.cards.forEach((card, cardId) => {
            let cardMarked = false;
            
            numbers.forEach(number => {
                if (this.markNumber(cardId, number)) {
                    cardMarked = true;
                    results.totalMarks++;
                }
            });
            
            if (cardMarked) {
                results.cardsMarked++;
            }
            
            if (card.winPatterns.size > 0) {
                results.winningCards.push({
                    cardId,
                    patterns: Array.from(card.winPatterns)
                });
            }
        });
        
        return results;
    }
    
    resetCardMarkings(cardId = null) {
        // Reset markings on card(s)
        if (cardId) {
            const card = this.cards.get(cardId);
            if (card) {
                card.markings = this.createMarkingsGrid();
                card.markedCount = 0;
                card.winPatterns.clear();
            }
        } else {
            // Reset all cards
            this.cards.forEach(card => {
                card.markings = this.createMarkingsGrid();
                card.markedCount = 0;
                card.winPatterns.clear();
            });
        }
    }
    
    getCardStats() {
        // Get statistics about cards
        const stats = {
            totalCards: this.cards.size,
            selectedCards: this.selectedCards.size,
            cardsWithMarks: 0,
            winningCards: 0,
            totalMarks: 0
        };
        
        this.cards.forEach(card => {
            if (card.markedCount > 0) {
                stats.cardsWithMarks++;
                stats.totalMarks += card.markedCount;
            }
            
            if (card.winPatterns.size > 0) {
                stats.winningCards++;
            }
        });
        
        return stats;
    }
    
    handleCardClick(cardId) {
        // Handle card click event
        const card = this.cards.get(cardId);
        if (!card) return;
        
        if (card.selected) {
            this.deselectCard(cardId);
            this.emitEvent('card:deselected', { cardId });
        } else {
            if (this.canSelectMore()) {
                this.selectCard(cardId);
                this.emitEvent('card:selected', { cardId });
            } else {
                this.emitEvent('card:selection:full', { 
                    cardId,
                    maxCards: Config.GAME.MAX_CARDS_PER_PLAYER 
                });
            }
        }
    }
    
    emitEvent(event, data) {
        const customEvent = new CustomEvent(event, { detail: data });
        document.dispatchEvent(customEvent);
    }
    
    // Utility methods for card validation
    validateCard(cardId) {
        const card = this.cards.get(cardId);
        if (!card) return { valid: false, error: 'Card not found' };
        
        // Check if card has valid structure
        if (!Array.isArray(card.numbers) || card.numbers.length !== 5) {
            return { valid: false, error: 'Invalid card structure' };
        }
        
        // Check each row has 5 columns
        for (let row of card.numbers) {
            if (!Array.isArray(row) || row.length !== 5) {
                return { valid: false, error: 'Invalid row structure' };
            }
        }
        
        // Check free space
        if (card.numbers[2][2] !== 'FREE') {
            return { valid: false, error: 'Missing free space' };
        }
        
        // Check column ranges
        const ranges = Config.BINGO_CARD.COLUMN_RANGES;
        for (let col = 0; col < 5; col++) {
            const columnLetter = Object.keys(ranges)[col];
            const range = ranges[columnLetter];
            const columnNumbers = [];
            
            for (let row = 0; row < 5; row++) {
                const num = card.numbers[row][col];
                if (num === 'FREE') continue;
                
                // Check if number is within range
                if (num < range.min || num > range.max) {
                    return { 
                        valid: false, 
                        error: `Number ${num} out of range for column ${columnLetter}` 
                    };
                }
                
                // Check for duplicates in column
                if (columnNumbers.includes(num)) {
                    return { 
                        valid: false, 
                        error: `Duplicate number ${num} in column ${columnLetter}` 
                    };
                }
                
                columnNumbers.push(num);
            }
            
            // Check column is sorted
            const sorted = [...columnNumbers].sort((a, b) => a - b);
            if (!columnNumbers.every((val, idx) => val === sorted[idx])) {
                return { 
                    valid: false, 
                    error: `Column ${columnLetter} not sorted correctly` 
                };
            }
        }
        
        return { valid: true, card };
    }
    
    // Batch operations
    generateMultipleCards(count, startId = 1) {
        const cards = [];
        for (let i = 0; i < count; i++) {
            const cardId = startId + i;
            const card = this.generateCard(cardId);
            cards.push(card);
        }
        return cards;
    }
    
    exportCards(format = 'json') {
        // Export cards in specified format
        const cards = Array.from(this.cards.values());
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(cards, null, 2);
                
            case 'csv':
                return this.convertToCSV(cards);
                
            case 'html':
                return this.convertToHTML(cards);
                
            default:
                return cards;
        }
    }
    
    convertToCSV(cards) {
        // Convert cards to CSV format
        const headers = ['Card ID', 'B1', 'B2', 'B3', 'B4', 'B5', 'I1', 'I2', 'I3', 'I4', 'I5', 'N1', 'N2', 'N3', 'N4', 'N5', 'G1', 'G2', 'G3', 'G4', 'G5', 'O1', 'O2', 'O3', 'O4', 'O5'];
        const rows = cards.map(card => {
            const numbers = card.numbers.flat();
            return [card.id, ...numbers];
        });
        
        return [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');
    }
    
    convertToHTML(cards) {
        // Convert cards to HTML table
        let html = '<table class="bingo-cards-table"><thead><tr><th>Card ID</th>';
        
        // Add column headers
        for (let i = 0; i < 5; i++) {
            html += `<th>B${i+1}</th><th>I${i+1}</th><th>N${i+1}</th><th>G${i+1}</th><th>O${i+1}</th>`;
        }
        html += '</tr></thead><tbody>';
        
        // Add card rows
        cards.forEach(card => {
            html += `<tr><td>${card.id}</td>`;
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const num = card.numbers[row][col];
                    html += `<td>${num}</td>`;
                }
            }
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }
}

// Export singleton
let cardManagerInstance = null;

function getCardManager() {
    if (!cardManagerInstance) {
        cardManagerInstance = new CardManager();
    }
    return cardManagerInstance;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardManager, getCardManager };
} else {
    window.CardManager = CardManager;
    window.getCardManager = getCardManager;
}
