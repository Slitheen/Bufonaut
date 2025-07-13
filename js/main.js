import { PHASER_CONFIG, VERSION } from './config/GameConfig.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { SplashScreenScene } from './scenes/SplashScreenScene.js';
import { GameScene } from './scenes/GameScene.js';

// Add scenes to config
PHASER_CONFIG.scene = [MainMenuScene, SplashScreenScene, GameScene];

// Create the game
const game = new Phaser.Game(PHASER_CONFIG);

// Log game version to console
console.log(`🐸 Bufonaut Game v${VERSION} - Ready to launch!`);
console.log('🚀 Game initialized successfully'); 