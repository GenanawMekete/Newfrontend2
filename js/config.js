// Configuration file for the Bingo Game

const CONFIG = {
    // Game Configuration
    MAX_CARDS: 400,
    MIN_CARDS: 1,
    MAX_SELECTION: 4, // Maximum cards a user can select
    BINGO_NUMBERS: 75, // Standard Bingo uses numbers 1-75
    
    // API Configuration
    API_BASE_URL: 'https://your-api-endpoint.com/api',
    API_ENDPOINTS: {
        GET_CARD: '/card',
        GET_AVAILABLE_CARDS: '/cards/available',
        VALIDATE_CARD: '/card/validate',
        GAME_STATUS: '/game/status'
    },
    
    // WebSocket Configuration
    WS_URL: 'wss://your-websocket-endpoint.com/ws',
    WS_RECONNECT_DELAY: 3000,
    WS_MAX_RETRIES: 5,
    
    // Audio Configuration
    AUDIO_ENABLED: true,
    DEFAULT_VOLUME: 0.5,
    SOUNDS: {
        BINGO: 'assets/sounds/bingo.mp3',
        CARD_SELECT: 'assets/sounds/card-select.mp3',
        NUMBER_DRAWN: 'assets/sounds/number-drawn.mp3',
        WIN: 'assets/sounds/win.mp3',
        BUTTON_CLICK: 'assets/sounds/button-click.mp3'
    },
    
    // UI Configuration
    THEMES: {
        DARK: 'dark',
        LIGHT: 'light',
        SYSTEM: 'system'
    },
    DEFAULT_THEME: 'dark',
    
    // Animation Configuration
    ANIMATION_DURATION: 300,
    TRANSITION_SPEED: '0.3s',
    
    // Game Rules
    BINGO_PATTERNS: [
        'LINE',     // Horizontal, vertical, or diagonal line
        'FOUR_CORNERS', // All four corners
        'BLACKOUT'  // All numbers on the card
    ],
    
    // Local Storage Keys
    STORAGE_KEYS: {
        SELECTED_CARDS: 'bingo_selected_cards',
        USER_PREFERENCES: 'bingo_user_prefs',
        GAME_STATE: 'bingo_game_state',
        AUDIO_SETTINGS: 'bingo_audio_settings'
    },
    
    // Telegram Web App Configuration
    TELEGRAM: {
        BOT_USERNAME: 'YourBotUsername',
        LAUNCH_PARAMS: {
            START_APP: 'startapp',
            REFERRAL: 'ref'
        }
    },
    
    // Performance Configuration
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 100,
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    
    // Feature Flags
    FEATURES: {
        OFFLINE_MODE: true,
        PUSH_NOTIFICATIONS: false,
        SOCIAL_SHARING: true,
        MULTIPLAYER: false,
        STATISTICS: true
    },
    
    // Analytics Configuration
    ANALYTICS: {
        ENABLED: true,
        TRACKING_ID: 'UA-XXXXX-Y',
        EVENTS: {
            CARD_SELECTED: 'card_selected',
            GAME_STARTED: 'game_started',
            BINGO_CALLED: 'bingo_called'
        }
    }
};

// Card Generation Rules
const CARD_RULES = {
    B_COLUMN: { min: 1, max: 15 },
    I_COLUMN: { min: 16, max: 30 },
    N_COLUMN: { min: 31, max: 45 },
    G_COLUMN: { min: 46, max: 60 },
    O_COLUMN: { min: 61, max: 75 },
    
    COLUMNS: ['B', 'I', 'N', 'G', 'O'],
    FREE_SPACE: true,
    FREE_SPACE_POSITION: [2, 2], // Row 3, Column 3 (0-indexed)
    
    // Card validation rules
    VALIDATION: {
        UNIQUE_NUMBERS: true,
        COLUMN_RANGE: true,
        NO_DUPLICATES: true
    }
};

// Game States
const GAME_STATES = {
    IDLE: 'idle',
    SELECTING_CARDS: 'selecting_cards',
    PLAYING: 'playing',
    PAUSED: 'paused',
    FINISHED: 'finished',
    WAITING: 'waiting_for_players'
};

// Error Messages
const ERROR_MESSAGES = {
    CARD_UNAVAILABLE: 'This card is no longer available. Please select another card.',
    MAX_SELECTION_REACHED: `You can only select up to ${CONFIG.MAX_SELECTION} cards.`,
    NETWORK_ERROR: 'Network error. Please check your connection.',
    GAME_FULL: 'The game is full. Please try again later.',
    INVALID_CARD: 'Invalid card number.',
    OFFLINE_MODE: 'You are offline. Some features may be limited.'
};

// Success Messages
const SUCCESS_MESSAGES = {
    CARD_SELECTED: 'Card selected successfully!',
    CARD_REMOVED: 'Card removed from selection.',
    GAME_STARTED: 'Game started! Good luck!',
    BINGO_VALID: 'Bingo! Your card is valid!'
};

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        CARD_RULES,
        GAME_STATES,
        ERROR_MESSAGES,
        SUCCESS_MESSAGES
    };
}
