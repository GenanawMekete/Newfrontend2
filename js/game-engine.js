import { CONFIG, BINGO_COLUMNS } from './config.js';

export class GameEngine {
    constructor(app) {
        this.app = app;
        this.selectionTimer = null;
        this.gameTimer = null;
        this.numberDrawInterval = null;
        this.drawnNumbers = new Set();
        this.gameStartTime = null;
        this.autoMarkEnabled = true;
    }
    
    startSelectionTimer(seconds) {
        let timeLeft = seconds;
        
        this.selectionTimer = setInterval(() => {
            timeLeft--;
            this.app.uiManager.updateSelectionTimer(timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(this.selectionTimer);
                this.endSelectionPeriod();
            }
        }, 1000);
    }
    
    endSelectionPeriod() {
        if (this.app.selectedCards.length === 0) {
            // Auto-select random cards if none selected
            const cards = this.app.cardManager.getAvailableCards();
            const randomCards = cards.slice(0, CONFIG.MAX_CARDS_PER_PLAYER);
            this.app.selectedCards = randomCards.map(card => card.id);
            this.app.cardManager.updateSelectionDisplay();
        }
        
        this.app.confirmCardSelection();
    }
    
    startGame(gameData) {
        this.gameStartTime = Date.now();
        this.drawnNumbers.clear();
        
        // Start number drawing interval
        this.numberDrawInterval = setInterval(() => {
            this.drawNumber();
        }, CONFIG.NUMBER_DRAW_INTERVAL);
        
        // Update game timer every second
        this.gameTimer = setInterval(() => {
            this.updateGameTimer();
        }, 1000);
        
        this.app.uiManager.showBingoButton(true);
    }
    
    drawNumber() {
        if (this.drawnNumbers.size >= CONFIG.BINGO_NUMBERS) {
            clearInterval(this.numberDrawInterval);
            return;
        }
        
        let number;
        do {
            number = Math.floor(Math.random() * CONFIG.BINGO_NUMBERS) + 1;
        } while (this.drawnNumbers.has(number));
        
        this.drawnNumbers.add(number);
        
        // Send to server (in real implementation)
        this.app.socketManager.send({
            type: 'number_drawn',
            number: number
        });
        
        // Update UI
        this.app.handleNumberDrawn(number);
    }
    
    updateGameTimer() {
        if (!this.gameStartTime) return;
        
        const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        this.app.uiManager.updateGameTimer(minutes, seconds);
    }
    
    checkForBingo() {
        if (!this.autoMarkEnabled) return;
        
        const playerCards = this.app.cardManager.getPlayerCards();
        let hasBingo = false;
        
        for (const card of playerCards) {
            if (this.checkCardForBingo(card)) {
                hasBingo = true;
                break;
            }
        }
        
        if (hasBingo) {
            this.app.uiManager.showBingoButton(true);
            this.app.uiManager.highlightBingoButton();
        }
    }
    
    checkCardForBingo(card) {
        const patterns = this.getBingoPatterns();
        
        for (const pattern of patterns) {
            if (this.checkPattern(card, pattern)) {
                return true;
            }
        }
        
        return false;
    }
    
    getBingoPatterns() {
        // Common bingo patterns
        return [
            // Horizontal lines
            [[0,0], [0,1], [0,2], [0,3], [0,4]],
            [[1,0], [1,1], [1,2], [1,3], [1,4]],
            [[2,0], [2,1], [2,2], [2,3], [2,4]],
            [[3,0], [3,1], [3,2], [3,3], [3,4]],
            [[4,0], [4,1], [4,2], [4,3], [4,4]],
            
            // Vertical lines
            [[0,0], [1,0], [2,0], [3,0], [4,0]],
            [[0,1], [1,1], [2,1], [3,1], [4,1]],
            [[0,2], [1,2], [2,2], [3,2], [4,2]],
            [[0,3], [1,3], [2,3], [3,3], [4,3]],
            [[0,4], [1,4], [2,4], [3,4], [4,4]],
            
            // Diagonals
            [[0,0], [1,1], [2,2], [3,3], [4,4]],
            [[0,4], [1,3], [2,2], [3,1], [4,0]],
            
            // Four corners
            [[0,0], [0,4], [4,0], [4,4]],
            
            // X pattern
            [[0,0], [1,1], [3,3], [4,4], [0,4], [1,3], [3,1], [4,0]]
        ];
    }
    
    checkPattern(card, pattern) {
        for (const [row, col] of pattern) {
            const number = card.numbers[row][col];
            if (!this.drawnNumbers.has(number) && !(row === 2 && col === 2)) { // Free space
                return false;
            }
        }
        return true;
    }
    
    toggleAutoMark() {
        this.autoMarkEnabled = !this.autoMarkEnabled;
        this.app.uiManager.updateAutoMarkButton(this.autoMarkEnabled);
    }
    
    stopGame() {
        if (this.selectionTimer) {
            clearInterval(this.selectionTimer);
        }
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        if (this.numberDrawInterval) {
            clearInterval(this.numberDrawInterval);
        }
    }
    
    getGameStats() {
        return {
            drawnNumbers: this.drawnNumbers.size,
            gameDuration: this.gameStartTime ? Date.now() - this.gameStartTime : 0
        };
    }
}
