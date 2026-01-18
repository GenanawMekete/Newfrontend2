// Card Manager - Handles card data and operations
import { CONFIG, CARD_RULES } from './config.js';

export class CardManager {
    constructor() {
        this.cardsCache = new Map();
        this.availableCardsCache = null;
        this.cacheTimestamp = null;
    }
    
    // Get available cards (1-400)
    async getAvailableCards() {
        // Check cache first
        if (this.availableCardsCache && this.cacheTimestamp) {
            const cacheAge = Date.now() - this.cacheTimestamp;
            if (cacheAge < CONFIG.CACHE_TTL) {
                return this.availableCardsCache;
            }
        }
        
        try {
            if (navigator.onLine) {
                // Fetch from server
                const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINTS.GET_AVAILABLE_CARDS}`);
                
                if (!response.ok) {
                    throw new Error('Failed to fetch available cards');
                }
                
                const data = await response.json();
                this.availableCardsCache = data.availableCards || this.generateAllCardNumbers();
                this.cacheTimestamp = Date.now();
                
                // Cache in localStorage for offline use
                localStorage.setItem('available_cards_cache', JSON.stringify({
                    cards: this.availableCardsCache,
                    timestamp: this.cacheTimestamp
                }));
                
                return this.availableCardsCache;
            } else {
                // Try to get from localStorage
                const cached = localStorage.getItem('available_cards_cache');
                if (cached) {
                    const { cards, timestamp } = JSON.parse(cached);
                    this.availableCardsCache = cards;
                    this.cacheTimestamp = timestamp;
                    return cards;
                }
                
                // If no cache, generate all cards (offline fallback)
                return this.generateAllCardNumbers();
            }
        } catch (error) {
            console.error('Error fetching available cards:', error);
            
            // Fallback to all cards
            return this.generateAllCardNumbers();
        }
    }
    
    // Get card data by number
    async getCardData(cardNumber) {
        // Validate card number
        if (!this.isValidCardNumber(cardNumber)) {
            throw new Error('Invalid card number');
        }
        
        // Check cache first
        if (this.cardsCache.has(cardNumber)) {
            return this.cardsCache.get(cardNumber);
        }
        
        try {
            let cardData;
            
            if (navigator.onLine) {
                // Fetch from server
                const response = await fetch(
                    `${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINTS.GET_CARD}/${cardNumber}`
                );
                
                if (!response.ok) {
                    if (response.status === 404) {
                        return this.generateCardData(cardNumber, false);
                    }
                    throw new Error('Failed to fetch card data');
                }
                
                cardData = await response.json();
            } else {
                // Generate card data locally for offline mode
                cardData = this.generateCardData(cardNumber, true);
            }
            
            // Cache the data
            this.cardsCache.set(cardNumber, cardData);
            
            return cardData;
        } catch (error) {
            console.error(`Error fetching card ${cardNumber}:`, error);
            
            // Generate fallback card data
            const fallbackData = this.generateCardData(cardNumber, false);
            this.cardsCache.set(cardNumber, fallbackData);
            
            return fallbackData;
        }
    }
    
    // Validate multiple cards
    async validateCards(cardNumbers) {
        if (!cardNumbers || cardNumbers.length === 0) {
            return [];
        }
        
        try {
            if (navigator.onLine) {
                // Validate with server
                const response = await fetch(
                    `${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINTS.VALIDATE_CARD}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ cardNumbers })
                    }
                );
                
                if (!response.ok) {
                    throw new Error('Failed to validate cards');
                }
                
                return await response.json();
            } else {
                // For offline mode, check cache and assume available
                const availableCards = await this.getAvailableCards();
                return cardNumbers.map(cardNumber => ({
                    cardNumber,
                    valid: availableCards.includes(cardNumber),
                    reason: availableCards.includes(cardNumber) ? 'available' : 'unavailable'
                }));
            }
        } catch (error) {
            console.error('Error validating cards:', error);
            
            // Fallback validation
            const availableCards = await this.getAvailableCards();
            return cardNumbers.map(cardNumber => ({
                cardNumber,
                valid: availableCards.includes(cardNumber),
                reason: 'error_fallback'
            }));
        }
    }
    
    // Generate card data locally
    generateCardData(cardNumber, isAvailable = true) {
        // Use card number as seed for consistent generation
        const seed = cardNumber * 123456789;
        
        // Generate BINGO card numbers
        const card = {
            cardNumber,
            isAvailable,
            numbers: [],
            pattern: this.generateCardPattern(seed),
            createdAt: new Date().toISOString()
        };
        
        // Generate numbers for each column
        CARD_RULES.COLUMNS.forEach((letter, colIndex) => {
            const columnRules = CARD_RULES[`${letter}_COLUMN`];
            
            for (let row = 0; row < 5; row++) {
                // Free space in the middle (if enabled)
                if (CARD_RULES.FREE_SPACE && 
                    row === CARD_RULES.FREE_SPACE_POSITION[0] && 
                    colIndex === CARD_RULES.FREE_SPACE_POSITION[1]) {
                    card.numbers.push({
                        letter,
                        number: 'FREE',
                        row,
                        column: colIndex,
                        isFreeSpace: true
                    });
                    continue;
                }
                
                // Generate unique number for this position
                const number = this.generateColumnNumber(seed, cardNumber, colIndex, row, columnRules);
                
                card.numbers.push({
                    letter,
                    number,
                    row,
                    column: colIndex,
                    isMarked: false
                });
            }
        });
        
        return card;
    }
    
    // Generate card pattern based on seed
    generateCardPattern(seed) {
        const patterns = ['standard', 'diagonal', 'four-corners', 'x-pattern'];
        const patternIndex = Math.abs(seed) % patterns.length;
        return patterns[patternIndex];
    }
    
    // Generate column number
    generateColumnNumber(seed, cardNumber, columnIndex, rowIndex, columnRules) {
        // Create a deterministic but varied number based on inputs
        const base = seed + (cardNumber * 100) + (columnIndex * 10) + rowIndex;
        const range = columnRules.max - columnRules.min + 1;
        const number = columnRules.min + (Math.abs(base) % range);
        
        return number;
    }
    
    // Generate all card numbers (1-400)
    generateAllCardNumbers() {
        const cards = [];
        for (let i = CONFIG.MIN_CARDS; i <= CONFIG.MAX_CARDS; i++) {
            cards.push(i);
        }
        return cards;
    }
    
    // Validate card number
    isValidCardNumber(cardNumber) {
        const num = parseInt(cardNumber);
        return !isNaN(num) && 
               num >= CONFIG.MIN_CARDS && 
               num <= CONFIG.MAX_CARDS;
    }
    
    // Clear cache
    clearCache() {
        this.cardsCache.clear();
        this.availableCardsCache = null;
        this.cacheTimestamp = null;
    }
    
    // Get cached card data
    getCachedCard(cardNumber) {
        return this.cardsCache.get(cardNumber);
    }
    
    // Preload cards (for better UX)
    async preloadCards(cardNumbers) {
        const promises = cardNumbers.map(cardNumber => 
            this.getCardData(cardNumber).catch(() => null)
        );
        
        await Promise.all(promises);
    }
}
