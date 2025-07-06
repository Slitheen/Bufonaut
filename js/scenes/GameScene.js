import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { ObjectSpawner } from '../systems/ObjectSpawner.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { UISystem } from '../systems/UISystem.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Game state
        this.player = null;
        this.startPoint = null;
        this.isPulling = false;
        this.launchLine = null;
        this.launchZoneIndicator = null;
        this.initialPlayerPosition = null;
        this.isAirborne = false;
        this.isLanded = false;
        this.launchTime = 0;
        this.peakY = 0;
        this.launchCount = 0;
        this.dayCount = 1;
        this.fuel = 0;
        this.maxFuel = 0;
        this.keys = null;
        this.groundLevel = 0;

        // Systems
        this.upgradeSystem = null;
        this.objectSpawner = null;
        this.collisionSystem = null;
        this.uiSystem = null;
    }

    preload() {
        // Load assets
        this.load.image('bufo', 'assets/bufo.png');
        this.load.image('bufo_rocket', 'assets/bufo_rocket.png');
        this.load.image('balloon', 'assets/balloon.png');
        this.load.image('balloons_2', 'assets/balloon_2.png');
        this.load.image('birds', 'assets/birds.png');
        this.load.image('birds_2', 'assets/birds_2.png');
        this.load.image('hot_air_balloon', 'assets/balloon.png');
        this.load.image('plane', 'assets/birds.png');
        this.load.image('satellite', 'assets/satellite.png');
        this.load.image('martian', 'assets/martian.png');
        this.load.image('cloud', 'assets/cloud.png');
        this.load.image('cloud_2', 'assets/cloud_2.png');
        this.load.image('cloud_3', 'assets/cloud_3.png');
        this.load.image('cloud_4', 'assets/cloud_4.png');
        this.load.image('cloud_5', 'assets/cloud_5.png');
        this.load.image('cloud_6', 'assets/cloud_6.png');
        this.load.image('cloud_7', 'assets/cloud_7.png');
        this.load.image('upgrade_string', 'assets/upgrade_string.png');
        this.load.image('upgrade_frame', 'assets/upgrade_frame.png');
        this.load.image('upgrade_ship', 'assets/upgrade_ship.png');
        this.load.image('upgrade_rocket', 'assets/upgrade_rocket.png');
    }

    create() {
        // Initialize systems
        this.upgradeSystem = new UpgradeSystem(this);
        this.objectSpawner = new ObjectSpawner(this);
        this.collisionSystem = new CollisionSystem(this);
        this.uiSystem = new UISystem(this);

        // Setup world
        this.physics.world.setBounds(0, GAME_CONSTANTS.WORLD_TOP, this.cameras.main.width, this.cameras.main.height - GAME_CONSTANTS.WORLD_TOP);
        this.groundLevel = this.cameras.main.height - GAME_CONSTANTS.GROUND_HEIGHT;

        // Create world
        this.createSkyLayers();
        this.createGrassTexture();
        this.uiSystem.createModernUI();
        this.uiSystem.createCameraOverlay();
        this.uiSystem.createGameplayArea();
        this.uiSystem.createFloatingUI();
        
        // Spawn objects after player is created
        this.objectSpawner.spawnObjectsForCurrentZone();
        this.objectSpawner.spawnClouds();
        
        // Setup collision detection with spawned objects
        this.setupCollisionDetection();
        
        // Initialize UI text with current values
        this.uiSystem.ui.materialsText.setText(this.upgradeSystem.getMaterials());
        this.uiSystem.ui.dayCountText.setText(this.dayCount.toString());
    }

    setupCollisionDetection() {
        // Setup collision detection with objects
        if (this.objectSpawner.balloons) {
            this.physics.add.overlap(this.player, this.objectSpawner.balloons, (player, balloon) => this.collisionSystem.hitBalloon(player, balloon), null, this);
        }
        if (this.objectSpawner.birds) {
            this.physics.add.overlap(this.player, this.objectSpawner.birds, (player, bird) => this.collisionSystem.hitBird(player, bird), null, this);
        }
        if (this.objectSpawner.clouds) {
            this.physics.add.overlap(this.player, this.objectSpawner.clouds, (player, cloud) => this.collisionSystem.hitCloud(player, cloud), null, this);
        }
    }

    update() {
        const frameCount = this.time.now % GAME_CONSTANTS.PERFORMANCE.UPDATE_FREQUENCY;
        
        if (this.isPulling) {
            const pointer = this.input.activePointer;
            this.launchLine.clear();
            this.launchLine.lineStyle(5, 0xffffff);
            this.launchLine.lineBetween(this.startPoint.x, this.startPoint.y, pointer.x, pointer.y);
            this.launchZoneIndicator.clear();
        }

        // Only update bird wrapping every few frames
        if (frameCount === 0 && this.objectSpawner.birds && this.objectSpawner.birds.children.size > 0) {
            this.physics.world.wrap(this.objectSpawner.birds, 40);
        }

        if (this.isAirborne) {
            // Check for cloud breach before camera tracking
            this.uiSystem.checkCloudBreach();
            
            // Update altitude text every frame for smooth display
            const altitude = Math.round(this.groundLevel - this.player.y);
            this.uiSystem.altitudeText.setText(`Altitude: ${altitude} ft`);
            this.uiSystem.altitudeText.setVisible(true);

            this.handleRocketControls();

            // Check zone changes
            if (this.time.now % GAME_CONSTANTS.PERFORMANCE.ZONE_CHECK_FREQUENCY === 0) {
                this.objectSpawner.checkAltitudeZoneChange();
            }

            // Update fuel gauge less frequently
            if (frameCount === 0) {
                if (this.upgradeSystem.hasRocket()) {
                    this.uiSystem.fuelGauge.setVisible(true);
                    const fuelBar = this.uiSystem.fuelGauge.getByName('fuelBar');
                    const fuelPercentage = this.fuel / this.maxFuel;
                    fuelBar.clear();
                    const barColor = Phaser.Display.Color.Interpolate.ColorWithColor(
                        Phaser.Display.Color.ValueToColor(0xff0000),
                        Phaser.Display.Color.ValueToColor(0x00ff00),
                        1, 100,
                        fuelPercentage * 100
                    );
                    fuelBar.fillStyle(Phaser.Display.Color.GetColor(barColor.r, barColor.g, barColor.b));
                    fuelBar.fillRect(-45 + 1, -6 + 1, 88 * fuelPercentage, 10);
                } else {
                    this.uiSystem.fuelGauge.setVisible(false);
                }
            }

            if (this.player.y < this.peakY) {
                this.peakY = this.player.y;
            }

            // Update rotation
            if (this.time.now % GAME_CONSTANTS.PERFORMANCE.ROTATION_FREQUENCY === 0) {
                this.player.angle += this.player.body.velocity.x * 0.05;
            }

            // Update camera only after cloud breach
            if (this.uiSystem.cloudBreached) {
                const targetY = this.player.y - this.cameras.main.height / 2;
                this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, GAME_CONSTANTS.PERFORMANCE.CAMERA_SMOOTHING);
            }

            this.launchZoneIndicator.clear();

            // Update fuel gauge position every frame for smooth following
            if (this.uiSystem.fuelGauge && this.uiSystem.fuelGauge.visible && this.player) {
                const offsetY = this.player.displayHeight / 2 + 20; // Position at feet
                this.uiSystem.fuelGauge.x = this.player.x;
                this.uiSystem.fuelGauge.y = this.player.y + offsetY;
                this.uiSystem.fuelGauge.setDepth(1000);
            }
            
            // Update launcher visualization position
            this.uiSystem.updateLauncherPosition();

        } else {
            this.uiSystem.altitudeText.setVisible(false);
            
            if (!this.isLanded && !this.isPulling) {
                this.launchZoneIndicator.clear();
                this.launchZoneIndicator.lineStyle(2, 0xffffff, 0.3);
                this.launchZoneIndicator.strokeCircle(this.player.x, this.player.y, 60);
            } else {
                this.launchZoneIndicator.clear();
            }
        }
    }

    handleRocketControls() {
        if (this.upgradeSystem.hasRocket()) {
            const thrust = this.upgradeSystem.upgrades.rocket.thrust;
            const nudgeThrust = GAME_CONSTANTS.PLAYER.NUDGE_THRUST;
            let fuelConsumed = false;

            if (this.keys.W.isDown) {
                if (this.fuel > 0) {
                    this.player.body.velocity.y -= thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.y -= nudgeThrust;
                }
            }
            if (this.keys.S.isDown) {
                if (this.fuel > 0) {
                    this.player.body.velocity.y += thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.y += nudgeThrust;
                }
            }
            if (this.keys.A.isDown) {
                if (this.fuel > 0) {
                    this.player.body.velocity.x -= thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.x -= nudgeThrust;
                }
            }
            if (this.keys.D.isDown) {
                if (this.fuel > 0) {
                    this.player.body.velocity.x += thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.x += nudgeThrust;
                }
            }

            if (fuelConsumed) {
                this.fuel = Math.max(0, this.fuel - 1);
            }
        } else {
            const nudgeThrust = GAME_CONSTANTS.PLAYER.NUDGE_THRUST;

            if (this.keys.W.isDown) { this.player.body.velocity.y -= nudgeThrust; }
            if (this.keys.S.isDown) { this.player.body.velocity.y += nudgeThrust; }
            if (this.keys.A.isDown) { this.player.body.velocity.x -= nudgeThrust; }
            if (this.keys.D.isDown) { this.player.body.velocity.x += nudgeThrust; }
        }
    }

    handleLanding() {
        this.isAirborne = false;
        this.isLanded = true;

        this.cameras.main.pan(this.cameras.main.width / 2, this.cameras.main.height / 2, 250, 'Sine.easeInOut');

        this.player.body.stop();
        this.player.setAngle(0);
        this.launchZoneIndicator.clear();

        const airTime = (this.time.now - this.launchTime) / 1000;
        const distance = Math.max(0, this.startPoint.y - this.peakY);
        const materialsEarned = GAME_CONSTANTS.REWARDS.BASE_MATERIALS + Math.floor(distance / GAME_CONSTANTS.REWARDS.DISTANCE_DIVISOR);

        this.upgradeSystem.addMaterials(materialsEarned);
        this.uiSystem.ui.materialsText.setText(this.upgradeSystem.getMaterials());

        this.uiSystem.ui.flightDistanceText.setText(`${Math.round(distance)} ft`);
        this.uiSystem.ui.airTimeText.setText(`${airTime.toFixed(1)}s`);

        if (this.upgradeSystem.areAllUpgradesMaxed()) {
            this.uiSystem.ui.endOfDayContainer.getByName('dayFailedText').setText('LAUNCHER MAXED OUT!');
        } else {
            this.uiSystem.ui.endOfDayContainer.getByName('dayFailedText').setText(`Day ${this.dayCount} Failed`);
        }
        this.uiSystem.ui.endOfDayContainer.getByName('materialsEarnedText').setText(`You salvaged ${materialsEarned} materials.`);
        this.uiSystem.ui.endOfDayContainer.setVisible(true);
    }

    buyUpgrade(key) {
        const result = this.upgradeSystem.buyUpgrade(key);
        if (result) {
            this.maxFuel = result.maxFuel;
            this.fuel = result.fuel;
            this.player.setTexture(result.texture);
        }
        this.uiSystem.updateUpgradeUI();
        this.uiSystem.updateLauncherVisualization();
        this.uiSystem.ui.materialsText.setText(this.upgradeSystem.getMaterials());
    }

    restartDay() {
        this.uiSystem.ui.endOfDayContainer.setVisible(false);

        this.dayCount++;
        this.uiSystem.ui.dayCountText.setText(this.dayCount);

        this.objectSpawner.cleanupOldAssets();

        this.isLanded = false;
        this.player.setAngle(0);
        this.player.setTexture(this.upgradeSystem.hasRocket() ? 'bufo_rocket' : 'bufo');
        this.player.setPosition(this.initialPlayerPosition.x, this.initialPlayerPosition.y);

        // Reset cloud breach state
        this.uiSystem.cloudBreached = false;
        if (this.uiSystem.titleContainer) {
            this.uiSystem.titleContainer.setVisible(true);
        }
        if (this.uiSystem.bottomCloudCover) {
            this.uiSystem.bottomCloudCover.setVisible(false);
            this.uiSystem.bottomCloudCover.y = this.cameras.main.height;
        }

        if (this.upgradeSystem.hasRocket()) {
            this.maxFuel = 100;
            this.fuel = this.maxFuel;
        }

        this.objectSpawner.currentAltitudeZone = null;
        this.objectSpawner.spawnObjectsForCurrentZone();
        this.objectSpawner.spawnClouds();

        this.player.body.stop();
        
        // Update launcher visualization
        this.uiSystem.updateLauncherVisualization();
    }

    debugLaunch() {
        let testPower = 0;
        for (const key in this.upgradeSystem.upgrades) {
            const upgrade = this.upgradeSystem.upgrades[key];
            const halfLevel = Math.ceil(upgrade.maxLevel / 2);
            const powerAtHalf = upgrade.power + ((halfLevel - 1) * upgrade.increment);
            testPower += powerAtHalf;
        }

        this.isLanded = false;
        this.isPulling = false;
        this.uiSystem.ui.endOfDayContainer.setVisible(false);
        this.uiSystem.upgradeContainer.setVisible(false);
        this.player.body.stop();
        this.player.setPosition(this.initialPlayerPosition.x, this.initialPlayerPosition.y);
        this.player.setAngle(0);
        this.cameras.main.pan(this.cameras.main.width / 2, this.cameras.main.height / 2, 100, 'Sine.easeInOut');

        const launchVector = new Phaser.Math.Vector2(0, -200);
        this.player.setVelocity(launchVector.x * testPower, launchVector.y * testPower);

        this.isAirborne = true;
        this.launchTime = this.time.now;
        this.peakY = this.player.y;
        this.launchCount++;
        this.uiSystem.ui.launchCountText.setText(this.launchCount);
        this.uiSystem.ui.flightDistanceText.setText('...');
        this.uiSystem.ui.airTimeText.setText('...');
    }

    createSkyLayers() {
        const worldWidth = this.cameras.main.width;
        const groundY = this.groundLevel;
        const sunsetY = GAME_CONSTANTS.SKY.SUNSET_Y;
        const spaceY = GAME_CONSTANTS.SKY.SPACE_Y;
        const worldTopY = GAME_CONSTANTS.WORLD_TOP;

        // Create beautiful gradient sky layers using graphics
        const graphics = this.add.graphics();

        // Layer 1: Ground to Sunset (Sky Blue to Light Blue gradient)
        const skyZoneHeight = groundY - sunsetY;
        graphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4682B4, 0x4682B4, 1);
        graphics.fillRect(0, sunsetY, worldWidth, skyZoneHeight);

        // Layer 2: Sunset to Space (Orange to Purple gradient)
        const sunsetZoneHeight = sunsetY - spaceY;
        graphics.fillGradientStyle(0xFFA07A, 0xFFA07A, 0x8A2BE2, 0x8A2BE2, 1);
        graphics.fillRect(0, spaceY, worldWidth, sunsetZoneHeight);

        // Layer 3: Deep Space (Dark Blue to Black gradient)
        const spaceZoneHeight = spaceY - worldTopY;
        graphics.fillGradientStyle(0x483D8B, 0x483D8B, 0x000000, 0x000000, 1);
        graphics.fillRect(0, worldTopY, worldWidth, spaceZoneHeight);

        graphics.setDepth(-2);

        // Create twinkling stars in space
        this.createTwinklingStars(worldTopY, spaceY);
    }

    createTwinklingStars(spaceTop, spaceBottom) {
        // Create multiple star layers for depth effect
        const starLayers = [
            { count: 50, size: 2, alpha: 0.8, speed: 2000 }, // Background stars
            { count: 30, size: 3, alpha: 0.9, speed: 1500 }, // Mid stars
            { count: 20, size: 4, alpha: 1.0, speed: 1000 }  // Foreground stars
        ];

        starLayers.forEach((layer, layerIndex) => {
            for (let i = 0; i < layer.count; i++) {
                const star = this.add.graphics();
                
                // Random position in space
                const x = Phaser.Math.Between(0, this.cameras.main.width);
                const y = Phaser.Math.Between(spaceTop, spaceBottom);
                
                // Create star shape
                star.fillStyle(0xFFFFFF, layer.alpha);
                star.fillCircle(x, y, layer.size);
                
                star.setDepth(-1 + (layerIndex * 0.1)); // Slight depth variation
                
                // Twinkling animation
                this.tweens.add({
                    targets: star,
                    alpha: 0.3,
                    duration: layer.speed,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: Phaser.Math.Between(0, layer.speed) // Random start time
                });
            }
        });
    }

    createGrassTexture() {
        if (!this.textures.exists('grass')) {
            const graphics = this.add.graphics();
            
            // Create a more detailed grass texture with multiple shades
            const width = 100;
            const height = 64;
            
            // Base grass color
            graphics.fillStyle(0x228B22);
            graphics.fillRect(0, 0, width, height);
            
            // Add darker grass patches for variety
            graphics.fillStyle(0x1B5E20);
            for (let i = 0; i < 8; i++) {
                const x = Phaser.Math.Between(0, width - 10);
                const y = Phaser.Math.Between(0, height - 10);
                const size = Phaser.Math.Between(5, 15);
                graphics.fillRect(x, y, size, size);
            }
            
            // Add lighter grass highlights
            graphics.fillStyle(0x32CD32);
            for (let i = 0; i < 6; i++) {
                const x = Phaser.Math.Between(0, width - 8);
                const y = Phaser.Math.Between(0, height - 8);
                const size = Phaser.Math.Between(3, 8);
                graphics.fillRect(x, y, size, size);
            }
            
            graphics.generateTexture('grass', width, height);
            graphics.destroy();
        }
    }

    showZoneTransition(zoneName) {
        this.uiSystem.showZoneTransition(zoneName);
    }

    startCameraTracking() {
        // This method is called when Bufo breaches the clouds
        // The camera will start tracking the player from this point
        console.log('Camera tracking started - Bufo has breached the clouds!');
    }
} 