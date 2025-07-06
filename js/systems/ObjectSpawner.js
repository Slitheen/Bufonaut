import { GAME_CONSTANTS } from '../config/GameConfig.js';

export class ObjectSpawner {
    constructor(scene) {
        this.scene = scene;
        this.assetMaxAge = 4;
        this.assetAgeMap = new Map();
        this.currentAltitudeZone = null;
        
        // Create physics groups
        this.balloons = scene.physics.add.group({ allowGravity: false });
        this.birds = scene.physics.add.group({ allowGravity: false });
        this.clouds = scene.physics.add.group({ allowGravity: false });
    }

    spawnObjectsForCurrentZone() {
        const currentZone = this.getCurrentAltitudeZone();
        
        if (this.currentAltitudeZone && this.currentAltitudeZone !== currentZone.name) {
            this.balloons.clear(true, true);
            this.birds.clear(true, true);
            
            const maxObjects = Math.min(GAME_CONSTANTS.PERFORMANCE.MAX_ACTIVE_OBJECTS, 
                GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT + GAME_CONSTANTS.OBSTACLES.BIRD_COUNT);
            
            switch (currentZone.name) {
                case 'GROUND':
                case 'LOW_ALTITUDE':
                    this._spawnGroundObjects(maxObjects);
                    break;
                case 'HIGH_ALTITUDE':
                    this._spawnHighAltitudeObjects(maxObjects);
                    break;
                case 'SPACE':
                    this._spawnSpaceObjects(maxObjects);
                    break;
            }
        } else {
            const maxObjects = Math.min(GAME_CONSTANTS.PERFORMANCE.MAX_ACTIVE_OBJECTS, 
                GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT + GAME_CONSTANTS.OBSTACLES.BIRD_COUNT);
            this._spawnGroundObjects(maxObjects);
        }
    }

    spawnClouds() {
        this.clouds.clear(true, true);
        const maxClouds = Math.min(GAME_CONSTANTS.OBSTACLES.CLOUD_COUNT, 5);
        
        for (let i = 0; i < maxClouds; i++) {
            const cloud = this.clouds.create(0, 0, 'cloud').setActive(false).setVisible(false);
            this._resetCloud(cloud);
        }
    }

    getCurrentAltitudeZone() {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        
        for (const [zoneName, zone] of Object.entries(GAME_CONSTANTS.ALTITUDE_ZONES)) {
            if (playerY >= zone.min && playerY <= zone.max) {
                return { name: zoneName, ...zone };
            }
        }
        
        return GAME_CONSTANTS.ALTITUDE_ZONES.SPACE;
    }

    checkAltitudeZoneChange() {
        const currentZone = this.getCurrentAltitudeZone();
        
        if (!this.currentAltitudeZone) {
            this.currentAltitudeZone = currentZone.name;
            return;
        }
        
        if (this.currentAltitudeZone !== currentZone.name) {
            this.currentAltitudeZone = currentZone.name;
            
            this.scene.showZoneTransition(currentZone.name);
            
            setTimeout(() => {
                this.spawnObjectsForCurrentZone();
            }, 1000);
        }
    }

    cleanupOldAssets() {
        const currentDay = this.scene.dayCount;
        const maxAge = this.assetMaxAge;
        
        this._cleanupGroup(this.balloons, 'balloon');
        this._cleanupGroup(this.birds, 'bird');
        this._cleanupGroup(this.clouds, 'cloud');
    }

    _cleanupGroup(group, type) {
        if (group) {
            group.children.entries.forEach(obj => {
                const assetId = obj.name || obj.texture.key + '_' + obj.x + '_' + obj.y;
                const creationDay = this.assetAgeMap.get(assetId);
                
                if (creationDay && (this.scene.dayCount - creationDay) >= this.assetMaxAge) {
                    this.assetAgeMap.delete(assetId);
                    obj.destroy();
                }
            });
        }
    }

    _spawnGroundObjects(maxObjects) {
        for (let i = 0; i < Math.min(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT, maxObjects / 2); i++) {
            const balloon = this.balloons.create(0, 0, 'balloon').setActive(false).setVisible(false);
            this._resetBalloon(balloon, 'balloon');
        }
        for (let i = 0; i < Math.min(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT, maxObjects / 2); i++) {
            const bird = this.birds.create(0, 0, 'birds').setActive(false).setVisible(false);
            this._resetBird(bird, 'birds');
        }
    }

    _spawnHighAltitudeObjects(maxObjects) {
        for (let i = 0; i < Math.min(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT, maxObjects / 2); i++) {
            const balloon = this.balloons.create(0, 0, 'hot_air_balloon').setActive(false).setVisible(false);
            this._resetBalloon(balloon, 'hot_air_balloon');
        }
        for (let i = 0; i < Math.min(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT, maxObjects / 2); i++) {
            const bird = this.birds.create(0, 0, 'plane').setActive(false).setVisible(false);
            this._resetBird(bird, 'plane');
        }
    }

