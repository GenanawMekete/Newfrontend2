import { CONFIG, BINGO_COLUMNS } from './config.js';

export class CardManager {
    constructor(app) {
        this.app = app;
        this.availableCards = [];
        this.playerCards = [];
    }
    
    init() {
        this.generateSelectionCards();
    }
    
    generateSelectionCards() {
        this.availableCards = [];
        const cardsToShow = Math.min(12, CONFIG.TOTAL_CARDS);
        
        for (let i = 0; i < cardsToShow; i++) {
            const cardId = this.generateCardId();
            const card = {
                id: cardId,
                numbers: this.generateBingoCard(),
                selected: this.app.selectedCards.includes(cardId)
            };
            this.availableCards.push(card);
        }
        
        this.app.uiManager.displaySelectionCards(this.availableCards);
    }
    
    generateCardId() {
        return 'C' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
    
    generateBingoCard() {
        const card = [];
        const columnLetters = ['B', 'I', 'N', 'G', 'O'];
        
        for (let col = 0; col < 5; col++) {
            const column = [];
            const { min, max } = BINGO_COLUMNS[columnLetters[col]];
            const numbers = new Set();
            
            // Generate 5 unique numbers for this column
            while (numbers.size < 5) {
                const num = Math.floor(Math.random() * (max - min + 1)) + min;
                numbers.add(num);
            }
            
            // Convert to array and sort
            const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);
            
            for (let row = 0; row < 5; row++) {
                // Free space in the middle
                if (row === 2 && col === 2) {
                    column[row] = 'FREE';
                } else {
                    column[row] = sortedNumbers[row];
                }
            }
            
            card.push(column);
        }
        
        // Transpose to get rows
        return this.transposeMatrix(card);
    }
    
    transposeMatrix(matrix) {
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }
    
    toggleCardSelection(cardId) {
        if (this.app.selectedCards.includes(cardId)) {
            // Deselect card
            this.app.selectedCards = this.app.selectedCards.filter(id => id !== cardId);
            this.app.audioManager.play('buttonClick');
        } else {
            // Select card if limit not reached
            if (this.app.selectedCards.length < CONFIG.MAX_CARDS_PER_PLAYER) {
                this.app.selectedCards.push(cardId);
                this.app.audioManager.play('cardSelect');
            } else {
                this.app.uiManager.showNotification(`Maximum ${CONFIG.MAX_CARDS_PER_PLAYER} cards allowed`, 'warning');
                return;
            }
        }
        
        this.updateSelectionDisplay();
    }
    
    updateSelectionDisplay() {
        // Update card selection UI
        this.app.uiManager.updateCardSelection(this.app.selectedCards, this.availableCards);
        
        // Update confirm button
        const confirmBtn = document.getElementById('confirmSelection');
        if (confirmBtn) {
            confirmBtn.disabled = this.app.selectedCards.length === 0;
            confirmBtn.textContent = `Confirm Selection (${this.app.selectedCards.length}/${CONFIG.MAX_CARDS_PER_PLAYER})`;
        }
        
        // Save selection
        this.app.saveState();
    }
    
    getPlayerCards() {
        return this.playerCards;
    }
    
    setupPlayerCards(selectedCardIds) {
        this.playerCards = [];
        
        for (const cardId of selectedCardIds) {
            // Find the card in available cards or generate new one
            let card = this.availableCards.find(c => c.id === cardId);
            
            if (!card) {
                card = {
                    id: cardId,
                    numbers: this.generateBingoCard(),
                    selected: true
                };
            }
            
            this.playerCards.push(card);
        }
        
        this.app.uiManager.displayPlayerCards(this.playerCards);
    }
    
    markNumberOnCards(number) {
        for (const card of this.playerCards) {
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    if (card.numbers[row][col] === number) {
                        // Mark the number on the card
                        this.app.uiManager.markNumberOnCard(card.id, row, col);
                    }
                }
            }
        }
    }
    
    getAvailableCards() {
        return this.availableCards;
    }
}
