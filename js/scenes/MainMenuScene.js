import { UI_THEME } from '../config/GameConfig.js';

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create() {
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 3, 'Bufonaut', { 
            fontSize: '128px', 
            fill: '#FFF' 
        }).setOrigin(0.5);

        const startButton = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'Start Mission', { 
            fontSize: '48px', 
            fill: '#0F0' 
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setPadding(16)
            .setStyle({ backgroundColor: '#111' });

        startButton.on('pointerdown', () => {
            this.scene.start('SplashScreenScene');
        });
    }
} 