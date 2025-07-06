import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class CollisionSystem {
    constructor(scene) {
        this.scene = scene;
        this.lastLogMessages = new Map(); // Track last log messages to prevent spam
        this.logCooldown = 2000; // 2 seconds cooldown for repeated messages
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

    hitBalloon(player, balloon) {
        // Always add the boost - balloons should always help, never hurt
        player.body.velocity.y += GAME_CONSTANTS.OBSTACLES.BALLOON_BOOST;
        
        // Also add a small horizontal boost in the direction the player is moving
        if (player.body.velocity.x !== 0) {
            player.body.velocity.x += Math.sign(player.body.velocity.x) * 50;
        }

        // Always cap velocity after adding boost to prevent extreme speeds
        this.capPlayerVelocity(player);

        // Remove from age tracking before destroying
        if (balloon.name) {
            this.scene.objectSpawner.assetAgeMap.delete(balloon.name);
        }

        // Deactivate the balloon, hide it, and disable its physics body.
        balloon.setActive(false).setVisible(false);
        balloon.body.enable = false;
        
        // Add a visual effect to show the boost
        this.addBoostEffect(player.x, player.y);
    }

    hitBird(player, bird) {
        // Always add the boost - birds should always help, never hurt
        player.body.velocity.y += GAME_CONSTANTS.OBSTACLES.BIRD_BOOST;

        // Add horizontal momentum in the direction the bird was flying
        player.body.velocity.x += bird.body.velocity.x * 0.5; // Scale down bird's velocity

        // Always cap velocity after adding boost to prevent extreme speeds
        this.capPlayerVelocity(player);

        // Remove from age tracking before destroying
        if (bird.name) {
            this.scene.objectSpawner.assetAgeMap.delete(bird.name);
        }

        // Deactivate the bird, hide it, and disable its physics body.
        bird.setActive(false).setVisible(false);
        bird.body.enable = false;
        
        // Add a visual effect to show the boost
        this.addBoostEffect(player.x, player.y);
    }

    hitCloud(player, cloud) {
        // Slow down the player's momentum
        player.body.velocity.x *= GAME_CONSTANTS.OBSTACLES.CLOUD_SLOWDOWN;
        player.body.velocity.y *= GAME_CONSTANTS.OBSTACLES.CLOUD_SLOWDOWN;

        // Remove from age tracking before destroying
        if (cloud.name) {
            this.scene.objectSpawner.assetAgeMap.delete(cloud.name);
        }

        // Deactivate the cloud, hide it, and disable its physics body.
        cloud.setActive(false).setVisible(false);
        cloud.body.enable = false;
        
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
        this.debugLog('=== LANDING DETECTED ===', 'landing_detected');
        this.debugLog(`Player state: isPulling=${this.scene.isPulling}, isAirborne=${this.scene.isAirborne}, hasBeenLaunched=${this.scene.hasBeenLaunched}, isLanded=${this.scene.isLanded}`, 'player_state');
        
        // Don't handle ground collision during pulling - let the player move freely
        if (this.scene.isPulling) {
            this.debugLog('Landing ignored - player is pulling', 'landing_ignored_pulling');
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