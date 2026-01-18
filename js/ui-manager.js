import { CONFIG } from './config.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.currentScreen = 'cardSelection';
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadComponents();
    }
    
    cacheElements() {
        // Screens
        this.screens = {
            cardSelection: document.getElementById('cardSelectionScreen'),
            game: document.getElementById('gameScreen'),
            winner: document.getElementById('winnerScreen')
        };
        
        // Buttons
        this.confirmBtn = document.getElementById('confirmSelection');
        this.bingoBtn = document.getElementById('bingoBtn');
        this.autoMarkBtn = document.getElementById('autoMarkBtn');
        
        // Info displays
        this.playersCount = document.getElementById('playersCount');
        this.gameTimer = document.getElementById('gameTimer');
        this.selectionTimer = document.getElementById('selectionTimer');
        this.lastNumber = document.getElementById('lastNumber');
        this.maxCards = document.getElementById('maxCards');
        
        // Containers
        this.cardsContainer = document.getElementById('cardsContainer');
        this.playerCardsContainer = document.getElementById('playerCardsContainer');
        this.numberGridContainer = document.getElementById('numberGridContainer');
    }
    
    bindEvents() {
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => {
                this.app.confirmCardSelection();
            });
        }
        
        if (this.bingoBtn) {
            this.bingoBtn.addEventListener('click', () => {
                this.app.declareBingo();
            });
        }
        
        if (this.autoMarkBtn) {
            this.autoMarkBtn.addEventListener('click', () => {
                this.app.gameEngine.toggleAutoMark();
            });
        }
    }
    
    async loadComponents() {
        try {
            // Load mobile navigation
            const navResponse = await fetch('components/mobile-nav.html');
            const navHTML = await navResponse.text();
            document.getElementById('mobileNavContainer').innerHTML = navHTML;
            
            // Load winner modal
            const modalResponse = await fetch('components/winner-modal.html');
            const modalHTML = await modalResponse.text();
            document.getElementById('winnerModalContainer').innerHTML = modalHTML;
            
            this.bindComponentEvents();
            
        } catch (error) {
            console.error('Failed to load components:', error);
            this.createFallbackComponents();
        }
    }
    
    bindComponentEvents() {
        // Mobile navigation events
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const screen = item.dataset.screen;
                this.showScreen(screen);
            });
        });
        
        // Modal close button
        const closeBtn = document.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideModal();
            });
        }
    }
    
    createFallbackComponents() {
        // Create fallback mobile navigation
        const navHTML = `
            <nav class="mobile-nav">
                <div class="nav-item active" data-screen="cardSelection">
                    <span class="nav-icon">🎴</span>
                    <span class="nav-label">Cards</span>
                </div>
                <div class="nav-item" data-screen="game">
                    <span class="nav-icon">🎮</span>
                    <span class="nav-label">Game</span>
                </div>
                <div class="nav-item" data-screen="stats">
                    <span class="nav-icon">📊</span>
                    <span class="nav-label">Stats</span>
                </div>
            </nav>
        `;
        
        document.getElementById('mobileNavContainer').innerHTML = navHTML;
        this.bindComponentEvents();
    }
    
    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        
        // Show requested screen
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
            this.currentScreen = screenName;
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });
    }
    
    showCardSelectionScreen() {
        this.showScreen('cardSelection');
        this.maxCards.textContent = CONFIG.MAX_CARDS_PER_PLAYER;
    }
    
    showGameScreen() {
        this.showScreen('game');
        this.generateNumberGrid();
    }
    
    showWinnerScreen(winnerData) {
        this.showScreen('winner');
        
        // Update winner information
        document.getElementById('winnerName').textContent = winnerData.name || 'Unknown Player';
        document.getElementById('winningCard').textContent = winnerData.cardId || '#1';
        document.getElementById('numbersCalled').textContent = winnerData.numbersCalled || 0;
        
        const duration = winnerData.duration || 0;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        document.getElementById('gameDuration').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Start restart countdown
        this.startRestartCountdown();
        
        // Show confetti
        this.showConfetti();
    }
    
    startRestartCountdown() {
        let timeLeft = CONFIG.AUTO_RESTART_DELAY / 1000;
        const timerElement = document.getElementById('restartTimer');
        
        const countdown = setInterval(() => {
            timeLeft--;
            timerElement.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(countdown);
            }
        }, 1000);
    }
    
    showConfetti() {
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti-container';
        
        for (let i = 0; i < 9; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confettiContainer.appendChild(confetti);
        }
        
        document.body.appendChild(confettiContainer);
        
        // Remove confetti after animation
        setTimeout(() => {
            confettiContainer.remove();
        }, 5000);
    }
    
    displaySelectionCards(cards) {
        if (!this.cardsContainer) return;
        
        this.cardsContainer.innerHTML = '';
        
        cards.forEach(card => {
            const cardElement = this.createCardElement(card);
            this.cardsContainer.appendChild(cardElement);
        });
    }
    
    createCardElement(card) {
        const div = document.createElement('div');
        div.className = `bingo-card-selection ${card.selected ? 'selected' : ''}`;
        div.dataset.cardId = card.id;
        
        div.innerHTML = `
            <div class="card-header">
                <span class="card-id">${card.id}</span>
                <span class="card-status">${card.selected ? 'Selected' : 'Available'}</span>
            </div>
            <div class="card-numbers">
                ${this.generateCardNumbersHTML(card.numbers)}
            </div>
        `;
        
        div.addEventListener('click', () => {
            this.app.cardManager.toggleCardSelection(card.id);
        });
        
        return div;
    }
    
    generateCardNumbersHTML(numbers) {
        let html = '';
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const number = numbers[row][col];
                const isFree = row === 2 && col === 2;
                
                html += `
                    <div class="card-number ${isFree ? 'free' : ''}">
                        ${isFree ? 'FREE' : number}
                    </div>
                `;
            }
        }
        return html;
    }
    
    updateCardSelection(selectedIds, availableCards) {
        // Update card selection state
        document.querySelectorAll('.bingo-card-selection').forEach(cardElement => {
            const cardId = cardElement.dataset.cardId;
            const isSelected = selectedIds.includes(cardId);
            
            cardElement.classList.toggle('selected', isSelected);
            
            const statusElement = cardElement.querySelector('.card-status');
            if (statusElement) {
                statusElement.textContent = isSelected ? 'Selected' : 'Available';
            }
        });
        
        // Update confirm button
        if (this.confirmBtn) {
            this.confirmBtn.disabled = selectedIds.length === 0;
            this.confirmBtn.textContent = `Confirm Selection (${selectedIds.length}/${CONFIG.MAX_CARDS_PER_PLAYER})`;
        }
    }
    
    displayPlayerCards(cards) {
        if (!this.playerCardsContainer) return;
        
        this.playerCardsContainer.innerHTML = '';
        
        cards.forEach((card, index) => {
            const cardElement = this.createPlayerCardElement(card, index);
            this.playerCardsContainer.appendChild(cardElement);
        });
    }
    
    createPlayerCardElement(card, index) {
        const div = document.createElement('div');
        div.className = 'player-card';
        div.dataset.cardId = card.id;
        
        div.innerHTML = `
            <div class="player-card-header">
                <span class="card-id">${card.id}</span>
                <span class="card-number">Card ${index + 1}</span>
            </div>
            <div class="player-card-numbers" id="player-card-${card.id}">
                ${this.generateCardNumbersHTML(card.numbers)}
            </div>
        `;
        
        return div;
    }
    
    markNumberOnCard(cardId, row, col) {
        const cardElement = document.querySelector(`.player-card[data-card-id="${cardId}"]`);
        if (!cardElement) return;
        
        const numbers = cardElement.querySelectorAll('.card-number');
        const index = row * 5 + col;
        
        if (numbers[index]) {
            numbers[index].classList.add('marked', 'number-reveal');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                numbers[index].classList.remove('number-reveal');
            }, 500);
        }
    }
    
    generateNumberGrid() {
        if (!this.numberGridContainer) return;
        
        let html = '<div class="number-grid"><div class="grid-header">Called Numbers</div><div class="numbers-container">';
        
        for (let i = 1; i <= CONFIG.BINGO_NUMBERS; i++) {
            html += `<div class="grid-number" data-number="${i}">${i}</div>`;
        }
        
        html += '</div></div>';
        this.numberGridContainer.innerHTML = html;
    }
    
    updateLastNumber(number) {
        this.lastNumber.textContent = number;
        
        // Highlight the number in the grid
        const numberElement = document.querySelector(`.grid-number[data-number="${number}"]`);
        if (numberElement) {
            numberElement.classList.add('called', 'recent');
            
            // Remove recent class after animation
            setTimeout(() => {
                numberElement.classList.remove('recent');
            }, 1000);
        }
    }
    
    updatePlayersCount(count) {
        this.playersCount.textContent = count;
    }
    
    updateSelectionTimer(seconds) {
        this.selectionTimer.textContent = seconds;
    }
    
    updateGameTimer(minutes, seconds) {
        this.gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    showBingoButton(show) {
        if (this.bingoBtn) {
            this.bingoBtn.disabled = !show;
        }
    }
    
    highlightBingoButton() {
        if (this.bingoBtn) {
            this.bingoBtn.classList.add('pulse', 'glow');
        }
    }
    
    updateAutoMarkButton(enabled) {
        if (this.autoMarkBtn) {
            this.autoMarkBtn.textContent = `Auto-Mark: ${enabled ? 'ON' : 'OFF'}`;
        }
    }
    
    updatePlayerInfo(user) {
        // Could update player name/avatar in the UI
        console.log('User info:', user);
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to DOM
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4CAF50'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideUp 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    showConfirmationModal(title, message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="modalCancel" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                    <button id="modalConfirm" class="btn btn-primary" style="flex: 1;">Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#modalCancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#modalConfirm').addEventListener('click', () => {
            onConfirm();
            modal.remove();
        });
    }
    
    hideModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
}
