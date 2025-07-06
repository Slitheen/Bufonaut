import { PHASER_CONFIG } from './config/GameConfig.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { SplashScreenScene } from './scenes/SplashScreenScene.js';
import { GameScene } from './scenes/GameScene.js';

// Add scenes to config
PHASER_CONFIG.scene = [MainMenuScene, SplashScreenScene, GameScene];

// Create the game
const game = new Phaser.Game(PHASER_CONFIG); 