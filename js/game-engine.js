// Game Engine - Core game logic
import { CONFIG, CARD_RULES } from './config.js';

export class GameEngine {
    constructor() {
        this.state = {
            gameId: null,
            selectedCards: [],
            calledNumbers: new Set(),
            calledNumbersHistory: [],
            currentNumber: null,
            gameStarted: false,
            gameEnded: false,
            winners: [],
            patterns: [],
            players: [],
            startTime: null,
            lastNumberTime: null
        };
        
        this.cardsData = new Map();
        this.winningPatterns = new Set();
        this.numberFrequency = new Map();
    }
    
    // Initialize game with selected cards
    async init(selectedCards) {
        this.state.selectedCards = selectedCards;
        this.state.gameId = this.generateGameId();
        this.state.startTime = Date.now();
        
        // Load card data for all selected cards
        await this.loadCardsData(selectedCards);
        
        // Initialize number frequency tracking
        this.initializeNumberFrequency();
        
        // Initialize winning patterns
        this.initializeWinningPatterns();
        
        console.log(`Game initialized with ${selectedCards.length} cards`);
    }
    
    // Generate unique game ID
    generateGameId() {
        return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Load data for all selected cards
    async loadCardsData(cardNumbers) {
        // This would typically fetch from server
        // For now, we'll generate mock data
        
        cardNumbers.forEach(cardNumber => {
            const cardData = this.generateCardData(cardNumber);
            this.cardsData.set(cardNumber, cardData);
        });
    }
    
    // Generate card data (mock implementation)
    generateCardData(cardNumber) {
        const seed = cardNumber * 123456789;
        const card = {
            cardNumber,
            numbers: [],
            markedNumbers: new Set(),
            patternsCompleted: new Set()
        };
        
        // Generate BINGO numbers
        CARD_RULES.COLUMNS.forEach((letter, colIndex) => {
            const columnRules = CARD_RULES[`${letter}_COLUMN`];
            
            for (let row = 0; row < 5; row++) {
                // Free space in the middle
                if (CARD_RULES.FREE_SPACE && 
                    row === CARD_RULES.FREE_SPACE_POSITION[0] && 
                    colIndex === CARD_RULES.FREE_SPACE_POSITION[1]) {
                    card.numbers.push({
                        letter,
                        number: 'FREE',
                        row,
                        column: colIndex,
                        isFreeSpace: true,
                        isMarked: true // Free space is always marked
                    });
                    continue;
                }
                
                // Generate number
                const number = this.generateColumnNumber(seed, cardNumber, colIndex, row, columnRules);
                
                card.numbers.push({
                    letter,
                    number,
                    row,
                    column: colIndex,
                    isFreeSpace: false,
                    isMarked: false
                });
            }
        });
        
        return card;
    }
    
    // Generate column number (consistent with card-manager)
    generateColumnNumber(seed, cardNumber, columnIndex, rowIndex, columnRules) {
        const base = seed + (cardNumber * 100) + (columnIndex * 10) + rowIndex;
        const range = columnRules.max - columnRules.min + 1;
        return columnRules.min + (Math.abs(base) % range);
    }
    
    // Initialize number frequency tracking
    initializeNumberFrequency() {
        // Count frequency of each number across all cards
        for (const cardData of this.cardsData.values()) {
            cardData.numbers.forEach(cell => {
                if (cell.number !== 'FREE') {
                    const current = this.numberFrequency.get(cell.number) || 0;
                    this.numberFrequency.set(cell.number, current + 1);
                }
            });
        }
    }
    
    // Initialize winning patterns
    initializeWinningPatterns() {
        this.winningPatterns = new Set(CONFIG.BINGO_PATTERNS);
    }
    
    // Start the game
    startGame() {
        if (this.state.gameStarted) {
            console.warn('Game already started');
            return;
        }
        
        this.state.gameStarted = true;
        this.state.startTime = Date.now();
        
        console.log('Game started:', this.state.gameId);
        return this.state.gameId;
    }
    
    // Draw a new number
    drawNumber() {
        if (!this.state.gameStarted || this.state.gameEnded) {
            return null;
        }
        
        // Generate random number 1-75
        let newNumber;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            newNumber = Math.floor(Math.random() * 75) + 1;
            attempts++;
            
            if (attempts > maxAttempts) {
                // All numbers drawn
                this.endGame();
                return null;
            }
        } while (this.state.calledNumbers.has(newNumber));
        
        // Update state
        this.state.calledNumbers.add(newNumber);
        this.state.currentNumber = newNumber;
        this.state.lastNumberTime = Date.now();
        
        const letter = this.getNumberLetter(newNumber);
        const numberData = {
            number: newNumber,
            letter,
            timestamp: this.state.lastNumberTime,
            frequency: this.numberFrequency.get(newNumber) || 0
        };
        
        this.state.calledNumbersHistory.push(numberData);
        
        // Mark numbers on cards
        this.markNumbersOnCards(newNumber);
        
        // Check for winners
        this.checkForWinners();
        
        return numberData;
    }
    
