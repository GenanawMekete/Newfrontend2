// Application Configuration
const Config = {
    // Game Configuration
    GAME: {
        CARD_SELECTION_TIME: 30, // seconds
        MAX_CARDS_PER_PLAYER: 4,
        TOTAL_CARDS: 400,
        MIN_PLAYERS: 2,
        NUMBER_DRAW_INTERVAL: 3000, // 3 seconds
        AUTO_RESTART_DELAY: 10000, // 10 seconds
        BINGO_PATTERNS: {
            LINE: ['line_1', 'line_2', 'line_3', 'line_4', 'line_5'],
            COLUMN: ['column_1', 'column_2', 'column_3', 'column_4', 'column_5'],
            DIAGONAL: ['diagonal_1', 'diagonal_2'],
            FOUR_CORNERS: 'four_corners',
            FULL_HOUSE: 'full_house'
        }
    },
    
    // Bingo Card Configuration
    BINGO_CARD: {
        ROWS: 5,
        COLS: 5,
        FREE_SPACE: true,
        COLUMN_RANGES: {
            'B': { min: 1, max: 15 },
            'I': { min: 16, max: 30 },
            'N': { min: 31, max: 45 },
            'G': { min: 46, max: 60 },
            'O': { min: 61, max: 75 }
        }
    },
    
    // Server Configuration
    SERVER: {
        SOCKET_URL: window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : window.location.origin,
        RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 1000,
        HEARTBEAT_INTERVAL: 30000
    },
    
    // UI Configuration
    UI: {
        THEME: {
            LIGHT: {
                bg: '#f8f9fa',
                surface: '#ffffff',
                text: '#212529',
                primary: '#4a6fa5',
                accent: '#ff6b6b'
            },
            DARK: {
                bg: '#0f172a',
                surface: '#1e293b',
                text: '#f1f5f9',
                primary: '#4a6fa5',
                accent: '#ff6b6b'
            }
        },
        ANIMATIONS: {
            ENABLED: true,
            DURATION: 300,
            TRANSITION: 'cubic-bezier(0.4, 0, 0.2, 1)'
        },
        NOTIFICATIONS: {
            TIMEOUT: 3000,
            POSITION: 'top-right'
        }
    },
    
    // Sound Configuration
    SOUND: {
        ENABLED: true,
        VOLUME: 0.5,
        FILES: {
            BINGO: 'assets/sounds/bingo.mp3',
            CARD_SELECT: 'assets/sounds/card-select.mp3',
            NUMBER_DRAWN: 'assets/sounds/number-drawn.mp3',
            WIN: 'assets/sounds/win.mp3',
            BUTTON_CLICK: 'assets/sounds/button-click.mp3',
            COUNTDOWN: 'assets/sounds/countdown.mp3'
        }
    },
    
    // Local Storage Keys
    STORAGE: {
        USER_ID: 'bingo_user_id',
        USERNAME: 'bingo_username',
        BALANCE: 'bingo_balance',
        SELECTED_CARDS: 'bingo_selected_cards',
        GAME_HISTORY: 'bingo_game_history',
        SETTINGS: 'bingo_settings',
        STATS: 'bingo_stats'
    },
    
    // Game Rules
    RULES: {
        TICKET_PRICE: 10,
        PRIZE_DISTRIBUTION: {
            FULL_HOUSE: 70,
            FIRST_LINE: 15,
            SECOND_LINE: 10,
            THIRD_LINE: 5
        },
        MINIMUM_PRIZE: 100,
        MAXIMUM_PRIZE: 10000
    },
    
    // Feature Flags
    FEATURES: {
        AUTO_DAUB: true,
        AUTO_SELECT: true,
        NOTIFICATIONS: true,
        VIBRATION: 'vibrate' in navigator,
        OFFLINE_MODE: true,
        PUSH_NOTIFICATIONS: 'serviceWorker' in navigator && 'PushManager' in window
    },
    
    // API Endpoints
    API: {
        GAME_STATUS: '/api/game/status',
        SELECT_CARD: '/api/cards/select',
        CLAIM_BINGO: '/api/bingo/claim',
        USER_PROFILE: '/api/user/profile',
        WALLET_BALANCE: '/api/wallet/balance',
        TRANSACTION_HISTORY: '/api/wallet/transactions'
    },
    
    // Telegram Web App Configuration
    TELEGRAM: {
        ENABLED: typeof Telegram !== 'undefined' && Telegram.WebApp,
        INIT_DATA: Telegram?.WebApp?.initData,
        THEME_PARAMS: Telegram?.WebApp?.themeParams || {},
        USER: Telegram?.WebApp?.initDataUnsafe?.user
    },
    
    // Version
    VERSION: '1.0.0',
    BUILD: '2024.01.01'
};

