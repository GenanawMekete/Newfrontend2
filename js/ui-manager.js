// UI Manager for DOM Manipulation and User Interactions
class UIManager {
    constructor() {
        this.currentView = 'game';
        this.modals = new Map();
        this.toasts = [];
        this.loadingStates = new Set();
        this.animationsEnabled = Config.UI.ANIMATIONS.ENABLED;
        this.touchSupport = 'ontouchstart' in window;
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTouchSupport();
        this.setupAccessibility();
        this.setupTheme();
    }
    
    setupEventListeners() {
        // Navigation events
        document.addEventListener('click', (e) => this.handleNavigationClick(e));
        
        // View change events
        document.addEventListener('view:change', (e) => this.handleViewChange(e));
        
        // Modal events
        document.addEventListener('click', (e) => this.handleModalClick(e));
        document.addEventListener('keydown', (e) => this.handleModalKeydown(e));
        
        // Touch events
        if (this.touchSupport) {
            this.setupTouchGestures();
        }
        
        // Window events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
    }
    
    setupTouchSupport() {
        // Add touch-specific classes
        if (this.touchSupport) {
            document.body.classList.add('touch-device');
        } else {
            document.body.classList.add('mouse-device');
        }
        
        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }
    
    setupAccessibility() {
        // Add aria attributes
        this.addAriaAttributes();
        
        // Setup keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
        
        // Focus management
        document.addEventListener('focusin', (e) => this.handleFocusChange(e));
    }
    
    setupTheme() {
        // Apply theme based on system preference or saved setting
        const savedTheme = Config.loadFromStorage('theme', 'auto');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        let theme = savedTheme;
        if (theme === 'auto') {
            theme = systemDark ? 'dark' : 'light';
        }
        
        this.applyTheme(theme);
        
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (Config.loadFromStorage('theme', 'auto') === 'auto') {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
    
    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        document.documentElement.style.setProperty('color-scheme', theme);
        
        // Update meta theme-color
        const themeColor = theme === 'dark' ? '#0f172a' : '#f8f9fa';
        document.querySelector('meta[name="theme-color"]').setAttribute('content', themeColor);
    }
    
    // View Management
    switchView(viewName) {
        if (this.currentView === viewName) return;
        
        const oldView = this.currentView;
        this.currentView = viewName;
        
        // Hide all views
        document.querySelectorAll('.content-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show current view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        // Update navigation
        this.updateNavigation(viewName);
        
        // Update side menu
        this.updateSideMenu(viewName);
        
        // Emit event
        this.emitEvent('view:changed', { oldView, newView: viewName });
    }
    
    updateNavigation(viewName) {
        // Update bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });
        
        // Update side menu
        document.querySelectorAll('.menu-item[data-view]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });
    }
    
    updateSideMenu(viewName) {
        // Update active state in side menu
        const menuItems = document.querySelectorAll('.menu-item[data-view]');
        menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });
    }
    
    // Modal Management
    showModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        // Set options
        const {
            backdropClose = true,
            escapeClose = true,
            animation = 'slide-up',
            zIndex = 1000
        } = options;
        
        // Store modal options
        this.modals.set(modalId, {
            backdropClose,
            escapeClose,
            animation,
            zIndex
        });
        
        // Show modal
        modal.style.zIndex = zIndex;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        
        // Add animation class
        if (this.animationsEnabled && animation) {
            modal.classList.add(animation);
        }
        
        // Trap focus inside modal
        this.trapFocus(modal);
        
        // Emit event
        this.emitEvent('modal:opened', { modalId, options });
        
        return true;
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal || !modal.classList.contains('active')) return false;
        
        // Remove animation class
        const options = this.modals.get(modalId);
        if (options && options.animation) {
            modal.classList.remove(options.animation);
        }
        
        // Hide modal
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        
        // Remove from tracking
        this.modals.delete(modalId);
        
        // Restore focus
        this.restoreFocus();
        
