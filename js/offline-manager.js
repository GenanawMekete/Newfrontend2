// Offline Manager - Handles offline functionality and data sync
import { CONFIG } from './config.js';

export class OfflineManager {
    constructor() {
        this.pendingActions = new Map();
        this.syncQueue = [];
        this.isSyncing = false;
        this.lastSync = null;
        this.offlineData = new Map();
        
        // Initialize IndexedDB
        this.initIndexedDB();
    }
    
    // Initialize IndexedDB for offline storage
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not supported');
                resolve(false);
                return;
            }
            
            const request = indexedDB.open('BingoOfflineDB', 1);
            
            request.onerror = (event) => {
                console.error('Failed to open IndexedDB:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB initialized');
                resolve(true);
                
                // Load pending actions
                this.loadPendingActions();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('pendingActions')) {
                    const actionsStore = db.createObjectStore('pendingActions', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    actionsStore.createIndex('type', 'type', { unique: false });
                    actionsStore.createIndex('synced', 'synced', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('offlineData')) {
                    const dataStore = db.createObjectStore('offlineData', { 
                        keyPath: 'key'
                    });
                    dataStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('gameState')) {
                    const gameStore = db.createObjectStore('gameState', { 
                        keyPath: 'gameId'
                    });
                    gameStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }
    
    // Store data for offline use
    async storeData(key, data, options = {}) {
        if (!this.db) return false;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offlineData'], 'readwrite');
            const store = transaction.objectStore('offlineData');
            
            const item = {
                key,
                data,
                timestamp: Date.now(),
                ...options
            };
            
            const request = store.put(item);
            
            request.onsuccess = () => {
                this.offlineData.set(key, item);
                resolve(true);
            };
            
            request.onerror = (event) => {
                console.error('Failed to store offline data:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    // Retrieve offline data
    async getData(key) {
        // Check memory cache first
        if (this.offlineData.has(key)) {
            return this.offlineData.get(key).data;
        }
        
        if (!this.db) return null;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offlineData'], 'readonly');
            const store = transaction.objectStore('offlineData');
            const request = store.get(key);
            
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    this.offlineData.set(key, result);
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = (event) => {
                console.error('Failed to get offline data:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    // Queue action for sync when online
    async queueAction(type, data, priority = 0) {
        const action = {
            type,
            data,
            timestamp: Date.now(),
            priority,
            synced: false,
            attempts: 0
        };
        
        if (!this.db) {
            // Store in memory if IndexedDB not available
            this.syncQueue.push(action);
            return action;
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingActions'], 'readwrite');
            const store = transaction.objectStore('pendingActions');
            
            const request = store.add(action);
            
            request.onsuccess = (event) => {
                action.id = event.target.result;
                this.pendingActions.set(action.id, action);
                resolve(action);
            };
            
            request.onerror = (event) => {
                console.error('Failed to queue action:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    // Load pending actions from IndexedDB
    async loadPendingActions() {
        if (!this.db) return;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingActions'], 'readonly');
            const store = transaction.objectStore('pendingActions');
            const index = store.index('synced');
            const request = index.getAll(false); // Get all unsynced actions
            
            request.onsuccess = (event) => {
                const actions = event.target.result;
                actions.forEach(action => {
                    this.pendingActions.set(action.id, action);
                });
                console.log(`Loaded ${actions.length} pending actions`);
                resolve(actions);
            };
            
            request.onerror = (event) => {
                console.error('Failed to load pending actions:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    // Sync pending actions with server
    async sync() {
        if (this.isSyncing || !navigator.onLine) {
            return { synced: 0, failed: 0 };
        }
        
        this.isSyncing = true;
        
        const actionsToSync = Array.from(this.pendingActions.values())
            .filter(action => !action.synced)
            .sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
        
        let syncedCount = 0;
        let failedCount = 0;
        
        for (const action of actionsToSync) {
            try {
                await this.syncAction(action);
                syncedCount++;
            } catch (error) {
                console.error(`Failed to sync action ${action.type}:`, error);
                action.attempts++;
                
                // Remove if too many attempts
                if (action.attempts >= 3) {
                    await this.removeAction(action.id);
                    failedCount++;
                }
            }
        }
        
        this.isSyncing = false;
        this.lastSync = Date.now();
        
        console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);
        
        return { synced: syncedCount, failed: failedCount };
    }
    
    // Sync individual action
    async syncAction(action) {
        let endpoint;
        let method = 'POST';
        let body = action.data;
        
        // Determine endpoint based on action type
        switch (action.type) {
            case 'card_selection':
                endpoint = `${CONFIG.API_BASE_URL}/select-cards`;
                break;
                
            case 'game_action':
                endpoint = `${CONFIG.API_BASE_URL}/game/action`;
                break;
                
            case 'bingo_call':
                endpoint = `${CONFIG.API_BASE_URL}/bingo/call`;
                break;
                
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
        
        const response = await fetch(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Mark as synced
        await this.markActionAsSynced(action.id);
        
        return response.json();
    }
    
    // Mark action as synced
    async markActionAsSynced(actionId) {
        const action = this.pendingActions.get(actionId);
        if (!action) return;
        
        action.synced = true;
        
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['pendingActions'], 'readwrite');
                const store = transaction.objectStore('pendingActions');
                
                const request = store.put(action);
                
                request.onsuccess = () => {
                    this.pendingActions.delete(actionId);
                    resolve(true);
                };
                
                request.onerror = (event) => {
                    console.error('Failed to mark action as synced:', event.target.error);
                    reject(event.target.error);
                };
            });
        }
    }
    
    // Remove action
    async removeAction(actionId) {
        this.pendingActions.delete(actionId);
        
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['pendingActions'], 'readwrite');
                const store = transaction.objectStore('pendingActions');
                
                const request = store.delete(actionId);
                
                request.onsuccess = () => resolve(true);
                request.onerror = (event) => reject(event.target.error);
            });
        }
    }
    
    // Save game state for offline resume
    async saveGameState(gameId, state) {
        const gameState = {
            gameId,
            state,
            timestamp: Date.now()
        };
        
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['gameState'], 'readwrite');
                const store = transaction.objectStore('gameState');
                
                const request = store.put(gameState);
                
                request.onsuccess = () => resolve(true);
                request.onerror = (event) => reject(event.target.error);
            });
        }
        
        // Fallback to localStorage
        localStorage.setItem(`game_state_${gameId}`, JSON.stringify(gameState));
        return true;
    }
    
    // Load game state
    async loadGameState(gameId) {
        if (this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['gameState'], 'readonly');
                const store = transaction.objectStore('gameState');
                
                const request = store.get(gameId);
                
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    resolve(result ? result.state : null);
                };
                
                request.onerror = (event) => reject(event.target.error);
            });
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem(`game_state_${gameId}`);
        return saved ? JSON.parse(saved).state : null;
    }
    
    // Clear old data
    async cleanupOldData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        const cutoff = Date.now() - maxAge;
        
        if (this.db) {
            // Clean pending actions
            await this.cleanupObjectStore('pendingActions', 'timestamp', cutoff);
            
            // Clean offline data
            await this.cleanupObjectStore('offlineData', 'timestamp', cutoff);
            
            // Clean game states
            await this.cleanupObjectStore('gameState', 'timestamp', cutoff);
        }
        
        // Clean localStorage
        this.cleanupLocalStorage(cutoff);
    }
    
    // Cleanup object store
    async cleanupObjectStore(storeName, indexName, cutoff) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const range = IDBKeyRange.upperBound(cutoff);
            
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    // Cleanup localStorage
    cleanupLocalStorage(cutoff) {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('game_state_') || key.startsWith('offline_')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item && item.timestamp && item.timestamp < cutoff) {
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    // If can't parse, remove it
                    localStorage.removeItem(key);
                }
            }
        }
    }
    
    // Check if there are pending actions
    hasPendingActions() {
        return this.pendingActions.size > 0 || this.syncQueue.length > 0;
    }
    
    // Get sync status
    getSyncStatus() {
        return {
            pendingActions: this.pendingActions.size,
            syncQueue: this.syncQueue.length,
            isSyncing: this.isSyncing,
            lastSync: this.lastSync,
            offlineDataSize: this.offlineData.size
        };
    }
    
    // Clear all offline data
    async clearAll() {
        if (this.db) {
            const stores = ['pendingActions', 'offlineData', 'gameState'];
            const promises = stores.map(storeName => {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.clear();
                    
                    request.onsuccess = () => resolve();
                    request.onerror = (event) => reject(event.target.error);
                });
            });
            
            await Promise.all(promises);
        }
        
        // Clear memory
        this.pendingActions.clear();
        this.syncQueue = [];
        this.offlineData.clear();
        
        // Clear localStorage items
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('game_state_') || key.startsWith('offline_')) {
                localStorage.removeItem(key);
            }
        });
        
        console.log('All offline data cleared');
    }
}
