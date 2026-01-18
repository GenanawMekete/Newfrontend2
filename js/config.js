// Game Configuration
export const CONFIG = {
    CARD_SELECTION_TIME: 30, // seconds
    MAX_CARDS_PER_PLAYER: 4,
    TOTAL_CARDS: 400,
    MIN_PLAYERS: 2,
    NUMBER_DRAW_INTERVAL: 3000, // 3 seconds
    AUTO_RESTART_DELAY: 10000, // 10 seconds
    BINGO_NUMBERS: 75, // Standard bingo has numbers 1-75
    GRID_COLUMNS: 10, // For number grid display
    SERVER_URL: 'wss://your-server.com/ws', // WebSocket server URL
    RECONNECT_INTERVAL: 5000, // 5 seconds
    MAX_RECONNECT_ATTEMPTS: 5,
    SOUND_ENABLED: true,
    VIBRATION_ENABLED: true
};

// Bingo column mapping (B, I, N, G, O)
export const BINGO_COLUMNS = {
    'B': { min: 1, max: 15 },
    'I': { min: 16, max: 30 },
    'N': { min: 31, max: 45 },
    'G': { min: 46, max: 60 },
    'O': { min: 61, max: 75 }
};

// Game states
export const GAME_STATES = {
    LOBBY: 'lobby',
    CARD_SELECTION: 'card_selection',
    PLAYING: 'playing',
    ROUND_END: 'round_end',
    GAME_END: 'game_end'
};

// Local Storage keys
export const STORAGE_KEYS = {
    PLAYER_ID: 'bingo_player_id',
    SELECTED_CARDS: 'bingo_selected_cards',
    GAME_STATE: 'bingo_game_state',
    USER_PREFERENCES: 'bingo_preferences'
};
