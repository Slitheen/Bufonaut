import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class CollisionSystem {
    constructor(scene) {
        this.scene = scene;
        this.lastLogMessages = new Map(); // Track last log messages to prevent spam
        this.logCooldown = 2000; // 2 seconds cooldown for repeated messages
        
        // Collision cooldown tracking to prevent multiple hits on same object
        this.collisionCooldowns = new Map();
        this.collisionCooldownTime = 1000; // 1000ms cooldown between hits on same object (increased to prevent bouncing loops)
        
        // Velocity tracking to prevent extreme boosts
        this.lastVelocityY = 0;
        this.lastVelocityX = 0;
        this.velocityChangeThreshold = 1000; // Maximum velocity change per collision
        
        // Landing detection optimization
        this.lastLandingCheck = 0;
        this.landingCheckCooldown = 50; // Minimum time between landing checks (ms)
        
        // Launch protection to prevent collisions immediately after launch
        this.launchProtectionActive = false;
        this.launchProtectionStartTime = 0;
        this.launchProtectionDuration = 1500; // 1.5s protection after launch
        this.launchStartY = 0; // Y position when launched
        this.launchProtectionDistance = 300; // Distance player must travel from launch
        
        // Tighter collision boundaries for different object types
        this.collisionBounds = {
            balloon: {
                maxDistance: 80,      // Reduced from 150
                horizontalRadius: 45, // Horizontal collision radius
                verticalRadius: 60,   // Vertical collision radius
                topZone: 0.2,        // Reduced from 0.3 (20% of height)
                bottomZone: 0.4      // Reduced from 0.5 (40% of height)
            },
            bird: {
                maxDistance: 85,      // Reduced from 150
                horizontalRadius: 50, // Horizontal collision radius
                verticalRadius: 55,   // Vertical collision radius  
                topZone: 0.25,       // Reduced from 0.3 (25% of height)
                bottomZone: 0.35     // Reduced from 0.5 (35% of height)
            },
            cloud: {
                maxDistance: 90,      // Clouds can be slightly larger
                horizontalRadius: 60, // Horizontal collision radius
                verticalRadius: 50    // Vertical collision radius
            },
            coin: {
                maxDistance: 40,      // Small collision area for coins
                horizontalRadius: 25, // Horizontal collision radius
                verticalRadius: 25    // Vertical collision radius
            },
            gasTank: {
                maxDistance: 50,      // Medium collision area for gas tanks
                horizontalRadius: 30, // Horizontal collision radius
                verticalRadius: 35    // Vertical collision radius
            }
        };
    }
    
    // Clear all collision cooldowns (called when restarting day)
    clearCooldowns() {
        this.collisionCooldowns.clear();
        this.launchProtectionActive = false;
        console.log('Collision cooldowns cleared');
    }

    // Start launch protection (called when player is launched)
    startLaunchProtection(playerY) {
        this.launchProtectionActive = true;
        this.launchProtectionStartTime = Date.now();
        this.launchStartY = playerY;
        console.log('Launch protection started');
    }

    // Check if launch protection is active
    isLaunchProtectionActive() {
        if (!this.launchProtectionActive) {
            return false;
        }

        const now = Date.now();
        const timeSinceLaunch = now - this.launchProtectionStartTime;
        const distanceFromLaunch = Math.abs(this.scene.player.y - this.launchStartY);

        // End protection if enough time has passed OR player has moved far enough
        if (timeSinceLaunch >= this.launchProtectionDuration || distanceFromLaunch >= this.launchProtectionDistance) {
            this.launchProtectionActive = false;
            console.log('Launch protection ended');
            return false;
        }

        return true;
    }

    // Debug logging utility that prevents spam
    debugLog(message, key = null) {
        const now = Date.now();
        const messageKey = key || message;
        
        if (this.lastLogMessages.has(messageKey)) {
            const lastTime = this.lastLogMessages.get(messageKey);
            if (now - lastTime < this.logCooldown) {
                return; // Skip this log message
            }
        }
        
        console.log(message);
        this.lastLogMessages.set(messageKey, now);
    }

    // Check if collision is on cooldown
    isOnCooldown(objectId) {
        const now = Date.now();
        if (this.collisionCooldowns.has(objectId)) {
            const lastCollision = this.collisionCooldowns.get(objectId);
            if (now - lastCollision < this.collisionCooldownTime) {
                return true;
            }
        }
        return false;
    }

    // Set collision cooldown
    setCooldown(objectId) {
        this.collisionCooldowns.set(objectId, Date.now());
    }

    // Safe velocity change that prevents extreme boosts
    safeVelocityChange(player, newVelX, newVelY) {
        const currentVelX = player.body.velocity.x;
        const currentVelY = player.body.velocity.y;
        
        // Limit velocity to prevent extreme speeds
        const maxVel = GAME_CONSTANTS.PLAYER.MAX_VELOCITY;
        const safeVelX = Math.sign(newVelX) * Math.min(Math.abs(newVelX), maxVel);
        const safeVelY = Math.sign(newVelY) * Math.min(Math.abs(newVelY), maxVel);
        
        // Set the new velocity directly
        player.body.velocity.x = safeVelX;
        player.body.velocity.y = safeVelY;
        
        // Calculate the actual change for logging
        const deltaX = safeVelX - currentVelX;
        const deltaY = safeVelY - currentVelY;
        
        // Log extreme velocity changes for debugging (increased threshold for doubled bounces)
        if (Math.abs(deltaX) > 1000 || Math.abs(deltaY) > 1000) {
            console.warn('Large velocity change detected:', {
                deltaX: deltaX.toFixed(1),
                deltaY: deltaY.toFixed(1),
                finalVelX: safeVelX.toFixed(1),
                finalVelY: safeVelY.toFixed(1)
            });
        }
    }

    // Enhanced 2D spatial validation using elliptical collision bounds
    validateSpatialCollision(player, object, objectType) {
        const bounds = this.collisionBounds[objectType];
        if (!bounds) return true; // Fallback to allow collision if no bounds defined
        
        // Calculate distance in both directions
        const deltaX = Math.abs(player.x - object.x);
        const deltaY = Math.abs(player.y - object.y);
        
        // Check if collision is within elliptical bounds
        const normalizedX = deltaX / bounds.horizontalRadius;
        const normalizedY = deltaY / bounds.verticalRadius;
        const distanceSquared = (normalizedX * normalizedX) + (normalizedY * normalizedY);
        
        const isWithinBounds = distanceSquared <= 1.0;
        
        // Debug logging for spatial validation
        this.debugLog(`${objectType} spatial validation: DeltaX: ${deltaX.toFixed(1)}, DeltaY: ${deltaY.toFixed(1)}, NormX: ${normalizedX.toFixed(2)}, NormY: ${normalizedY.toFixed(2)}, DistSq: ${distanceSquared.toFixed(2)}, Valid: ${isWithinBounds}`, `${objectType}_spatial_debug`);
        
        return isWithinBounds;
    }

    hitBalloon(player, balloon) {
        // Check if launch protection is active
        if (this.isLaunchProtectionActive()) {
            return;
        }
        
        // Check collision cooldown
        if (this.isOnCooldown(balloon.name)) {
            return;
        }
        
        // Enhanced spatial validation using 2D elliptical bounds
        if (!this.validateSpatialCollision(player, balloon, 'balloon')) {
            this.debugLog(`Balloon collision rejected - outside 2D bounds: PlayerX: ${player.x.toFixed(1)}, PlayerY: ${player.y.toFixed(1)}, BalloonX: ${balloon.x.toFixed(1)}, BalloonY: ${balloon.y.toFixed(1)}`, 'balloon_spatial_reject');
            return;
        }
        
        // Set cooldown for this balloon
        this.setCooldown(balloon.name);
        
        // Always delete the balloon when hit (pass-through or interaction)
        // Remove from age tracking before destroying
        if (balloon.name) {
            this.scene.objectSpawner.assetAgeMap.delete(balloon.name);
        }

        // Deactivate the balloon, hide it, and disable its physics body.
        balloon.setActive(false).setVisible(false);
        balloon.body.enable = false;
        
        // Only apply physics when falling down (not when flying up)
        if (player.body.velocity.y < 0) {
            // Pass through when flying upward - delete asset but no velocity change
            this.debugLog(`Balloon passed through while flying upward - deleted but no velocity change`, 'balloon_pass_through_up');
            return;
        }
        
        // Store original velocity for comparison
        const originalVelocityY = player.body.velocity.y;
        const originalVelocityX = player.body.velocity.x;
        
        // Use tighter collision zones for more precise positioning
        const bounds = this.collisionBounds.balloon;
        const balloonTopY = balloon.y - (balloon.height * bounds.topZone); // Top 20% of balloon (tighter)
        const balloonBottomY = balloon.y + (balloon.height * bounds.bottomZone); // Bottom 40% of balloon (tighter)
        const isOnTop = player.y < balloonTopY; // Bufo is in the top area
        const isMovingDown = player.body.velocity.y > 0; // Any downward movement
        
        if (isMovingDown) {
            // Landing on balloon - give bounce based on position
            // Check if player's velocity is already very negative (recently bounced)
            const currentVelY = player.body.velocity.y;
            
            if (isOnTop) {
                // Direct top hit - strongest bounce
                if (currentVelY < -300) {
                    this.safeVelocityChange(player, 
                        player.body.velocity.x * 0.98, // Maintain almost all horizontal momentum
                        Math.max(currentVelY, -500) // Strong bounce even with existing upward velocity
                    );
                    this.debugLog(`Balloon bounce reduced due to existing upward velocity: ${currentVelY.toFixed(1)}`, 'balloon_reduced_bounce');
                } else {
                    this.safeVelocityChange(player, 
                        player.body.velocity.x * 0.95, // Maintain more horizontal momentum
                        -600 // Strong upward bounce for 4-6 Bufo heights (doubled from -300)
                    );
                    this.debugLog(`Balloon top hit! Strong bounce applied - PlayerY: ${player.y.toFixed(1)}, BalloonTopY: ${balloonTopY.toFixed(1)}`, 'balloon_bounce');
                }
            } else {
                // Side/bottom collision - moderate bounce
                if (currentVelY < -300) {
                    this.safeVelocityChange(player, 
                        player.body.velocity.x * 0.98, // Maintain almost all horizontal momentum
                        Math.max(currentVelY, -400) // Moderate bounce even with existing upward velocity
                    );
                    this.debugLog(`Balloon side bounce reduced due to existing upward velocity: ${currentVelY.toFixed(1)}`, 'balloon_side_reduced_bounce');
                } else {
                    this.safeVelocityChange(player, 
                        player.body.velocity.x * 0.95, // Maintain more horizontal momentum
                        -450 // Moderate upward bounce for side/bottom collision
                    );
                    this.debugLog(`Balloon side hit! Moderate bounce applied - PlayerY: ${player.y.toFixed(1)}, BalloonTopY: ${balloonTopY.toFixed(1)}`, 'balloon_side_bounce');
                }
            }
            
            // Add bounce visual effect
            this.addBounceEffect(player.x, player.y);
            
            this.debugLog(`Balloon hit! Velocity change: Y=${(player.body.velocity.y - originalVelocityY).toFixed(1)}, X=${(player.body.velocity.x - originalVelocityX).toFixed(1)}`, 'balloon_hit');
        } else {
            // When flying upward, pass through (no interaction)
            this.debugLog(`Balloon passed through while flying upward - deleted but no velocity change`, 'balloon_pass_through_up');
        }
    }

    hitBird(player, bird) {
        // Check if launch protection is active
        if (this.isLaunchProtectionActive()) {
            return;
        }
        
        // Check collision cooldown
        if (this.isOnCooldown(bird.name)) {
            return;
        }
        
        // Enhanced spatial validation using 2D elliptical bounds
        if (!this.validateSpatialCollision(player, bird, 'bird')) {
            this.debugLog(`Bird collision rejected - outside 2D bounds: PlayerX: ${player.x.toFixed(1)}, PlayerY: ${player.y.toFixed(1)}, BirdX: ${bird.x.toFixed(1)}, BirdY: ${bird.y.toFixed(1)}`, 'bird_spatial_reject');
            return;
        }
        
        // Set cooldown for this bird
        this.setCooldown(bird.name);
        
        // Always delete the bird when hit (pass-through or interaction)
        // Remove from age tracking before destroying
        if (bird.name) {
            this.scene.objectSpawner.assetAgeMap.delete(bird.name);
        }

        // Deactivate the bird, hide it, and disable its physics body.
        bird.setActive(false).setVisible(false);
        bird.body.enable = false;
        
        // Only apply physics when falling down (not when flying up)
        if (player.body.velocity.y < 0) {
            // Pass through when flying upward - delete asset but no velocity change
            this.debugLog(`Bird passed through while flying upward - deleted but no velocity change`, 'bird_pass_through_up');
            return;
        }
        
        // Store original velocity for comparison
        const originalVelocityY = player.body.velocity.y;
        const originalVelocityX = player.body.velocity.x;
        
        // Use tighter collision zones for more precise positioning
        const bounds = this.collisionBounds.bird;
        const birdTopY = bird.y - (bird.height * bounds.topZone); // Top 25% of bird (tighter)
        const birdBottomY = bird.y + (bird.height * bounds.bottomZone); // Bottom 35% of bird (tighter)
        const isOnTop = player.y < birdTopY; // Bufo is in the top area
        const isMovingDown = player.body.velocity.y > 0; // Any downward movement
        
        if (isMovingDown) {
            // Landing on bird - give bounce based on position
            // Check if player's velocity is already very negative (recently bounced)
            const currentVelY = player.body.velocity.y;
            
            if (isOnTop) {
                // Direct top hit - strongest bounce
                if (currentVelY < -300) {
                    this.safeVelocityChange(player,
                        player.body.velocity.x * 0.98, // Maintain almost all horizontal momentum
                        Math.max(currentVelY, -540) // Strong bounce even with existing upward velocity
                    );
                    this.debugLog(`Bird bounce reduced due to existing upward velocity: ${currentVelY.toFixed(1)}`, 'bird_reduced_bounce');
                } else {
                    this.safeVelocityChange(player,
                        player.body.velocity.x * 0.95, // Maintain more horizontal momentum
                        -640 // Strong upward bounce for 5-7 Bufo heights (doubled from -320)
                    );
                    this.debugLog(`Bird top hit! Strong bounce applied - PlayerY: ${player.y.toFixed(1)}, BirdTopY: ${birdTopY.toFixed(1)}`, 'bird_bounce');
                }
            } else {
                // Side/bottom collision - moderate bounce
                if (currentVelY < -300) {
                    this.safeVelocityChange(player,
                        player.body.velocity.x * 0.98, // Maintain almost all horizontal momentum
                        Math.max(currentVelY, -480) // Moderate bounce even with existing upward velocity
                    );
                    this.debugLog(`Bird side bounce reduced due to existing upward velocity: ${currentVelY.toFixed(1)}`, 'bird_side_reduced_bounce');
                } else {
                    this.safeVelocityChange(player,
                        player.body.velocity.x * 0.95, // Maintain more horizontal momentum
                        -520 // Moderate upward bounce for side/bottom collision
                    );
                    this.debugLog(`Bird side hit! Moderate bounce applied - PlayerY: ${player.y.toFixed(1)}, BirdTopY: ${birdTopY.toFixed(1)}`, 'bird_side_bounce');
                }
            }
            
            // Add bounce visual effect
            this.addBounceEffect(player.x, player.y);
            
            this.debugLog(`Bird hit! Velocity change: Y=${(player.body.velocity.y - originalVelocityY).toFixed(1)}, X=${(player.body.velocity.x - originalVelocityX).toFixed(1)}`, 'bird_hit');
        } else {
            // When flying upward, pass through (no interaction)
            this.debugLog(`Bird passed through while flying upward - deleted but no velocity change`, 'bird_pass_through_up');
        }
    }

    hitCloud(player, cloud) {
        // Check if launch protection is active
        if (this.isLaunchProtectionActive()) {
            return;
        }
        
        // Enhanced spatial validation using 2D elliptical bounds
        if (!this.validateSpatialCollision(player, cloud, 'cloud')) {
            this.debugLog(`Cloud collision rejected - outside 2D bounds: PlayerX: ${player.x.toFixed(1)}, PlayerY: ${player.y.toFixed(1)}, CloudX: ${cloud.x.toFixed(1)}, CloudY: ${cloud.y.toFixed(1)}`, 'cloud_spatial_reject');
            return;
        }
        
        // Always delete the cloud when hit (pass-through or interaction)
        // Remove from age tracking before destroying
        if (cloud.name) {
            this.scene.objectSpawner.assetAgeMap.delete(cloud.name);
        }

        // Deactivate the cloud, hide it, and disable its physics body.
        cloud.setActive(false).setVisible(false);
        cloud.body.enable = false;
        
        // Only apply physics when falling down (not when flying up)
        if (player.body.velocity.y < 0) {
            // Pass through when flying upward - delete asset but no velocity change
            this.debugLog(`Cloud passed through while flying upward - deleted but no velocity change`, 'cloud_pass_through_up');
            return;
        }
        
        // Slow down the player's momentum
        player.body.velocity.x *= GAME_CONSTANTS.OBSTACLES.CLOUD_SLOWDOWN;
        player.body.velocity.y *= GAME_CONSTANTS.OBSTACLES.CLOUD_SLOWDOWN;
        
        // Add a visual effect to show the slowdown
        this.addSlowdownEffect(player.x, player.y);
    }

    capPlayerVelocity(player) {
        // Cap both X and Y velocity to prevent extreme speeds
        const maxVel = GAME_CONSTANTS.PLAYER.MAX_VELOCITY;
        
        if (Math.abs(player.body.velocity.x) > maxVel) {
            player.body.velocity.x = Math.sign(player.body.velocity.x) * maxVel;
        }
        
        if (Math.abs(player.body.velocity.y) > maxVel) {
            player.body.velocity.y = Math.sign(player.body.velocity.y) * maxVel;
        }
    }

    addBoostEffect(x, y) {
        // Create a simple visual effect to show the boost (optimized for performance)
        const boostEffect = this.scene.add.graphics()
            .lineStyle(1, UI_THEME.secondary, 0.4)
            .strokeCircle(x, y, 15);
        
        // Animate the effect with shorter duration
        this.scene.tweens.add({
            targets: boostEffect,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0,
            duration: 150, // Reduced from 200
            ease: 'Power1',
            onComplete: () => boostEffect.destroy()
        });
    }

    addBounceEffect(x, y) {
        // Create a visual effect to show the bounce (different from boost)
        const bounceEffect = this.scene.add.graphics()
            .lineStyle(2, 0x87CEEB, 0.6) // Sky blue color
            .strokeCircle(x, y, 12);
        
        // Add inner circle for bounce effect
        const innerEffect = this.scene.add.graphics()
            .fillStyle(0x87CEEB, 0.3)
            .fillCircle(x, y, 8);
        
        // Animate the bounce effect with a different pattern
        this.scene.tweens.add({
            targets: bounceEffect,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            ease: 'Bounce.easeOut',
            onComplete: () => bounceEffect.destroy()
        });
        
        this.scene.tweens.add({
            targets: innerEffect,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 180,
            ease: 'Power2',
            onComplete: () => innerEffect.destroy()
        });
    }

    addSlowdownEffect(x, y) {
        // Create a simple visual effect to show the slowdown (optimized for performance)
        const slowdownEffect = this.scene.add.graphics()
            .lineStyle(1, UI_THEME.danger, 0.4)
            .strokeCircle(x, y, 12);
        
        // Animate the effect with shorter duration
        this.scene.tweens.add({
            targets: slowdownEffect,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0,
            duration: 200, // Reduced from 250
            ease: 'Power1',
            onComplete: () => slowdownEffect.destroy()
        });
    }

    hitCoin(player, coin) {
        // Enhanced spatial validation using 2D elliptical bounds
        if (!this.validateSpatialCollision(player, coin, 'coin')) {
            this.debugLog(`Coin collision rejected - outside 2D bounds: PlayerX: ${player.x.toFixed(1)}, PlayerY: ${player.y.toFixed(1)}, CoinX: ${coin.x.toFixed(1)}, CoinY: ${coin.y.toFixed(1)}`, 'coin_spatial_reject');
            return;
        }
        
        // Add coins to the player's total
        const coinsEarned = GAME_CONSTANTS.REWARDS.COIN_VALUE;
        this.scene.upgradeSystem.addCoins(coinsEarned);
        this.scene.uiSystem.ui.coinsText.setText(this.scene.upgradeSystem.getCoins());
        
        this.debugLog(`Coin collected! +${coinsEarned} coins. Total: ${this.scene.upgradeSystem.getCoins()}`, 'coin_collected');

        // Remove from age tracking before destroying
        if (coin.name) {
            this.scene.objectSpawner.assetAgeMap.delete(coin.name);
        }

        // Deactivate the coin, hide it, and disable its physics body
        coin.setActive(false).setVisible(false);
        coin.body.enable = false;
        
        // Add a visual effect to show the coin collection
        this.addCoinEffect(player.x, player.y);
    }

    hitGasTank(player, gasTank) {
        // Enhanced spatial validation using 2D elliptical bounds
        if (!this.validateSpatialCollision(player, gasTank, 'gasTank')) {
            this.debugLog(`Gas tank collision rejected - outside 2D bounds: PlayerX: ${player.x.toFixed(1)}, PlayerY: ${player.y.toFixed(1)}, GasTankX: ${gasTank.x.toFixed(1)}, GasTankY: ${gasTank.y.toFixed(1)}`, 'gasTank_spatial_reject');
            return;
        }
        
        // Refill fuel if player has a rocket
        if (this.scene.upgradeSystem.hasRocket()) {
            const rocketCapabilities = this.scene.upgradeSystem.getRocketCapabilities();
            this.scene.fuel = rocketCapabilities.fuelCapacity;
            this.scene.maxFuel = rocketCapabilities.fuelCapacity;
            
            this.debugLog(`Gas tank collected! Fuel refilled to ${this.scene.fuel}/${this.scene.maxFuel}`, 'gas_tank_collected');
        } else {
            this.debugLog('Gas tank collected but no rocket to refill!', 'gas_tank_no_rocket');
        }

        // Remove from age tracking before destroying
        if (gasTank.name) {
            this.scene.objectSpawner.assetAgeMap.delete(gasTank.name);
        }

        // Deactivate the gas tank, hide it, and disable its physics body
        gasTank.setActive(false).setVisible(false);
        gasTank.body.enable = false;
        
        // Add a visual effect to show the gas tank collection
        this.addGasTankEffect(player.x, player.y);
    }

    addCoinEffect(x, y) {
        // Create a coin collection effect
        const coinEffect = this.scene.add.graphics()
            .lineStyle(2, 0xFFD700, 0.8) // Gold color
            .strokeCircle(x, y, 20);
        
        // Animate the effect
        this.scene.tweens.add({
            targets: coinEffect,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 300,
            ease: 'Power1',
            onComplete: () => coinEffect.destroy()
        });
    }

    addGasTankEffect(x, y) {
        // Create a gas tank collection effect
        const gasTankEffect = this.scene.add.graphics()
            .lineStyle(2, 0x00FF00, 0.8) // Green color
            .strokeCircle(x, y, 25);
        
        // Animate the effect
        this.scene.tweens.add({
            targets: gasTankEffect,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0,
            duration: 400,
            ease: 'Power1',
            onComplete: () => gasTankEffect.destroy()
        });
    }

    onPlayerLand() {
        const now = Date.now();
        
        // OPTIMIZATION: Add cooldown to prevent excessive landing checks
        if (now - this.lastLandingCheck < this.landingCheckCooldown) {
            return;
        }
        this.lastLandingCheck = now;
        
        this.debugLog('=== LANDING DETECTED ===', 'landing_detected');
        this.debugLog(`Player state: isPulling=${this.scene.isPulling}, isAirborne=${this.scene.isAirborne}, hasBeenLaunched=${this.scene.hasBeenLaunched}, isLanded=${this.scene.isLanded}`, 'player_state');
        
        // Don't handle ground collision during pulling - let the player move freely
        if (this.scene.isPulling) {
            this.debugLog('Landing ignored - player is pulling', 'landing_ignored_pulling');
            return;
        }
        
        // CRITICAL FIX: Don't process landing if player is already landed
        if (this.scene.isLanded) {
            this.debugLog('Landing ignored - player is already landed', 'landing_ignored_already_landed');
            return;
        }
        
        // This callback only fires on collision with the ground group.
        // We only want to trigger the landing sequence if we were actually airborne.
        if (this.scene.isAirborne) {
            this.debugLog('Player is airborne, checking launch status...', 'airborne_check');
            // Only end the game if player has been properly launched (not just bounced)
            if (this.scene.hasBeenLaunched) {
                this.debugLog('Player has been launched - calling handleLanding()', 'handle_landing');
                this.scene.handleLanding();
            } else {
                this.debugLog('Player airborne but not launched - resetting airborne state', 'reset_airborne');
                // Just reset airborne state for bounce landings
                this.scene.isAirborne = false;
                this.scene.player.body.setVelocityY(0);
                this.scene.player.body.setVelocityX(0); // Stop horizontal movement too
            }
        } else {
            this.debugLog('Player not airborne on landing', 'not_airborne');
            // If not airborne but still moving, stop all movement
            if ((this.scene.player.body.velocity.x !== 0 || this.scene.player.body.velocity.y !== 0) && !this.scene.isLanded) {
                this.scene.player.body.setVelocityX(0);
                this.scene.player.body.setVelocityY(0);
                this.debugLog('Stopping movement on ground collision', 'stop_movement');
            }
        }
        
        // Always ensure player is properly positioned on ground (but not during pulling)
        if (!this.scene.isAirborne && !this.scene.isLanded && !this.scene.isPulling) {
            // If player is touching ground but not in a proper state, stabilize
            this.scene.player.body.setVelocityX(0);
            this.scene.player.body.setVelocityY(0);
            this.debugLog('Stabilizing player on ground', 'stabilize_player');
        }
    }
    

} 