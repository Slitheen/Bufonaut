import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class CollisionSystem {
    constructor(scene) {
        this.scene = scene;
    }

    hitBalloon(player, balloon) {
        // Add upward momentum to current velocity (don't replace it)
        player.body.velocity.y += GAME_CONSTANTS.OBSTACLES.BALLOON_BOOST;
        
        // Also add a small horizontal boost in the direction the player is moving
        if (player.body.velocity.x !== 0) {
            player.body.velocity.x += Math.sign(player.body.velocity.x) * 50;
        }

        // Cap velocity to prevent extreme speeds
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
        // Add upward momentum to current velocity
        player.body.velocity.y += GAME_CONSTANTS.OBSTACLES.BIRD_BOOST;

        // Add horizontal momentum in the direction the bird was flying
        player.body.velocity.x += bird.body.velocity.x * 0.5; // Scale down bird's velocity

        // Cap velocity to prevent extreme speeds
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

    onPlayerLand() {
        // This callback only fires on collision with the ground group.
        // We only want to trigger the landing sequence if we were actually airborne.
        if (this.scene.isAirborne) {
            this.scene.handleLanding();
        }
    }
} 