export class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.setupServiceWorker();
    }
    
    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showStatus('You are back online!', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showStatus('You are offline. Some features may be limited.', 'warning');
        });
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('service-worker.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }
    
    showStatus(message, type) {
        const statusBar = document.createElement('div');
        statusBar.className = `offline-status ${type}`;
        statusBar.textContent = message;
        statusBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 10px;
            text-align: center;
            background: ${type === 'success' ? '#4CAF50' : '#FF9800'};
            color: white;
            z-index: 10000;
            animation: slideDown 0.3s ease;
        `;
        
        document.body.appendChild(statusBar);
        
        setTimeout(() => {
            statusBar.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => statusBar.remove(), 300);
        }, 3000);
    }
    
    isOnline() {
        return this.isOnline;
    }
    
    // Cache management
    async cacheData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to cache data:', error);
        }
    }
    
    async getCachedData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get cached data:', error);
            return null;
        }
    }
}
