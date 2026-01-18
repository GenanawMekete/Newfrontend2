// UI Manager - Handles all UI updates and interactions
import { CONFIG } from './config.js';

export class UIManager {
    constructor() {
        this.elements = {};
        this.selectedCards = new Set();
        this.isModalVisible = false;
    }
    
    // Initialize UI
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.applyTheme();
    }
    
    // Cache DOM elements
    cacheElements() {
        this.elements = {
            cardsGrid: document.getElementById('cardsGrid'),
            cardContent: document.getElementById('cardContent'),
            selectedCount: document.getElementById('selectedCount'),
            totalCards: document.getElementById('totalCards'),
            activeCards: document.getElementById('activeCards'),
            numbersCalled: document.getElementById('numbersCalled'),
            cardSearch: document.getElementById('cardSearch'),
            clearSearch: document.getElementById('clearSearch'),
            cardSelectionSection: document.getElementById('cardSelectionSection'),
            gameBoardSection: document.getElementById('gameBoardSection'),
            cardPreviewModal: document.getElementById('cardPreviewModal'),
            previewCardNumber: document.getElementById('previewCardNumber'),
            cardPreviewContent: document.getElementById('cardPreviewContent'),
            userInfo: document.getElementById('userInfo')
        };
    }
    
    // Generate card grid (1-400)
    generateCardGrid(totalCards, availableCards, onCardClick, onCardPreview) {
        this.elements.cardsGrid.innerHTML = '';
        
        for (let i = 1; i <= totalCards; i++) {
            const cardElement = this.createCardElement(i, availableCards.has(i));
            cardElement.addEventListener('click', () => onCardClick(i));
            cardElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                onCardPreview(i);
            });
            
            this.elements.cardsGrid.appendChild(cardElement);
        }
    }
    
    // Create individual card element
    createCardElement(cardNumber, isAvailable) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card-number ${isAvailable ? 'available' : 'unavailable'}`;
        cardDiv.textContent = cardNumber;
        cardDiv.dataset.cardNumber = cardNumber;
        cardDiv.title = `Card ${cardNumber} - ${isAvailable ? 'Click to select' : 'Unavailable'}`;
        
        // Add tooltip for preview
        if (isAvailable) {
            cardDiv.title += '\nRight-click to preview';
        }
        
        return cardDiv;
    }
    
    // Update card selection state
    updateCardSelection(cardNumber, isSelected) {
        const cardElement = document.querySelector(`.card-number[data-card-number="${cardNumber}"]`);
        
        if (cardElement) {
            if (isSelected) {
                cardElement.classList.add('selected');
                this.selectedCards.add(cardNumber);
            } else {
                cardElement.classList.remove('selected');
                this.selectedCards.delete(cardNumber);
            }
        }
    }
    
    // Update card selection from Set
    updateCardSelectionFromSet(selectedSet) {
        // Clear all selections first
        document.querySelectorAll('.card-number.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add new selections
        selectedSet.forEach(cardNumber => {
            this.updateCardSelection(cardNumber, true);
        });
    }
    
    // Clear all card selections
    clearCardSelection() {
        document.querySelectorAll('.card-number.selected').forEach(card => {
            card.classList.remove('selected');
        });
        this.selectedCards.clear();
    }
    
    // Update selection count
    updateSelectionCount(count) {
        this.elements.selectedCount.textContent = count;
    }
    
    // Update game statistics
    updateStats(stats) {
        if (stats.totalCards !== undefined) {
            this.elements.totalCards.textContent = stats.totalCards;
        }
        if (stats.availableCards !== undefined) {
            this.elements.activeCards.textContent = stats.availableCards;
        }
        if (stats.selectedCards !== undefined) {
            this.elements.selectedCount.textContent = stats.selectedCards;
        }
    }
    
    // Show card preview modal
    showCardPreviewModal() {
        this.elements.cardPreviewModal.style.display = 'flex';
        this.isModalVisible = true;
        document.body.style.overflow = 'hidden';
    }
    
    // Hide card preview modal
    hideCardPreviewModal() {
        this.elements.cardPreviewModal.style.display = 'none';
        this.isModalVisible = false;
        document.body.style.overflow = '';
    }
    
    // Show loading in card preview
    showCardPreviewLoading(cardNumber) {
        this.elements.previewCardNumber.textContent = cardNumber;
        this.elements.cardPreviewContent.innerHTML = `
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading card ${cardNumber}...</p>
        `;
    }
    
    // Display card preview
    displayCardPreview(cardNumber, cardData) {
        this.elements.previewCardNumber.textContent = cardNumber;
        
        if (!cardData || !cardData.numbers) {
            this.elements.cardPreviewContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Card Not Available</h3>
                    <p>This card is no longer available for selection.</p>
                </div>
            `;
            return;
        }
        
        // Create BINGO card preview
        const bingoCard = this.createBingoCardPreview(cardData);
        
        this.elements.cardPreviewContent.innerHTML = `
            <div class="card-preview fade-in">
                <div class="card-header">
                    <div class="card-title">Card #${cardNumber}</div>
                    <div class="card-status ${cardData.isAvailable ? 'status-available' : 'status-unavailable'}">
                        ${cardData.isAvailable ? 'Available' : 'Unavailable'}
                    </div>
                </div>
                ${bingoCard}
                <div class="card-info">
                    <p><strong>Pattern:</strong> ${cardData.pattern}</p>
                    <p><strong>Generated:</strong> ${new Date(cardData.createdAt).toLocaleDateString()}</p>
                </div>
            </div>
        `;
    }
    
    // Create BINGO card preview HTML
    createBingoCardPreview(cardData) {
        // Sort numbers by row and column
        const sortedNumbers = cardData.numbers.sort((a, b) => {
            if (a.row === b.row) return a.column - b.column;
            return a.row - b.row;
        });
        
        // Create header row (B I N G O)
        let html = '<div class="bingo-header">';
        ['B', 'I', 'N', 'G', 'O'].forEach(letter => {
            html += `<div class="bingo-letter">${letter}</div>`;
        });
        html += '</div>';
        
        // Create 5x5 grid
        html += '<div class="bingo-card">';
        
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const numberData = sortedNumbers.find(n => n.row === row && n.column === col);
                
                if (numberData) {
                    const cellClass = numberData.isFreeSpace ? 'bingo-cell free' : 'bingo-cell';
                    const cellContent = numberData.isFreeSpace ? 'FREE' : numberData.number;
                    
                    html += `<div class="${cellClass}">${cellContent}</div>`;
                }
            }
        }
        
        html += '</div>';
        return html;
    }
    
    // Show game board
    showGameBoard() {
        this.elements.cardSelectionSection.style.display = 'none';
        this.elements.gameBoardSection.style.display = 'block';
        
        // Load game board component
        this.loadComponent('components/game-board.html', this.elements.gameBoardSection)
            .then(() => {
                // Initialize game board UI
                this.initializeGameBoard();
            });
    }
    
    // Hide game board
    hideGameBoard() {
        this.elements.cardSelectionSection.style.display = 'block';
        this.elements.gameBoardSection.style.display = 'none';
    }
    
    // Initialize game board UI
    initializeGameBoard() {
        // This would be called after loading the game board component
        // Implementation depends on game board structure
    }
    
    // Update user info from Telegram
    updateUserInfo(userData) {
        if (!userData || !this.elements.userInfo) return;
        
        const { first_name, last_name, username } = userData;
        const displayName = first_name || username || 'Player';
        
        this.elements.userInfo.innerHTML = `
            <div class="user-avatar">
                ${displayName.charAt(0).toUpperCase()}
            </div>
            <span class="user-name">${displayName}</span>
        `;
    }
    
    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} fade-in-up`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    // Show error message
    showError(message) {
        this.showToast(message, 'error');
    }
    
    // Show loading state
    showLoading(message = 'Loading...') {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-overlay';
        loadingDiv.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    }
    
    // Hide loading state
    hideLoading(loadingDiv) {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
    }
    
    // Filter cards based on search term
    filterCards(searchTerm) {
        const cards = document.querySelectorAll('.card-number');
        const term = searchTerm.toLowerCase();
        
        cards.forEach(card => {
            const cardNumber = card.dataset.cardNumber;
            const isVisible = term === '' || cardNumber.includes(term);
            card.style.display = isVisible ? '' : 'none';
        });
    }
    
    // Set theme
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update Telegram theme if available
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.setHeaderColor(theme === 'dark' ? '#17212b' : '#ffffff');
            window.Telegram.WebApp.setBackgroundColor(theme === 'dark' ? '#17212b' : '#ffffff');
        }
    }
    
    // Apply theme from system preference
    applyTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme') || CONFIG.DEFAULT_THEME;
        
        let theme = savedTheme;
        if (theme === 'system') {
            theme = prefersDark ? 'dark' : 'light';
        }
        
        this.setTheme(theme);
    }
    
    // Update online status indicator
    updateOnlineStatus(isOnline) {
        const statusIndicator = document.getElementById('onlineStatus') || 
                               this.createOnlineStatusIndicator();
        
        statusIndicator.className = `online-status ${isOnline ? 'online' : 'offline'}`;
        statusIndicator.title = isOnline ? 'Online' : 'Offline';
    }
    
    // Create online status indicator
    createOnlineStatusIndicator() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'onlineStatus';
        statusDiv.className = 'online-status online';
        
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            headerContent.appendChild(statusDiv);
        }
        
        return statusDiv;
    }
    
    // Load HTML component
    async loadComponent(url, container) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            container.innerHTML = html;
        } catch (error) {
            console.error(`Failed to load component ${url}:`, error);
            container.innerHTML = `<p class="error">Failed to load component</p>`;
        }
    }
    
    // Check if modal is visible
    isModalVisible() {
        return this.isModalVisible;
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Debounced search
        let searchTimeout;
        this.elements.cardSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCards(e.target.value);
            }, CONFIG.DEBOUNCE_DELAY);
        });
        
        // Clear search button
        this.elements.clearSearch.addEventListener('click', () => {
            this.elements.cardSearch.value = '';
            this.filterCards('');
            this.elements.cardSearch.focus();
        });
        
        // Modal close on overlay click
        this.elements.cardPreviewModal.addEventListener('click', (e) => {
            if (e.target === this.elements.cardPreviewModal) {
                this.hideCardPreviewModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalVisible) {
                this.hideCardPreviewModal();
            }
        });
    }
}