// Utility Functions
Config.getNumberLetter = function(number) {
    if (number <= 15) return 'B';
    if (number <= 30) return 'I';
    if (number <= 45) return 'N';
    if (number <= 60) return 'G';
    return 'O';
};

Config.getNumberRange = function(letter) {
    return this.BINGO_CARD.COLUMN_RANGES[letter];
};

Config.isValidBingoPattern = function(pattern) {
    const allPatterns = [
        ...this.GAME.BINGO_PATTERNS.LINE,
        ...this.GAME.BINGO_PATTERNS.COLUMN,
        ...this.GAME.BINGO_PATTERNS.DIAGONAL,
        this.GAME.BINGO_PATTERNS.FOUR_CORNERS,
        this.GAME.BINGO_PATTERNS.FULL_HOUSE
    ];
    return allPatterns.includes(pattern);
};

Config.calculatePrize = function(players, winType) {
    const totalPool = players * this.RULES.TICKET_PRICE;
    const percentage = this.RULES.PRIZE_DISTRIBUTION[winType.toUpperCase()] || 70;
    const prize = totalPool * (percentage / 100);
    return Math.max(this.RULES.MINIMUM_PRIZE, Math.min(prize, this.RULES.MAXIMUM_PRIZE));
};

Config.getThemeColors = function() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = this.TELEGRAM.THEME_PARAMS.bg_color 
        ? (this.TELEGRAM.THEME_PARAMS.bg_color === '#212121' ? 'DARK' : 'LIGHT')
        : (prefersDark ? 'DARK' : 'LIGHT');
    
    return this.UI.THEME[theme];
};

Config.saveToStorage = function(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
        return false;
    }
};

Config.loadFromStorage = function(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return defaultValue;
    }
};

Config.clearStorage = function() {
    try {
        localStorage.clear();
        return true;
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
        return false;
    }
};

// Initialize default settings if not exist
Config.initializeSettings = function() {
    const defaultSettings = {
        soundEnabled: this.SOUND.ENABLED,
        soundVolume: this.SOUND.VOLUME,
        autoDaub: this.FEATURES.AUTO_DAUB,
        notifications: this.FEATURES.NOTIFICATIONS,
        theme: 'auto',
        animations: this.UI.ANIMATIONS.ENABLED,
        language: 'en'
    };
    
    const currentSettings = this.loadFromStorage(this.STORAGE.SETTINGS, {});
    const settings = { ...defaultSettings, ...currentSettings };
    
    this.saveToStorage(this.STORAGE.SETTINGS, settings);
    return settings;
};

// Get current user ID
Config.getUserId = function() {
    if (this.TELEGRAM.USER) {
        return this.TELEGRAM.USER.id.toString();
    }
    
    let userId = this.loadFromStorage(this.STORAGE.USER_ID);
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        this.saveToStorage(this.STORAGE.USER_ID, userId);
    }
    return userId;
};

// Get current username
Config.getUsername = function() {
    if (this.TELEGRAM.USER) {
        return this.TELEGRAM.USER.username || 
               this.TELEGRAM.USER.first_name || 
               'Telegram User';
    }
    
    let username = this.loadFromStorage(this.STORAGE.USERNAME);
    if (!username) {
        username = 'Player_' + Math.floor(Math.random() * 10000);
        this.saveToStorage(this.STORAGE.USERNAME, username);
    }
    return username;
};

// Check if running in standalone mode (PWA)
Config.isStandalone = function() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
};

// Check network status
Config.checkNetworkStatus = function() {
    return navigator.onLine;
};

// Get device info
Config.getDeviceInfo = function() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: {
            width: window.screen.width,
            height: window.screen.height,
            orientation: window.screen.orientation?.type || 'portrait'
        },
        touch: 'ontouchstart' in window,
        pwa: this.isStandalone(),
        online: this.checkNetworkStatus()
    };
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
} else {
    window.Config = Config;
}
