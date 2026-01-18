<div class="game-board fade-in">
    <div class="game-header">
        <div class="game-info">
            <h2>Game Board</h2>
            <div class="game-id">Game ID: <span id="currentGameId">Loading...</span></div>
        </div>
        <div class="game-controls">
            <button class="btn btn-secondary" id="pauseGame">
                <span class="btn-icon">⏸️</span> Pause
            </button>
            <button class="btn btn-primary" id="callBingo">
                <span class="btn-icon">🎯</span> Call Bingo!
            </button>
        </div>
    </div>
    
    <div class="game-content">
        <!-- Current Number Display -->
        <div class="current-number-section">
            <div class="current-number-label">Current Number</div>
            <div class="current-number-display" id="currentNumberDisplay">
                <div class="number-letter" id="currentLetter">B</div>
                <div class="number-value" id="currentNumberValue">1</div>
            </div>
            <div class="number-history">
                <span class="history-label">Last 5:</span>
                <div class="history-numbers" id="lastNumbers">
                    <!-- Last numbers will be added here -->
                </div>
            </div>
        </div>
        
        <!-- Number Grid -->
        <div class="number-grid-section">
            <h3>Called Numbers</h3>
            <div class="number-grid" id="numberGrid">
                <!-- Numbers 1-75 will be generated here -->
            </div>
        </div>
        
        <!-- Player Cards -->
        <div class="player-cards-section">
            <h3>Your Cards</h3>
            <div class="cards-container" id="playerCards">
                <!-- Selected cards will be displayed here -->
            </div>
        </div>
        
        <!-- Game Stats -->
        <div class="game-stats-section">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-content">
                        <div class="stat-label">Game Time</div>
                        <div class="stat-value" id="gameTime">00:00</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔢</div>
                    <div class="stat-content">
                        <div class="stat-label">Numbers Called</div>
                        <div class="stat-value" id="numbersCalledCount">0</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-content">
                        <div class="stat-label">Cards Marked</div>
                        <div class="stat-value" id="cardsMarked">0/0</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-content">
                        <div class="stat-label">Winners</div>
                        <div class="stat-value" id="winnersCount">0</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Winners Modal (Hidden by default) -->
    <div class="winners-modal" id="winnersModal" style="display: none;">
        <div class="modal-content">
            <div class="winner-header">
                <div class="winner-icon">🏆</div>
                <h3 class="winner-title">BINGO!</h3>
            </div>
            <div class="winner-details" id="winnerDetails">
                <!-- Winner details will be added here -->
            </div>
            <div class="winner-actions">
                <button class="btn btn-secondary" id="continueGame">Continue Playing</button>
                <button class="btn btn-primary" id="newGame">Start New Game</button>
            </div>
        </div>
    </div>
</div>

<script>
// Game board specific JavaScript will be loaded here
// This would be integrated with the main app.js
</script>
