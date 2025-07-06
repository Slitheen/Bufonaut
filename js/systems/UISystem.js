import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class UISystem {
    constructor(scene) {
        this.scene = scene;
        this.ui = {};
        this.upgradeContainer = null;
        this.altitudeText = null;
        this.fuelGauge = null;
        this.launcherVisualization = null;
    }

    createModernUI() {
        this.createStatusBar();
        this.createGameplayArea();
        this.createActionPanel();
        this.createFloatingUI();
    }

    createStatusBar() {
        // Create cloud-themed title with animated clouds
        this.createCloudTitle();

        // Stats display with modern styling
        const labelX = 60;
        const valueX = 360;
        const initialY = 180;
        const stepY = 67;

        // Create stat cards
        this.createStatCard('Launches:', '0', labelX, valueX, initialY);
        this.ui.launchCountText = this.createStatValue('0', valueX, initialY);

        this.createStatCard('Last Flight:', '0 ft', labelX, valueX, initialY + stepY);
        this.ui.flightDistanceText = this.createStatValue('0 ft', valueX, initialY + stepY);

        this.createStatCard('Air Time:', '0.0s', labelX, valueX, initialY + (stepY * 2));
        this.ui.airTimeText = this.createStatValue('0.0s', valueX, initialY + (stepY * 2));

        this.createStatCard('Materials:', '0', labelX, valueX, initialY + (stepY * 3));
        this.ui.materialsText = this.createStatValue('0', valueX, initialY + (stepY * 3));

        // Day counter on the right
        this.createStatCard('Day:', '1', this.scene.cameras.main.width - 330, this.scene.cameras.main.width - 180, initialY);
        this.ui.dayCountText = this.createStatValue('1', this.scene.cameras.main.width - 180, initialY);
    }

    createStatCard(label, value, labelX, valueX, y) {
        const cardWidth = valueX - labelX + 120;
        const cardHeight = 60;
        const cardX = labelX - 10;
        const cardY = y - 30;
        
        const cardBg = this.scene.add.rectangle(cardX + cardWidth/2, cardY + cardHeight/2, cardWidth, cardHeight, 0x34495e, 0.3);
        
        this.scene.add.text(labelX, y, label, { 
            fontSize: GAME_CONSTANTS.UI_SCALE.STAT_FONT,
            fill: UI_THEME.textSecondary,
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0, 0.5);
    }

    createStatValue(value, x, y) {
        return this.scene.add.text(x, y, value, { 
            fontSize: GAME_CONSTANTS.UI_SCALE.STAT_FONT,
            fill: UI_THEME.text,
            fontFamily: 'Arial, sans-serif',
            stroke: UI_THEME.primary,
            strokeThickness: 1
        }).setOrigin(0, 0.5);
    }

    createGameplayArea() {
        // This area is intentionally clean for gameplay
        const ground = this.scene.physics.add.staticGroup();
        ground.create(this.scene.cameras.main.width / 2, this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2))
            .setSize(this.scene.cameras.main.width, GAME_CONSTANTS.GROUND_HEIGHT)
            .setVisible(false);

        // Create the visual tiled sprite for the grass
        this.scene.add.tileSprite(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2),
            this.scene.cameras.main.width,
            GAME_CONSTANTS.GROUND_HEIGHT,
            'grass'
        );

        // Create the player (only if not already created)
        if (!this.scene.player) {
            const startX = this.scene.cameras.main.width / 2;
            const startY = this.scene.groundLevel - GAME_CONSTANTS.PLAYER.START_Y_OFFSET - GAME_CONSTANTS.PLAYER.SIZE / 2;
            this.scene.initialPlayerPosition = new Phaser.Math.Vector2(startX, startY);
            const playerTexture = this.scene.upgradeSystem.hasRocket() ? 'bufo_rocket' : 'bufo';
            this.scene.player = this.scene.physics.add.sprite(startX, startY, playerTexture)
                .setOrigin(0.5, 0.5)
                .setDisplaySize(GAME_CONSTANTS.PLAYER.SIZE, GAME_CONSTANTS.PLAYER.SIZE)
                .setCollideWorldBounds(true)
                .refreshBody()
                .setDepth(500); // Higher than launcher (400)
            this.scene.player.setCircle(this.scene.player.width / 2);

            // Setup ground collision
            this.scene.physics.add.collider(this.scene.player, ground, () => this.scene.collisionSystem.onPlayerLand(), null, this.scene);
        }
        
        // Create launcher visualization
        this.createLauncherVisualization();
    }

    createActionPanel() {
        // Bottom area for any action buttons (currently empty)
    }

    createFloatingUI() {
        // Create UI containers (initially hidden)
        this.ui.endOfDayContainer = this.createEndOfDayUI();
        this.createUpgradeUI();
        this.createFuelGauge();

        // Setup slingshot inputs
        this.scene.launchLine = this.scene.add.graphics();
        this.scene.launchZoneIndicator = this.scene.add.graphics();

        // Listen for a click or touch anywhere on the game screen
        this.scene.input.on('pointerdown', (pointer) => {
            if (!this.scene.isAirborne && !this.scene.isLanded) {
                this.scene.isPulling = true;
                this.scene.startPoint = new Phaser.Math.Vector2(this.scene.player.x, this.scene.player.y);
            }
        });

        // Listen for WASD keys for rocket controls
        this.scene.keys = this.scene.input.keyboard.addKeys('W,A,S,D');

        this.scene.input.on('pointerup', (pointer) => {
            if (this.scene.isPulling) {
                this.scene.isPulling = false;
                this.scene.launchLine.clear();

                const pullVector = this.scene.startPoint.clone().subtract(pointer.position);
                const currentLaunchPower = this.scene.upgradeSystem.getTotalLaunchPower();

                if (pullVector.y < 0) {
                    this.scene.player.setVelocity(pullVector.x * currentLaunchPower, pullVector.y * currentLaunchPower);
                    this.scene.isAirborne = true;
                    this.scene.launchTime = this.scene.time.now;
                    this.scene.peakY = this.scene.player.y;
                    this.scene.launchCount++;
                    this.ui.launchCountText.setText(this.scene.launchCount);
                    this.ui.flightDistanceText.setText('...');
                    this.ui.airTimeText.setText('...');
                    
                    // Trigger cloud collision effect when launching
                    this.triggerCloudCollisionEffect();
                }
            }
        });

        // Debug features
        const f2Key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
        f2Key.on('down', () => {
            this.scene.physics.world.drawDebug = !this.scene.physics.world.drawDebug;
            if (this.scene.physics.world.debugGraphic) {
                this.scene.physics.world.debugGraphic.clear();
                this.scene.physics.world.debugGraphic.setVisible(this.scene.physics.world.drawDebug);
            }
        });

        const f3Key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
        f3Key.on('down', () => this.scene.debugLaunch());

        const f9Key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
        f9Key.on('down', () => {
            this.scene.upgradeSystem.addMaterials(500);
            this.ui.materialsText.setText(this.scene.upgradeSystem.getMaterials());
            console.log(`Admin: Added 500 materials. Total: ${this.scene.upgradeSystem.getMaterials()}`);
        });
    }

    createLauncherVisualization() {
        // Create a container for all launcher parts
        this.launcherVisualization = this.scene.add.container(0, 0);
        
        // Create upgrade visualizations using actual assets
        this.createUpgradeVisualizations();
        
        // Position the launcher visualization
        this.updateLauncherPosition();
    }

    createUpgradeVisualizations() {
        const upgrades = this.scene.upgradeSystem.upgrades;
        const upgradeElements = [];
        
        // Create a simple slingshot shape using basic graphics
        this.createSlingshotShape(upgradeElements);
        
        // Add all upgrade elements to the launcher visualization
        upgradeElements.forEach(element => {
            this.launcherVisualization.add(element);
        });
    }

    createSlingshotShape(upgradeElements) {
        // Create a simple slingshot using rectangles and lines
        const slingshotWidth = 80;
        const slingshotHeight = 120;
        
        // Left support post
        const leftPost = this.scene.add.graphics()
            .fillStyle(UI_THEME.surface, 0.8)
            .fillRect(-slingshotWidth/2 - 8, -slingshotHeight/2, 16, slingshotHeight)
            .lineStyle(2, UI_THEME.primary, 0.9)
            .strokeRect(-slingshotWidth/2 - 8, -slingshotHeight/2, 16, slingshotHeight);
        
        // Right support post
        const rightPost = this.scene.add.graphics()
            .fillStyle(UI_THEME.surface, 0.8)
            .fillRect(slingshotWidth/2 - 8, -slingshotHeight/2, 16, slingshotHeight)
            .lineStyle(2, UI_THEME.primary, 0.9)
            .strokeRect(slingshotWidth/2 - 8, -slingshotHeight/2, 16, slingshotHeight);
        
        // Top crossbar
        const crossbar = this.scene.add.graphics()
            .fillStyle(UI_THEME.surface, 0.8)
            .fillRect(-slingshotWidth/2, -slingshotHeight/2 - 8, slingshotWidth, 16)
            .lineStyle(2, UI_THEME.primary, 0.9)
            .strokeRect(-slingshotWidth/2, -slingshotHeight/2 - 8, slingshotWidth, 16);
        
        // Rubber band (elastic)
        const rubberBand = this.scene.add.graphics()
            .lineStyle(4, UI_THEME.secondary, 0.8)
            .lineBetween(-slingshotWidth/2 + 4, -slingshotHeight/2 + 20, 0, 20)
            .lineBetween(slingshotWidth/2 - 4, -slingshotHeight/2 + 20, 0, 20);
        
        upgradeElements.push(leftPost, rightPost, crossbar, rubberBand);
    }

    createCloudTitle() {
        // Create title container
        this.titleContainer = this.scene.add.container(this.scene.cameras.main.width / 2, 90);
        
        // Create cloud-themed title text
        const titleText = this.scene.add.text(0, 0, 'Reach for the Sky!', {
            fontSize: GAME_CONSTANTS.UI_SCALE.TITLE_FONT,
            fill: UI_THEME.text,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            stroke: UI_THEME.primary,
            strokeThickness: 3,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: 'rgba(0,0,0,0.5)',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);
        
        this.titleContainer.add(titleText);
        
        // Create animated clouds around the title
        this.createTitleClouds();
        
        // Set the title container to not scroll with camera initially
        this.titleContainer.setScrollFactor(0, 0);
        this.titleContainer.setDepth(100);
        
        // Create bottom cloud cover (initially hidden)
        this.createBottomCloudCover();
    }

    createTitleClouds() {
        const cloudTextures = ['cloud', 'cloud_2', 'cloud_3', 'cloud_4', 'cloud_5', 'cloud_6', 'cloud_7'];
        const cloudCount = 10; // More clouds for better spread
        
        for (let i = 0; i < cloudCount; i++) {
            const cloudTexture = cloudTextures[i % cloudTextures.length];
            
            // Spread clouds more widely around the title
            const x = Phaser.Math.Between(-300, 300); // Wider horizontal spread
            const y = Phaser.Math.Between(-100, 80); // More vertical spread
            const scale = Phaser.Math.FloatBetween(0.5, 1.1); // More size variation
            const delay = i * 300; // Staggered delays
            
            const cloud = this.scene.add.image(x, y, cloudTexture)
                .setScale(scale)
                .setAlpha(0.75);
            
            this.titleContainer.add(cloud);
            
            // Add floating animation with more variation
            this.scene.tweens.add({
                targets: cloud,
                y: y - Phaser.Math.Between(8, 18),
                duration: 2500 + (i * 300),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: delay
            });
            
            // Add gentle rotation
            this.scene.tweens.add({
                targets: cloud,
                angle: Phaser.Math.Between(-8, 8),
                duration: 3500 + (i * 400),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: delay + 500
            });
        }
    }

    updateLauncherPosition() {
        if (this.launcherVisualization && this.scene.player) {
            this.launcherVisualization.x = this.scene.player.x;
            this.launcherVisualization.y = this.scene.player.y;
            this.launcherVisualization.setDepth(400); // Lower than player (500+)
            
            // Only show launcher when on ground and not airborne
            this.launcherVisualization.setVisible(!this.scene.isAirborne && !this.scene.isLanded);
        }
    }

    updateLauncherVisualization() {
        // Clear existing upgrade visualizations
        this.launcherVisualization.removeAll(true);
        
        // Recreate upgrade visualizations using actual assets
        this.createUpgradeVisualizations();
    }

    createCameraOverlay() {
        // Create altitude text as a UI element that stays fixed on screen
        this.altitudeText = this.scene.add.text(
            this.scene.cameras.main.width - 45,
            45,
            'Altitude: 0',
            {
                fontSize: GAME_CONSTANTS.UI_SCALE.ALTITUDE_FONT,
                fill: UI_THEME.primary,
                fontFamily: 'Arial, sans-serif',
                align: 'right',
                backgroundColor: 'rgba(44,62,80,0.7)',
                padding: { left: 18, right: 18, top: 6, bottom: 6 },
            }
        ).setOrigin(1, 0);
        
        // Debug: Log the creation
        console.log('Altitude text created at:', this.scene.cameras.main.width - 45, 45);
        
        // Set high depth to ensure it's above everything
        this.altitudeText.setDepth(1000);
        this.altitudeText.setVisible(true); // Temporarily visible for testing
        
        // Make sure it doesn't scroll with the camera
        this.altitudeText.setScrollFactor(0, 0);
        
        // In Phaser 3, we use setScrollFactor(0, 0) to fix to camera
        // The text is already set to not scroll with the camera
    }

    createFuelGauge() {
        const gaugeWidth = 90;
        const gaugeHeight = 12;
        const x = 0;
        const y = 0;

        const bg = this.scene.add.graphics()
            .fillStyle(UI_THEME.surface, 0.8)
            .fillRoundedRect(-gaugeWidth/2, -gaugeHeight/2, gaugeWidth, gaugeHeight, 4);
        
        bg.lineStyle(1, UI_THEME.primary, 0.5)
            .strokeRoundedRect(-gaugeWidth/2, -gaugeHeight/2, gaugeWidth, gaugeHeight, 4);
        
        const bar = this.scene.add.graphics().fillStyle(UI_THEME.success).fillRoundedRect(-gaugeWidth/2 + 1, -gaugeHeight/2 + 1, gaugeWidth - 2, gaugeHeight - 2, 3);
        const text = this.scene.add.text(0, 0, 'FUEL', { 
            fontSize: GAME_CONSTANTS.UI_SCALE.FUEL_FONT,
            fill: UI_THEME.text,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        bar.setName('fuelBar');
        this.fuelGauge = this.scene.add.container(x, y, [bg, bar, text]);
        this.fuelGauge.setVisible(false);
        this.fuelGauge.setDepth(1000);
    }

    createEndOfDayUI() {
        const box = this.scene.add.graphics()
            .fillStyle(UI_THEME.background, 0.9)
            .fillRoundedRect(-250, -150, 500, 300, 16);
        
        box.lineStyle(2, UI_THEME.primary, 0.5)
            .strokeRoundedRect(-250, -150, 500, 300, 16);
        
        const dayFailedText = this.scene.add.text(0, -110, '', { 
            fontSize: '36px', 
            fill: UI_THEME.text, 
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        
        const materialsEarnedText = this.scene.add.text(0, -60, '', { 
            fontSize: '28px', 
            fill: UI_THEME.textSecondary, 
            align: 'center',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        const upgradeButton = this.createModernButton(0, 25, 'Upgrades', () => {
            this.ui.endOfDayContainer.setVisible(false);
            this.updateUpgradeUI();
            this.upgradeContainer.setVisible(true);
        }, 'success');
        
        const nextDayButton = this.createModernButton(0, 95, 'Try Again', () => this.scene.restartDay(), 'danger');

        const container = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2, [box, dayFailedText, materialsEarnedText, upgradeButton, nextDayButton]);
        dayFailedText.setName('dayFailedText');
        materialsEarnedText.setName('materialsEarnedText');
        container.setVisible(false);
        return container;
    }

    createUpgradeUI() {
        const box = this.scene.add.graphics()
            .fillStyle(UI_THEME.background, 0.95)
            .fillRoundedRect(-350, -250, 700, 500, 20);
        
        box.lineStyle(3, UI_THEME.primary, 0.6)
            .strokeRoundedRect(-350, -250, 700, 500, 20);
        
        const title = this.scene.add.text(0, -200, 'Launcher Upgrades', { 
            fontSize: '40px', 
            fill: UI_THEME.text,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const elements = [box, title];
        const startY = -120;
        const stepY = 100;

        const createRow = (y, key) => {
            const upgrade = this.scene.upgradeSystem.upgrades[key];

            const rowBg = this.scene.add.graphics()
                .fillStyle(UI_THEME.surface, 0.4)
                .fillRoundedRect(-320, y - 35, 640, 70, 10);

            const icon = this.scene.add.image(-280, y, upgrade.assetKey).setDisplaySize(GAME_CONSTANTS.UI_SCALE.UPGRADE_ICON_SIZE, GAME_CONSTANTS.UI_SCALE.UPGRADE_ICON_SIZE);

            const nameText = this.scene.add.text(-200, y - 16, upgrade.name, { 
                fontSize: GAME_CONSTANTS.UI_SCALE.BUTTON_FONT,
                fill: UI_THEME.text,
                fontFamily: 'Arial, sans-serif'
            });
            const levelText = this.scene.add.text(-200, y + 16, '', { 
                fontSize: GAME_CONSTANTS.UI_SCALE.SMALL_FONT,
                fill: UI_THEME.textSecondary,
                fontFamily: 'Arial, sans-serif'
            });

            const costText = this.scene.add.text(220, y, '', { 
                fontSize: GAME_CONSTANTS.UI_SCALE.BUTTON_FONT,
                fill: UI_THEME.secondary,
                fontFamily: 'Arial, sans-serif'
            }).setOrigin(1, 0.5);
            
            const buyButton = this.createUpgradeButton(290, y, 'BUY', () => this.scene.buyUpgrade(key));

            levelText.setName(`${key}LevelText`);
            costText.setName(`${key}CostText`);
            buyButton.setName(`${key}BuyButton`);

            elements.push(rowBg, icon, nameText, levelText, costText, buyButton);
        };

        createRow(startY, 'string');
        createRow(startY + stepY, 'frame');
        createRow(startY + (stepY * 2), 'spaceShip');
        createRow(startY + (stepY * 3), 'rocket');

        const closeButton = this.createModernButton(0, 200, 'Close', () => {
            this.upgradeContainer.setVisible(false);
            this.ui.endOfDayContainer.setVisible(true);
        }, 'danger');
        elements.push(closeButton);

        this.upgradeContainer = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2, elements);
        this.upgradeContainer.setVisible(false);
    }

    updateUpgradeUI() {
        const updateRow = (key) => {
            const upgrade = this.scene.upgradeSystem.upgrades[key];
            const levelText = this.upgradeContainer.getByName(`${key}LevelText`);
            const costText = this.upgradeContainer.getByName(`${key}CostText`);
            const buyButton = this.upgradeContainer.getByName(`${key}BuyButton`);

            if (upgrade.level >= upgrade.maxLevel) {
                levelText.setText(upgrade.maxLevel === 1 ? 'OWNED' : `Lvl MAX`);
                costText.setText('---');
                buyButton.setAlpha(0.5).disableInteractive();
                const buttonText = buyButton.getByName('buttonText');
                if (buttonText) buttonText.setText('OWNED');
            } else {
                levelText.setText(`Lvl ${upgrade.level}`);
                costText.setText(`Cost: ${upgrade.cost}`);
                const buttonText = buyButton.getByName('buttonText');
                if (buttonText) buttonText.setText('BUY');
                
                if (this.scene.upgradeSystem.getMaterials() >= upgrade.cost) {
                    buyButton.setAlpha(1).setInteractive(new Phaser.Geom.Rectangle(-40, -20, 80, 40), Phaser.Geom.Rectangle.Contains);
                } else {
                    buyButton.setAlpha(0.3).disableInteractive();
                }
            }
        };

        updateRow('string');
        updateRow('frame');
        updateRow('spaceShip');
        updateRow('rocket');
    }

    createModernButton(x, y, text, callback, style = 'primary') {
        const button = this.scene.add.container(x, y);
        
        const bg = this.scene.add.graphics()
            .fillStyle(UI_THEME[style])
            .fillRoundedRect(-80, -25, 160, 50, 12);
        
        bg.lineStyle(2, UI_THEME.text, 0.3)
            .strokeRoundedRect(-80, -25, 160, 50, 12);
        
        const textObj = this.scene.add.text(0, 0, text, {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fill: UI_THEME.text,
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        button.add([bg, textObj]);
        button.setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);
        
        button.on('pointerover', () => {
            bg.clear()
                .fillStyle(UI_THEME[style], 0.8)
                .fillRoundedRect(-80, -25, 160, 50, 12)
                .lineStyle(2, UI_THEME.text, 0.5)
                .strokeRoundedRect(-80, -25, 160, 50, 12);
        });
        
        button.on('pointerout', () => {
            bg.clear()
                .fillStyle(UI_THEME[style])
                .fillRoundedRect(-80, -25, 160, 50, 12)
                .lineStyle(2, UI_THEME.text, 0.3)
                .strokeRoundedRect(-80, -25, 160, 50, 12);
        });
        
        button.on('pointerdown', callback);
        
        return button;
    }

    createUpgradeButton(x, y, text, callback) {
        const button = this.scene.add.container(x, y);
        
        const bg = this.scene.add.graphics()
            .fillStyle(UI_THEME.success)
            .fillRoundedRect(-40, -20, 80, 40, 8);
        
        bg.lineStyle(1, UI_THEME.text, 0.3)
            .strokeRoundedRect(-40, -20, 80, 40, 8);
        
        const textObj = this.scene.add.text(0, 0, text, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fill: UI_THEME.text,
            fontWeight: 'bold'
        }).setOrigin(0.5).setName('buttonText');
        
        button.add([bg, textObj]);
        button.setInteractive(new Phaser.Geom.Rectangle(-40, -20, 80, 40), Phaser.Geom.Rectangle.Contains);
        
        button.on('pointerover', () => {
            bg.clear()
                .fillStyle(UI_THEME.success, 0.8)
                .fillRoundedRect(-40, -20, 80, 40, 8)
                .lineStyle(1, UI_THEME.text, 0.5)
                .strokeRoundedRect(-40, -20, 80, 40, 8);
        });
        
        button.on('pointerout', () => {
            bg.clear()
                .fillStyle(UI_THEME.success)
                .fillRoundedRect(-40, -20, 80, 40, 8)
                .lineStyle(1, UI_THEME.text, 0.3)
                .strokeRoundedRect(-40, -20, 80, 40, 8);
        });
        
        button.on('pointerdown', callback);
        
        return button;
    }

    showZoneTransition(zoneName) {
        const transitionText = this.scene.add.text(
            this.scene.cameras.main.width / 2, 
            this.scene.cameras.main.height / 2, 
            zoneName, 
            { 
                fontSize: '48px', 
                fill: UI_THEME.primary,
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
            }
        ).setOrigin(0.5).setAlpha(0);
        
        this.scene.tweens.add({
            targets: transitionText,
            alpha: 1,
            duration: 500,
            ease: 'Power2',
            yoyo: true,
            onComplete: () => transitionText.destroy()
        });
    }

    triggerCloudCollisionEffect() {
        if (!this.titleContainer) return;
        
        // Get all clouds in the title container
        const clouds = this.titleContainer.getAll();
        
        clouds.forEach((cloud, index) => {
            if (cloud.texture && cloud.texture.key && cloud.texture.key.startsWith('cloud')) {
                // Create a "burst" effect when Bufo launches through
                this.scene.tweens.add({
                    targets: cloud,
                    scaleX: cloud.scaleX * 1.5,
                    scaleY: cloud.scaleY * 1.5,
                    alpha: 0.3,
                    duration: 300,
                    ease: 'Power2',
                    delay: index * 50,
                    yoyo: true,
                    onComplete: () => {
                        // Reset cloud to normal
                        cloud.setScale(cloud.scaleX / 1.5, cloud.scaleY / 1.5);
                        cloud.setAlpha(0.8);
                    }
                });
                
                // Add a small particle effect
                this.createCloudParticles(cloud.x + this.titleContainer.x, cloud.y + this.titleContainer.y);
            }
        });
    }

    createCloudParticles(x, y) {
        // Create simple particle effect
        for (let i = 0; i < 5; i++) {
            const particle = this.scene.add.graphics()
                .fillStyle(0xFFFFFF, 0.6)
                .fillCircle(0, 0, 3);
            
            particle.setPosition(x, y);
            particle.setDepth(200);
            
            this.scene.tweens.add({
                targets: particle,
                x: x + Phaser.Math.Between(-30, 30),
                y: y + Phaser.Math.Between(-20, 20),
                alpha: 0,
                scaleX: 0.5,
                scaleY: 0.5,
                duration: 800,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }

    createBottomCloudCover() {
        // Create bottom cloud cover container
        this.bottomCloudCover = this.scene.add.container(0, this.scene.cameras.main.height);
        
        const cloudTextures = ['cloud', 'cloud_2', 'cloud_3', 'cloud_4', 'cloud_5', 'cloud_6', 'cloud_7'];
        const cloudCount = 15; // More clouds for better spread
        
        for (let i = 0; i < cloudCount; i++) {
            const cloudTexture = cloudTextures[i % cloudTextures.length];
            
            // Spread clouds more horizontally with wider distribution
            const x = (this.scene.cameras.main.width / (cloudCount - 1)) * i + Phaser.Math.Between(-120, 120);
            
            // Bring clouds down and spread them more vertically
            const y = Phaser.Math.Between(-120, -40); // Lower and more spread out
            
            const scale = Phaser.Math.FloatBetween(0.6, 1.3); // Slightly smaller for less screen coverage
            
            const cloud = this.scene.add.image(x, y, cloudTexture)
                .setScale(scale)
                .setAlpha(0.8);
            
            this.bottomCloudCover.add(cloud);
            
            // Add gentle floating animation with more variation
            this.scene.tweens.add({
                targets: cloud,
                y: y - Phaser.Math.Between(8, 20), // Slightly less movement
                duration: 3500 + (i * 500), // More varied timing
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: i * 200
            });
        }
        
        // Initially hidden
        this.bottomCloudCover.setVisible(false);
        this.bottomCloudCover.setScrollFactor(0, 0);
        this.bottomCloudCover.setDepth(150);
    }

    checkCloudBreach() {
        if (!this.scene.player || !this.titleContainer) return;
        
        // Check if player has breached the title cloud area (around y=90)
        const breachY = 90;
        
        if (this.scene.player.y < breachY && !this.cloudBreached) {
            this.cloudBreached = true;
            
            // Start camera tracking
            this.scene.startCameraTracking();
            
            // Hide title and show bottom cloud cover
            this.titleContainer.setVisible(false);
            this.bottomCloudCover.setVisible(true);
            
            // Animate bottom cloud cover sliding up
            this.scene.tweens.add({
                targets: this.bottomCloudCover,
                y: this.scene.cameras.main.height - 150,
                duration: 2000,
                ease: 'Power2',
                onComplete: () => {
                    // Keep it at the bottom
                    this.bottomCloudCover.y = this.scene.cameras.main.height - 150;
                }
            });
        }
    }
} 