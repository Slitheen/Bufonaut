export class SplashScreenScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SplashScreenScene' });
    }

    create() {
        const story = [
            "Bufo, a bio-engineered frog with advanced intelligence, escaped from the lab where he was created.",
            "",
            "Now, the ruthless corporation OmniGen is hunting him, intending to dissect him to study his unique brain.",
            "",
            "To save his life and escape their grasp, he must build a launcher and flee to the stars."
        ];

        const storyText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height + 100,
            story,
            { 
                fontSize: '36px', 
                fill: '#FFF', 
                align: 'center', 
                wordWrap: { width: this.cameras.main.width - 100 } 
            }
        ).setOrigin(0.5, 0);

        // Tween the text to scroll up
        this.tweens.add({
            targets: storyText,
            y: -storyText.height,
            duration: 13000,
            ease: 'Linear',
            onComplete: () => this._startGame()
        });

        // Add a skip button for convenience
        this.add.text(this.cameras.main.width - 30, this.cameras.main.height - 30, 'Skip >>', { 
            fontSize: '24px', 
            fill: '#AAA' 
        })
            .setOrigin(1, 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._startGame());
    }

    _startGame() {
        this.tweens.killAll();
        this.scene.start('GameScene');
    }
} 