    // Get letter for a number (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
    getNumberLetter(number) {
        if (number <= 15) return 'B';
        if (number <= 30) return 'I';
        if (number <= 45) return 'N';
        if (number <= 60) return 'G';
        return 'O';
    }
    
    // Mark numbers on all cards
    markNumbersOnCards(number) {
        for (const [cardNumber, cardData] of this.cardsData) {
            cardData.numbers.forEach(cell => {
                if (cell.number === number) {
                    cell.isMarked = true;
                    cardData.markedNumbers.add(number);
                }
            });
        }
    }
    
    // Check for winners
    checkForWinners() {
        const winners = [];
        
        for (const [cardNumber, cardData] of this.cardsData) {
            // Check each winning pattern
            for (const pattern of this.winningPatterns) {
                if (!cardData.patternsCompleted.has(pattern) && 
                    this.checkPattern(cardData, pattern)) {
                    
                    cardData.patternsCompleted.add(pattern);
                    
                    winners.push({
                        cardNumber,
                        pattern,
                        winningNumbers: Array.from(cardData.markedNumbers),
                        timestamp: Date.now()
                    });
                }
            }
        }
        
        if (winners.length > 0) {
            this.state.winners.push(...winners);
            
            // Check if game should end
            if (this.shouldEndGame()) {
                this.endGame();
            }
        }
        
        return winners;
    }
    
    // Check specific pattern on a card
    checkPattern(cardData, pattern) {
        switch (pattern) {
            case 'LINE':
                return this.checkLinePattern(cardData);
            case 'FOUR_CORNERS':
                return this.checkFourCornersPattern(cardData);
            case 'BLACKOUT':
                return this.checkBlackoutPattern(cardData);
            default:
                return false;
        }
    }
    
    // Check for any complete line
    checkLinePattern(cardData) {
        const grid = this.createNumberGrid(cardData);
        
        // Check rows
        for (let row = 0; row < 5; row++) {
            let complete = true;
            for (let col = 0; col < 5; col++) {
                if (!grid[row][col].isMarked) {
                    complete = false;
                    break;
                }
            }
            if (complete) return true;
        }
        
        // Check columns
        for (let col = 0; col < 5; col++) {
            let complete = true;
            for (let row = 0; row < 5; row++) {
                if (!grid[row][col].isMarked) {
                    complete = false;
                    break;
                }
            }
            if (complete) return true;
        }
        
        // Check diagonals
        let diag1Complete = true;
        let diag2Complete = true;
        
        for (let i = 0; i < 5; i++) {
            if (!grid[i][i].isMarked) diag1Complete = false;
            if (!grid[i][4 - i].isMarked) diag2Complete = false;
        }
        
        return diag1Complete || diag2Complete;
    }
    
    // Check four corners pattern
    checkFourCornersPattern(cardData) {
        const grid = this.createNumberGrid(cardData);
        
        return grid[0][0].isMarked &&  // Top-left
               grid[0][4].isMarked &&  // Top-right
               grid[4][0].isMarked &&  // Bottom-left
               grid[4][4].isMarked;    // Bottom-right
    }
    