    _spawnSpaceObjects(maxObjects) {
        for (let i = 0; i < Math.min(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT, maxObjects / 2); i++) {
            const balloon = this.balloons.create(0, 0, 'satellite').setActive(false).setVisible(false);
            this._resetBalloon(balloon, 'satellite');
        }
        for (let i = 0; i < Math.min(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT, maxObjects / 2); i++) {
            const bird = this.birds.create(0, 0, 'martian').setActive(false).setVisible(false);
            this._resetBird(bird, 'martian');
        }
    }

    _resetBalloon(balloon, textureType) {
        balloon.body.enable = true;

        if (textureType === 'balloon') {
            const balloonTextures = ['balloon', 'balloons_2'];
            const randomTexture = Phaser.Math.RND.pick(balloonTextures);
            balloon.setTexture(randomTexture);
        } else {
            balloon.setTexture(textureType);
        }

        balloon.setDisplaySize(GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE, GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE);
        balloon.refreshBody();
        balloon.setCircle(balloon.width / 2);
        balloon.setActive(true).setVisible(true);

        this.scene.tweens.killTweensOf(balloon);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        
        // Spawn in appropriate zone based on texture type
        let y;
        if (textureType === 'satellite' || textureType === 'martian') {
            // Space objects spawn in the space zone (-15000 to -50000)
            y = Phaser.Math.Between(-40000, -15000);
        } else {
            // Regular objects spawn in the normal range
            y = Phaser.Math.Between(GAME_CONSTANTS.SKY.SPACE_Y, this.scene.groundLevel - 400);
        }
        
        balloon.setPosition(x, y);
        balloon.body.setVelocity(0, 0);

        const balloonId = `balloon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        balloon.setName(balloonId);
        this.assetAgeMap.set(balloonId, this.scene.dayCount);

        // Different animation for space objects
        if (textureType === 'satellite') {
            // Satellite orbits in a larger pattern
            this.scene.tweens.add({
                targets: balloon,
                y: y - 50,
                duration: Phaser.Math.Between(2000, 3000),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                useRadians: true
            });
        } else {
            // Regular balloon animation
            this.scene.tweens.add({
                targets: balloon,
                y: y - 25,
                duration: Phaser.Math.Between(1500, 2500),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                useRadians: true
            });
        }
    }

    _resetBird(bird, textureType) {
        bird.body.enable = true;

        if (textureType === 'birds') {
            const birdTextures = ['birds', 'birds_2'];
            const randomTexture = Phaser.Math.RND.pick(birdTextures);
            bird.setTexture(randomTexture);
        } else {
            bird.setTexture(textureType);
        }

        bird.displayWidth = GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE;
        bird.scaleY = bird.scaleX;
        bird.refreshBody();
        bird.body.setSize(bird.width * 0.85, bird.height * 0.85).setOffset(bird.width * 0.075, bird.height * 0.075);
        bird.setActive(true).setVisible(true);

        bird.setPosition(
            Phaser.Math.Between(50, this.scene.cameras.main.width - 50),
            Phaser.Math.Between(GAME_CONSTANTS.SKY.SPACE_Y, this.scene.groundLevel - 400)
        );
        const velocityX = Phaser.Math.Between(75, 125) * (Math.random() > 0.5 ? 1 : -1);
        bird.body.setVelocityX(velocityX);
        bird.setFlipX(velocityX > 0);

        const birdId = `bird_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        bird.setName(birdId);
        this.assetAgeMap.set(birdId, this.scene.dayCount);
    }

    _resetCloud(cloud) {
        cloud.body.enable = true;

        const cloudTextures = ['cloud', 'cloud_2', 'cloud_3', 'cloud_4', 'cloud_5', 'cloud_6', 'cloud_7'];
        const randomTexture = Phaser.Math.RND.pick(cloudTextures);
        cloud.setTexture(randomTexture);

        cloud.setDisplaySize(GAME_CONSTANTS.UI_SCALE.CLOUD_SIZE, GAME_CONSTANTS.UI_SCALE.CLOUD_HEIGHT);
        cloud.refreshBody();
        cloud.setCircle(cloud.width / 2);
        cloud.setActive(true).setVisible(true);

        this.scene.tweens.killTweensOf(cloud);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        const y = Phaser.Math.Between(-15000, -5500);
        cloud.setPosition(x, y);
        cloud.body.setVelocity(0, 0);

        const cloudId = `cloud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        cloud.setName(cloudId);
        this.assetAgeMap.set(cloudId, this.scene.dayCount);

        this.scene.tweens.add({
            targets: cloud,
            y: y - 30,
            duration: Phaser.Math.Between(2000, 3500),
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });

        const horizontalDistance = Phaser.Math.Between(50, 150);
        const horizontalDuration = Phaser.Math.Between(3000, 5000);
        
        this.scene.tweens.add({
            targets: cloud,
            x: x + horizontalDistance,
            duration: horizontalDuration,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });
    }
} 