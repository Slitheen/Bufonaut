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
        this.justRestarted = false; // Initialize the flag properly
        this.hasBeenLaunched = false; // Initialize launch tracking

        // Systems
        this.upgradeSystem = null;
        this.objectSpawner = null;
        this.collisionSystem = null;
        this.uiSystem = null;
    }

    preload() {
        // Load assets
        this.load.image('bufo', 'assets/bufo.png');
        this.load.image('bufo_failed', 'assets/bufo_failed.png');
        this.load.image('bufo_rocket', 'assets/bufo_rocket.png');
        this.load.image('balloon', 'assets/balloon.png');
        this.load.image('balloon_2', 'assets/balloon_2.png');
        this.load.image('birds', 'assets/birds.png');
        this.load.image('birds_2', 'assets/birds_2.png');
        this.load.image('hot_air_balloon', 'assets/hot_air_balloon.png');
        this.load.image('plane', 'assets/plane.png');
        this.load.image('satellite', 'assets/satellite.png');
        this.load.image('martian', 'assets/martian.png');
        this.load.image('coin', 'assets/coin.png');
        this.load.image('gas_tank', 'assets/gas_tank.png');
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
        
        // Load seamless world background with cache-busting
        const backgroundVersion = Date.now(); // Use timestamp for cache-busting
        // Alternative: Use manual version - increment this when you update the background
        // const backgroundVersion = '1.1'; // Change this number when you update background.png
        this.load.image('world_background', `World/background.png?v=${backgroundVersion}`);
        
        console.log(`Loading background with cache-busting: World/background.png?v=${backgroundVersion}`);
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
        
        // CRITICAL FIX: Set initial camera position with grass edge at bottom of screen
        // Position camera so the bottom edge of the grass is at the bottom of the screen
        const grassTileHeight = 80;
        const additionalGrassRows = 4;
        const grassBottomEdge = this.groundLevel + (grassTileHeight * additionalGrassRows); // Bottom of the 4th additional row
        const initialCameraY = grassBottomEdge - this.cameras.main.height; // Bottom edge of grass at bottom of screen
        this.cameras.main.scrollX = 0;
        this.cameras.main.scrollY = initialCameraY;
        console.log(`Initial camera position set with grass edge at bottom: scrollX=${this.cameras.main.scrollX}, scrollY=${this.cameras.main.scrollY}, groundLevel=${this.groundLevel}, grassBottomEdge=${grassBottomEdge}`);

        // Create seamless world background
        this.createSeamlessBackground();
        this.createGrassTexture();
        this.uiSystem.createModernUI();
        this.uiSystem.createCameraOverlay();
        this.uiSystem.createGameplayArea();
        this.uiSystem.createFloatingUI();
        
        // Create the upgrade shop building
        this.uiSystem.createUpgradeShopBuilding();
        
        // Validate all required textures are loaded before spawning
        this.validateAssets(() => {
            // Spawn objects after assets are validated and player is created
            this.time.delayedCall(200, () => {
                if (this.objectSpawner && typeof this.objectSpawner.spawnObjectsForMultipleZones === 'function') {
                    this.objectSpawner.spawnObjectsForMultipleZones();
                    this.objectSpawner.spawnClouds();
                    this.objectSpawner.spawnCoinsAndGasTanks();
                    
                    // Setup collision detection with spawned objects
                    this.setupCollisionDetection();
                } else {
                    console.error('ObjectSpawner or spawnObjectsForMultipleZones method not available');
                }
            });
        });
        
        // Initialize UI text with current values
        this.uiSystem.ui.coinsText.setText(this.upgradeSystem.getCoins());
        this.uiSystem.ui.dayCountText.setText(this.dayCount.toString());
        
        // Ensure justRestarted flag is properly initialized for first session
        if (this.dayCount === 1) {
            console.log('First session - ensuring justRestarted flag is properly initialized');
            this.justRestarted = false;
        }
    }

    validateAssets(callback) {
        console.log('Validating game assets...');
        
        const requiredTextures = [
            'bufo', 'bufo_failed', 'bufo_rocket', 'balloon', 'balloon_2', 'birds', 'birds_2',
            'hot_air_balloon', 'plane', 'satellite', 'martian', 'coin', 'gas_tank',
            'cloud', 'cloud_2', 'cloud_3', 'cloud_4', 'cloud_5', 'cloud_6', 'cloud_7',
            'upgrade_string', 'upgrade_frame', 'upgrade_ship', 'upgrade_rocket',
            'world_background'
        ];
        
        const missingTextures = [];
        
        requiredTextures.forEach(texture => {
            if (!this.textures.exists(texture)) {
                missingTextures.push(texture);
            }
        });
        
        if (missingTextures.length > 0) {
            console.error('Missing textures:', missingTextures);
            // Try to wait a bit longer for textures to load
            this.time.delayedCall(500, () => {
                const stillMissing = missingTextures.filter(texture => !this.textures.exists(texture));
                if (stillMissing.length > 0) {
                    console.error('Still missing textures after delay:', stillMissing);
                }
                callback();
            });
        } else {
            console.log('All textures validated successfully');
            callback();
        }
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
        if (this.objectSpawner.coins) {
            this.physics.add.overlap(this.player, this.objectSpawner.coins, (player, coin) => this.collisionSystem.hitCoin(player, coin), null, this);
        }
        if (this.objectSpawner.gasTanks) {
            this.physics.add.overlap(this.player, this.objectSpawner.gasTanks, (player, gasTank) => this.collisionSystem.hitGasTank(player, gasTank), null, this);
        }
        
        console.log('Collision detection setup complete');
    }

    update() {
        const frameCount = this.time.now % GAME_CONSTANTS.PERFORMANCE.UPDATE_FREQUENCY;
        
        if (this.isPulling) {
            const pointer = this.input.activePointer;
            this.launchLine.clear();
            
            // Convert pointer coordinates to world coordinates
            const worldX = pointer.x + this.cameras.main.scrollX;
            const worldY = pointer.y + this.cameras.main.scrollY;
            
            // Draw elastic bands from launcher to player with better styling
            this.launchLine.lineStyle(4, 0x4A90E2, 0.6); // Blue color instead of white
            
            // Use original player position for launcher anchor points (fixed position)
            const launcherX = this.originalPlayerPosition.x;
            const launcherY = this.originalPlayerPosition.y;
            
            // Left band from launcher to player
            const launcherLeftX = launcherX - 70; // Left side of launcher
            const launcherTopY = launcherY - 90; // Top of launcher
            this.launchLine.lineBetween(launcherLeftX, launcherTopY, this.player.x, this.player.y);
            
            // Right band from launcher to player
            const launcherRightX = launcherX + 70; // Right side of launcher
            this.launchLine.lineBetween(launcherRightX, launcherTopY, this.player.x, this.player.y);
            
            // Draw pull direction indicator using world coordinates
            this.launchLine.lineStyle(2, 0xFFFF00, 0.8); // Yellow direction indicator
            this.launchLine.lineBetween(this.player.x, this.player.y, worldX, worldY);
            
            this.launchZoneIndicator.clear();
        }

        // Only update bird wrapping every few frames
        if (frameCount === 0 && this.objectSpawner.birds && this.objectSpawner.birds.children.size > 0) {
            this.physics.world.wrap(this.objectSpawner.birds, 40);
        }

        // Update debug hitboxes only for moving objects (Bufo)
        if (frameCount % 4 === 0) { // Only update every 4 frames (144 FPS / 4 = 36 FPS)
            this.uiSystem.updateDebugHitboxes();
        }

        if (this.isAirborne) {
            // Check for cloud breach before camera tracking
            this.uiSystem.checkCloudBreach();
            
            // Update seamless background based on player altitude
            this.updateSeamlessBackground();
            
            // Update altitude text every frame for smooth display
            const altitude = Math.round(this.groundLevel - this.player.y);
            this.uiSystem.altitudeText.setText(`Altitude: ${altitude} ft`);
            this.uiSystem.altitudeText.setVisible(true);
            
            // Ensure altitude text stays in correct screen position
            this.uiSystem.altitudeText.setPosition(this.cameras.main.width / 2, 50);
            
            // Debug altitude calculation
            if (this.time.now % 60 === 0) { // Log every 60 frames
                console.log('Altitude Debug:', {
                    groundLevel: this.groundLevel,
                    playerY: this.player.y,
                    altitude: altitude,
                    cameraScrollY: this.cameras.main.scrollY
                });
            }

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

            // Enhanced rotation based on velocity and direction
            this.updatePlayerRotation();

            // Update camera to track player when airborne (but not when landed)
            if (!this.isLanded) {
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
            
            // Apply continuous friction to help control velocity when airborne
            if (this.isAirborne && this.player && this.player.body) {
                // Only apply air resistance after being airborne for a while to prevent launch interference
                const timeAirborne = this.time.now - this.launchTime;
                if (timeAirborne > 1000) { // Wait 1 second after launch before applying air resistance
                    const currentVelX = this.player.body.velocity.x;
                    const currentVelY = this.player.body.velocity.y;
                    
                    // Apply much gentler air resistance (friction) to horizontal movement
                    if (Math.abs(currentVelX) > 500) { // Higher threshold
                        this.player.body.velocity.x *= 0.9995; // Much gentler slowdown
                    }
                    
                    // Apply much gentler air resistance to vertical movement
                    if (Math.abs(currentVelY) > 1000) { // Higher threshold
                        this.player.body.velocity.y *= 0.9998; // Much gentler slowdown
                    }
                }
            }

        } else {
            this.uiSystem.altitudeText.setVisible(false);
            
            // Keep player on platform when not airborne (but not during pulling)
            if (!this.isLanded && !this.isPulling && !this.isAirborne) {
                const platformY = this.groundLevel - 12; // Platform top surface
                const targetY = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                
                // If player is falling, stop them and position on platform
                if (this.player.body.velocity.y > 0) {
                    this.player.body.setVelocityY(0);
                    this.player.y = targetY;
                }
                
                // Show extended launch zone with larger indicator
                this.launchZoneIndicator.clear();
                this.launchZoneIndicator.lineStyle(3, 0x4A90E2, 0.3);
                this.launchZoneIndicator.strokeCircle(this.player.x, this.player.y, 200); // Larger circle
                
                // Add subtle arrow pointing down to indicate pull direction
                this.launchZoneIndicator.lineStyle(2, 0x4A90E2, 0.5);
                this.launchZoneIndicator.lineBetween(this.player.x, this.player.y + 80, this.player.x, this.player.y + 160);
                this.launchZoneIndicator.lineBetween(this.player.x - 15, this.player.y + 140, this.player.x, this.player.y + 160);
                this.launchZoneIndicator.lineBetween(this.player.x + 15, this.player.y + 140, this.player.x, this.player.y + 160);
                
                // Add a subtle outer ring to show maximum pull range
                this.launchZoneIndicator.lineStyle(1, 0x4A90E2, 0.2);
                this.launchZoneIndicator.strokeCircle(this.player.x, this.player.y, 400); // Maximum pull range indicator
            } else {
                this.launchZoneIndicator.clear();
            }
            
            // Additional safety check: if player is not supposed to be airborne but is, fix it
            // But only if we're not currently pulling and the player is actually on the ground
            if (!this.hasBeenLaunched && this.isAirborne && !this.isPulling && this.player.y > this.groundLevel - 50) {
                console.log('Safety check: Resetting unexpected airborne state');
                this.isAirborne = false;
                this.player.body.setVelocityY(0);
                const platformY = this.groundLevel - 12;
                this.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
            }
        }
    }

    handleRocketControls() {
        if (this.upgradeSystem.hasRocket()) {
            const rocketCapabilities = this.upgradeSystem.getRocketCapabilities();
            const thrust = rocketCapabilities.thrust;
            const nudgeThrust = GAME_CONSTANTS.PLAYER.NUDGE_THRUST;
            let fuelConsumed = false;

            // Get joystick direction for mobile controls
            const joystickDirection = this.uiSystem.getJoystickDirection();

            // Handle upward movement (W key or joystick up) - only available in Tier 3
            if ((this.keys.W.isDown || joystickDirection.y < -0.3) && rocketCapabilities.canMoveUp) {
                if (this.fuel > 0) {
                    this.player.body.velocity.y -= thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.y -= nudgeThrust;
                }
            }

            // Handle downward movement (S key or joystick down) - always available with rocket
            if (this.keys.S.isDown || joystickDirection.y > 0.3) {
                if (this.fuel > 0) {
                    this.player.body.velocity.y += thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.y += nudgeThrust;
                }
            }

            // Handle left movement (A key or joystick left) - available in all tiers
            if (this.keys.A.isDown || joystickDirection.x < -0.3) {
                if (this.fuel > 0) {
                    this.player.body.velocity.x -= thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.x -= nudgeThrust;
                }
            }

            // Handle right movement (D key or joystick right) - available in all tiers
            if (this.keys.D.isDown || joystickDirection.x > 0.3) {
                if (this.fuel > 0) {
                    this.player.body.velocity.x += thrust;
                    fuelConsumed = true;
                } else {
                    // Use nudge thrust when out of fuel
                    this.player.body.velocity.x += nudgeThrust;
                }
            }

            if (fuelConsumed) {
                // Apply fuel efficiency from rocket upgrades
                const fuelConsumption = rocketCapabilities.fuelEfficiency || 1.0;
                this.fuel = Math.max(0, this.fuel - fuelConsumption);
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
        console.log('=== HANDLE LANDING CALLED ===');
        console.log('Landing state before:', {
            isAirborne: this.isAirborne,
            isLanded: this.isLanded,
            hasBeenLaunched: this.hasBeenLaunched,
            cloudBreached: this.uiSystem.cloudBreached
        });
        
        this.isAirborne = false;
        this.isLanded = true;

        // Stop camera tracking by resetting cloud breach state
        this.uiSystem.cloudBreached = false;

        // IMMEDIATELY reset camera to default position when landing
        const grassTileHeight = 80;
        const additionalGrassRows = 4;
        const grassBottomEdge = this.groundLevel + (grassTileHeight * additionalGrassRows);
        const properCameraY = grassBottomEdge - this.cameras.main.height;
        
        this.cameras.main.scrollX = 0;
        this.cameras.main.scrollY = properCameraY;
        
        console.log(`Camera immediately reset to default position: scrollX=${this.cameras.main.scrollX}, scrollY=${this.cameras.main.scrollY}`);

        console.log('Landing state after:', {
            isAirborne: this.isAirborne,
            isLanded: this.isLanded,
            cloudBreached: this.uiSystem.cloudBreached
        });

        this.player.body.stop();
        this.player.setAngle(0); // Reset rotation when landing
        this.launchZoneIndicator.clear();
        
        // Hide fuel gauge when landing
        this.uiSystem.hideFuelGauge();
        
        // Hide joystick when landing
        this.uiSystem.hideJoystick();

        const airTime = (this.time.now - this.launchTime) / 1000;
        const distance = Math.max(0, this.startPoint.y - this.peakY);
        const coinsEarned = GAME_CONSTANTS.REWARDS.BASE_COINS + Math.floor(distance / GAME_CONSTANTS.REWARDS.DISTANCE_DIVISOR);

        console.log('Landing results:', {
            airTime: airTime,
            distance: distance,
            coinsEarned: coinsEarned
        });

        this.upgradeSystem.addCoins(coinsEarned);
        this.uiSystem.ui.coinsText.setText(this.upgradeSystem.getCoins());

        this.uiSystem.ui.flightDistanceText.setText(`${Math.round(distance)} ft`);
        this.uiSystem.ui.airTimeText.setText(`${airTime.toFixed(1)}s`);

        // Create brief flight summary overlay
        this.createFlightSummary(airTime, distance, coinsEarned);
        
        // Start Bufo walking back to launch position
        this.startWalkBackAnimation();
    }

    createFlightSummary(airTime, distance, coinsEarned) {
        // Create temporary flight summary that fades away
        const summaryContainer = this.add.container(this.cameras.main.width / 2, 100);
        summaryContainer.setScrollFactor(0); // Fixed to camera
        summaryContainer.setDepth(2000);
        
        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-150, -40, 300, 80, 10);
        bg.lineStyle(2, 0x4A90E2, 0.8);
        bg.strokeRoundedRect(-150, -40, 300, 80, 10);
        
        // Flight stats
        const statsText = this.add.text(0, -10, `${Math.round(distance)} ft • ${airTime.toFixed(1)}s • +${coinsEarned} coins`, {
            fontSize: '20px',
            fill: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        
        summaryContainer.add([bg, statsText]);
        
        // Fade out animation
        this.tweens.add({
            targets: summaryContainer,
            alpha: 0,
            y: 50,
            duration: 3000,
            ease: 'Sine.easeOut',
            onComplete: () => {
                summaryContainer.destroy();
            }
        });
    }

    startWalkBackAnimation() {
        // Calculate the walk path back to launch position
        const startX = this.player.x;
        const startY = this.player.y;
        const targetX = this.initialPlayerPosition.x;
        const targetY = this.initialPlayerPosition.y;
        
        const walkDistance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
        const walkTime = Math.min(3000, Math.max(1000, walkDistance * 2)); // 1-3 seconds based on distance
        
        console.log(`Bufo walking back from (${startX}, ${startY}) to (${targetX}, ${targetY}) over ${walkTime}ms`);
        
        // Change sprite to failed appearance for the walk back
        this.player.setTexture('bufo_failed');
        console.log('Bufo sprite changed to failed appearance for walk back');
        
        // Flip sprite to face the walking direction
        const walkingLeft = startX > targetX; // If current position is to the right of target, walking left
        this.player.setFlipX(!walkingLeft); // Invert the flip logic
        console.log(`Bufo facing ${walkingLeft ? 'left' : 'right'} while walking back`);
        
        // Disable physics during walk
        this.player.body.setEnable(false);
        
        // Create walking animation with slight bobbing
        this.tweens.add({
            targets: this.player,
            x: targetX,
            y: targetY,
            duration: walkTime,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                // Add slight bobbing animation to simulate walking
                const progress = this.tweens.getTweensOf(this.player)[0].progress;
                const bobAmount = Math.sin(progress * Math.PI * 8) * 3; // 8 bobs during walk
                this.player.y = targetY + bobAmount;
            },
            onComplete: () => {
                // Ensure final position is exact
                this.player.setPosition(targetX, targetY);
                
                // Pan camera back to launch position
                this.panCameraToLaunchPosition(() => {
                    // Auto-restart the day after walking back
                    this.restartDay();
                });
            }
        });
        
        // Camera has already been reset to default position in handleLanding()
        // No need to animate camera during walk-back
    }

    panCameraToLaunchPosition(callback) {
        // Reset camera to proper launch position with grass edge at bottom
        const grassTileHeight = 80;
        const additionalGrassRows = 4;
        const grassBottomEdge = this.groundLevel + (grassTileHeight * additionalGrassRows);
        const properCameraY = grassBottomEdge - this.cameras.main.height;
        
        this.cameras.main.scrollX = 0;
        this.cameras.main.scrollY = properCameraY;
        
        console.log(`Camera reset to launch position: scrollX=${this.cameras.main.scrollX}, scrollY=${this.cameras.main.scrollY}`);
        
        if (callback) {
            callback();
        }
    }

    buyUpgrade(key) {
        // Apply upgrade effects to game state (don't purchase again - already done by UI)
        if (key === 'rocket' && this.upgradeSystem.hasRocket()) {
            const rocketCapabilities = this.upgradeSystem.getRocketCapabilities();
            this.maxFuel = rocketCapabilities.fuelCapacity;
            this.fuel = rocketCapabilities.fuelCapacity;
            this.player.setTexture('bufo_rocket');
            
            // Log rocket upgrade information
            console.log(`Rocket upgraded to Level ${rocketCapabilities.level}!`);
            console.log(`Capabilities: Upward movement: ${rocketCapabilities.canMoveUp}, Fuel: ${rocketCapabilities.fuelCapacity}, Thrust: ${rocketCapabilities.thrust}, Efficiency: ${Math.round(rocketCapabilities.fuelEfficiency * 100)}%`);
        }
        
        // Handle non-rocket upgrades (string, frame, spaceShip)
        if (key === 'string' || key === 'frame' || key === 'spaceShip') {
            const upgrade = this.upgradeSystem.upgrades[key];
            console.log(`${upgrade.name} upgraded to Level ${upgrade.level}! New power: ${upgrade.power.toFixed(1)}`);
        }
        
        // Update UI elements to reflect upgrade changes
        this.uiSystem.updateUpgradeUI();
        this.uiSystem.updateLauncherVisualization();
        this.uiSystem.ui.coinsText.setText(this.upgradeSystem.getCoins());
    }

    restartDay() {
        this.dayCount++;
        this.uiSystem.ui.dayCountText.setText(this.dayCount);

        this.objectSpawner.cleanupOldAssets();
        
        // Clear collision cooldowns for fresh collision detection
        this.collisionSystem.clearCooldowns();
        
        // Reset input state to prevent glitch where game launches automatically
        this.input.keyboard.resetKeys();
        // Set a flag to prevent immediate launches after restart
        this.justRestarted = true;
        this.time.delayedCall(500, () => {
            this.justRestarted = false;
            // Show launch readiness indicator after restart delay
            this.uiSystem.showLaunchReadyIndicator();
        });

        this.isLanded = false;
        this.isAirborne = false; // Reset airborne state
        this.isPulling = false; // Reset pulling state
        this.launchCount = 0; // Reset launch count for new day
        this.hasBeenLaunched = false; // Track if player has been properly launched (not just bounced)
        this.uiSystem.ui.launchCountText.setText(this.launchCount);
        this.player.setAngle(0);
        this.player.setTexture(this.upgradeSystem.hasRocket() ? 'bufo_rocket' : 'bufo');
        this.player.setFlipX(false); // Reset sprite flip to face forward
        this.player.setPosition(this.initialPlayerPosition.x, this.initialPlayerPosition.y);

        // Reset camera to proper launch position with grass edge at bottom
        const grassTileHeight = 80;
        const additionalGrassRows = 4;
        const grassBottomEdge = this.groundLevel + (grassTileHeight * additionalGrassRows);
        const properCameraY = grassBottomEdge - this.cameras.main.height;
        this.cameras.main.scrollX = 0;
        this.cameras.main.scrollY = properCameraY;
        console.log(`Camera reset to proper launch position with grass edge at bottom: scrollX=${this.cameras.main.scrollX}, scrollY=${this.cameras.main.scrollY}, groundLevel=${this.groundLevel}, grassBottomEdge=${grassBottomEdge}`);

        // Reset cloud breach state
        this.uiSystem.cloudBreached = false;
        if (this.uiSystem.titleContainer) {
            this.uiSystem.titleContainer.setVisible(true);
        }
        
        // Hide joystick when restarting day
        this.uiSystem.hideJoystick();

        if (this.upgradeSystem.hasRocket()) {
            const rocketCapabilities = this.upgradeSystem.getRocketCapabilities();
            this.maxFuel = rocketCapabilities.fuelCapacity;
            this.fuel = this.maxFuel;
        }

        this.objectSpawner.currentAltitudeZone = null;
        if (this.objectSpawner && typeof this.objectSpawner.spawnObjectsForMultipleZones === 'function') {
            this.objectSpawner.spawnObjectsForMultipleZones();
            this.objectSpawner.spawnClouds();
            this.objectSpawner.spawnCoinsAndGasTanks();
            
            // Re-setup collision detection after spawning new objects
            this.setupCollisionDetection();
        } else {
            console.error('ObjectSpawner or spawnObjectsForMultipleZones method not available during restart');
        }

        // Reset player physics completely
        this.player.body.stop();
        this.player.body.setGravityY(0);
        this.player.body.setVelocity(0, 0);
        this.player.body.setImmovable(false);
        
        // Clear any existing launch lines and indicators
        if (this.launchLine) {
            this.launchLine.clear();
        }
        if (this.launchZoneIndicator) {
            this.launchZoneIndicator.clear();
        }
        
        // Ensure launch line graphics are properly set up
        if (!this.launchLine) {
            this.launchLine = this.add.graphics();
        }
        if (!this.launchZoneIndicator) {
            this.launchZoneIndicator = this.add.graphics();
        }
        
        // Ensure launch lines are visible and on top
        this.launchLine.setDepth(1000);
        this.launchZoneIndicator.setDepth(1000);
        
        // Reset player state for new day
        this.uiSystem.resetPlayerForNewDay();
        
        // Clear debug hitboxes on game reset
        this.uiSystem.clearAllDebugHitboxes();
        
        // Reset position references for pulling
        this.originalPlayerPosition = new Phaser.Math.Vector2(this.initialPlayerPosition.x, this.initialPlayerPosition.y);
        this.startPoint = new Phaser.Math.Vector2(this.initialPlayerPosition.x, this.initialPlayerPosition.y);
        
        console.log('Day restarted! Player state:', {
            isAirborne: this.isAirborne,
            isLanded: this.isLanded,
            isPulling: this.isPulling,
            hasBeenLaunched: this.hasBeenLaunched,
            launchCount: this.launchCount,
            playerX: this.player.x,
            playerY: this.player.y,
            cameraScrollY: this.cameras.main.scrollY
        });
        
        // Update launcher visualization
        this.uiSystem.updateLauncherVisualization();
        
        // Randomize grass for the new day
        this.randomizeGrassForNewDay();
    }

    debugLaunch() {
        console.log('=== DEBUG LAUNCH ACTIVATED ===');
        
        // Calculate test power based on current upgrades
        let testPower = 0;
        let upgradeInfo = [];
        
        for (const key in this.upgradeSystem.upgrades) {
            const upgrade = this.upgradeSystem.upgrades[key];
            
            if (key === 'rocket') {
                // Rocket is a special upgrade with thrust instead of power
                const rocketPower = upgrade.level > 0 ? upgrade.thrust : 0;
                testPower += rocketPower;
                upgradeInfo.push(`${key}: ${rocketPower.toFixed(1)}`);
            } else {
                // Standard upgrades with power and increment
                const halfLevel = Math.ceil(upgrade.maxLevel / 2);
                const powerAtHalf = upgrade.power + ((halfLevel - 1) * upgrade.increment);
                testPower += powerAtHalf;
                upgradeInfo.push(`${key}: ${powerAtHalf.toFixed(1)}`);
            }
        }
        
        console.log('Test power calculation:', upgradeInfo.join(', '));
        console.log('Total test power:', testPower.toFixed(1));
        
        // Safety check for NaN values
        if (isNaN(testPower)) {
            console.warn('Test power is NaN, using default value of 10');
            testPower = 10;
        }

        // Reset game state for test launch
        this.isLanded = false;
        this.isPulling = false;
        this.isAirborne = false;
        
        // Hide UI elements
        this.uiSystem.ui.endOfDayContainer.setVisible(false);
        this.uiSystem.upgradeContainer.setVisible(false);
        
        // Reset player physics and position
        this.player.body.stop();
        this.player.body.setGravityY(GAME_CONSTANTS.GRAVITY); // Use proper falling speed
        this.player.body.setVelocity(0, 0);
        this.player.setPosition(this.initialPlayerPosition.x, this.initialPlayerPosition.y);
        this.player.setAngle(0);
        
        // Reset camera
        this.cameras.main.pan(this.cameras.main.width / 2, this.cameras.main.height / 2, 100, 'Sine.easeInOut');
        
        // Clear any existing launch lines
        if (this.launchLine) {
            this.launchLine.clear();
        }
        if (this.launchZoneIndicator) {
            this.launchZoneIndicator.clear();
        }

        // Apply test launch velocity with multiple test scenarios
        const testScenarios = [
            { name: 'Vertical Launch', x: 0, y: -200 },
            { name: 'Diagonal Launch', x: 50, y: -200 },
            { name: 'High Power Launch', x: 0, y: -300 },
            { name: 'Low Power Launch', x: 0, y: -100 }
        ];
        
        // Cycle through test scenarios based on launch count
        const scenarioIndex = (this.launchCount % testScenarios.length);
        const scenario = testScenarios[scenarioIndex];
        
        const launchVector = new Phaser.Math.Vector2(
            scenario.x * testPower, 
            scenario.y * testPower
        );
        
        console.log(`Test scenario: ${scenario.name}`);
        console.log('Launch velocity:', launchVector.x.toFixed(1), launchVector.y.toFixed(1));
        
        this.player.setVelocity(launchVector.x, launchVector.y);

        // Set airborne state
        this.isAirborne = true;
        console.log('Setting isAirborne = true during debug launch');
        
        // Start launch protection to prevent immediate collisions
        this.collisionSystem.startLaunchProtection(this.player.y);
        
        this.launchTime = this.time.now;
        this.peakY = this.player.y;
        this.launchCount++;
        
        // Update UI
        this.uiSystem.ui.launchCountText.setText(this.launchCount);
        this.uiSystem.ui.flightDistanceText.setText('...');
        this.uiSystem.ui.airTimeText.setText('...');
        
        // Reset fuel if rocket is available
        if (this.upgradeSystem.hasRocket()) {
            this.maxFuel = 100;
            this.fuel = this.maxFuel;
            console.log('Rocket fuel reset to:', this.fuel);
        }
        
        console.log('Debug launch completed!');
        console.log('Player state:', {
            position: { x: this.player.x.toFixed(1), y: this.player.y.toFixed(1) },
            velocity: { x: this.player.body.velocity.x.toFixed(1), y: this.player.body.velocity.y.toFixed(1) },
            isAirborne: this.isAirborne,
            launchCount: this.launchCount
        });
    }

    createSkyLayers() {
        const worldWidth = this.cameras.main.width;
        const groundY = this.groundLevel;
        const worldTopY = GAME_CONSTANTS.WORLD_TOP;

        // Remove old segmented background
        // Create a single smooth vertical gradient background
        this.createSmoothSkyGradient(worldWidth, groundY, worldTopY);

        // Create twinkling stars in the black space area
        this.createTwinklingStars(worldTopY, groundY - 10000);
    }

    createSeamlessBackground() {
        // Create the seamless background with correct bottom-to-top reveal
        this.worldBackground = this.add.image(0, 0, 'world_background');
        this.worldBackground.setOrigin(0, 1); // FIXED: Origin at bottom-left instead of top-left
        this.worldBackground.setDepth(-1000); // Behind everything
        
        // Get the actual background image dimensions
        const bgWidth = this.worldBackground.width;
        const bgHeight = this.worldBackground.height;
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        
        // Scale the background to fit the screen width while maintaining aspect ratio
        const scaleX = screenWidth / bgWidth;
        this.worldBackground.setScale(scaleX, scaleX);
        
        // Calculate the total world height we need to cover
        const worldHeight = Math.abs(GAME_CONSTANTS.WORLD_TOP) + screenHeight;
        
        // If the background is shorter than the world height, we need to repeat it
        const scaledBgHeight = bgHeight * scaleX;
        const repeatCount = Math.ceil(worldHeight / scaledBgHeight);
        
        // Create background sections from bottom to top for correct reveal
        this.backgroundTiles = [];
        
        // FIXED: Position the bottom of the PNG at ground level
        // The bottom of the PNG should be visible at ground level (altitude 0)
        const groundLevelY = this.groundLevel;
        
        // Create bottom section first (ground/launch area) - this shows bottom of PNG
        const bottomTile = this.add.image(0, groundLevelY, 'world_background');
        bottomTile.setOrigin(0, 1); // Origin at bottom-left
        bottomTile.setScale(scaleX, scaleX);
        bottomTile.setDepth(-1000);
        this.backgroundTiles.push(bottomTile);
        
        // Create additional tiles going UPWARD (negative Y) to show top portions of PNG
        for (let i = 1; i < repeatCount; i++) {
            const tile = this.add.image(0, groundLevelY - (i * scaledBgHeight), 'world_background');
            tile.setOrigin(0, 1); // Origin at bottom-left
            tile.setScale(scaleX, scaleX);
            tile.setDepth(-1000);
            
            // Set full alpha immediately - no fade in effect
            tile.setAlpha(1);
            
            this.backgroundTiles.push(tile);
            console.log(`Background section ${i + 1}/${repeatCount} loaded and positioned at Y: ${groundLevelY - (i * scaledBgHeight)}`);
        }
        
        // Store the initial background positioning
        this.initialBackgroundY = groundLevelY;
        
        console.log('Background loading fixed (bottom-to-top reveal):', {
            originalWidth: bgWidth,
            originalHeight: bgHeight,
            screenWidth: screenWidth,
            screenHeight: screenHeight,
            scaleX: scaleX,
            scaledBgHeight: scaledBgHeight,
            worldHeight: worldHeight,
            repeatCount: repeatCount,
            groundLevel: this.groundLevel,
            groundLevelY: groundLevelY,
            bottomTileY: groundLevelY,
            topTileY: groundLevelY - ((repeatCount - 1) * scaledBgHeight)
        });
    }

    updateSeamlessBackground() {
        if (!this.backgroundTiles || !this.player) return;
        
        // Calculate the background position based on player altitude
        const playerAltitude = this.groundLevel - this.player.y;
        const maxAltitude = Math.abs(GAME_CONSTANTS.WORLD_TOP);
        
        // Calculate what portion of the background should be visible (0 = bottom of PNG, 1 = top of PNG)
        const backgroundProgress = Math.max(0, Math.min(1, playerAltitude / maxAltitude));
        const screenHeight = this.cameras.main.height;
        const scaledBgHeight = this.worldBackground.height * this.worldBackground.scaleX;
        
        // FIXED: Simplified scrolling logic since tiles are now positioned correctly
        // At ground level (altitude 0): Bottom PNG is visible, tiles stay at original positions
        // As altitude increases: Background moves with camera to reveal higher portions
        
        // The background tiles are now positioned correctly from the start:
        // - Bottom tile at groundLevel (shows bottom of PNG)
        // - Higher tiles at increasingly negative Y positions (show top portions)
        // They should move naturally with the camera without complex calculations
        
        // Calculate camera-relative positioning
        const cameraY = this.cameras.main.scrollY;
        const baseGroundY = this.groundLevel;
        
        // Update each tile position relative to camera movement
        this.backgroundTiles.forEach((tile, index) => {
            if (tile && tile.active) {
                // Each tile should maintain its relative position to ground level
                // Tile 0 is at groundLevel, Tile 1 is one tile height above, etc.
                const tileBaseY = baseGroundY - (index * scaledBgHeight);
                
                // Keep tiles in their correct positions - they move naturally with world coordinates
                tile.y = tileBaseY;
            }
        });
        
        // Debug scrolling
        if (this.time.now % 120 === 0) { // Log every 120 frames (2 seconds at 60fps)
            console.log('Background scrolling FIXED (bottom-to-top reveal):', {
                totalSections: this.backgroundTiles.length,
                activeSections: this.backgroundTiles.filter(tile => tile && tile.active).length,
                playerAltitude: Math.round(playerAltitude),
                backgroundProgress: Math.round(backgroundProgress * 100) + '%',
                cameraY: Math.round(cameraY),
                groundLevel: this.groundLevel,
                bottomTileY: this.backgroundTiles[0] ? Math.round(this.backgroundTiles[0].y) : 'N/A',
                topTileY: this.backgroundTiles[this.backgroundTiles.length - 1] ? Math.round(this.backgroundTiles[this.backgroundTiles.length - 1].y) : 'N/A'
            });
        }
    }

    createSmoothSkyGradient(worldWidth, groundY, worldTopY) {
        // Define color stops (bottom to top)
        const colorStops = [
            0xFFF8DC, // Cornsilk
            0xFFE4B5, // Moccasin
            0xFFDAB9, // Peach Puff
            0xFFB6C1, // Light Pink
            0xDDA0DD, // Plum
            0x87CEEB, // Sky Blue
            0x191970, // Midnight Blue
            0x000000  // Black
        ];
        const totalHeight = groundY - worldTopY;
        const stripHeight = 4; // px per strip for performance
        const steps = Math.ceil(totalHeight / stripHeight);
        const graphics = this.add.graphics({x: 0, y: worldTopY});
        graphics.setDepth(-2);
        for (let i = 0; i < steps; i++) {
            const y = i * stripHeight;
            const t = y / (totalHeight - 1);
            const scaled = t * (colorStops.length - 1);
            const lower = Math.floor(scaled);
            const upper = Math.ceil(scaled);
            const localT = scaled - lower;
            const c1 = Phaser.Display.Color.ValueToColor(colorStops[lower]);
            const c2 = Phaser.Display.Color.ValueToColor(colorStops[upper]);
            const interp = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 1, 100, localT * 100);
            const color = Phaser.Display.Color.GetColor(interp.r, interp.g, interp.b);
            graphics.fillStyle(color, 1);
            graphics.fillRect(0, y, worldWidth, stripHeight);
        }
    }

    createTwinklingStars(spaceTop, spaceBottom) {
        // Enhanced star system with 4 layers and 205 total stars
        const starLayers = [
            { count: 100, size: 1, alpha: 0.6, speed: 3000 }, // Distant background stars
            { count: 70, size: 2, alpha: 0.8, speed: 2000 },  // Background stars
            { count: 25, size: 3, alpha: 0.9, speed: 1500 },  // Mid stars
            { count: 10, size: 4, alpha: 1.0, speed: 1000 }   // Foreground stars
        ];

        // Enhanced color variation for stars with slight variations
        const starColors = [
            0xFFFFFF, // Pure White
            0xFFFFE0, // Light Yellow
            0xFFFACD, // Lemon Chiffon
            0xF0F8FF, // Alice Blue
            0xE6E6FA, // Lavender
            0xFFF8DC, // Cornsilk
            0xFFF5EE, // Seashell
            0xF0FFFF, // Azure
            0xF5F5DC  // Beige
        ];

        starLayers.forEach((layer, layerIndex) => {
            for (let i = 0; i < layer.count; i++) {
                const star = this.add.graphics();
                
                // Random position in space
                const x = Phaser.Math.Between(0, this.cameras.main.width);
                const y = Phaser.Math.Between(spaceTop, spaceBottom);
                
                // Enhanced color variation for stars
                const starColor = Phaser.Math.RND.pick(starColors);
                
                star.fillStyle(starColor, layer.alpha);
                star.fillCircle(x, y, layer.size);
                
                star.setDepth(-1 + (layerIndex * 0.1)); // Slight depth variation
                
                // Enhanced twinkling animation with improved scaling effects
                this.tweens.add({
                    targets: star,
                    alpha: 0.2,
                    scaleX: 0.6,
                    scaleY: 0.6,
                    duration: layer.speed,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: Phaser.Math.Between(0, layer.speed) // Random start time
                });

                // Add subtle rotation for more dynamic effect
                this.tweens.add({
                    targets: star,
                    angle: 360,
                    duration: layer.speed * 2,
                    ease: 'Linear',
                    repeat: -1,
                    delay: Phaser.Math.Between(0, layer.speed * 2)
                });
            }
        });

        console.log(`Created enhanced star system with ${starLayers.reduce((sum, layer) => sum + layer.count, 0)} total stars across ${starLayers.length} layers`);
    }

    createGrassTexture() {
        // Define grass color themes - each theme has cohesive colors
        const grassThemes = [
            {
                name: 'forest',
                base: 0x228B22,      // Forest green
                dark: 0x1B5E20,      // Dark forest green
                light: 0x32CD32,     // Lime green
                detail: 0x006400     // Dark green details
            },
            {
                name: 'meadow',
                base: 0x2E8B57,      // Sea green
                dark: 0x006400,      // Dark green
                light: 0x90EE90,     // Light green
                detail: 0x228B22     // Medium green details
            },
            {
                name: 'spring',
                base: 0x32CD32,      // Lime green
                dark: 0x228B22,      // Forest green
                light: 0xADFF2F,     // Green yellow
                detail: 0x1B5E20     // Dark green details
            },
            {
                name: 'emerald',
                base: 0x00A86B,      // Emerald green
                dark: 0x006400,      // Dark green
                light: 0x7FFF00,     // Chartreuse
                detail: 0x228B22     // Forest green details
            }
        ];
        
        // Select one random theme for the entire day
        const selectedTheme = Phaser.Math.RND.pick(grassThemes);
        console.log(`Selected grass theme: ${selectedTheme.name}`);
        
        // Create multiple grass variations using the same theme
        const grassVariations = ['grass', 'grass2', 'grass3', 'grass4'];
        
        grassVariations.forEach((textureName, index) => {
            if (!this.textures.exists(textureName)) {
                const graphics = this.add.graphics();
                
                // Create a more detailed grass texture with multiple shades
                const width = 100;
                const height = 64;
                
                // Use the selected theme's base color
                graphics.fillStyle(selectedTheme.base);
                graphics.fillRect(0, 0, width, height);
                
                // Add darker grass patches with more variety (same theme)
                graphics.fillStyle(selectedTheme.dark);
                
                // Vary the number and size of dark patches
                const darkPatchCount = Phaser.Math.Between(6, 12);
                for (let i = 0; i < darkPatchCount; i++) {
                    const x = Phaser.Math.Between(0, width - 15);
                    const y = Phaser.Math.Between(0, height - 15);
                    const size = Phaser.Math.Between(4, 18);
                    const shape = Phaser.Math.Between(0, 2); // 0=rect, 1=circle, 2=ellipse
                    
                    if (shape === 0) {
                        graphics.fillRect(x, y, size, size);
                    } else if (shape === 1) {
                        graphics.fillCircle(x + size/2, y + size/2, size/2);
                    } else {
                        graphics.fillEllipse(x + size/2, y + size/2, size, size * 0.7);
                    }
                }
                
                // Add lighter grass highlights with more variety (same theme)
                graphics.fillStyle(selectedTheme.light);
                
                const lightPatchCount = Phaser.Math.Between(4, 10);
                for (let i = 0; i < lightPatchCount; i++) {
                    const x = Phaser.Math.Between(0, width - 10);
                    const y = Phaser.Math.Between(0, height - 10);
                    const size = Phaser.Math.Between(2, 12);
                    const shape = Phaser.Math.Between(0, 2);
                    
                    if (shape === 0) {
                        graphics.fillRect(x, y, size, size);
                    } else if (shape === 1) {
                        graphics.fillCircle(x + size/2, y + size/2, size/2);
                    } else {
                        graphics.fillEllipse(x + size/2, y + size/2, size, size * 0.6);
                    }
                }
                
                // Add some small detail elements (grass blades, small dots) - same theme
                graphics.fillStyle(selectedTheme.detail);
                const detailCount = Phaser.Math.Between(8, 15);
                for (let i = 0; i < detailCount; i++) {
                    const x = Phaser.Math.Between(0, width - 4);
                    const y = Phaser.Math.Between(0, height - 4);
                    const size = Phaser.Math.Between(1, 3);
                    graphics.fillCircle(x, y, size);
                }
                
                graphics.generateTexture(textureName, width, height);
                graphics.destroy();
            }
        });
    }

    showZoneTransition(zoneName) {
        this.uiSystem.showZoneTransition(zoneName);
    }



    randomizeGrassForNewDay() {
        // Clear existing grass textures to force regeneration
        const grassVariations = ['grass', 'grass2', 'grass3', 'grass4'];
        grassVariations.forEach(textureName => {
            if (this.textures.exists(textureName)) {
                this.textures.remove(textureName);
            }
        });
        
        // Regenerate grass textures with new randomization
        this.createGrassTexture();
        
        // Recreate grass tiles with new textures
        this.uiSystem.recreateGrassTiles();
        
        console.log('Grass randomized for new day!');
    }

    updatePlayerRotation() {
        if (!this.player || !this.isAirborne) return;

        // Simple spinning animation - just rotate continuously
        const spinSpeed = 2; // Degrees per frame
        this.player.angle += spinSpeed;
    }
} 