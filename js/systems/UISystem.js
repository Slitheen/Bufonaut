import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class UISystem {
    constructor(scene) {
        this.scene = scene;
        this.ui = {};
        this.upgradeContainer = null;
        this.altitudeText = null;
        this.fuelGauge = null;
        this.launcherVisualization = null;
        
        // DPI and resolution compatibility
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.canvasScale = {
            x: this.scene.scale.width / this.scene.cameras.main.width,
            y: this.scene.scale.height / this.scene.cameras.main.height
        };
        
        // Log display information for debugging
        console.log('🖥️ Display Configuration:', {
            devicePixelRatio: this.devicePixelRatio,
            windowInnerWidth: window.innerWidth,
            windowInnerHeight: window.innerHeight,
            scaleWidth: this.scene.scale.width,
            scaleHeight: this.scene.scale.height,
            cameraWidth: this.scene.cameras.main.width,
            cameraHeight: this.scene.cameras.main.height,
            canvasScale: this.canvasScale,
            browserInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
            }
        });
        
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
        
        // Setup debug hotkey for button alignment
        this.setupButtonDebugHotkey();
    }

    /**
     * Convert pointer coordinates to game coordinates, handling DPI scaling and resolution differences
     * @param {Phaser.Input.Pointer} pointer - The pointer object
     * @returns {Object} Corrected coordinates {x, y}
     */
    convertPointerToGameCoords(pointer) {
        // For screen-relative elements (scrollFactor 0), use Phaser's built-in coordinates
        // but apply simple DPI correction if needed
        
        let gameX = pointer.x;
        let gameY = pointer.y;
        
        // Only apply DPI correction for very high DPI displays (2.0+)
        // For moderately high DPI (1.1-1.9), use Phaser's coordinates directly
        if (this.devicePixelRatio >= 2.0) {
            const canvas = this.scene.sys.canvas;
            const canvasRect = canvas.getBoundingClientRect();
            
            const mouseX = pointer.event.clientX - canvasRect.left;
            const mouseY = pointer.event.clientY - canvasRect.top;
            
            const scaleX = this.scene.cameras.main.width / canvasRect.width;
            const scaleY = this.scene.cameras.main.height / canvasRect.height;
            
            gameX = mouseX * scaleX;
            gameY = mouseY * scaleY;
        }
        
        return {
            x: gameX,
            y: gameY,
            originalX: pointer.x,
            originalY: pointer.y,
            usedDPICorrection: this.devicePixelRatio >= 2.0,
            devicePixelRatio: this.devicePixelRatio,
            debugInfo: {
                devicePixelRatio: this.devicePixelRatio,
                usedCorrection: this.devicePixelRatio >= 2.0,
                phaserCoords: { x: pointer.x, y: pointer.y }
            }
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
        
        // FIXED: Position grass tiles properly for pulling space with new camera setup
        // Main grass tile at ground level (bottom of screen)
        const mainGrassTile = this.scene.add.tileSprite(
            this.scene.cameras.main.width / 2,
            this.scene.groundLevel,
            this.scene.cameras.main.width,
            GAME_CONSTANTS.GROUND_HEIGHT,
            mainGrassTexture
        );
        this.grassTiles.push(mainGrassTile);
        
        // Create multiple additional rows of grass tiles for extended pull range
        const grassTileHeight = 80; // Increased height for better visual and pulling space
        
        // Add 4 additional rows of grass tiles BELOW the main ground for balanced pull space
        // This prevents exploiting extra pull-down space while maintaining fair gameplay
        for (let i = 1; i <= 4; i++) { // Reduced to 4 rows for balanced pull distance
            const additionalGrassY = this.scene.groundLevel + (grassTileHeight * i);
            
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
                    this.scene.player.body.setGravityY(GAME_CONSTANTS.GRAVITY); // Re-enable gravity with proper falling speed
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
            // Prevent pulling when upgrade shop is open
            if (this.upgradeShopContainer) {
                console.log('Pulling blocked - upgrade shop is open');
                return;
            }
            
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
            // Stop pulling if upgrade shop opens mid-pull
            if (this.upgradeShopContainer && this.scene.isPulling) {
                this.scene.isPulling = false;
                this.scene.launchLine.clear();
                console.log('Pulling interrupted - upgrade shop opened');
                return;
            }
            
            if (this.scene.isPulling && this.scene.originalPlayerPosition) {
                // Convert pointer coordinates from screen space to world space
                const worldX = pointer.x + this.scene.cameras.main.scrollX;
                const worldY = pointer.y + this.scene.cameras.main.scrollY;
                
                console.log('Pointer move - pulling:', {
                    pointerScreenX: pointer.x,
                    pointerScreenY: pointer.y,
                    pointerWorldX: worldX,
                    pointerWorldY: worldY,
                    cameraScrollX: this.scene.cameras.main.scrollX,
                    cameraScrollY: this.scene.cameras.main.scrollY,
                    playerX: this.scene.player.x,
                    playerY: this.scene.player.y,
                    velocityX: this.scene.player.body.velocity.x,
                    velocityY: this.scene.player.body.velocity.y,
                    gravityY: this.scene.player.body.gravity.y
                });
                
                // Calculate pull distance and direction using world coordinates
                const pullVector = new Phaser.Math.Vector2(
                    worldX - this.scene.originalPlayerPosition.x,
                    worldY - this.scene.originalPlayerPosition.y
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
            // Cancel launch if upgrade shop is open
            if (this.upgradeShopContainer && this.scene.isPulling) {
                this.scene.isPulling = false;
                this.scene.launchLine.clear();
                this.scene.launchZoneIndicator.clear();
                console.log('Launch cancelled - upgrade shop is open');
                return;
            }
            
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
                this.scene.player.body.setGravityY(GAME_CONSTANTS.GRAVITY); // Use proper falling speed
                this.scene.player.body.setBounce(0.1, 0.1);
                this.scene.player.body.setFriction(0.0); // No friction during launch
                
                // Calculate launch velocity with smoothing
                const launchVelocityX = pullVector.x * currentLaunchPower;
                const launchVelocityY = pullVector.y * currentLaunchPower;
                
                // Apply velocity smoothly - use a small delay to prevent jitter
                this.scene.time.delayedCall(16, () => {
                    this.scene.player.body.setVelocity(launchVelocityX, launchVelocityY);
                    
                    // Set airborne state after velocity is applied
                    this.scene.isAirborne = true;
                    this.scene.hasBeenLaunched = true; // Mark as properly launched
                    
                    // Start launch protection to prevent immediate collisions
                    this.scene.collisionSystem.startLaunchProtection(this.scene.player.y);
                    this.scene.launchTime = this.scene.time.now;
                    this.scene.peakY = this.scene.player.y;
                    this.scene.launchCount++;
                    this.ui.launchCountText.setText(this.scene.launchCount);
                    this.ui.flightDistanceText.setText('...');
                    this.ui.airTimeText.setText('...');
                    
                    // Keep friction low during flight to maintain velocity
                    this.scene.player.body.setFriction(0.0);
                    
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
                    
                    // Debug: Check velocity after a short delay to verify it's maintained
                    this.scene.time.delayedCall(100, () => {
                        console.log('Velocity after 100ms:', {
                            velocityX: this.scene.player.body.velocity.x,
                            velocityY: this.scene.player.body.velocity.y
                        });
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
        // Title container removed - no longer displaying "Reach for the Sky!" text
        // This provides more clean space for the game interface
        this.titleContainer = null;
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
        // Hide any existing indicator first
        this.hideLaunchReadyIndicators();
        
        // Create a prominent "Ready to Launch" indicator
        const indicator = this.scene.add.container(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2 - 100);
        indicator.setDepth(2500);
        
        // Store reference for later hiding
        this.launchReadyIndicator = indicator;
        
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
        
        // Store reference for later hiding
        this.launchHighlight = launchHighlight;
        
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
    
    hideLaunchReadyIndicators() {
        // Hide and destroy launch ready indicator
        if (this.launchReadyIndicator) {
            this.launchReadyIndicator.setVisible(false);
            // Optionally destroy it completely
            this.scene.tweens.add({
                targets: this.launchReadyIndicator,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    if (this.launchReadyIndicator) {
                        this.launchReadyIndicator.destroy();
                        this.launchReadyIndicator = null;
                    }
                }
            });
        }
        
        // Hide and destroy launch highlight
        if (this.launchHighlight) {
            this.launchHighlight.setVisible(false);
            this.scene.tweens.add({
                targets: this.launchHighlight,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    if (this.launchHighlight) {
                        this.launchHighlight.destroy();
                        this.launchHighlight = null;
                    }
                }
            });
        }
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
            this.scene.groundLevel,
            this.scene.cameras.main.width,
            GAME_CONSTANTS.GROUND_HEIGHT,
            mainGrassTexture
        );
        this.grassTiles.push(mainGrassTile);
        
        // Create additional grass rows below the main ground for balanced pull space
        const grassTileHeight = 80;
        for (let i = 1; i <= 4; i++) { // Reduced to 4 rows for balanced pull distance
            const additionalGrassY = this.scene.groundLevel + (grassTileHeight * i);
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

    createUpgradeShopBuilding() {
        // Position the building to the left of the platform in the grass area
        const platformX = this.scene.cameras.main.width / 2;
        
        // Building dimensions
        const buildingWidth = 120;
        const buildingX = platformX - 200 - buildingWidth; // Move left by building width + 200 pixels
        const buildingY = this.scene.groundLevel + 40; // In the grass area below ground level
        
        // Create building container
        this.upgradeBuilding = this.scene.add.container(buildingX, buildingY);
        const buildingHeight = 140;
        const roofHeight = 40;
        
        // Create 3D building using isometric-style graphics
        const building = this.scene.add.graphics();
        
        // Main building face (front)
        building.fillStyle(0x8B4513, 0.9); // Brown brick color
        building.fillRect(-buildingWidth/2, -buildingHeight, buildingWidth, buildingHeight);
        building.lineStyle(2, 0x654321, 1); // Dark brown outline
        building.strokeRect(-buildingWidth/2, -buildingHeight, buildingWidth, buildingHeight);
        
        // Right side wall (3D effect)
        building.fillStyle(0x654321, 0.8); // Darker brown for side
        building.beginPath();
        building.moveTo(buildingWidth/2, -buildingHeight);    // Top front right
        building.lineTo(buildingWidth/2 + 20, -buildingHeight - 15); // Top back right
        building.lineTo(buildingWidth/2 + 20, -15);           // Bottom back right
        building.lineTo(buildingWidth/2, 0);                  // Bottom front right
        building.closePath();
        building.fillPath();
        
        building.lineStyle(2, 0x4A2C17, 1);
        building.beginPath();
        building.moveTo(buildingWidth/2, -buildingHeight);
        building.lineTo(buildingWidth/2 + 20, -buildingHeight - 15);
        building.lineTo(buildingWidth/2 + 20, -15);
        building.lineTo(buildingWidth/2, 0);
        building.closePath();
        building.strokePath();
        
        // Roof (3D effect)
        building.fillStyle(0xB22222, 0.9); // Red roof
        building.beginPath();
        building.moveTo(-buildingWidth/2, -buildingHeight);     // Left front
        building.lineTo(buildingWidth/2, -buildingHeight);      // Right front
        building.lineTo(buildingWidth/2 + 20, -buildingHeight - 15); // Right back
        building.lineTo(-buildingWidth/2 + 20, -buildingHeight - 15); // Left back
        building.closePath();
        building.fillPath();
        
        building.lineStyle(2, 0x8B0000, 1); // Dark red outline
        building.beginPath();
        building.moveTo(-buildingWidth/2, -buildingHeight);
        building.lineTo(buildingWidth/2, -buildingHeight);
        building.lineTo(buildingWidth/2 + 20, -buildingHeight - 15);
        building.lineTo(-buildingWidth/2 + 20, -buildingHeight - 15);
        building.closePath();
        building.strokePath();
        
        // Add building details
        // Windows
        building.fillStyle(0x87CEEB, 0.8); // Light blue windows
        building.fillRect(-30, -buildingHeight + 20, 20, 25);
        building.fillRect(10, -buildingHeight + 20, 20, 25);
        building.fillRect(-30, -buildingHeight + 60, 20, 25);
        building.fillRect(10, -buildingHeight + 60, 20, 25);
        building.lineStyle(2, 0x4682B4, 1); // Steel blue window frames
        building.strokeRect(-30, -buildingHeight + 20, 20, 25);
        building.strokeRect(10, -buildingHeight + 20, 20, 25);
        building.strokeRect(-30, -buildingHeight + 60, 20, 25);
        building.strokeRect(10, -buildingHeight + 60, 20, 25);
        
        // Door
        building.fillStyle(0x8B4513, 0.9); // Brown door
        building.fillRect(-15, -30, 30, 35);
        building.lineStyle(2, 0x654321, 1);
        building.strokeRect(-15, -30, 30, 35);
        
        // Door handle
        building.fillStyle(0xFFD700, 1); // Gold handle
        building.fillCircle(8, -12, 3);
        
        // Sign above door
        building.fillStyle(0x2F4F4F, 0.9); // Dark slate gray
        building.fillRect(-25, -50, 50, 15);
        building.lineStyle(1, 0x000000, 1);
        building.strokeRect(-25, -50, 50, 15);
        
        // Sign text
        const signText = this.scene.add.text(0, -42, 'UPGRADES', {
            fontSize: '12px',
            fill: '#FFD700',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5, 0.5);
        
        // Add upgrade icon above building
        const upgradeIcon = this.scene.add.graphics();
        upgradeIcon.fillStyle(0xFFD700, 1);
        
        // Create a star shape manually
        const starX = 0;
        const starY = -buildingHeight - 25;
        const outerRadius = 15;
        const innerRadius = 8;
        const points = 5;
        
        upgradeIcon.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = starX + Math.cos(angle - Math.PI / 2) * radius;
            const y = starY + Math.sin(angle - Math.PI / 2) * radius;
            
            if (i === 0) {
                upgradeIcon.moveTo(x, y);
            } else {
                upgradeIcon.lineTo(x, y);
            }
        }
        upgradeIcon.closePath();
        upgradeIcon.fillPath();
        
        upgradeIcon.lineStyle(2, 0xFF8C00, 1);
        upgradeIcon.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = starX + Math.cos(angle - Math.PI / 2) * radius;
            const y = starY + Math.sin(angle - Math.PI / 2) * radius;
            
            if (i === 0) {
                upgradeIcon.moveTo(x, y);
            } else {
                upgradeIcon.lineTo(x, y);
            }
        }
        upgradeIcon.closePath();
        upgradeIcon.strokePath();
        
        // Add all elements to building container
        this.upgradeBuilding.add([building, signText, upgradeIcon]);
        
        // Set depth to be above grass but below player
        this.upgradeBuilding.setDepth(250);
        
        // Make building interactive
        const interactiveArea = this.scene.add.rectangle(0, -buildingHeight/2, buildingWidth + 40, buildingHeight + 20, 0x000000, 0);
        interactiveArea.setInteractive({ useHandCursor: true });
        this.upgradeBuilding.add(interactiveArea);
        
        // Add click handler
        interactiveArea.on('pointerdown', () => {
            this.openUpgradeShop();
        });
        
        // Add hover effects
        interactiveArea.on('pointerover', () => {
            this.upgradeBuilding.setScale(1.05);
            // Add glow effect
            this.upgradeBuilding.getAll().forEach(child => {
                if (child.setTint) {
                    child.setTint(0xFFFFAA);
                }
            });
        });
        
        interactiveArea.on('pointerout', () => {
            this.upgradeBuilding.setScale(1);
            // Remove glow effect
            this.upgradeBuilding.getAll().forEach(child => {
                if (child.clearTint) {
                    child.clearTint();
                }
            });
        });
        
        // Add subtle animation
        this.scene.tweens.add({
            targets: this.upgradeBuilding,
            y: buildingY - 3,
            duration: 3000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Add floating upgrade indicator
        this.createUpgradeIndicator();
        
        // Update indicator based on initial coin state
        this.updateUpgradeBuildingIndicator();
    }

    createUpgradeIndicator() {
        // Create floating indicator above building
        const indicatorX = this.upgradeBuilding.x;
        const indicatorY = this.upgradeBuilding.y - 180;
        
        this.upgradeIndicator = this.scene.add.container(indicatorX, indicatorY);
        
        // Background circle
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x4A90E2, 0.8);
        bg.fillCircle(0, 0, 15);
        bg.lineStyle(2, 0xFFFFFF, 0.9);
        bg.strokeCircle(0, 0, 15);
        
        // Upgrade arrow
        const arrow = this.scene.add.graphics();
        arrow.fillStyle(0xFFFFFF, 1);
        arrow.fillTriangle(-6, 4, 6, 4, 0, -6);
        
        this.upgradeIndicator.add([bg, arrow]);
        this.upgradeIndicator.setDepth(300);
        
        // Floating animation
        this.scene.tweens.add({
            targets: this.upgradeIndicator,
            y: indicatorY - 10,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Pulsing effect
        this.scene.tweens.add({
            targets: this.upgradeIndicator,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    openUpgradeShop() {
        // Create comprehensive upgrade shop UI
        this.createUpgradeShopUI();
    }

    createUpgradeShopUI() {
        // Disable all game inputs when upgrade shop is open
        this.disableGameInteractions();
        
        // Initialize upgrade elements storage
        this.upgradeShopElements = {};
        this.upgradeButtons = [];
        
        // Create main overlay container
        this.upgradeShopContainer = this.scene.add.container(0, 0);
        this.upgradeShopContainer.setDepth(2000);
        
        // Create backdrop/overlay
        const backdrop = this.scene.add.rectangle(0, 0, this.scene.game.config.width, this.scene.game.config.height, 0x000000, 0.6);
        backdrop.setOrigin(0, 0);
        backdrop.setInteractive();
        backdrop.on('pointerdown', (pointer) => {
            // Only close if click is outside the panel area
            const clickX = pointer.x;
            const clickY = pointer.y;
            const panelLeft = panelX - panelWidth / 2;
            const panelRight = panelX + panelWidth / 2;
            const panelTop = panelY - panelHeight + 20;
            const panelBottom = panelY + 20;
            
            // Check if click is outside the panel bounds
            if (clickX < panelLeft || clickX > panelRight || clickY < panelTop || clickY > panelBottom) {
                this.closeUpgradeShop();
            }
        });
        this.upgradeShopContainer.add(backdrop);
        
        // Create main panel dimensions
        const panelWidth = Math.min(450, this.scene.game.config.width - 40);
        const panelHeight = Math.min(600, this.scene.game.config.height - 100);
        const panelX = this.scene.game.config.width / 2;
        const panelY = this.scene.game.config.height; // Start below screen
        
        // Create main panel
        this.upgradePanel = this.scene.add.container(panelX, panelY);
        this.upgradeShopContainer.add(this.upgradePanel);
        
        // Panel background with modern rounded corners
        const panelBg = this.scene.add.graphics();
        panelBg.fillStyle(0x1a1a2e, 1);
        panelBg.fillRoundedRect(-panelWidth/2, -panelHeight, panelWidth, panelHeight, 20);
        panelBg.lineStyle(2, 0x16213e, 1);
        panelBg.strokeRoundedRect(-panelWidth/2, -panelHeight, panelWidth, panelHeight, 20);
        this.upgradePanel.add(panelBg);
        
        // Add subtle glow effect
        const glowEffect = this.scene.add.graphics();
        glowEffect.fillStyle(0x0f3460, 0.3);
        glowEffect.fillRoundedRect(-panelWidth/2 - 4, -panelHeight - 4, panelWidth + 8, panelHeight + 8, 24);
        this.upgradePanel.add(glowEffect);
        this.upgradePanel.sendToBack(glowEffect);
        
        // Header section
        this.createModernHeader(panelWidth, panelHeight);
        
        // Upgrade ribbons section
        this.createUpgradeRibbons(panelWidth, panelHeight);
        
        // Footer section
        this.createModernFooter(panelWidth, panelHeight);
        
        // Slide up animation
        this.scene.tweens.add({
            targets: this.upgradePanel,
            y: panelY - panelHeight + 20,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.setupKeyboardNavigation();
                this.announceToScreenReader("Upgrade shop opened");
            }
        });
        
        // Store panel dimensions for responsive updates
        this.panelWidth = panelWidth;
        this.panelHeight = panelHeight;
        
        // Set up responsive handling
        this.setupResponsiveHandling();
    }
    
    createModernHeader(panelWidth, panelHeight) {
        const headerHeight = 80;
        const headerY = -panelHeight + 20;
        
        // Header background
        const headerBg = this.scene.add.graphics();
        headerBg.fillStyle(0x0f3460, 1);
        headerBg.fillRoundedRect(-panelWidth/2, headerY, panelWidth, headerHeight, {tl: 20, tr: 20, bl: 0, br: 0});
        this.upgradePanel.add(headerBg);
        
        // Title
        const title = this.scene.add.text(0, headerY + 25, 'UPGRADE SHOP', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffffff',
            fontWeight: 'bold'
        });
        title.setOrigin(0.5, 0);
        this.upgradePanel.add(title);
        
        // Coins display
        const coinsContainer = this.scene.add.container(0, headerY + 55);
        this.upgradePanel.add(coinsContainer);
        
        const coinIcon = this.scene.add.text(-30, 0, '💰', {
            fontSize: '18px'
        });
        coinIcon.setOrigin(0.5, 0.5);
        coinsContainer.add(coinIcon);
        
        this.upgradeShopCoinsText = this.scene.add.text(0, 0, `${this.scene.coins}`, {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffd700',
            fontWeight: 'bold'
        });
        this.upgradeShopCoinsText.setOrigin(0, 0.5);
        coinsContainer.add(this.upgradeShopCoinsText);
        
        // Close button
        this.createModernCloseButton(panelWidth, headerY);
    }
    
    createModernCloseButton(panelWidth, headerY) {
        const closeButton = this.scene.add.container(panelWidth/2 - 40, headerY + 40);
        this.upgradePanel.add(closeButton);
        
        // Close button background
        const closeBg = this.scene.add.graphics();
        closeBg.fillStyle(0x333366, 1);
        closeBg.fillCircle(0, 0, 20);
        closeBg.lineStyle(2, 0x666699, 1);
        closeBg.strokeCircle(0, 0, 20);
        closeButton.add(closeBg);
        
        // Close button icon
        const closeIcon = this.scene.add.text(0, 0, '×', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffffff',
            fontWeight: 'bold'
        });
        closeIcon.setOrigin(0.5, 0.5);
        closeButton.add(closeIcon);
        
        // Interactive area
        const closeArea = this.scene.add.circle(0, 0, 25, 0x000000, 0);
        closeArea.setInteractive({ useHandCursor: true });
        closeButton.add(closeArea);
        
        // Button interactions
        closeArea.on('pointerdown', () => {
            this.closeUpgradeShop();
        });
        
        closeArea.on('pointerover', () => {
            closeBg.clear();
            closeBg.fillStyle(0x444477, 1);
            closeBg.fillCircle(0, 0, 20);
            closeBg.lineStyle(2, 0x7777aa, 1);
            closeBg.strokeCircle(0, 0, 20);
        });
        
        closeArea.on('pointerout', () => {
            closeBg.clear();
            closeBg.fillStyle(0x333366, 1);
            closeBg.fillCircle(0, 0, 20);
            closeBg.lineStyle(2, 0x666699, 1);
            closeBg.strokeCircle(0, 0, 20);
        });
        
        // Store for keyboard navigation
        this.closeButton = closeArea;
    }
    
    createUpgradeRibbons(panelWidth, panelHeight) {
        const ribbonStartY = -panelHeight + 150;
        const ribbonHeight = 90;
        const ribbonSpacing = 10;
        
        // Scrollable content area
        this.ribbonContainer = this.scene.add.container(0, 0);
        this.upgradePanel.add(this.ribbonContainer);
        
        // Create ribbons for each upgrade
        const upgrades = ['string', 'frame', 'spaceShip', 'rocket'];
        upgrades.forEach((key, index) => {
            const ribbonY = ribbonStartY + (index * (ribbonHeight + ribbonSpacing));
            this.createUpgradeRibbon(key, ribbonY, panelWidth - 40, ribbonHeight);
        });
        
        // Add scroll indicators if needed
        this.setupScrollIndicators(panelWidth, panelHeight);
    }
    
    createUpgradeRibbon(upgradeKey, y, width, height) {
        const upgrade = this.scene.upgradeSystem.upgrades[upgradeKey];
        const ribbonContainer = this.scene.add.container(0, y);
        this.ribbonContainer.add(ribbonContainer);
        
        // Main ribbon background
        const ribbonBg = this.scene.add.graphics();
        const isMaxed = upgrade.level >= upgrade.maxLevel;
        const canAfford = this.scene.coins >= upgrade.cost;
        
        // Dynamic colors based on state
        let bgColor = 0x2a2a3e;
        let borderColor = 0x3a3a5e;
        
        if (isMaxed) {
            bgColor = 0x1a3a1a;
            borderColor = 0x2a5a2a;
        } else if (canAfford) {
            bgColor = 0x3a2a1a;
            borderColor = 0x5a4a2a;
        }
        
        ribbonBg.fillStyle(bgColor, 1);
        ribbonBg.fillRoundedRect(-width/2, -height/2, width, height, 12);
        ribbonBg.lineStyle(2, borderColor, 1);
        ribbonBg.strokeRoundedRect(-width/2, -height/2, width, height, 12);
        ribbonContainer.add(ribbonBg);
        
        // Progress ribbon (shows current level)
        const progressWidth = (upgrade.level / upgrade.maxLevel) * (width - 20);
        if (progressWidth > 0) {
            const progressBg = this.scene.add.graphics();
            progressBg.fillStyle(0x4a6a4a, 0.6);
            progressBg.fillRoundedRect(-width/2 + 10, -height/2 + 10, progressWidth, height - 20, 8);
            ribbonContainer.add(progressBg);
        }
        
        // Upgrade icon
        const iconContainer = this.scene.add.container(-width/2 + 50, 0);
        ribbonContainer.add(iconContainer);
        
        const iconBg = this.scene.add.graphics();
        iconBg.fillStyle(0x1a1a2e, 1);
        iconBg.fillCircle(0, 0, 25);
        iconBg.lineStyle(2, 0x4a4a6e, 1);
        iconBg.strokeCircle(0, 0, 25);
        iconContainer.add(iconBg);
        
        // Load upgrade icon if available
        if (this.scene.textures.exists(`upgrade_${upgradeKey}`)) {
            const icon = this.scene.add.image(0, 0, `upgrade_${upgradeKey}`);
            // Set explicit size to fit within the 50px diameter circle (25px radius)
            icon.setDisplaySize(32, 32);
            iconContainer.add(icon);
        } else {
            // Fallback text icon
            const iconText = this.scene.add.text(0, 0, this.getUpgradeIcon(upgradeKey), {
                fontSize: '20px',
                fill: '#ffffff'
            });
            iconText.setOrigin(0.5, 0.5);
            iconContainer.add(iconText);
        }
        
        // Upgrade info
        const infoContainer = this.scene.add.container(-width/2 + 120, -25);
        ribbonContainer.add(infoContainer);
        
        const nameText = this.scene.add.text(0, 0, this.getUpgradeName(upgradeKey), {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffffff',
            fontWeight: 'bold'
        });
        nameText.setOrigin(0, 0);
        infoContainer.add(nameText);
        
        const levelText = this.scene.add.text(0, 20, `Level ${upgrade.level}/${upgrade.maxLevel}`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#aaaaaa'
        });
        levelText.setOrigin(0, 0);
        infoContainer.add(levelText);
        
        // Stats info - moved down to avoid overlapping footer text
        const statsContainer = this.scene.add.container(-width/2 + 120, 10);
        ribbonContainer.add(statsContainer);
        
        const statsText = this.scene.add.text(0, 0, this.getUpgradeStats(upgradeKey), {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            fill: '#cccccc'
        });
        statsText.setOrigin(0, 0);
        statsContainer.add(statsText);
        
        // Buy button
        this.createRibbonButton(ribbonContainer, upgradeKey, width, height, isMaxed, canAfford);
        
        // Store elements for updates
        this.upgradeShopElements[upgradeKey] = {
            container: ribbonContainer,
            background: ribbonBg,
            levelText,
            statsText,
            infoContainer,
            statsContainer
        };
    }
    
    createRibbonButton(ribbonContainer, upgradeKey, width, height, isMaxed, canAfford) {
        const buttonWidth = 80;
        const buttonHeight = 36;
        const buttonX = width/2 - buttonWidth/2 - 20;
        
        const buttonContainer = this.scene.add.container(buttonX, 0);
        ribbonContainer.add(buttonContainer);
        
        // Button background
        const buttonBg = this.scene.add.graphics();
        let buttonColor = 0x333366;
        let buttonText = 'BUY';
        
        if (isMaxed) {
            buttonColor = 0x2a5a2a;
            buttonText = 'MAX';
        } else if (canAfford) {
            buttonColor = 0x4a6a2a;
        } else {
            buttonColor = 0x5a2a2a;
        }
        
        buttonBg.fillStyle(buttonColor, 1);
        buttonBg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
        buttonBg.lineStyle(2, this.lightenColor(buttonColor), 1);
        buttonBg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
        buttonContainer.add(buttonBg);
        
        // Button text
        const text = this.scene.add.text(0, -2, buttonText, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffffff',
            fontWeight: 'bold'
        });
        text.setOrigin(0.5, 0.5);
        buttonContainer.add(text);
        
        // Cost text
        if (!isMaxed) {
            const upgrade = this.scene.upgradeSystem.upgrades[upgradeKey];
            const costText = this.scene.add.text(0, 12, `${upgrade.cost}💰`, {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                fill: canAfford ? '#ffd700' : '#ff6666'
            });
            costText.setOrigin(0.5, 0.5);
            buttonContainer.add(costText);
        }
        
        // Interactive area
        const buttonArea = this.scene.add.rectangle(0, 0, buttonWidth + 10, buttonHeight + 10, 0x000000, 0);
        buttonArea.setInteractive({ useHandCursor: !isMaxed });
        buttonContainer.add(buttonArea);
        
        // Button interactions
        if (!isMaxed) {
            buttonArea.on('pointerdown', () => {
                this.playButtonSound();
                this.buyUpgrade(upgradeKey);
            });
            
            buttonArea.on('pointerover', () => {
                buttonBg.clear();
                buttonBg.fillStyle(this.lightenColor(buttonColor), 1);
                buttonBg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
                buttonBg.lineStyle(2, this.lightenColor(buttonColor, 0.4), 1);
                buttonBg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
            });
            
            buttonArea.on('pointerout', () => {
                buttonBg.clear();
                buttonBg.fillStyle(buttonColor, 1);
                buttonBg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
                buttonBg.lineStyle(2, this.lightenColor(buttonColor), 1);
                buttonBg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
            });
        }
        
        // Store for keyboard navigation
        if (!isMaxed) {
            if (!this.upgradeButtons) this.upgradeButtons = [];
            this.upgradeButtons.push({
                area: buttonArea,
                upgradeKey: upgradeKey,
                container: buttonContainer
            });
        }
    }
    
    createModernFooter(panelWidth, panelHeight) {
        const footerY = -10;
        
        // Footer background
        const footerBg = this.scene.add.graphics();
        footerBg.fillStyle(0x0f3460, 0.8);
        footerBg.fillRoundedRect(-panelWidth/2, footerY, panelWidth, 40, {tl: 0, tr: 0, bl: 20, br: 20});
        this.upgradePanel.add(footerBg);
        
        // Help text
        const helpText = this.scene.add.text(0, footerY + 20, 'Tap outside panel to close • Press ESC to close', {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            fill: '#aaaaaa'
        });
        helpText.setOrigin(0.5, 0.5);
        this.upgradePanel.add(helpText);
    }
    
    // Helper methods
    getUpgradeIcon(upgradeKey) {
        const icons = {
            string: '🎯',
            frame: '🛡️',
            spaceShip: '🚀',
            rocket: '⚡'
        };
        return icons[upgradeKey] || '⚙️';
    }
    
    getUpgradeName(upgradeKey) {
        const names = {
            string: 'STRING',
            frame: 'FRAME',
            spaceShip: 'SPACE SHIP',
            rocket: 'ROCKET'
        };
        return names[upgradeKey] || upgradeKey.toUpperCase();
    }
    
    getUpgradeStats(upgradeKey) {
        const upgrade = this.scene.upgradeSystem.upgrades[upgradeKey];
        switch (upgradeKey) {
            case 'string':
                return `Length: ${upgrade.length}m`;
            case 'frame':
                return `Strength: ${upgrade.strength}`;
            case 'spaceShip':
                return `Speed: ${upgrade.speed}`;
            case 'rocket':
                const info = this.getRocketUpgradeInfo(upgrade);
                return `Thrust: ${info.thrust} | Fuel: ${info.fuel}`;
            default:
                return 'Level ' + upgrade.level;
        }
    }
    
    lightenColor(color, amount = 0.2) {
        const r = (color >> 16) & 255;
        const g = (color >> 8) & 255;
        const b = color & 255;
        
        const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
        const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
        const newB = Math.min(255, Math.floor(b + (255 - b) * amount));
        
        return (newR << 16) | (newG << 8) | newB;
    }
    
    playButtonSound() {
        // Add sound effect if available
        if (this.scene.sound && this.scene.sound.get('buttonClick')) {
            this.scene.sound.play('buttonClick', { volume: 0.3 });
        }
    }
    
    announceToScreenReader(message) {
        // Create invisible element for screen reader announcement
        if (!this.screenReaderAnnouncer) {
            this.screenReaderAnnouncer = this.scene.add.text(-1000, -1000, '', {
                fontSize: '1px',
                fill: '#000000'
            });
        }
        this.screenReaderAnnouncer.setText(message);
    }
    
    setupKeyboardNavigation() {
        // Add keyboard navigation support
        if (this.scene.input.keyboard) {
            this.escKey = this.scene.input.keyboard.addKey('ESC');
            this.escKey.on('down', () => {
                this.closeUpgradeShop();
            });
            
            // Tab navigation through buttons
            this.tabKey = this.scene.input.keyboard.addKey('TAB');
            this.enterKey = this.scene.input.keyboard.addKey('ENTER');
            this.spaceKey = this.scene.input.keyboard.addKey('SPACE');
            
            let currentButtonIndex = 0;
            this.tabKey.on('down', () => {
                if (this.upgradeButtons && this.upgradeButtons.length > 0) {
                    currentButtonIndex = (currentButtonIndex + 1) % this.upgradeButtons.length;
                    this.highlightButton(currentButtonIndex);
                }
            });
            
            this.enterKey.on('down', () => {
                if (this.upgradeButtons && this.upgradeButtons[currentButtonIndex]) {
                    this.buyUpgrade(this.upgradeButtons[currentButtonIndex].upgradeKey);
                }
            });
            
            this.spaceKey.on('down', () => {
                if (this.upgradeButtons && this.upgradeButtons[currentButtonIndex]) {
                    this.buyUpgrade(this.upgradeButtons[currentButtonIndex].upgradeKey);
                }
            });
        }
    }
    
    highlightButton(index) {
        // Remove previous highlights
        if (this.upgradeButtons) {
            this.upgradeButtons.forEach(button => {
                button.container.setScale(1);
            });
            
            // Highlight current button
            if (this.upgradeButtons[index]) {
                this.upgradeButtons[index].container.setScale(1.05);
            }
        }
    }
    
    setupScrollIndicators(panelWidth, panelHeight) {
        // Add scroll indicators if content overflows
        // This would be implemented based on content height
    }
    
    setupResponsiveHandling() {
        // Handle responsive updates
        // This would listen for resize events and update layout accordingly
    }
    
    updateUpgradeShop() {
        if (!this.upgradeShopContainer) return;
        
        // Update coins display
        if (this.upgradeShopCoinsText) {
            this.upgradeShopCoinsText.setText(`${this.scene.coins}`);
        }
        
        // Update each upgrade ribbon
        const upgrades = ['string', 'frame', 'spaceShip', 'rocket'];
        upgrades.forEach(key => {
            this.updateUpgradeRibbon(key);
        });
    }
    
    updateUpgradeRibbon(upgradeKey) {
        const elements = this.upgradeShopElements[upgradeKey];
        if (!elements) return;
        
        const upgrade = this.scene.upgradeSystem.upgrades[upgradeKey];
        const isMaxed = upgrade.level >= upgrade.maxLevel;
        const canAfford = this.scene.coins >= upgrade.cost;
        
        // Update level text
        elements.levelText.setText(`Level ${upgrade.level}/${upgrade.maxLevel}`);
        
        // Update stats text
        elements.statsText.setText(this.getUpgradeStats(upgradeKey));
        
        // Update background color
        let bgColor = 0x2a2a3e;
        let borderColor = 0x3a3a5e;
        
        if (isMaxed) {
            bgColor = 0x1a3a1a;
            borderColor = 0x2a5a2a;
        } else if (canAfford) {
            bgColor = 0x3a2a1a;
            borderColor = 0x5a4a2a;
        }
        
        elements.background.clear();
        elements.background.fillStyle(bgColor, 1);
        elements.background.fillRoundedRect(-this.panelWidth/2 + 20, -45, this.panelWidth - 40, 90, 12);
        elements.background.lineStyle(2, borderColor, 1);
        elements.background.strokeRoundedRect(-this.panelWidth/2 + 20, -45, this.panelWidth - 40, 90, 12);
        
        // Update progress ribbon
        this.updateProgressRibbon(elements.container, upgrade, this.panelWidth - 40, 90);
        
        // Recreate the button with updated state
        this.recreateRibbonButton(elements.container, upgradeKey, this.panelWidth - 40, 90, isMaxed, canAfford);
    }
    
    updateProgressRibbon(ribbonContainer, upgrade, width, height) {
        // Find existing progress bar
        const existingProgress = ribbonContainer.list.find(child => child.progressBar === true);
        const newProgressWidth = (upgrade.level / upgrade.maxLevel) * (width - 20);
        
        if (existingProgress) {
            // Animate existing progress bar
            if (newProgressWidth > 0) {
                // Create temporary graphics for animation
                const tempProgress = this.scene.add.graphics();
                tempProgress.fillStyle(0x4a6a4a, 0.6);
                tempProgress.fillRoundedRect(-width/2 + 10, -height/2 + 10, 0, height - 20, 8);
                tempProgress.progressBar = true;
                ribbonContainer.add(tempProgress);
                
                // Remove old progress bar
                existingProgress.destroy();
                
                // Animate new progress bar
                this.scene.tweens.add({
                    targets: { width: 0 },
                    width: newProgressWidth,
                    duration: 400,
                    ease: 'Cubic.easeOut',
                    onUpdate: (tween) => {
                        const currentWidth = tween.getValue();
                        tempProgress.clear();
                        tempProgress.fillStyle(0x4a6a4a, 0.6);
                        tempProgress.fillRoundedRect(-width/2 + 10, -height/2 + 10, currentWidth, height - 20, 8);
                        
                        // Add pulsing effect during animation
                        const pulse = Math.sin(tween.progress * Math.PI * 3) * 0.1 + 0.6;
                        tempProgress.fillStyle(0x4a6a4a, pulse);
                        tempProgress.fillRoundedRect(-width/2 + 10, -height/2 + 10, currentWidth, height - 20, 8);
                    },
                    onComplete: () => {
                        // Final render with normal alpha
                        tempProgress.clear();
                        tempProgress.fillStyle(0x4a6a4a, 0.6);
                        tempProgress.fillRoundedRect(-width/2 + 10, -height/2 + 10, newProgressWidth, height - 20, 8);
                        
                        // Add completion flash
                        this.scene.tweens.add({
                            targets: tempProgress,
                            alpha: 0.3,
                            duration: 100,
                            yoyo: true,
                            repeat: 1,
                            ease: 'Cubic.easeInOut'
                        });
                    }
                });
            } else {
                // Remove progress bar if no progress
                existingProgress.destroy();
            }
        } else {
            // Create new progress bar with animation
            if (newProgressWidth > 0) {
                const progressBg = this.scene.add.graphics();
                progressBg.fillStyle(0x4a6a4a, 0.6);
                progressBg.fillRoundedRect(-width/2 + 10, -height/2 + 10, 0, height - 20, 8);
                progressBg.progressBar = true;
                ribbonContainer.add(progressBg);
                
                // Animate to full width
                this.scene.tweens.add({
                    targets: { width: 0 },
                    width: newProgressWidth,
                    duration: 500,
                    ease: 'Cubic.easeOut',
                    onUpdate: (tween) => {
                        const currentWidth = tween.getValue();
                        progressBg.clear();
                        progressBg.fillStyle(0x4a6a4a, 0.6);
                        progressBg.fillRoundedRect(-width/2 + 10, -height/2 + 10, currentWidth, height - 20, 8);
                    }
                });
            }
        }
    }
    
    recreateRibbonButton(ribbonContainer, upgradeKey, width, height, isMaxed, canAfford) {
        // Remove existing button
        const existingButton = ribbonContainer.list.find(child => child.ribbonButton === true);
        if (existingButton) {
            // Remove from upgrade buttons array
            if (this.upgradeButtons) {
                this.upgradeButtons = this.upgradeButtons.filter(btn => btn.upgradeKey !== upgradeKey);
            }
            existingButton.destroy();
        }
        
        // Create new button
        const buttonWidth = 80;
        const buttonHeight = 36;
        const buttonX = width/2 - buttonWidth/2 - 20;
        
        const buttonContainer = this.scene.add.container(buttonX, 0);
        buttonContainer.ribbonButton = true; // Mark for identification
        ribbonContainer.add(buttonContainer);
        
        // Button background
        const buttonBg = this.scene.add.graphics();
        let buttonColor = 0x333366;
        let buttonText = 'BUY';
        
        if (isMaxed) {
            buttonColor = 0x2a5a2a;
            buttonText = 'MAX';
        } else if (canAfford) {
            buttonColor = 0x4a6a2a;
        } else {
            buttonColor = 0x5a2a2a;
        }
        
        buttonBg.fillStyle(buttonColor, 1);
        buttonBg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
        buttonBg.lineStyle(2, this.lightenColor(buttonColor), 1);
        buttonBg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
        buttonContainer.add(buttonBg);
        
        // Button text
        const text = this.scene.add.text(0, -2, buttonText, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#ffffff',
            fontWeight: 'bold'
        });
        text.setOrigin(0.5, 0.5);
        buttonContainer.add(text);
        
        // Cost text
        if (!isMaxed) {
            const upgrade = this.scene.upgradeSystem.upgrades[upgradeKey];
            const costText = this.scene.add.text(0, 12, `${upgrade.cost}💰`, {
                fontSize: '10px',
                fontFamily: 'Arial, sans-serif',
                fill: canAfford ? '#ffd700' : '#ff6666'
            });
            costText.setOrigin(0.5, 0.5);
            buttonContainer.add(costText);
        }
        
        // Interactive area
        const buttonArea = this.scene.add.rectangle(0, 0, buttonWidth + 10, buttonHeight + 10, 0x000000, 0);
        buttonArea.setInteractive({ useHandCursor: !isMaxed });
        buttonContainer.add(buttonArea);
        
        // Button interactions
        if (!isMaxed) {
            buttonArea.on('pointerdown', () => {
                this.playButtonSound();
                this.buyUpgrade(upgradeKey);
            });
            
            buttonArea.on('pointerover', () => {
                buttonBg.clear();
                buttonBg.fillStyle(this.lightenColor(buttonColor), 1);
                buttonBg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
                buttonBg.lineStyle(2, this.lightenColor(buttonColor, 0.4), 1);
                buttonBg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
                
                // Add smooth scale animation
                this.scene.tweens.add({
                    targets: buttonContainer,
                    scaleX: 1.02,
                    scaleY: 1.02,
                    duration: 100,
                    ease: 'Cubic.easeOut'
                });
            });
            
            buttonArea.on('pointerout', () => {
                buttonBg.clear();
                buttonBg.fillStyle(buttonColor, 1);
                buttonBg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
                buttonBg.lineStyle(2, this.lightenColor(buttonColor), 1);
                buttonBg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
                
                // Return to normal scale
                this.scene.tweens.add({
                    targets: buttonContainer,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100,
                    ease: 'Cubic.easeOut'
                });
            });
            
            // Add to upgrade buttons array for keyboard navigation
            if (!this.upgradeButtons) this.upgradeButtons = [];
            this.upgradeButtons.push({
                area: buttonArea,
                upgradeKey: upgradeKey,
                container: buttonContainer
            });
        }
    }

    closeUpgradeShop() {
        if (this.upgradeShopContainer) {
            // Clean up keyboard listeners
            if (this.escKey) this.escKey.destroy();
            if (this.tabKey) this.tabKey.destroy();
            if (this.enterKey) this.enterKey.destroy();
            if (this.spaceKey) this.spaceKey.destroy();
            
            // Clean up visual debug if active
            if (this.visualDebugGraphics) {
                this.visualDebugGraphics.destroy();
                this.visualDebugGraphics = null;
            }
            
            // Clean up mouse debug if active
            if (this.mouseDebugActive) {
                this.scene.input.off('pointermove', this.mouseDebugHandler);
                this.scene.input.off('pointerdown', this.mouseDebugHandler);
                this.mouseDebugActive = false;
            }
            
            // Store reference to container for animation
            const containerToClose = this.upgradeShopContainer;
            const panelToClose = this.upgradePanel;
            
            // Immediately clear the container reference so input handlers work
            this.upgradeShopContainer = null;
            this.upgradePanel = null;
            this.upgradeShopElements = {};
            this.upgradeShopCoinsText = null;
            this.upgradeButtons = [];
            this.closeButton = null;
            
            // Re-enable game interactions
            this.enableGameInteractions();
            
            // Slide down animation
            this.scene.tweens.add({
                targets: panelToClose,
                y: this.scene.game.config.height + 50,
                duration: 300,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    containerToClose.destroy();
                    this.announceToScreenReader("Upgrade shop closed");
                }
            });
        }
    }

    getRocketUpgradeInfo(upgrade) {
        const level = upgrade.level;
        if (level === 0) {
            return "Unlock basic rocket with fuel system";
        }
        
        // Calculate stats for current level
        const thrust = upgrade.baseThrust + (level * 2);
        const fuelCapacity = upgrade.baseFuelCapacity + (level * 20);
        const fuelEfficiency = Math.round((1 - (level * 0.08)) * 100);
        const canMoveUp = level >= 3;
        
        let info = `Thrust: ${thrust} | Fuel: ${fuelCapacity} | Efficiency: ${fuelEfficiency}%`;
        
        if (level < 3) {
            info += " | Left/Right only";
        } else {
            info += " | Full movement (UP unlocked)";
        }
        
        return info;
    }

    buyUpgrade(key) {
        const result = this.scene.upgradeSystem.buyUpgrade(key);
        
        if (result !== null) {
            // Add success feedback animation
            this.showUpgradeSuccessAnimation(key);
            
            // Update the entire upgrade shop display
            this.updateUpgradeShop();
            
            // CRITICAL FIX: Apply upgrade effects immediately to the game
            // Call the GameScene's buyUpgrade method to apply effects to game state
            this.scene.buyUpgrade(key);
            
            // Play purchase sound effect
            this.playButtonSound();
            
            // Update building indicator
            this.updateUpgradeBuildingIndicator();
        }
    }
    
    showUpgradeSuccessAnimation(upgradeKey) {
        const elements = this.upgradeShopElements[upgradeKey];
        if (!elements) return;
        
        // Create success flash overlay
        const flashOverlay = this.scene.add.graphics();
        flashOverlay.fillStyle(0x4a6a2a, 0.7);
        flashOverlay.fillRoundedRect(-this.panelWidth/2 + 20, -45, this.panelWidth - 40, 90, 12);
        elements.container.add(flashOverlay);
        
        // Flash animation
        this.scene.tweens.add({
            targets: flashOverlay,
            alpha: 0,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                flashOverlay.destroy();
            }
        });
        
        // Create success text
        const successText = this.scene.add.text(0, 0, 'UPGRADED!', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fill: '#4a6a2a',
            fontWeight: 'bold'
        });
        successText.setOrigin(0.5, 0.5);
        successText.setAlpha(0);
        elements.container.add(successText);
        
        // Success text animation
        this.scene.tweens.add({
            targets: successText,
            alpha: 1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: successText,
                    alpha: 0,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 300,
                    delay: 200,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        successText.destroy();
                    }
                });
            }
        });
        
        // Add coin particles effect
        this.createCoinParticles(elements.container);
    }
    
    createCoinParticles(container) {
        const particleCount = 8;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.scene.add.text(0, 0, '💰', {
                fontSize: '12px'
            });
            particle.setOrigin(0.5, 0.5);
            particle.setAlpha(0.8);
            container.add(particle);
            particles.push(particle);
            
            // Random direction for particles
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = 50;
            const targetX = Math.cos(angle) * distance;
            const targetY = Math.sin(angle) * distance;
            
            // Animate particle
            this.scene.tweens.add({
                targets: particle,
                x: targetX,
                y: targetY,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 600,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }



    updateUpgradeBuildingIndicator() {
        // Update indicator based on available upgrades
        if (this.upgradeIndicator) {
            const canAffordAnyUpgrade = this.canAffordAnyUpgrade();
            
            if (canAffordAnyUpgrade) {
                // Make indicator more prominent when upgrades are available
                this.upgradeIndicator.getAll().forEach(child => {
                    if (child.fillStyle) {
                        child.clear();
                        child.fillStyle(0x00FF00, 1); // Green when affordable
                        child.fillCircle(0, 0, 15);
                        child.lineStyle(2, 0xFFFFFF, 0.9);
                        child.strokeCircle(0, 0, 15);
                    }
                });
            } else {
                // Normal blue indicator
                this.upgradeIndicator.getAll().forEach(child => {
                    if (child.fillStyle) {
                        child.clear();
                        child.fillStyle(0x4A90E2, 0.8); // Blue when not affordable
                        child.fillCircle(0, 0, 15);
                        child.lineStyle(2, 0xFFFFFF, 0.9);
                        child.strokeCircle(0, 0, 15);
                    }
                });
            }
        }
    }

    canAffordAnyUpgrade() {
        const coins = this.scene.upgradeSystem.getCoins();
        const upgrades = this.scene.upgradeSystem.upgrades;
        
        for (const key in upgrades) {
            const upgrade = upgrades[key];
            if (upgrade.level < upgrade.maxLevel && coins >= upgrade.cost) {
                return true;
            }
        }
        return false;
    }
    
    setupButtonDebugHotkey() {
        // Add keyboard listener for 'B' key to debug button alignment
        this.scene.input.keyboard.on('keydown-B', () => {
            this.debugButtonAlignment();
        });
        
        // Add keyboard listener for 'V' key to toggle visual debug
        this.scene.input.keyboard.on('keydown-V', () => {
            this.toggleVisualButtonDebug();
        });
        
        // Add keyboard listener for 'M' key to show mouse position debug
        this.scene.input.keyboard.on('keydown-M', () => {
            this.toggleMousePositionDebug();
        });
        
        // Add keyboard listener for 'D' key to check DPI compatibility
        this.scene.input.keyboard.on('keydown-D', () => {
            this.checkDPICompatibility();
        });
        
        console.log('🔧 Debug Hotkeys Added:');
        console.log('  - Press "B" to log button alignment details');
        console.log('  - Press "V" to toggle visual button debug overlay');
        console.log('  - Press "M" to toggle mouse position debug');
        console.log('  - Press "D" to check DPI compatibility');
        console.log('  - Open upgrade shop first, then use debug hotkeys');
    }
    
    debugButtonAlignment() {
        console.log('🔍 ==================== BUTTON ALIGNMENT DEBUG ====================');
        console.log('📍 Upgrade Shop Status:', this.upgradeShopContainer ? 'OPEN' : 'CLOSED');
        
        if (!this.upgradeShopContainer) {
            console.log('❌ Upgrade shop is not open - no buttons to debug');
            return;
        }
        
        console.log('📊 Container Info:');
        console.log('  - Container Position:', { x: this.upgradeShopContainer.x, y: this.upgradeShopContainer.y });
        console.log('  - Container Scale:', { x: this.upgradeShopContainer.scaleX, y: this.upgradeShopContainer.scaleY });
        console.log('  - Container Depth:', this.upgradeShopContainer.depth);
        
        console.log('🎯 Button Alignment Analysis:');
        
        // Debug each upgrade row
        Object.keys(this.upgradeShopElements).forEach((key, index) => {
            const row = this.upgradeShopElements[key];
            console.log(`\n🔹 ${key.toUpperCase()} Upgrade (Row ${index + 1}):`);
            
            if (row.buyButton && row.buttonArea) {
                // Calculate world positions
                const containerWorldX = this.upgradeShopContainer.x;
                const containerWorldY = this.upgradeShopContainer.y;
                const rowWorldY = containerWorldY + row.container.y;
                
                // Button text position
                const buttonTextX = containerWorldX + row.buyButton.x;
                const buttonTextY = rowWorldY + row.buyButton.y;
                
                // Button area position
                const buttonAreaX = containerWorldX + row.buttonArea.x;
                const buttonAreaY = rowWorldY + row.buttonArea.y;
                
                // Calculate button text bounds
                const buttonTextBounds = row.buyButton.getBounds();
                const buttonText = row.buyButton.text;
                
                console.log('  📝 Button Text Info:');
                console.log('    - Text:', `"${buttonText}"`);
                console.log('    - Origin:', { x: row.buyButton.originX, y: row.buyButton.originY });
                console.log('    - Local Position:', { x: row.buyButton.x, y: row.buyButton.y });
                console.log('    - World Position:', { x: buttonTextX, y: buttonTextY });
                console.log('    - Text Bounds:', {
                    x: buttonTextBounds.x,
                    y: buttonTextBounds.y,
                    width: buttonTextBounds.width,
                    height: buttonTextBounds.height
                });
                
                console.log('  🎯 Button Area Info:');
                console.log('    - Local Position:', { x: row.buttonArea.x, y: row.buttonArea.y });
                console.log('    - World Position:', { x: buttonAreaX, y: buttonAreaY });
                console.log('    - Size:', { width: row.buttonArea.width, height: row.buttonArea.height });
                console.log('    - Interactive:', row.buttonArea.input ? 'YES' : 'NO');
                
                // Calculate alignment differences
                const xDifference = buttonAreaX - buttonTextX;
                const yDifference = buttonAreaY - buttonTextY;
                
                console.log('  ⚠️  Alignment Analysis:');
                console.log('    - X Offset:', xDifference.toFixed(2), 'pixels');
                console.log('    - Y Offset:', yDifference.toFixed(2), 'pixels');
                
                // Check if button area covers text properly
                const textLeft = buttonTextBounds.x;
                const textRight = buttonTextBounds.x + buttonTextBounds.width;
                const textTop = buttonTextBounds.y;
                const textBottom = buttonTextBounds.y + buttonTextBounds.height;
                
                const areaLeft = buttonAreaX - (row.buttonArea.width / 2);
                const areaRight = buttonAreaX + (row.buttonArea.width / 2);
                const areaTop = buttonAreaY - (row.buttonArea.height / 2);
                const areaBottom = buttonAreaY + (row.buttonArea.height / 2);
                
                const coversText = (areaLeft <= textLeft && areaRight >= textRight && 
                                 areaTop <= textTop && areaBottom >= textBottom);
                
                console.log('  ✅ Coverage Analysis:');
                console.log('    - Text Bounds:', { left: textLeft.toFixed(1), right: textRight.toFixed(1), top: textTop.toFixed(1), bottom: textBottom.toFixed(1) });
                console.log('    - Area Bounds:', { left: areaLeft.toFixed(1), right: areaRight.toFixed(1), top: areaTop.toFixed(1), bottom: areaBottom.toFixed(1) });
                console.log('    - Covers Text:', coversText ? '✅ YES' : '❌ NO');
                
                if (!coversText) {
                    console.log('  🚨 ISSUE DETECTED: Button area does not properly cover text!');
                }
                
                if (Math.abs(xDifference) > 5 || Math.abs(yDifference) > 5) {
                    console.log('  🚨 ISSUE DETECTED: Significant alignment offset!');
                }
                
            } else if (row.buyButton && !row.buttonArea) {
                console.log('  ❌ Has button text but NO button area!');
            } else {
                console.log('  ✅ Max level reached - no button to debug');
            }
        });
        
        console.log('\n🔧 Debug Tips:');
        console.log('  - Button text should be at (170, 15) relative to row');
        console.log('  - Button area should be at (170, 15) with same origin as text');
        console.log('  - Area should be sized to match text bounds + 24px padding for 2K monitor compatibility');
        console.log('  - For high DPI displays (>1.0), clicks are more forgiving');
        console.log('  - Look for alignment offsets > 5 pixels or coverage issues');
        
        console.log('🔍 ==================== END DEBUG ====================\n');
    }
    
    toggleVisualButtonDebug() {
        if (!this.upgradeShopContainer) {
            console.log('❌ Upgrade shop is not open - no buttons to debug visually');
            return;
        }
        
        if (this.visualDebugGraphics) {
            // Remove existing debug graphics
            this.visualDebugGraphics.destroy();
            this.visualDebugGraphics = null;
            console.log('🔍 Visual button debug: OFF');
        } else {
            // Create visual debug graphics
            this.visualDebugGraphics = this.scene.add.graphics();
            this.visualDebugGraphics.setDepth(5000); // Above everything
            this.visualDebugGraphics.setScrollFactor(0); // Fixed to camera
            
            this.drawButtonDebugOverlay();
            console.log('🔍 Visual button debug: ON');
        }
    }
    
    drawButtonDebugOverlay() {
        if (!this.visualDebugGraphics || !this.upgradeShopContainer) return;
        
        this.visualDebugGraphics.clear();
        
        // Debug each upgrade row
        Object.keys(this.upgradeShopElements).forEach((key, index) => {
            const row = this.upgradeShopElements[key];
            
            if (row.buyButton && row.buttonArea) {
                // Calculate world positions
                const containerWorldX = this.upgradeShopContainer.x;
                const containerWorldY = this.upgradeShopContainer.y;
                const rowWorldY = containerWorldY + row.container.y;
                
                // Button text bounds
                const buttonTextBounds = row.buyButton.getBounds();
                
                // Button area bounds
                const buttonAreaX = containerWorldX + row.buttonArea.x;
                const buttonAreaY = rowWorldY + row.buttonArea.y;
                const areaLeft = buttonAreaX - (row.buttonArea.width / 2);
                const areaRight = buttonAreaX + (row.buttonArea.width / 2);
                const areaTop = buttonAreaY - (row.buttonArea.height / 2);
                const areaBottom = buttonAreaY + (row.buttonArea.height / 2);
                
                // Draw button text bounds (blue)
                this.visualDebugGraphics.lineStyle(2, 0x0000FF, 0.8);
                this.visualDebugGraphics.strokeRect(
                    buttonTextBounds.x,
                    buttonTextBounds.y,
                    buttonTextBounds.width,
                    buttonTextBounds.height
                );
                
                // Draw button area bounds (red)
                this.visualDebugGraphics.lineStyle(2, 0xFF0000, 0.8);
                this.visualDebugGraphics.strokeRect(
                    areaLeft,
                    areaTop,
                    row.buttonArea.width,
                    row.buttonArea.height
                );
                
                // Draw center points
                this.visualDebugGraphics.fillStyle(0x0000FF, 1);
                this.visualDebugGraphics.fillCircle(
                    buttonTextBounds.x + buttonTextBounds.width / 2,
                    buttonTextBounds.y + buttonTextBounds.height / 2,
                    3
                );
                
                this.visualDebugGraphics.fillStyle(0xFF0000, 1);
                this.visualDebugGraphics.fillCircle(buttonAreaX, buttonAreaY, 3);
                
                // Add labels
                const labelStyle = {
                    fontSize: '12px',
                    fill: '#FFFFFF',
                    backgroundColor: '#000000',
                    padding: { x: 4, y: 2 }
                };
                
                this.scene.add.text(
                    buttonTextBounds.x,
                    buttonTextBounds.y - 20,
                    `${key.toUpperCase()} Text`,
                    labelStyle
                ).setDepth(5001).setScrollFactor(0);
                
                this.scene.add.text(
                    areaLeft,
                    areaTop - 20,
                    `${key.toUpperCase()} Area`,
                    { ...labelStyle, fill: '#FF0000' }
                ).setDepth(5001).setScrollFactor(0);
            }
        });
        
        // Add legend
        const legendY = 50;
        this.scene.add.text(50, legendY, 'BUTTON DEBUG LEGEND:', {
            fontSize: '14px',
            fill: '#FFFFFF',
            backgroundColor: '#000000',
            padding: { x: 6, y: 4 }
        }).setDepth(5001).setScrollFactor(0);
        
        this.scene.add.text(50, legendY + 25, '🔵 Blue: Button Text Bounds', {
            fontSize: '12px',
            fill: '#0000FF',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        }).setDepth(5001).setScrollFactor(0);
        
        this.scene.add.text(50, legendY + 45, '🔴 Red: Button Click Area', {
            fontSize: '12px',
            fill: '#FF0000',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        }).setDepth(5001).setScrollFactor(0);
        
                 this.scene.add.text(50, legendY + 65, 'Perfect alignment: Red should cover Blue', {
             fontSize: '10px',
             fill: '#FFFF00',
             backgroundColor: '#000000',
             padding: { x: 4, y: 2 }
         }).setDepth(5001).setScrollFactor(0);
     }
     
     disableGameInteractions() {
         // Store original interaction states
         this.originalInteractionStates = {
             playerInteractive: false,
             buildingInteractive: false,
             isPulling: false
         };
         
         // Disable player interactions
         if (this.scene.player && this.scene.player.input) {
             this.originalInteractionStates.playerInteractive = this.scene.player.input.enabled;
             this.scene.player.disableInteractive();
         }
         
         // Disable upgrade building interactions (player can't click it while shop is open)
         if (this.upgradeBuilding && this.upgradeBuilding.input) {
             this.originalInteractionStates.buildingInteractive = this.upgradeBuilding.input.enabled;
             this.upgradeBuilding.disableInteractive();
         }
         
         // Store and disable pulling state
         this.originalInteractionStates.isPulling = this.scene.isPulling;
         this.scene.isPulling = false;
         
         // Disable launching keyboard inputs
         this.disabledKeys = [];
         ['SPACE', 'ENTER', 'W', 'A', 'S', 'D'].forEach(keyCode => {
             const key = this.scene.input.keyboard.addKey(keyCode);
             if (key.enabled) {
                 key.enabled = false;
                 this.disabledKeys.push(key);
             }
         });
         
         // Hide launch ready indicator and related elements
         this.hideLaunchReadyIndicators();
         
         console.log('🔒 Game interactions disabled - upgrade shop modal active');
     }
     
     enableGameInteractions() {
         // Restore original interaction states
         if (this.originalInteractionStates) {
             // Restore player interactions
             if (this.scene.player && this.originalInteractionStates.playerInteractive) {
                 this.scene.player.setInteractive();
             }
             
             // Restore upgrade building interactions
             if (this.upgradeBuilding && this.originalInteractionStates.buildingInteractive) {
                 this.upgradeBuilding.setInteractive();
             }
             
             // Restore pulling state
             this.scene.isPulling = this.originalInteractionStates.isPulling;
         }
         
         // Re-enable disabled keyboard inputs
         if (this.disabledKeys) {
             this.disabledKeys.forEach(key => {
                 key.enabled = true;
             });
             this.disabledKeys = [];
         }
         
         console.log('🔓 Game interactions enabled - upgrade shop closed');
     }
     
     toggleMousePositionDebug() {
         if (!this.upgradeShopContainer) {
             console.log('❌ Upgrade shop is not open - no mouse debug needed');
             return;
         }
         
         if (this.mouseDebugActive) {
             // Remove mouse debug
             this.scene.input.off('pointermove', this.mouseDebugHandler);
             this.scene.input.off('pointerdown', this.mouseDebugHandler);
             this.mouseDebugActive = false;
             console.log('🖱️ Mouse position debug: OFF');
         } else {
             // Add mouse debug
             this.mouseDebugHandler = (pointer) => {
                 console.log('🖱️ Mouse position:', {
                     screenX: pointer.x,
                     screenY: pointer.y,
                     worldX: pointer.worldX,
                     worldY: pointer.worldY,
                     containerCenterX: this.upgradeShopContainer.x,
                     containerCenterY: this.upgradeShopContainer.y,
                     relativeToContainerX: pointer.x - this.upgradeShopContainer.x,
                     relativeToContainerY: pointer.y - this.upgradeShopContainer.y,
                     screenDimensions: {
                         width: this.scene.scale.width,
                         height: this.scene.scale.height
                     },
                     cameraDimensions: {
                         width: this.scene.cameras.main.width,
                         height: this.scene.cameras.main.height
                     }
                 });
             };
             
             this.scene.input.on('pointermove', this.mouseDebugHandler);
             this.scene.input.on('pointerdown', this.mouseDebugHandler);
             this.mouseDebugActive = true;
             console.log('🖱️ Mouse position debug: ON - move mouse around upgrade shop');
         }
     }

    /**
     * Check if corrected coordinates are within button bounds
     * @param {Object} correctedCoords - Corrected coordinates from convertPointerToGameCoords
     * @param {Phaser.GameObjects.Rectangle} buttonArea - The button area object
     * @returns {boolean} True if within bounds
     */
    isClickWithinButtonBounds(correctedCoords, buttonArea) {
        const transform = buttonArea.getWorldTransformMatrix();
        const buttonCenterX = transform.tx;
        const buttonCenterY = transform.ty;
        const halfWidth = buttonArea.width / 2;
        const halfHeight = buttonArea.height / 2;
        
        const bounds = {
            left: buttonCenterX - halfWidth,
            right: buttonCenterX + halfWidth,
            top: buttonCenterY - halfHeight,
            bottom: buttonCenterY + halfHeight
        };
        
        const isWithin = correctedCoords.x >= bounds.left && 
                        correctedCoords.x <= bounds.right &&
                        correctedCoords.y >= bounds.top && 
                        correctedCoords.y <= bounds.bottom;
        
        console.log('Button bounds check:', {
            correctedCoords: { x: correctedCoords.x, y: correctedCoords.y },
            buttonBounds: bounds,
            isWithin: isWithin,
            buttonCenter: { x: buttonCenterX, y: buttonCenterY },
            buttonSize: { width: buttonArea.width, height: buttonArea.height }
        });
        
        return isWithin;
    }

    /**
     * Create DPI-aware button interaction for high DPI displays
     * @param {Phaser.GameObjects.Rectangle} buttonArea - The button area
     * @param {string} buttonKey - Key identifying the button
     * @param {Function} callback - Callback function when button is clicked
     */
    setupDPIAwareButtonInteraction(buttonArea, buttonKey, callback) {
        // Remove existing interaction to avoid duplicates
        buttonArea.removeInteractive();
        
        // Create custom interaction that handles DPI scaling
        const interactionArea = new Phaser.Geom.Rectangle(
            -buttonArea.width / 2,
            -buttonArea.height / 2,
            buttonArea.width,
            buttonArea.height
        );
        
        buttonArea.setInteractive(interactionArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true })
        .on('pointerdown', (pointer) => {
            const correctedCoords = this.convertPointerToGameCoords(pointer);
            
            // For high DPI displays, be more forgiving with bounds checking
            if (this.devicePixelRatio > 1) {
                const isWithinBounds = this.isClickWithinButtonBounds(correctedCoords, buttonArea);
                const expandedBounds = this.isClickWithinExpandedButtonBounds(correctedCoords, buttonArea, 30);
                
                console.log(`High DPI click validation for ${buttonKey}:`, {
                    devicePixelRatio: this.devicePixelRatio,
                    isWithinBounds: isWithinBounds,
                    isWithinExpandedBounds: expandedBounds,
                    correctedCoords: correctedCoords,
                    willAcceptClick: true // Always accept for moderate high DPI
                });
                
                // For devicePixelRatio between 1.0-2.0, always accept (with larger button areas)
                // For very high DPI (2.0+), check expanded bounds
                if (this.devicePixelRatio < 2.0 || isWithinBounds || expandedBounds) {
                    callback(pointer, correctedCoords);
                } else {
                    console.log(`Very high DPI click outside all bounds for ${buttonKey}, trying fallback`);
                    // Even for very high DPI, try the callback as a fallback
                    callback(pointer, correctedCoords);
                }
            } else {
                // Normal DPI handling
                callback(pointer, correctedCoords);
            }
        });
    }

    /**
     * Detect if user is on high DPI display and provide compatibility warnings
     * @returns {Object} DPI information and compatibility status
     */
    checkDPICompatibility() {
        const dpiInfo = {
            devicePixelRatio: this.devicePixelRatio,
            isHighDPI: this.devicePixelRatio > 1,
            is2K: this.devicePixelRatio >= 1.5,
            is4K: this.devicePixelRatio >= 2.0,
            windowSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            screenSize: {
                width: window.screen.width,
                height: window.screen.height
            },
            canvasSize: {
                width: this.scene.sys.canvas.width,
                height: this.scene.sys.canvas.height
            },
            gameSize: {
                width: this.scene.cameras.main.width,
                height: this.scene.cameras.main.height
            }
        };
        
        // Provide helpful warnings for high DPI displays
        if (dpiInfo.isHighDPI) {
            console.log('🖥️ High DPI Display Detected:', dpiInfo);
            console.log('💡 DPI Compatibility Tips:');
            console.log('   - If buttons are hard to click, try changing browser zoom to 100%');
            console.log('   - If using Windows, try adjusting display scaling');
            console.log('   - Press F12 and check console for detailed click debugging');
        }
        
        return dpiInfo;
    }

    /**
     * Check if corrected coordinates are within expanded button bounds (for high DPI tolerance)
     * @param {Object} correctedCoords - Corrected coordinates from convertPointerToGameCoords
     * @param {Phaser.GameObjects.Rectangle} buttonArea - The button area object
     * @param {number} tolerance - Additional pixels of tolerance
     * @returns {boolean} True if within expanded bounds
     */
    isClickWithinExpandedButtonBounds(correctedCoords, buttonArea, tolerance = 20) {
        const transform = buttonArea.getWorldTransformMatrix();
        const buttonCenterX = transform.tx;
        const buttonCenterY = transform.ty;
        const halfWidth = (buttonArea.width / 2) + tolerance;
        const halfHeight = (buttonArea.height / 2) + tolerance;
        
        const bounds = {
            left: buttonCenterX - halfWidth,
            right: buttonCenterX + halfWidth,
            top: buttonCenterY - halfHeight,
            bottom: buttonCenterY + halfHeight
        };
        
        const isWithin = correctedCoords.x >= bounds.left && 
                        correctedCoords.x <= bounds.right &&
                        correctedCoords.y >= bounds.top && 
                        correctedCoords.y <= bounds.bottom;
        
        console.log('Expanded button bounds check:', {
            tolerance: tolerance,
            correctedCoords: { x: correctedCoords.x, y: correctedCoords.y },
            expandedBounds: bounds,
            isWithinExpanded: isWithin,
            buttonCenter: { x: buttonCenterX, y: buttonCenterY },
            expandedSize: { width: buttonArea.width + (tolerance * 2), height: buttonArea.height + (tolerance * 2) }
        });
        
        return isWithin;
    }
}  