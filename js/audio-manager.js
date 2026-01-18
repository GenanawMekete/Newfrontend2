// Audio Manager - Handles all audio playback
import { CONFIG } from './config.js';

export class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.enabled = CONFIG.AUDIO_ENABLED;
        this.volume = CONFIG.DEFAULT_VOLUME;
        this.initialized = false;
    }
    
    // Initialize audio system
    async init() {
        if (this.initialized) return;
        
        try {
            // Create audio contexts for each sound
            await this.loadSounds();
            this.initialized = true;
            console.log('Audio Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Audio Manager:', error);
            // Continue without audio
        }
    }
    
    // Load all sound files
    async loadSounds() {
        const soundPromises = Object.entries(CONFIG.SOUNDS).map(async ([name, path]) => {
            try {
                const audio = new Audio(path);
                audio.volume = this.volume;
                audio.preload = 'auto';
                
                // Wait for audio to be ready
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', reject);
                });
                
                this.sounds.set(name.toLowerCase(), audio);
            } catch (error) {
                console.warn(`Failed to load sound ${name}:`, error);
            }
        });
        
        await Promise.all(soundPromises);
    }
    
    // Play a sound
    play(soundName, options = {}) {
        if (!this.enabled || !this.initialized) return null;
        
        const normalizedName = soundName.toLowerCase();
        const sound = this.sounds.get(normalizedName);
        
        if (!sound) {
            console.warn(`Sound not found: ${soundName}`);
            return null;
        }
        
        try {
            // Clone the audio element to allow overlapping playback
            const audioClone = sound.cloneNode();
            audioClone.volume = options.volume !== undefined ? options.volume : this.volume;
            
            // Apply fade if specified
            if (options.fadeIn) {
                this.fadeIn(audioClone, options.fadeIn);
            }
            
            // Play the sound
            const playPromise = audioClone.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn(`Failed to play sound ${soundName}:`, error);
                });
            }
            
            // Clean up after playback
            audioClone.addEventListener('ended', () => {
                if (options.fadeOut) {
                    this.fadeOut(audioClone, options.fadeOut, () => {
                        audioClone.remove();
                    });
                } else {
                    audioClone.remove();
                }
            });
            
            return audioClone;
        } catch (error) {
            console.error(`Error playing sound ${soundName}:`, error);
            return null;
        }
    }
    
    // Play card selection sound
    playCardSelect() {
        return this.play('card-select', {
            volume: 0.3,
            fadeIn: 100
        });
    }
    
    // Play number drawn sound
    playNumberDrawn() {
        return this.play('number-drawn', {
            volume: 0.4
        });
    }
    
    // Play bingo sound
    playBingo() {
        return this.play('bingo', {
            volume: 0.7,
            fadeIn: 200
        });
    }
    
    // Play win sound
    playWin() {
        return this.play('win', {
            volume: 0.6,
            fadeIn: 300,
            fadeOut: 1000
        });
    }
    
    // Play button click sound
    playButtonClick() {
        return this.play('button-click', {
            volume: 0.2
        });
    }
    
    // Fade in audio
    fadeIn(audioElement, duration = 500) {
        audioElement.volume = 0;
        const targetVolume = audioElement.volume;
        const step = targetVolume / (duration / 50);
        
        const fadeInterval = setInterval(() => {
            if (audioElement.volume < targetVolume) {
                audioElement.volume = Math.min(audioElement.volume + step, targetVolume);
            } else {
                clearInterval(fadeInterval);
            }
        }, 50);
    }
    
    // Fade out audio
    fadeOut(audioElement, duration = 500, onComplete = null) {
        const initialVolume = audioElement.volume;
        const step = initialVolume / (duration / 50);
        
        const fadeInterval = setInterval(() => {
            if (audioElement.volume > 0) {
                audioElement.volume = Math.max(audioElement.volume - step, 0);
            } else {
                clearInterval(fadeInterval);
                audioElement.pause();
                if (onComplete) onComplete();
            }
        }, 50);
    }
    
    // Set master volume (0.0 to 1.0)
    setVolume(volume) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.volume = clampedVolume;
        
        // Update all loaded sounds
        this.sounds.forEach(sound => {
            sound.volume = clampedVolume;
        });
        
        // Save to localStorage
        localStorage.setItem(CONFIG.STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify({
            volume: clampedVolume,
            enabled: this.enabled
        }));
    }
    
    // Get current volume
    getVolume() {
        return this.volume;
    }
    
    // Enable/disable audio
    setEnabled(enabled) {
        this.enabled = enabled;
        
        // Save to localStorage
        localStorage.setItem(CONFIG.STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify({
            volume: this.volume,
            enabled: enabled
        }));
    }
    
    // Check if audio is enabled
    isEnabled() {
        return this.enabled;
    }
    
    // Toggle audio on/off
    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }
    
    // Stop all sounds
    stopAll() {
        this.sounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }
    
    // Preload specific sounds
    async preload(soundNames) {
        const promises = soundNames.map(async (soundName) => {
            if (!this.sounds.has(soundName.toLowerCase())) {
                const path = CONFIG.SOUNDS[soundName.toUpperCase()];
                if (path) {
                    const audio = new Audio(path);
                    audio.preload = 'auto';
                    
                    return new Promise((resolve) => {
                        audio.addEventListener('canplaythrough', resolve);
                        audio.addEventListener('error', resolve); // Continue even if fails
                    });
                }
            }
        });
        
        await Promise.all(promises);
    }
    
    // Get sound duration
    getSoundDuration(soundName) {
        const sound = this.sounds.get(soundName.toLowerCase());
        return sound ? sound.duration : 0;
    }
    
    // Check if a sound is loaded
    isSoundLoaded(soundName) {
        return this.sounds.has(soundName.toLowerCase());
    }
    
    // Clean up resources
    destroy() {
        this.stopAll();
        this.sounds.clear();
        this.initialized = false;
    }
}
