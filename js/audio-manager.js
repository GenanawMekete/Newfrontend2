import { CONFIG } from './config.js';

export class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = CONFIG.SOUND_ENABLED;
        this.loadSounds();
    }
    
    loadSounds() {
        const soundFiles = {
            bingo: 'bingo.mp3',
            cardSelect: 'card-select.mp3',
            numberDrawn: 'number-drawn.mp3',
            win: 'win.mp3',
            buttonClick: 'button-click.mp3'
        };
        
        for (const [name, file] of Object.entries(soundFiles)) {
            this.sounds[name] = new Audio(`assets/sounds/${file}`);
            this.sounds[name].load();
        }
    }
    
    play(soundName) {
        if (!this.enabled || !this.sounds[soundName]) return;
        
        try {
            // Clone the audio element to allow overlapping sounds
            const audioClone = this.sounds[soundName].cloneNode();
            audioClone.volume = this.getVolumeForSound(soundName);
            audioClone.play().catch(e => console.log('Audio play failed:', e));
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }
    
    getVolumeForSound(soundName) {
        const volumes = {
            bingo: 0.7,
            cardSelect: 0.5,
            numberDrawn: 0.4,
            win: 0.8,
            buttonClick: 0.3
        };
        
        return volumes[soundName] || 0.5;
    }
    
    toggleSound() {
        this.enabled = !this.enabled;
        localStorage.setItem('bingo_sound_enabled', this.enabled);
        return this.enabled;
    }
    
    isEnabled() {
        return this.enabled;
    }
    
    vibrate(pattern = [100]) {
        if (CONFIG.VIBRATION_ENABLED && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }
}
