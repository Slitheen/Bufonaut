import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class UISystem {
    constructor(scene) {
        this.scene = scene;
        this.ui = {};
        this.upgradeContainer = null;
        this.altitudeText = null;
        this.fuelGauge = null;
        this.launcherVisualization = null;
        
        // Joystick system for mobile controls
        this.joystick = null;
        this.joystickBase = null;
        this.joystickThumb = null;
        this.joystickActive = false;
        this.joystickDirection = { x: 0, y: 0 };
        this.joystickRadius = 60;
        this.joystickBaseRadius = 70;
        
        // Debug system
        this.debugMenu = null;
        this.debugHitboxes = {
            bufo: false,
            platform: false,
            balloons: false,
            birds: false,
            clouds: false
        };
        this.debugGraphics = {
            bufo: null,
            platform: null,
            balloons: null,
            birds: null,
            clouds: null
        };
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

        // Stats display with modern styling - moved down to create more launch space
        const labelX = 60;
        const valueX = 360;
        const initialY = 280; // Moved down from 180 to 280
        const stepY = 67;

        // Create stat cards
        this.createStatCard('Launches:', '0', labelX, valueX, initialY);
        this.ui.launchCountText = this.createStatValue('0', valueX, initialY);

        this.createStatCard('Last Flight:', '0 ft', labelX, valueX, initialY + stepY);
        this.ui.flightDistanceText = this.createStatValue('0 ft', valueX, initialY + stepY);

        this.createStatCard('Air Time:', '0.0s', labelX, valueX, initialY + (stepY * 2));
        this.ui.airTimeText = this.createStatValue('0.0s', valueX, initialY + (stepY * 2));

        this.createStatCard('Coins:', '0', labelX, valueX, initialY + (stepY * 3));
        this.ui.coinsText = this.createStatValue('0', valueX, initialY + (stepY * 3));

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
        cardBg.setDepth(2500); // High depth for UI elements
        
        const labelText = this.scene.add.text(labelX, y, label, { 
            fontSize: GAME_CONSTANTS.UI_SCALE.STAT_FONT,
            fill: UI_THEME.textSecondary,
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0, 0.5);
        labelText.setDepth(2501); // Higher than background
    }

    createStatValue(value, x, y) {
        const text = this.scene.add.text(x, y, value, { 
            fontSize: GAME_CONSTANTS.UI_SCALE.STAT_FONT,
            fill: UI_THEME.text,
            fontFamily: 'Arial, sans-serif',
            stroke: UI_THEME.primary,
            strokeThickness: 1
        }).setOrigin(0, 0.5);
        text.setDepth(2501); // High depth for UI text
        return text;
    }

    createGameplayArea() {
        // This area is intentionally clean for gameplay
        const ground = this.scene.physics.add.staticGroup();
        ground.create(this.scene.cameras.main.width / 2, this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2))
            .setSize(this.scene.cameras.main.width, GAME_CONSTANTS.GROUND_HEIGHT)
            .setVisible(false);

        // Create the visual tiled sprite for the grass (main row) with random variation
        const grassVariations = ['grass', 'grass2', 'grass3', 'grass4'];
        const mainGrassTexture = Phaser.Math.RND.pick(grassVariations);
        
        // Initialize grass tiles array
        this.grassTiles = [];
        
        const mainGrassTile = this.scene.add.tileSprite(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2),
            this.scene.cameras.main.width,
            GAME_CONSTANTS.GROUND_HEIGHT,
            mainGrassTexture
        );
        this.grassTiles.push(mainGrassTile);
        
        // Create multiple additional rows of grass tiles for extended pull range
        const grassTileHeight = 60; // Height of each grass tile
        
        // Add 3 additional rows of grass tiles to extend the pullable area (4 total rows including main ground)
        for (let i = 1; i <= 3; i++) { // Add 3 additional rows
            const additionalGrassY = this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2) - (grassTileHeight * i);
            
            // Use random grass variation for each row to create more natural variation
            const randomGrassTexture = Phaser.Math.RND.pick(grassVariations);
            
            const grassTile = this.scene.add.tileSprite(
                this.scene.cameras.main.width / 2,
                additionalGrassY,
                this.scene.cameras.main.width,
                grassTileHeight,
                randomGrassTexture
            );
            this.grassTiles.push(grassTile);
        }

        // Create launcher platform
        this.createLauncherPlatform();
        
        // Create the player (only if not already created)
        if (!this.scene.player) {
            const startX = this.scene.cameras.main.width / 2;
            // Position player on top of the launcher platform
            const startY = this.scene.groundLevel - GAME_CONSTANTS.PLAYER.SIZE / 2 - 25; // On top of platform (platform height)
            this.scene.initialPlayerPosition = new Phaser.Math.Vector2(startX, startY);
            const playerTexture = this.scene.upgradeSystem.hasRocket() ? 'bufo_rocket' : 'bufo';
            this.scene.player = this.scene.physics.add.sprite(startX, startY, playerTexture)
                .setOrigin(0.5, 0.5)
                .setDisplaySize(GAME_CONSTANTS.PLAYER.SIZE, GAME_CONSTANTS.PLAYER.SIZE)
                .setCollideWorldBounds(true)
                .refreshBody()
                .setDepth(500) // Higher than launcher (400)
                .setInteractive(); // Make player interactive for clicking
            this.scene.player.setCircle(this.scene.player.width / 2);
            
            // Disable gravity initially to prevent falling
            this.scene.player.body.setGravityY(0);
            this.scene.player.body.setVelocity(0, 0);

            // Setup ground collision
            this.scene.physics.add.collider(this.scene.player, ground, () => this.scene.collisionSystem.onPlayerLand(), null, this.scene);
            
            // Setup platform collision
            if (this.platformBody) {
                // Add collision cooldown and state tracking to prevent spam
                let lastCollisionTime = 0;
                let collisionCount = 0;
                let lastVelocityY = 0;
                const collisionCooldown = 200; // Increased to 200ms cooldown
                const maxCollisions = 5; // Max collisions before forcing stabilization
                
                this.scene.physics.add.collider(this.scene.player, this.platformBody, () => {
                    const now = Date.now();
                    const currentVelocityY = this.scene.player.body.velocity.y;
                    const currentVelocityX = this.scene.player.body.velocity.x;
                    
                    // Skip if too soon since last collision
                    if (now - lastCollisionTime < collisionCooldown) {
                        return;
                    }
                    
                    // Track collision patterns
                    if (Math.abs(currentVelocityY - lastVelocityY) < 1) {
                        collisionCount++;
                    } else {
                        collisionCount = 0;
                    }
                    lastVelocityY = currentVelocityY;
                    lastCollisionTime = now;
                    
                    // Don't interfere if player is pulling or if we just restarted the day
                    if (this.scene.isPulling || this.scene.isLanded) {
                        return;
                    }
                    
                    // Check if player is actually on the platform (very small velocities and near platform)
                    const isOnPlatform = Math.abs(currentVelocityY) < 2 && 
                                       Math.abs(currentVelocityX) < 2 && 
                                       this.scene.player.y > this.scene.groundLevel - 25;
                    
                    // If player is marked as airborne but actually on platform, reset their state
                    if (this.scene.isAirborne && isOnPlatform) {
                        console.log('Player marked as airborne but actually on platform - resetting state');
                        this.scene.isAirborne = false;
                        this.scene.hasBeenLaunched = false;
                        this.scene.player.body.setVelocity(0, 0);
                        this.scene.player.body.setGravityY(0); // Disable gravity
                        const platformY = this.scene.groundLevel - 12;
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                        this.scene.player.setAngle(0);
                        collisionCount = 0;
                        return;
                    }
                    
                    // If player is clearly on the platform and not moving, don't process collision
                    if (isOnPlatform && !this.scene.isAirborne && !this.scene.isPulling) {
                        // Player is stable on platform, no need to process collision
                        return;
                    }
                    
                    // Only log meaningful collisions or when we need to force stabilization
                    const isSignificantCollision = this.scene.isAirborne || 
                                                  Math.abs(currentVelocityY) > 10 ||
                                                  Math.abs(currentVelocityX) > 10 ||
                                                  collisionCount >= maxCollisions;
                    
                    if (isSignificantCollision) {
                        console.log('Platform collision:', {
                            isPulling: this.scene.isPulling,
                            isAirborne: this.scene.isAirborne,
                            hasBeenLaunched: this.scene.hasBeenLaunched,
                            velocityY: currentVelocityY.toFixed(2),
                            velocityX: currentVelocityX.toFixed(2),
                            collisionCount: collisionCount,
                            isOnPlatform: isOnPlatform
                        });
                    }
                    
                    // Force stabilization if too many similar collisions
                    if (collisionCount >= maxCollisions) {
                        console.log('Forcing stabilization due to collision spam');
                        this.scene.player.body.setVelocityX(0);
                        this.scene.player.body.setVelocityY(0);
                        const platformY = this.scene.groundLevel - 12;
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                        // Reset airborne state if we're forcing stabilization
                        this.scene.isAirborne = false;
                        this.scene.hasBeenLaunched = false;
                        this.scene.player.body.setGravityY(0);
                        collisionCount = 0;
                        return;
                    }
                    
                    // If player is airborne and has been properly launched and is falling with significant velocity, end the game
                    if (this.scene.isAirborne && this.scene.hasBeenLaunched && currentVelocityY > 5) {
                        console.log('Proper landing detected - ending game');
                        this.scene.handleLanding();
                    } else if (this.scene.isAirborne && !this.scene.hasBeenLaunched) {
                        // Underpowered launch - reset player for relaunch
                        console.log('Underpowered launch detected - resetting for relaunch');
                        this.scene.isAirborne = false;
                        this.scene.hasBeenLaunched = false;
                        this.scene.player.body.setVelocityY(0);
                        this.scene.player.body.setVelocityX(0);
                        this.scene.player.body.setGravityY(0); // Disable gravity for relaunch
                        const platformY = this.scene.groundLevel - 12;
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                        this.scene.player.setAngle(0);
                        collisionCount = 0;
                    } else if (currentVelocityY > 5 && !this.scene.isPulling) {
                        // Just stop falling and position on platform if not a real landing and not pulling
                        this.scene.player.body.setVelocityY(0);
                        this.scene.player.body.setVelocityX(0); // Stop horizontal movement too
                        const platformY = this.scene.groundLevel - 12; // Platform top surface
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x; // Keep centered
                        collisionCount = 0;
                    } else if (currentVelocityY < -5 && this.scene.player.y > this.scene.groundLevel - 20 && !this.scene.isPulling) {
                        // If player is moving upward but still near platform, stop them (but not during pulling)
                        this.scene.player.body.setVelocityY(0);
                        this.scene.player.body.setVelocityX(0);
                        const platformY = this.scene.groundLevel - 12;
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                        collisionCount = 0;
                    } else if (Math.abs(currentVelocityX) > 0.1 && this.scene.player.y > this.scene.groundLevel - 25 && !this.scene.isPulling) {
                        // If player is sliding horizontally near platform, stop them immediately (but not during pulling)
                        this.scene.player.body.setVelocityX(0);
                        this.scene.player.body.setVelocityY(0);
                        const platformY = this.scene.groundLevel - 12;
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                        collisionCount = 0;
                    } else if (Math.abs(currentVelocityY) < 5 && this.scene.player.y > this.scene.groundLevel - 25 && !this.scene.isPulling) {
                        // If player is stuck with very small velocity near platform, stabilize them
                        this.scene.player.body.setVelocityX(0);
                        this.scene.player.body.setVelocityY(0);
                        const platformY = this.scene.groundLevel - 12;
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                        collisionCount = 0;
                    }
                }, null, this.scene);
            }
            
            // Force player to stay on platform initially
            this.scene.time.delayedCall(50, () => {
                if (this.scene.player) {
                    // Ensure player is positioned correctly on platform
                    const platformY = this.scene.groundLevel - 12; // Platform top surface
                    this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                    this.scene.player.body.setVelocity(0, 0);
                }
            });
            
            // Re-enable gravity after a short delay to allow for launching
            this.scene.time.delayedCall(200, () => {
                if (this.scene.player) {
                    this.scene.player.body.setGravityY(300); // Re-enable gravity
                }
            });
        }
        
        // Create launcher visualization
        this.createLauncherVisualization();
    }

    resetPlayerForNewDay() {
        // Reset player state for a new day
        if (this.scene.player) {
            // Clear any existing launch lines immediately
            if (this.scene.launchLine) {
                this.scene.launchLine.clear();
            }
            if (this.scene.launchZoneIndicator) {
                this.scene.launchZoneIndicator.clear();
            }
            
            // Re-enable physics body and keep gravity disabled until launch
            this.scene.player.body.setEnable(true);
            this.scene.player.body.setGravityY(0);
            this.scene.player.body.setVelocity(0, 0);
            
            // Position player correctly on platform
            const platformY = this.scene.groundLevel - 12; // Platform top surface
            this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
            this.scene.player.x = this.scene.initialPlayerPosition.x;
            
            // Allow interaction but prevent physics movement
            this.scene.player.body.setImmovable(false); // Allow interaction
            this.scene.player.body.setBounce(0, 0);
            this.scene.player.body.setFriction(0.95); // High friction when on ground
            
            // Continuous position stabilization for the first few frames
            let stabilizationCount = 0;
            const maxStabilizationFrames = 10;
            
            const stabilizePosition = () => {
                if (this.scene.player && !this.scene.isAirborne && !this.scene.isPulling && stabilizationCount < maxStabilizationFrames) {
                    this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                    this.scene.player.x = this.scene.initialPlayerPosition.x;
                    this.scene.player.body.setVelocity(0, 0);
                    stabilizationCount++;
                    
                    if (stabilizationCount < maxStabilizationFrames) {
                        this.scene.time.delayedCall(16, stabilizePosition);
                    }
                }
            };
            
            stabilizePosition();
            
            // Add continuous movement prevention for a longer period
            this.scene.time.delayedCall(500, () => {
                if (this.scene.player && !this.scene.isAirborne && !this.scene.isPulling) {
                    // Set up a continuous check to prevent sliding
                                const preventSliding = () => {
                if (this.scene.player && !this.scene.isAirborne && !this.scene.isPulling) {
                    // If player is moving horizontally, stop them
                    if (Math.abs(this.scene.player.body.velocity.x) > 0.1) {
                        this.scene.player.body.setVelocityX(0);
                        this.scene.player.x = this.scene.initialPlayerPosition.x;
                    }
                    // If player is moving vertically, stop them
                    if (Math.abs(this.scene.player.body.velocity.y) > 0.1) {
                        this.scene.player.body.setVelocityY(0);
                        this.scene.player.y = platformY - GAME_CONSTANTS.PLAYER.SIZE / 2;
                    }
                    // Continue checking only if not pulling
                    if (!this.scene.isPulling) {
                        this.scene.time.delayedCall(32, preventSliding);
                    }
                }
            };
                    preventSliding();
                }
            });
            
            // Add a visual indicator that player is ready (temporary)
            this.scene.time.delayedCall(500, () => {
                if (this.scene.player && !this.scene.isAirborne && !this.scene.isLanded) {
                    // Add a subtle glow effect to show player is ready
                    this.scene.tweens.add({
                        targets: this.scene.player,
                        alpha: 0.8,
                        duration: 300,
                        ease: 'Sine.easeInOut',
                        yoyo: true,
                        repeat: 1
                    });
                }
            });
            
            console.log('Player reset - gravity disabled, positioned on platform, interaction enabled');
        }
    }

    createLauncherPlatform() {
        const platformWidth = 180; // Wider platform
        const platformHeight = 25; // Slightly taller
        const platformX = this.scene.cameras.main.width / 2;
        const platformY = this.scene.groundLevel - platformHeight/2; // Position at ground level
        
        // Create platform container
        this.launcherPlatform = this.scene.add.container(platformX, platformY);
        
        // Main platform base (dark steel)
        const base = this.scene.add.graphics()
            .fillStyle(0x2C3E50, 0.9) // Dark steel color
            .fillRoundedRect(-platformWidth/2, -platformHeight/2, platformWidth, platformHeight, 8)
            .lineStyle(2, 0x34495E, 0.8) // Slightly lighter border
            .strokeRoundedRect(-platformWidth/2, -platformHeight/2, platformWidth, platformHeight, 8);
        
        // Platform top surface (lighter steel)
        const surface = this.scene.add.graphics()
            .fillStyle(0x34495E, 0.7) // Lighter steel for top surface
            .fillRoundedRect(-platformWidth/2 + 4, -platformHeight/2 + 2, platformWidth - 8, platformHeight - 4, 6);
        
        // Add metallic details - rivets
        const rivets = [];
        const rivetCount = 6;
        for (let i = 0; i < rivetCount; i++) {
            const rivetX = (-platformWidth/2 + 15) + (i * (platformWidth - 30) / (rivetCount - 1));
            const rivet = this.scene.add.graphics()
                .fillStyle(0x95A5A6, 0.8) // Silver rivet color
                .fillCircle(rivetX, 0, 3)
                .lineStyle(1, 0x7F8C8D, 0.9)
                .strokeCircle(rivetX, 0, 3);
            rivets.push(rivet);
        }
        
        // Add support beams underneath
        const supportBeams = [];
        const beamCount = 3;
        for (let i = 0; i < beamCount; i++) {
            const beamX = (-platformWidth/2 + 20) + (i * (platformWidth - 40) / (beamCount - 1));
            const beam = this.scene.add.graphics()
                .fillStyle(0x2C3E50, 0.8) // Dark steel for beams
                .fillRect(beamX - 3, platformHeight/2, 6, 15)
                .lineStyle(1, 0x34495E, 0.9)
                .strokeRect(beamX - 3, platformHeight/2, 6, 15);
            supportBeams.push(beam);
        }
        
        // Add subtle shadow underneath
        const shadow = this.scene.add.graphics()
            .fillStyle(0x000000, 0.3)
            .fillEllipse(0, platformHeight/2 + 20, platformWidth + 10, 10);
        
        // Add all elements to platform container
        this.launcherPlatform.add([base, surface, shadow, ...rivets, ...supportBeams]);
        
        // Set depth to be below player but above ground
        this.launcherPlatform.setDepth(300);
        
        // Create physics body for the platform so player can stand on it
        const platformBody = this.scene.physics.add.staticGroup();
        const platformCollider = platformBody.create(platformX, platformY, null)
            .setSize(platformWidth, platformHeight + 15) // Larger collision area for consistent platform effect
            .setVisible(false);
        
        // Store reference to platform body for collision setup
        this.platformBody = platformBody;
        
        // Add subtle hover effect
        this.scene.tweens.add({
            targets: this.launcherPlatform,
            y: platformY - 2,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    createActionPanel() {
        // Bottom area for any action buttons (currently empty)
    }

    createFloatingUI() {
        // Create UI containers (initially hidden)
        this.ui.endOfDayContainer = this.createEndOfDayUI();
        this.createUpgradeUI();

        // Create altitude display - positioned in world space to follow camera
        this.altitudeText = this.scene.add.text(this.scene.cameras.main.width / 2, 50, 'Altitude: 0 ft', {
            fontSize: GAME_CONSTANTS.UI_SCALE.ALTITUDE_FONT,
            fill: UI_THEME.text,
            fontFamily: 'Arial, sans-serif',
            stroke: UI_THEME.primary,
            strokeThickness: 2
        }).setOrigin(0.5, 0).setVisible(false).setScrollFactor(0); // Fixed to camera
        this.altitudeText.setDepth(2501); // High depth for UI text

        // Create fuel gauge
        this.createFuelGauge();

        // Create joystick for mobile controls
        this.createJoystick();

        // Setup slingshot inputs
        this.scene.launchLine = this.scene.add.graphics();
        this.scene.launchZoneIndicator = this.scene.add.graphics();
        
        // Ensure launch lines are visible and on top
        this.scene.launchLine.setDepth(1000);
        this.scene.launchZoneIndicator.setDepth(1000);
        
        // Remove any existing input listeners to prevent duplicates
        this.scene.input.off('pointerdown');
        this.scene.input.off('pointermove');
        this.scene.input.off('pointerup');

        // Listen for a click or touch anywhere on the game screen
        this.scene.input.on('pointerdown', (pointer) => {
            if (!this.scene.isAirborne && !this.scene.isLanded && !this.scene.isPulling) {
                console.log('Starting pull!');
                this.scene.isPulling = true;

                // Completely disable physics during pulling to prevent any interference
                this.scene.player.body.setEnable(false); // Disable the entire physics body
                
                this.scene.startPoint = new Phaser.Math.Vector2(this.scene.player.x, this.scene.player.y);
                this.scene.originalPlayerPosition = new Phaser.Math.Vector2(this.scene.player.x, this.scene.player.y);
            }
        });

        // Listen for WASD keys for rocket controls
        this.scene.keys = this.scene.input.keyboard.addKeys('W,A,S,D');

        // Handle mouse movement during pulling
        this.scene.input.on('pointermove', (pointer) => {
            if (this.scene.isPulling && this.scene.originalPlayerPosition) {
                console.log('Pointer move - pulling:', {
                    pointerX: pointer.x,
                    pointerY: pointer.y,
                    playerX: this.scene.player.x,
                    playerY: this.scene.player.y,
                    velocityX: this.scene.player.body.velocity.x,
                    velocityY: this.scene.player.body.velocity.y,
                    gravityY: this.scene.player.body.gravity.y
                });
                
                // Calculate pull distance and direction
                const pullVector = new Phaser.Math.Vector2(
                    pointer.x - this.scene.originalPlayerPosition.x,
                    pointer.y - this.scene.originalPlayerPosition.y
                );
                
                // Allow much longer pull distance for extended range
                const maxPullDistance = 800; // Increased from 150 to 800 for much longer pulls
                const pullDistance = Math.min(pullVector.length(), maxPullDistance);
                const normalizedPull = pullVector.normalize().scale(pullDistance);
                
                // Calculate target position
                const targetX = this.scene.originalPlayerPosition.x + normalizedPull.x;
                const targetY = this.scene.originalPlayerPosition.y + normalizedPull.y;
                
                // Direct movement for immediate response - no smoothing that creates resistance
                this.scene.player.x = targetX;
                this.scene.player.y = targetY;
                
                // Update start point for launch calculation
                this.scene.startPoint = new Phaser.Math.Vector2(this.scene.player.x, this.scene.player.y);
            }
        });

        this.scene.input.on('pointerup', (pointer) => {
            if (this.scene.isPulling) {
                console.log('Launching!');
                this.scene.isPulling = false;
                this.scene.launchLine.clear();
                this.scene.launchZoneIndicator.clear();
                
                // Calculate pull vector before returning player to original position
                const pullVector = this.scene.originalPlayerPosition.clone().subtract(this.scene.startPoint);
                
                // Return player to original position for launch
                if (this.scene.originalPlayerPosition) {
                    this.scene.player.x = this.scene.originalPlayerPosition.x;
                    this.scene.player.y = this.scene.originalPlayerPosition.y;
                }
                const pullDistance = pullVector.length();
                const currentLaunchPower = this.scene.upgradeSystem.getTotalLaunchPower();

                // Check if pull distance is too small or if we just restarted
                const minPullDistance = 10; // Minimum pixels to move
                console.log('Launch attempt:', {
                    pullDistance: pullDistance,
                    justRestarted: this.scene.justRestarted,
                    dayCount: this.scene.dayCount,
                    isAirborne: this.scene.isAirborne,
                    hasBeenLaunched: this.scene.hasBeenLaunched
                });
                
                if (pullDistance < minPullDistance || this.scene.justRestarted) {
                    if (this.scene.justRestarted) {
                        console.log('Launch prevented - just restarted the day');
                    } else {
                        console.log('Pull distance too small, canceling launch:', pullDistance);
                        
                        // Add visual feedback to show pull was too small
                        const feedbackText = this.scene.add.text(this.scene.player.x, this.scene.player.y - 50, 'Pull further!', {
                            fontSize: '16px',
                            fill: '#FF6B6B',
                            stroke: '#000',
                            strokeThickness: 2
                        }).setOrigin(0.5);
                        feedbackText.setDepth(2501); // High depth for UI text
                        
                        // Animate the feedback text
                        this.scene.tweens.add({
                            targets: feedbackText,
                            y: feedbackText.y - 30,
                            alpha: 0,
                            duration: 1000,
                            ease: 'Power2',
                            onComplete: () => feedbackText.destroy()
                        });
                    }
                    
                    return; // Don't launch if player didn't move enough or just restarted
                }

                // Re-enable physics and set up for launch
                this.scene.player.body.setEnable(true); // Re-enable the physics body
                this.scene.player.body.setGravityY(300);
                this.scene.player.body.setBounce(0.1, 0.1);
                this.scene.player.body.setFriction(0.1);
                
                // Calculate launch velocity with smoothing
                const launchVelocityX = pullVector.x * currentLaunchPower;
                const launchVelocityY = pullVector.y * currentLaunchPower;
                
                // Apply velocity smoothly - use a small delay to prevent jitter
                this.scene.time.delayedCall(16, () => {
                    this.scene.player.body.setVelocity(launchVelocityX, launchVelocityY);
                    
                    // Set airborne state after velocity is applied
                    this.scene.isAirborne = true;
                    this.scene.hasBeenLaunched = true; // Mark as properly launched
                    this.scene.launchTime = this.scene.time.now;
                    this.scene.peakY = this.scene.player.y;
                    this.scene.launchCount++;
                    this.ui.launchCountText.setText(this.scene.launchCount);
                    this.ui.flightDistanceText.setText('...');
                    this.ui.airTimeText.setText('...');
                    
                    // Add friction to help control velocity when airborne
                    this.scene.player.body.setFriction(0.9);
                    
                    // Show joystick if rocket is available
                    if (this.scene.upgradeSystem.hasRocket()) {
                        this.showJoystick();
                    }
                    
                    console.log('=== LAUNCH SUCCESSFUL ===');
                    console.log('Launch state set:', {
                        isAirborne: this.scene.isAirborne,
                        hasBeenLaunched: this.scene.hasBeenLaunched,
                        launchCount: this.scene.launchCount,
                        peakY: this.scene.peakY
                    });
                    
                    console.log('Launch successful!', {
                        velocityX: launchVelocityX,
                        velocityY: launchVelocityY,
                        power: currentLaunchPower,
                        pullDistance: pullDistance
                    });
                });
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

        const f4Key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
        f4Key.on('down', () => this.scene.debugLaunch());

        const f9Key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
        f9Key.on('down', () => {
                    this.scene.upgradeSystem.addCoins(500);
        this.ui.coinsText.setText(this.scene.upgradeSystem.getCoins());
        console.log(`Admin: Added 500 coins. Total: ${this.scene.upgradeSystem.getCoins()}`);
        });

        // Debug menu system
        this.createDebugMenu();
        
        // Debug menu toggle
        const f3Key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
        f3Key.on('down', () => {
            console.log('F3 key pressed!');
            this.toggleDebugMenu();
        });
    }

    createJoystick() {
        // Only create joystick on mobile devices or touch-enabled devices
        if (!this.scene.sys.game.device.touch) {
            return;
        }

        const joystickX = 120;
        const joystickY = this.scene.cameras.main.height - 120;

        // Create joystick base (outer circle)
        this.joystickBase = this.scene.add.circle(joystickX, joystickY, this.joystickBaseRadius, 0x34495e, 0.3);
        this.joystickBase.setStrokeStyle(2, 0x4A90E2, 0.6);
        this.joystickBase.setDepth(1000);

        // Create joystick thumb (inner circle)
        this.joystickThumb = this.scene.add.circle(joystickX, joystickY, this.joystickRadius, 0x4A90E2, 0.8);
        this.joystickThumb.setStrokeStyle(2, 0xFFFFFF, 0.9);
        this.joystickThumb.setDepth(1001);

        // Make joystick interactive
        this.joystickThumb.setInteractive();
        this.joystickBase.setInteractive();

        // Store initial position
        this.joystickInitialX = joystickX;
        this.joystickInitialY = joystickY;

        // Add touch events with proper event handling
        this.scene.input.on('pointerdown', this.onJoystickPointerDown, this);
        this.scene.input.on('pointermove', this.onJoystickPointerMove, this);
        this.scene.input.on('pointerup', this.onJoystickPointerUp, this);

        // Initially hide joystick until rocket is available
        this.joystickBase.setVisible(false);
        this.joystickThumb.setVisible(false);
    }

    onJoystickPointerDown(pointer) {
        // Only activate if rocket is available and player is airborne
        if (!this.scene.upgradeSystem.hasRocket() || !this.scene.isAirborne) {
            return;
        }

        // Check if pointer is near joystick area
        const distance = Phaser.Math.Distance.Between(
            pointer.x, pointer.y,
            this.joystickInitialX, this.joystickInitialY
        );

        if (distance <= this.joystickBaseRadius + 20) {
            this.joystickActive = true;
            this.updateJoystickPosition(pointer.x, pointer.y);
            // Stop event propagation to prevent slingshot activation
            pointer.event.stopPropagation();
        }
    }

    onJoystickPointerMove(pointer) {
        if (!this.joystickActive) {
            return;
        }

        this.updateJoystickPosition(pointer.x, pointer.y);
        // Stop event propagation to prevent slingshot interference
        pointer.event.stopPropagation();
    }

    onJoystickPointerUp(pointer) {
        if (!this.joystickActive) {
            return;
        }

        this.joystickActive = false;
        this.joystickDirection = { x: 0, y: 0 };
        
        // Reset joystick thumb to center
        this.joystickThumb.setPosition(this.joystickInitialX, this.joystickInitialY);
        // Stop event propagation to prevent slingshot activation
        pointer.event.stopPropagation();
    }

    updateJoystickPosition(pointerX, pointerY) {
        // Calculate distance from center
        const deltaX = pointerX - this.joystickInitialX;
        const deltaY = pointerY - this.joystickInitialY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Limit movement to joystick radius
        if (distance > this.joystickRadius) {
            const angle = Math.atan2(deltaY, deltaX);
            const limitedX = this.joystickInitialX + Math.cos(angle) * this.joystickRadius;
            const limitedY = this.joystickInitialY + Math.sin(angle) * this.joystickRadius;
            this.joystickThumb.setPosition(limitedX, limitedY);
            
            // Normalize direction vector
            this.joystickDirection.x = Math.cos(angle);
            this.joystickDirection.y = Math.sin(angle);
        } else {
            this.joystickThumb.setPosition(pointerX, pointerY);
            
            // Normalize direction vector
            this.joystickDirection.x = deltaX / this.joystickRadius;
            this.joystickDirection.y = deltaY / this.joystickRadius;
        }
    }

    showJoystick() {
        if (this.joystickBase && this.joystickThumb) {
            this.joystickBase.setVisible(true);
            this.joystickThumb.setVisible(true);
        }
    }

    hideJoystick() {
        if (this.joystickBase && this.joystickThumb) {
            this.joystickBase.setVisible(false);
            this.joystickThumb.setVisible(false);
        }
    }

    getJoystickDirection() {
        return this.joystickDirection;
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
        // Create a professional metal slingshot to match the platform
        const slingshotWidth = 140; // Wider to match platform
        const slingshotHeight = 180; // Increased height by half (was 120)
        
        // Left support post (professional metal)
        const leftPost = this.scene.add.graphics()
            .fillStyle(0x2C3E50, 0.9) // Dark steel base
            .fillRect(-slingshotWidth/2 - 10, -slingshotHeight/2, 20, slingshotHeight)
            .lineStyle(2, 0x34495E, 0.8) // Lighter steel border
            .strokeRect(-slingshotWidth/2 - 10, -slingshotHeight/2, 20, slingshotHeight);
        
        // Right support post (professional metal)
        const rightPost = this.scene.add.graphics()
            .fillStyle(0x2C3E50, 0.9) // Dark steel base
            .fillRect(slingshotWidth/2 - 10, -slingshotHeight/2, 20, slingshotHeight)
            .lineStyle(2, 0x34495E, 0.8) // Lighter steel border
            .strokeRect(slingshotWidth/2 - 10, -slingshotHeight/2, 20, slingshotHeight);
        
        // Top crossbar (professional metal)
        const crossbar = this.scene.add.graphics()
            .fillStyle(0x2C3E50, 0.9) // Dark steel base
            .fillRect(-slingshotWidth/2, -slingshotHeight/2 - 12, slingshotWidth, 24)
            .lineStyle(2, 0x34495E, 0.8) // Lighter steel border
            .strokeRect(-slingshotWidth/2, -slingshotHeight/2 - 12, slingshotWidth, 24);
        
        // Add metallic details - rivets on crossbar
        const rivetCount = 4;
        for (let i = 0; i < rivetCount; i++) {
            const rivetX = (-slingshotWidth/2 + 20) + (i * (slingshotWidth - 40) / (rivetCount - 1));
            const rivet = this.scene.add.graphics()
                .fillStyle(0x95A5A6, 0.8) // Silver rivet color
                .fillCircle(rivetX, -slingshotHeight/2 - 6, 4)
                .lineStyle(1, 0x7F8C8D, 0.9)
                .strokeCircle(rivetX, -slingshotHeight/2 - 6, 4);
            upgradeElements.push(rivet);
        }
        
        // No rubber bands - will be drawn dynamically during pulling
        upgradeElements.push(leftPost, rightPost, crossbar);
    }

    createCloudTitle() {
        // Create title container - moved down slightly for more launch space
        this.titleContainer = this.scene.add.container(this.scene.cameras.main.width / 2, 120);
        
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
        
        // Set the title container to not scroll with camera initially
        this.titleContainer.setScrollFactor(0, 0);
        this.titleContainer.setDepth(2500); // High depth for UI elements
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
        // Camera overlay functionality can be added here if needed
        // Removed old altitude text that was positioned in top right
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

    hideFuelGauge() {
        if (this.fuelGauge) {
            this.fuelGauge.setVisible(false);
        }
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
        
        const coinsEarnedText = this.scene.add.text(0, -60, '', { 
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

        const container = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2, [box, dayFailedText, coinsEarnedText, upgradeButton, nextDayButton]);
        dayFailedText.setName('dayFailedText');
        coinsEarnedText.setName('coinsEarnedText');
        container.setVisible(false);
        container.setDepth(3000); // High depth to ensure it's above all game objects
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

        const closeButton = this.createModernButton(0, 280, 'Close', () => {
            this.upgradeContainer.setVisible(false);
            this.ui.endOfDayContainer.setVisible(true);
        }, 'danger');
        elements.push(closeButton);

        this.upgradeContainer = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2, elements);
        this.upgradeContainer.setVisible(false);
        this.upgradeContainer.setDepth(3000); // High depth to ensure it's above all game objects
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
                
                if (this.scene.upgradeSystem.getCoins() >= upgrade.cost) {
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
        // Create zone transition UI
        const transitionContainer = this.scene.add.container(this.scene.cameras.main.width / 2, 100);
        transitionContainer.setDepth(2500);
        
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-150, -30, 300, 60, 15);
        
        const text = this.scene.add.text(0, 0, `Entering ${zoneName}`, {
            fontSize: '24px',
            fill: '#4A90E2',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        transitionContainer.add([bg, text]);
        
        // Animate the transition
        transitionContainer.setAlpha(0);
        this.scene.tweens.add({
            targets: transitionContainer,
            alpha: 1,
            duration: 300,
            ease: 'Power2',
            yoyo: true,
            hold: 1500,
            onComplete: () => transitionContainer.destroy()
        });
    }

    showLaunchReadyIndicator() {
        // Create a prominent "Ready to Launch" indicator
        const indicator = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2 - 100);
        indicator.setDepth(2500);
        
        // Background
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.9);
        bg.lineStyle(3, 0x4A90E2, 1);
        bg.fillRoundedRect(-200, -80, 400, 160, 20);
        bg.strokeRoundedRect(-200, -80, 400, 160, 20);
        
        // Main text
        const readyText = this.scene.add.text(0, -30, 'READY TO LAUNCH', {
            fontSize: '32px',
            fill: '#4A90E2',
            stroke: '#000',
            strokeThickness: 3,
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Instruction text
        const instructionText = this.scene.add.text(0, 20, 'Pull and release to launch!', {
            fontSize: '18px',
            fill: '#FFFFFF',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        // Launch icon/arrow
        const arrow = this.scene.add.graphics();
        arrow.lineStyle(4, 0x7ED321, 1);
        arrow.fillStyle(0x7ED321, 1);
        // Draw upward arrow
        arrow.lineBetween(0, 40, 0, 60);
        arrow.fillTriangle(-8, 40, 8, 40, 0, 25);
        
        indicator.add([bg, readyText, instructionText, arrow]);
        
        // Create launch area highlight
        const launchHighlight = this.scene.add.graphics();
        launchHighlight.setDepth(2499); // Just below the indicator
        launchHighlight.lineStyle(4, 0x4A90E2, 0.8);
        launchHighlight.strokeCircle(this.scene.player.x, this.scene.player.y, 150);
        launchHighlight.lineStyle(2, 0x7ED321, 0.6);
        launchHighlight.strokeCircle(this.scene.player.x, this.scene.player.y, 120);
        
        // Animate the indicator
        indicator.setAlpha(0);
        indicator.setScale(0.8);
        launchHighlight.setAlpha(0);
        
        this.scene.tweens.add({
            targets: indicator,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        this.scene.tweens.add({
            targets: launchHighlight,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        
        // Pulsing animation for attention
        this.scene.tweens.add({
            targets: readyText,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Pulsing animation for launch area highlight
        this.scene.tweens.add({
            targets: launchHighlight,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.4,
            duration: 1200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Auto-hide after a few seconds
        this.scene.time.delayedCall(4000, () => {
            this.scene.tweens.add({
                targets: [indicator, launchHighlight],
                alpha: 0,
                scaleX: 0.8,
                scaleY: 0.8,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    indicator.destroy();
                    launchHighlight.destroy();
                }
            });
        });
        
        // Hide when player starts pulling
        const hideOnPull = () => {
            if (this.scene.isPulling) {
                this.scene.tweens.add({
                    targets: [indicator, launchHighlight],
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        indicator.destroy();
                        launchHighlight.destroy();
                    }
                });
                this.scene.input.off('pointerdown', hideOnPull);
            }
        };
        this.scene.input.on('pointerdown', hideOnPull);
    }

    checkCloudBreach() {
        if (!this.scene.player || !this.titleContainer) return;
        
        // Check if player has breached the title area (around y=120)
        const breachY = 120;
        
        if (this.scene.player.y < breachY && !this.cloudBreached) {
            this.cloudBreached = true;
            
            // Start camera tracking
            this.scene.startCameraTracking();
            
            // Hide title when player goes high enough
            this.titleContainer.setVisible(false);
        }
    }

    createDebugMenu() {
        // Create debug menu container
        this.debugMenu = this.scene.add.container(10, 10);
        this.debugMenu.setDepth(2000);
        this.debugMenu.setVisible(false);
        this.debugMenu.setScrollFactor(0, 0); // Make sure it doesn't scroll with camera
        
        // Background panel
        const bg = this.scene.add.graphics()
            .fillStyle(0x000000, 0.8)
            .fillRoundedRect(0, 0, 300, 250, 10)
            .lineStyle(2, 0x00FF00, 1)
            .strokeRoundedRect(0, 0, 300, 250, 10);
        
        // Title
        const title = this.scene.add.text(10, 10, 'DEBUG MENU', {
            fontSize: '18px',
            fill: '#00FF00',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold'
        });
        
        // Hitbox toggles
        const hitboxToggles = [
            { key: 'bufo', label: 'Bufo Hitbox', keyCode: 'B' },
            { key: 'platform', label: 'Platform Hitbox', keyCode: 'T' },
            { key: 'balloons', label: 'Balloon Hitboxes', keyCode: '1' },
            { key: 'birds', label: 'Bird Hitboxes', keyCode: '2' },
            { key: 'clouds', label: 'Cloud Hitboxes', keyCode: '3' }
        ];
        
        let yOffset = 50;
        hitboxToggles.forEach((toggle, index) => {
            const status = this.debugHitboxes[toggle.key] ? 'ON' : 'OFF';
            const color = this.debugHitboxes[toggle.key] ? '#00FF00' : '#FF0000';
            
            const text = this.scene.add.text(10, yOffset, `${toggle.keyCode}: ${toggle.label} [${status}]`, {
                fontSize: '14px',
                fill: color,
                fontFamily: 'Arial, sans-serif'
            });
            
            this.debugMenu.add(text);
            yOffset += 25;
        });
        
        // Instructions
        const instructions = this.scene.add.text(10, yOffset + 10, 'F3: Toggle Debug Menu\nF4: Test Launch\nB: Toggle Bufo Hitbox\nT: Toggle Platform Hitbox\n1: Toggle Balloon Hitboxes\n2: Toggle Bird Hitboxes\n3: Toggle Cloud Hitboxes\nC: Clear All Hitboxes', {
            fontSize: '12px',
            fill: '#00FF00',
            fontFamily: 'Arial, sans-serif'
        });
        
        // Add all elements to debug menu
        this.debugMenu.add([bg, title, instructions]);
        
        // Create debug graphics containers
        this.debugGraphics.bufo = this.scene.add.graphics();
        this.debugGraphics.platform = this.scene.add.graphics();
        this.debugGraphics.balloons = this.scene.add.graphics();
        this.debugGraphics.birds = this.scene.add.graphics();
        this.debugGraphics.clouds = this.scene.add.graphics();
        
        // Set depths for debug graphics
        Object.values(this.debugGraphics).forEach(graphics => {
            if (graphics) graphics.setDepth(1500);
        });
        
        // Add key bindings for individual toggles
        const keyBindings = {
            'B': 'bufo',
            'T': 'platform',
            '1': 'balloons',
            '2': 'birds',
            '3': 'clouds'
        };
        
        Object.entries(keyBindings).forEach(([key, hitboxType]) => {
            const keyObj = this.scene.input.keyboard.addKey(key);
            keyObj.on('down', () => {
                this.toggleHitbox(hitboxType);
            });
        });
        
        // Add clear all hitboxes key binding
        const cKey = this.scene.input.keyboard.addKey('C');
        cKey.on('down', () => {
            this.clearAllDebugHitboxes();
        });
    }

    toggleDebugMenu() {
        console.log('Toggle debug menu called');
        if (this.debugMenu) {
            const wasVisible = this.debugMenu.visible;
            this.debugMenu.setVisible(!wasVisible);
            console.log(`Debug menu was ${wasVisible ? 'visible' : 'hidden'}, now ${this.debugMenu.visible ? 'visible' : 'hidden'}`);
            
            // Force update the debug menu text
            this.updateDebugMenuText();
        } else {
            console.log('Debug menu is null!');
        }
    }

    toggleHitbox(hitboxType) {
        if (this.debugHitboxes.hasOwnProperty(hitboxType)) {
            this.debugHitboxes[hitboxType] = !this.debugHitboxes[hitboxType];
            console.log(`${hitboxType} hitbox ${this.debugHitboxes[hitboxType] ? 'enabled' : 'disabled'}`);
            
            // Clear existing graphics
            if (this.debugGraphics[hitboxType]) {
                this.debugGraphics[hitboxType].clear();
            }
            
            // Update debug menu text
            this.updateDebugMenuText();
            
            // Draw hitboxes if enabled
            if (this.debugHitboxes[hitboxType]) {
                this.drawHitboxes(hitboxType);
            }
            
            // For static hitboxes, ensure they stay visible
            if (hitboxType === 'platform' && this.debugHitboxes[hitboxType]) {
                // Force redraw platform hitbox
                const graphics = this.debugGraphics[hitboxType];
                if (graphics) {
                    graphics.clear();
                    this.drawPlatformHitbox(graphics);
                }
            }
        }
    }

    updateDebugMenuText() {
        // Update the status text in the debug menu
        if (this.debugMenu) {
            const hitboxToggles = [
                { key: 'bufo', label: 'Bufo Hitbox', keyCode: 'B' },
                { key: 'platform', label: 'Platform Hitbox', keyCode: 'T' },
                { key: 'balloons', label: 'Balloon Hitboxes', keyCode: '1' },
                { key: 'birds', label: 'Bird Hitboxes', keyCode: '2' },
                { key: 'clouds', label: 'Cloud Hitboxes', keyCode: '3' }
            ];
            
            // Find and update text elements
            this.debugMenu.each((child) => {
                if (child.type === 'Text') {
                    hitboxToggles.forEach(toggle => {
                        if (child.text.includes(toggle.label)) {
                            const status = this.debugHitboxes[toggle.key] ? 'ON' : 'OFF';
                            const color = this.debugHitboxes[toggle.key] ? '#00FF00' : '#FF0000';
                            child.setText(`${toggle.keyCode}: ${toggle.label} [${status}]`);
                            child.setColor(color);
                        }
                    });
                }
            });
        }
    }

    drawHitboxes(hitboxType) {
        const graphics = this.debugGraphics[hitboxType];
        if (!graphics) return;
        
        graphics.clear();
        
        switch (hitboxType) {
            case 'bufo':
                this.drawBufoHitbox(graphics);
                break;
            case 'platform':
                this.drawPlatformHitbox(graphics);
                break;
            case 'balloons':
                this.drawBalloonHitboxes(graphics);
                break;
            case 'birds':
                this.drawBirdHitboxes(graphics);
                break;
            case 'clouds':
                this.drawCloudHitboxes(graphics);
                break;
        }
    }

    drawBufoHitbox(graphics) {
        if (this.scene.player) {
            graphics.lineStyle(2, 0xFF0000, 1);
            graphics.strokeCircle(this.scene.player.x, this.scene.player.y, this.scene.player.width / 2);
        }
    }

    drawPlatformHitbox(graphics) {
        console.log('Drawing platform hitbox, platformBody:', this.platformBody);
        if (this.platformBody) {
            graphics.lineStyle(2, 0x00FF00, 1);
            this.platformBody.children.entries.forEach(collider => {
                console.log('Drawing collider:', collider.x, collider.y, collider.width, collider.height);
                graphics.strokeRect(
                    collider.x - collider.width / 2,
                    collider.y - collider.height / 2,
                    collider.width,
                    collider.height
                );
            });
        } else {
            console.log('No platformBody found for platform hitbox');
        }
    }

    drawBalloonHitboxes(graphics) {
        if (this.scene.objectSpawner && this.scene.objectSpawner.balloons) {
            graphics.lineStyle(2, 0xFFFF00, 1);
            this.scene.objectSpawner.balloons.children.entries.forEach(balloon => {
                if (balloon.active && balloon.visible) {
                    graphics.strokeCircle(balloon.x, balloon.y, balloon.width / 2);
                }
            });
        }
    }

    drawBirdHitboxes(graphics) {
        if (this.scene.objectSpawner && this.scene.objectSpawner.birds) {
            graphics.lineStyle(2, 0x00FFFF, 1);
            this.scene.objectSpawner.birds.children.entries.forEach(bird => {
                if (bird.active && bird.visible) {
                    graphics.strokeCircle(bird.x, bird.y, bird.width / 2);
                }
            });
        }
    }

    drawCloudHitboxes(graphics) {
        if (this.scene.objectSpawner && this.scene.objectSpawner.clouds) {
            graphics.lineStyle(2, 0x808080, 1);
            this.scene.objectSpawner.clouds.children.entries.forEach(cloud => {
                if (cloud.active && cloud.visible) {
                    graphics.strokeCircle(cloud.x, cloud.y, cloud.width / 2);
                }
            });
        }
    }

    updateDebugHitboxes() {
        // Only update hitboxes that need continuous updates (moving objects)
        // Don't redraw static hitboxes like platform every frame
        
        // Check if any hitboxes are enabled before doing any work
        const hasEnabledHitboxes = Object.values(this.debugHitboxes).some(enabled => enabled);
        if (!hasEnabledHitboxes) {
            return; // Exit early if no hitboxes are enabled
        }
        
        // Only update moving objects, not static ones
        if (this.debugHitboxes.bufo && this.scene.player) {
            // Only redraw bufo hitbox if player position changed significantly
            const graphics = this.debugGraphics.bufo;
            if (graphics) {
                graphics.clear();
                this.drawBufoHitbox(graphics);
            }
        }
        
        // Note: Static hitboxes (platform) and object hitboxes (balloons, birds, clouds) 
        // are drawn once when enabled and don't need continuous updates
    }

    clearAllDebugHitboxes() {
        // Clear all debug graphics
        Object.values(this.debugGraphics).forEach(graphics => {
            if (graphics) graphics.clear();
        });
        
        // Reset all hitbox states
        Object.keys(this.debugHitboxes).forEach(key => {
            this.debugHitboxes[key] = false;
        });
        
        // Update debug menu text
        this.updateDebugMenuText();
        
        console.log('All debug hitboxes cleared');
    }

    recreateGrassTiles() {
        // Remove existing grass tiles
        if (this.grassTiles) {
            this.grassTiles.forEach(tile => {
                if (tile && tile.destroy) {
                    tile.destroy();
                }
            });
        }
        
        // Create new grass tiles with fresh randomization
        this.grassTiles = [];
        const grassVariations = ['grass', 'grass2', 'grass3', 'grass4'];
        
        // Create the main ground grass tile
        const mainGrassTexture = Phaser.Math.RND.pick(grassVariations);
        const mainGrassTile = this.scene.add.tileSprite(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2),
            this.scene.cameras.main.width,
            GAME_CONSTANTS.GROUND_HEIGHT,
            mainGrassTexture
        );
        this.grassTiles.push(mainGrassTile);
        
        // Create additional grass rows
        const grassTileHeight = 60;
        for (let i = 1; i <= 3; i++) {
            const additionalGrassY = this.scene.cameras.main.height - (GAME_CONSTANTS.GROUND_HEIGHT / 2) - (grassTileHeight * i);
            const randomGrassTexture = Phaser.Math.RND.pick(grassVariations);
            
            const grassTile = this.scene.add.tileSprite(
                this.scene.cameras.main.width / 2,
                additionalGrassY,
                this.scene.cameras.main.width,
                grassTileHeight,
                randomGrassTexture
            );
            this.grassTiles.push(grassTile);
        }
        
        console.log('Grass tiles recreated with new randomization');
    }
} 