    // Check blackout pattern (all numbers marked)
    checkBlackoutPattern(cardData) {
        return cardData.markedNumbers.size === 24; // 25 cells - free space
    }
    
    // Create 5x5 grid from card data
    createNumberGrid(cardData) {
        const grid = Array(5).fill().map(() => Array(5).fill(null));
        
        cardData.numbers.forEach(cell => {
            grid[cell.row][cell.column] = {
                number: cell.number,
                isMarked: cell.isMarked || cell.isFreeSpace,
                letter: cell.letter
            };
        });
        
        return grid;
    }
    
    // Determine if game should end
    shouldEndGame() {
        // End game if any blackout is achieved
        return this.state.winners.some(winner => winner.pattern === 'BLACKOUT');
    }
    
    // End the game
    endGame() {
        this.state.gameEnded = true;
        this.state.gameStarted = false;
        
        console.log('Game ended. Winners:', this.state.winners);
        
        return {
            winners: this.state.winners,
            totalNumbersCalled: this.state.calledNumbers.size,
            duration: Date.now() - this.state.startTime
        };
    }
    
    // Get card data
    getCardData(cardNumber) {
        return this.cardsData.get(cardNumber);
    }
    
    // Get all card data
    getAllCardData() {
        return Array.from(this.cardsData.entries()).map(([cardNumber, data]) => ({
            cardNumber,
            ...data
        }));
    }
    
    // Get game statistics
    getStatistics() {
        const totalPossibleNumbers = 75;
        const numbersCalled = this.state.calledNumbers.size;
        const percentageCalled = (numbersCalled / totalPossibleNumbers) * 100;
        
        // Most frequent numbers called
        const numberStats = Array.from(this.numberFrequency.entries())
            .map(([number, frequency]) => ({
                number,
                frequency,
                called: this.state.calledNumbers.has(number)
            }))
            .sort((a, b) => b.frequency - a.frequency);
        
        // Card statistics
        const cardStats = Array.from(this.cardsData.entries()).map(([cardNumber, data]) => ({
            cardNumber,
            markedNumbers: data.markedNumbers.size,
            totalNumbers: 24, // Excluding free space
            completionPercentage: (data.markedNumbers.size / 24) * 100,
            patternsCompleted: Array.from(data.patternsCompleted)
        }));
        
        return {
            gameId: this.state.gameId,
            numbersCalled,
            percentageCalled,
            totalWinners: this.state.winners.length,
            currentNumber: this.state.currentNumber,
            gameDuration: this.state.startTime ? Date.now() - this.state.startTime : 0,
            numberStats: numberStats.slice(0, 10), // Top 10
            cardStats,
            winners: this.state.winners
        };
    }
    
    // Get game state
    getState() {
        return {
            ...this.state,
            cardsData: Array.from(this.cardsData.entries()),
            numberFrequency: Array.from(this.numberFrequency.entries()),
            winningPatterns: Array.from(this.winningPatterns)
        };
    }
    
    // Reset game
    reset() {
        this.state = {
            gameId: null,
            selectedCards: [],
            calledNumbers: new Set(),
            calledNumbersHistory: [],
            currentNumber: null,
            gameStarted: false,
            gameEnded: false,
            winners: [],
            patterns: [],
            players: [],
            startTime: null,
            lastNumberTime: null
        };
        
        this.cardsData.clear();
        this.numberFrequency.clear();
        this.winningPatterns.clear();
    }
    
    // Export game data
    exportGameData() {
        return {
            gameId: this.state.gameId,
            startTime: this.state.startTime,
            endTime: this.state.gameEnded ? Date.now() : null,
            selectedCards: this.state.selectedCards,
            calledNumbers: Array.from(this.state.calledNumbers),
            calledNumbersHistory: this.state.calledNumbersHistory,
            winners: this.state.winners,
            cardsData: this.getAllCardData(),
            statistics: this.getStatistics()
        };
    }
}