        // Emit event
        this.emitEvent('modal:closed', { modalId });
        
        return true;
    }
    
    hideAllModals() {
        this.modals.forEach((options, modalId) => {
            this.hideModal(modalId);
        });
    }
    
    trapFocus(modal) {
        // Get all focusable elements in modal
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Store previously focused element
        this.previouslyFocused = document.activeElement;
        
        // Focus first element
        firstElement.focus();
        
        // Handle tab key within modal
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });
    }
    
    restoreFocus() {
        // Restore focus to previously focused element
        if (this.previouslyFocused && this.previouslyFocused.focus) {
            setTimeout(() => {
                this.previouslyFocused.focus();
            }, 10);
        }
    }
    
    // Toast Notifications
    showToast(message, options = {}) {
        const {
            type = 'info',
            duration = 3000,
            position = 'top-right',
            action = null
        } = options;
        
        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type} toast-${position}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        
        // Toast content
        let content = `
            <div class="toast-icon">${this.getToastIcon(type)}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
        `;
        
        if (action) {
            content += `
                <button class="toast-action" onclick="UIManager.handleToastAction('${toastId}', '${action.type}')">
                    ${action.label}
                </button>
            `;
        }
        
        content += '</div>';
        
        toast.innerHTML = content;
        
        // Add to DOM
        const container = this.getToastContainer(position);
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Store toast
        this.toasts.push({
            id: toastId,
            element: toast,
            duration,
            timeout: null
        });
        
        // Auto dismiss
        if (duration > 0) {
            const timeout = setTimeout(() => {
                this.dismissToast(toastId);
            }, duration);
            
            this.toasts[this.toasts.length - 1].timeout = timeout;
        }
        
        // Emit event
        this.emitEvent('toast:shown', { id: toastId, message, type, position });
        
        return toastId;
    }
    
    dismissToast(toastId) {
        const toastIndex = this.toasts.findIndex(t => t.id === toastId);
        if (toastIndex === -1) return;
        
        const toast = this.toasts[toastIndex];
        
        // Animate out
        toast.element.classList.remove('show');
        toast.element.classList.add('hide');
        
        // Remove after animation
        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            
            // Clear timeout
            if (toast.timeout) {
                clearTimeout(toast.timeout);
            }
            
            // Remove from array
            this.toasts.splice(toastIndex, 1);
            
            // Emit event
            this.emitEvent('toast:dismissed', { id: toastId });
        }, 300);
    }
    
    dismissAllToasts() {
        this.toasts.forEach(toast => {
            this.dismissToast(toast.id);
        });
    }
    
    getToastContainer(position) {
        let containerId = `toast-container-${position}`;
        let container = document.getElementById(containerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = `toast-container toast-container-${position}`;
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    getToastIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'loading': '⏳'
        };
        
        return icons[type] || 'ℹ️';
    }
    
    static handleToastAction(toastId, actionType) {
        // Handle toast action button click
        const uiManager = getUIManager();
        uiManager.emitEvent('toast:action', { toastId, actionType });
        uiManager.dismissToast(toastId);
    }
    
    // Loading States
    showLoading(id = 'global', message = 'Loading...') {
        this.loadingStates.add(id);
        
        // Create or update loading overlay
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            `;
            document.body.appendChild(overlay);
        }
        
        overlay.classList.add('active');
        
        // Update message if needed
        if (message) {
            const messageElement = overlay.querySelector('.loading-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
        
        // Emit event
        this.emitEvent('loading:started', { id, message });
    }
    
    hideLoading(id = 'global') {
        this.loadingStates.delete(id);
        
        // Hide loading if no more loading states
        if (this.loadingStates.size === 0) {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.remove('active');
                
                // Remove after animation
                setTimeout(() => {
                    if (overlay.parentNode && !overlay.classList.contains('active')) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 300);
            }
        }
        
        // Emit event
        this.emitEvent('loading:ended', { id });
    }
    
    // Card Selection UI
    showCardSelection() {
        const gameEngine = getGameEngine();
        const gameState = gameEngine.getGameState();
        
        if (gameState.phase !== 'CARD_SELECTION') {
            this.showToast('Card selection is not active', { type: 'error' });
            return false;
        }
        
        this.showModal('cardSelectionModal', {
            animation: 'slide-up',
            backdropClose: true,
            escapeClose: true
        });
        
        // Update card grid
        this.updateCardSelectionGrid();
        
        return true;
    }
    
    updateCardSelectionGrid() {
        const cardManager = getCardManager();
        const gameEngine = getGameEngine();
        
        const selectedCards = gameEngine.getPlayerState().selectedCards;
        const takenCards = gameEngine.getCardState().takenCards;
        
        const container = document.getElementById('cardGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Create grid of 400 cards
        for (let i = 1; i <= 400; i++) {
            const cardElement = document.createElement('div');
            cardElement.className = 'grid-card';
            cardElement.dataset.cardId = i;
            cardElement.textContent = i;
            
            if (selectedCards.has(i)) {
                cardElement.classList.add('selected');
                cardElement.title = 'Your card';
            } else if (takenCards.has(i)) {
                cardElement.classList.add('taken');
                cardElement.title = 'Taken by another player';
                cardElement.style.cursor = 'not-allowed';
            } else {
                cardElement.onclick = () => this.handleCardSelect(i);
            }
            
            container.appendChild(cardElement);
        }
        
        // Update counts
        this.updateElement('currentSelected', `${selectedCards.size}/4`);
        this.updateElement('availableCards', 400 - takenCards.size);
    }
    
    handleCardSelect(cardId) {
        const gameEngine = getGameEngine();
        const success = gameEngine.selectCard(cardId);
        
        if (success) {
            // Update UI immediately
            const cardElement = document.querySelector(`.grid-card[data-card-id="${cardId}"]`);
            if (cardElement) {
                cardElement.classList.add('selected');
                cardElement.onclick = null;
                
                // Add animation
                if (this.animationsEnabled) {
                    cardElement.classList.add('card-pop');
                    setTimeout(() => {
                        cardElement.classList.remove('card-pop');
                    }, 300);
                }
            }
            
            // Update counts
            this.updateCardSelectionCounts();
        }
    }
    
    updateCardSelectionCounts() {
        const gameEngine = getGameEngine();
        const selectedCards = gameEngine.getPlayerState().selectedCards;
        const takenCards = gameEngine.getCardState().takenCards;
        
        this.updateElement('currentSelected', `${selectedCards.size}/4`);
        this.updateElement('availableCards', 400 - takenCards.size);
    }
    
    // Bingo Claim UI
    showBingoClaim(cardId = null) {
        const gameEngine = getGameEngine();
        const playerState = gameEngine.getPlayerState();
        
        // If no cardId provided, use first selected card
        if (!cardId && playerState.selectedCards.size > 0) {
            cardId = Array.from(playerState.selectedCards)[0];
        }
        
        if (!cardId) {
            this.showToast('No cards selected', { type: 'error' });
            return false;
        }
        
        // Validate card ownership
        if (!playerState.selectedCards.has(cardId)) {
            this.showToast('You do not own this card', { type: 'error' });
            return false;
        }
        
        // Show modal
        this.showModal('bingoClaimModal', {
            animation: 'slide-up',
            backdropClose: true,
            escapeClose: true
        });
        
        // Update modal content
        this.updateBingoClaimModal(cardId);
        
        return true;
    }
    
    updateBingoClaimModal(cardId) {
        const cardManager = getCardManager();
        const gameEngine = getGameEngine();
        
        // Update card info
        this.updateElement('selectedCardNumber', cardId);
        
        // Update card preview
        const previewContainer = document.getElementById('cardMiniPreview');
        if (previewContainer) {
            cardManager.renderCardMini(cardId, previewContainer);
        }
        
        // Update pattern selection
        this.updatePatternSelection();
        
        // Set up claim button
        const claimButton = document.querySelector('.bingo-claim-btn');
        if (claimButton) {
            claimButton.onclick = () => this.handleBingoClaimSubmit(cardId);
        }
    }
    
    updatePatternSelection() {
        const patterns = document.querySelectorAll('.pattern-card');
        patterns.forEach(pattern => {
            pattern.classList.remove('selected');
            pattern.onclick = () => this.selectPattern(pattern);
        });
        
        // Select first pattern by default
        if (patterns.length > 0) {
            this.selectPattern(patterns[0]);
        }
    }
    
    selectPattern(patternElement) {
        // Deselect all patterns
        document.querySelectorAll('.pattern-card').forEach(p => {
            p.classList.remove('selected');
        });
        
        // Select clicked pattern
        patternElement.classList.add('selected');
        this.selectedPattern = patternElement.dataset.pattern;
    }
    
    handleBingoClaimSubmit(cardId) {
        if (!this.selectedPattern) {
            this.showToast('Please select a winning pattern', { type: 'error' });
            return;
        }
        
        const gameEngine = getGameEngine();
        const success = gameEngine.claimBingo(cardId, this.selectedPattern);
        
        if (success) {
            this.hideModal('bingoClaimModal');
            this.showToast('Bingo claim submitted!', { type: 'success' });
        }
    }
    
    // Number Display
    showNumberDrawn(number, letter) {
        // Update recent numbers display
        this.updateRecentNumbers(number, letter);
        
        // Show toast notification
        this.showToast(`Number ${number} (${letter}) drawn!`, {
            type: 'info',
            duration: 2000,
            position: 'top-center'
        });
        
        // Update number grid
        this.markNumberOnGrid(number);
        
        // Play animation
        if (this.animationsEnabled) {
            this.animateNumberDrawn(number, letter);
        }
    }
    
    updateRecentNumbers(number, letter) {
        const container = document.getElementById('recentList');
        if (!container) return;
        
        // Create number element
        const numberElement = document.createElement('div');
        numberElement.className = 'recent-number-item';
        numberElement.innerHTML = `
            <div class="number">${number}</div>
            <div class="letter">${letter}</div>
        `;
        
        // Add animation
        if (this.animationsEnabled) {
            numberElement.classList.add('number-pop');
            setTimeout(() => {
                numberElement.classList.remove('number-pop');
            }, 600);
        }
        
        // Add to beginning
        container.insertBefore(numberElement, container.firstChild);
        
        // Limit to 8 items
        while (container.children.length > 8) {
            container.removeChild(container.lastChild);
        }
    }
    
    markNumberOnGrid(number) {
        const numberElements = document.querySelectorAll(`[data-number="${number}"]`);
        numberElements.forEach(element => {
            element.classList.add('drawn', 'recent');
            
            // Remove recent class after animation
            setTimeout(() => {
                element.classList.remove('recent');
            }, 1000);
        });
    }
    
    animateNumberDrawn(number, letter) {
        // Create animation element
        const animElement = document.createElement('div');
        animElement.className = 'number-draw-animation';
        animElement.innerHTML = `
            <div class="number-draw-content">
                <div class="number-draw-number">${number}</div>
                <div class="number-draw-letter">${letter}</div>
            </div>
        `;
        
        document.body.appendChild(animElement);
        
        // Animate
        setTimeout(() => {
            animElement.classList.add('animate');
            
            // Remove after animation
            setTimeout(() => {
                if (animElement.parentNode) {
                    animElement.parentNode.removeChild(animElement);
                }
            }, 1000);
        }, 10);
    }
    
    // Winner Display
    showWinner(winnerData) {
        const isWinner = winnerData.userId === Config.getUserId();
        
        // Update modal content
        this.updateElement('winnerName', 
            isWinner ? 'YOU!' : (winnerData.username || `Player ${winnerData.userId}`));
        this.updateElement('winnerCard', winnerData.cardId);
        this.updateElement('winnerPattern', this.formatWinType(winnerData.winType));
        this.updateElement('winnerPrize', winnerData.prize ? `${winnerData.prize.toFixed(2)}` : '-');
        this.updateElement('winnerMessage', isWinner
            ? '🎉 CONGRATULATIONS! YOU WON! 🎉'
            : `${winnerData.username || 'A player'} won the game!`);
        
        // Show modal
        this.showModal('winnerModal', {
            animation: 'zoom-in',
            backdropClose: false,
            escapeClose: false
        });
        
        // Start countdown
        this.startWinnerCountdown();
        
        // Play confetti if winner
        if (isWinner && this.animationsEnabled) {
            this.playConfetti();
        }
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
    
    startWinnerCountdown() {
        let countdown = Math.floor(Config.GAME.AUTO_RESTART_DELAY / 1000);
        const timerElement = document.getElementById('nextGameTimer');
        
        if (!timerElement) return;
        
        timerElement.textContent = countdown;
        
        const interval = setInterval(() => {
            countdown--;
            timerElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(interval);
                this.hideModal('winnerModal');
            }
        }, 1000);
    }
    
    playConfetti() {
        // Create confetti container
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti-container';
        
        // Add confetti elements
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.backgroundColor = this.getRandomColor();
            confettiContainer.appendChild(confetti);
        }
        
        document.body.appendChild(confettiContainer);
        
        // Remove after animation
        setTimeout(() => {
            if (confettiContainer.parentNode) {
                confettiContainer.parentNode.removeChild(confettiContainer);
            }
        }, 5000);
    }
    
    getRandomColor() {
        const colors = [
            '#4a6fa5', '#ff6b6b', '#ff922b', '#51cf66',
            '#17a2b8', '#be4bdb', '#7950f2', '#f76707'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Utility Methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    addAriaAttributes() {
        // Add aria attributes to interactive elements
        document.querySelectorAll('button').forEach(button => {
            if (!button.getAttribute('aria-label')) {
                const label = button.textContent.trim() || button.title;
                if (label) {
                    button.setAttribute('aria-label', label);
                }
            }
        });
        
        // Add role to modal backdrops
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
        });
    }
    
    // Event Handlers
    handleNavigationClick(e) {
        // Handle bottom navigation clicks
        const navItem = e.target.closest('.nav-item');
        if (navItem && navItem.dataset.view) {
            e.preventDefault();
            this.switchView(navItem.dataset.view);
            return;
        }
        
        // Handle side menu clicks
        const menuItem = e.target.closest('.menu-item');
        if (menuItem && menuItem.dataset.view) {
            e.preventDefault();
            this.switchView(menuItem.dataset.view);
            
            // Close side menu
            const sideMenu = document.getElementById('sideMenu');
            if (sideMenu) {
                sideMenu.classList.remove('open');
            }
            return;
        }
        
        // Handle menu toggle
        if (e.target.closest('#menuToggle') || e.target.closest('.menu-toggle')) {
            e.preventDefault();
            const sideMenu = document.getElementById('sideMenu');
            if (sideMenu) {
                sideMenu.classList.toggle('open');
            }
            return;
        }
        
        // Handle menu close
        if (e.target.closest('#menuClose') || e.target.closest('.menu-close')) {
            e.preventDefault();
            const sideMenu = document.getElementById('sideMenu');
            if (sideMenu) {
                sideMenu.classList.remove('open');
            }
            return;
        }
    }
    
    handleViewChange(e) {
        const view = e.detail?.view;
        if (view) {
            this.switchView(view);
        }
    }
    
    handleModalClick(e) {
        // Handle modal backdrop click
        if (e.target.classList.contains('modal-overlay')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                const modalId = modal.id;
                const options = this.modals.get(modalId);
                
                if (options && options.backdropClose) {
                    this.hideModal(modalId);
                }
            }
        }
        
        // Handle modal close button click
        if (e.target.closest('.modal-close')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                this.hideModal(modal.id);
            }
        }
    }
    
    handleModalKeydown(e) {
        // Close modal on Escape key
        if (e.key === 'Escape') {
            const topModal = Array.from(this.modals.keys()).pop();
            if (topModal) {
                const options = this.modals.get(topModal);
                if (options && options.escapeClose) {
                    this.hideModal(topModal);
                }
            }
        }
    }
    
    handleKeyboardNavigation(e) {
        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) return;
        
        switch(e.key) {
            case '1':
            case '2':
            case '3':
            case '4':
                const views = ['game', 'cards', 'numbers', 'wallet'];
                const index = parseInt(e.key) - 1;
                if (views[index]) {
                    this.switchView(views[index]);
                    e.preventDefault();
                }
                break;
                
            case 'Escape':
                // Close modals or side menu
                if (document.getElementById('sideMenu').classList.contains('open')) {
                    document.getElementById('sideMenu').classList.remove('open');
                    e.preventDefault();
                }
                break;
                
            case ' ':
            case 'Spacebar':
                // Prevent space from scrolling
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                }
                break;
        }
    }
    
    handleFocusChange(e) {
        // Manage focus for accessibility
        const focused = e.target;
        
        // Add focus indicator class
        focused.classList.add('keyboard-focus');
        
        // Remove on blur
        focused.addEventListener('blur', () => {
            focused.classList.remove('keyboard-focus');
        }, { once: true });
    }
    
    handleResize() {
        // Handle window resize
        this.emitEvent('window:resize', {
            width: window.innerWidth,
            height: window.innerHeight,
            orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
        });
    }
    
    handleOrientationChange() {
        // Handle orientation change
        this.emitEvent('orientation:change', {
            orientation: screen.orientation?.type || 'unknown'
        });
    }
    
    setupTouchGestures() {
        // Setup touch gestures for mobile
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
            
            // Check if it's a swipe
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                // Horizontal swipe
                const views = ['game', 'cards', 'numbers', 'wallet'];
                const currentIndex = views.indexOf(this.currentView);
                
                if (deltaX > 0) {
                    // Swipe right - go to previous view
                    const newIndex = (currentIndex - 1 + views.length) % views.length;
                    this.switchView(views[newIndex]);
                } else {
                    // Swipe left - go to next view
                    const newIndex = (currentIndex + 1) % views.length;
                    this.switchView(views[newIndex]);
                }
            }
        });
    }
    
    // Event System
    emitEvent(event, data) {
        const customEvent = new CustomEvent(event, { detail: data });
        document.dispatchEvent(customEvent);
    }
    
    // Public API
    getCurrentView() {
        return this.currentView;
    }
    
    setAnimations(enabled) {
        this.animationsEnabled = enabled;
        document.body.classList.toggle('animations-enabled', enabled);
        document.body.classList.toggle('animations-disabled', !enabled);
    }
    
    vibrate(pattern = [100, 50, 100]) {
        if ('vibrate' in navigator && Config.FEATURES.VIBRATION) {
            navigator.vibrate(pattern);
        }
    }
    
    copyToClipboard(text) {
        return navigator.clipboard.writeText(text)
            .then(() => {
                this.showToast('Copied to clipboard', { type: 'success' });
                return true;
            })
            .catch(() => {
                this.showToast('Failed to copy', { type: 'error' });
                return false;
            });
    }
}

// Export singleton
let uiManagerInstance = null;

function getUIManager() {
    if (!uiManagerInstance) {
        uiManagerInstance = new UIManager();
    }
    return uiManagerInstance;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager, getUIManager };
} else {
    window.UIManager = UIManager;
    window.getUIManager = getUIManager;
}
