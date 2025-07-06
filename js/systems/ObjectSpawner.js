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
        this.coins = scene.physics.add.group({ allowGravity: false });
        this.gasTanks = scene.physics.add.group({ allowGravity: false });
        
        console.log('ObjectSpawner physics groups created:', {
            balloons: this.balloons ? 'created' : 'failed',
            birds: this.birds ? 'created' : 'failed',
            clouds: this.clouds ? 'created' : 'failed',
            coins: this.coins ? 'created' : 'failed',
            gasTanks: this.gasTanks ? 'created' : 'failed'
        });
    }

    spawnObjectsForCurrentZone() {
        console.log(`=== SPAWN OBJECTS FOR CURRENT ZONE CALLED ===`);
        const currentZone = this.getCurrentAltitudeZone();
        
        console.log(`Current zone detected: ${currentZone.name} (player Y: ${this.scene.player ? this.scene.player.y : 'no player'})`);
        
        // Always clear existing objects first
        console.log(`Clearing existing objects...`);
        this.balloons.clear(true, true);
        this.birds.clear(true, true);
        
        const maxObjects = Math.min(GAME_CONSTANTS.PERFORMANCE.MAX_ACTIVE_OBJECTS, 
            GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT + GAME_CONSTANTS.OBSTACLES.BIRD_COUNT);
        
        console.log(`Max objects allowed: ${maxObjects}`);
        console.log(`BALLOON_COUNT: ${GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT}`);
        console.log(`BIRD_COUNT: ${GAME_CONSTANTS.OBSTACLES.BIRD_COUNT}`);
        
        // Spawn objects based on current zone
        switch (currentZone.name) {
            case 'Ground Level':
            case 'Low Altitude':
                console.log(`Calling _spawnGroundObjects...`);
                this._spawnGroundObjects(maxObjects);
                break;
            case 'High Altitude':
                console.log(`Calling _spawnHighAltitudeObjects...`);
                this._spawnHighAltitudeObjects(maxObjects);
                break;
            case 'Space':
                console.log(`Calling _spawnSpaceObjects...`);
                this._spawnSpaceObjects(maxObjects);
                break;
            default:
                console.log(`Unknown zone: ${currentZone.name}, defaulting to ground objects`);
                this._spawnGroundObjects(maxObjects);
                break;
        }
        
        // Update current zone
        this.currentAltitudeZone = currentZone.name;
        
        console.log(`=== SPAWN OBJECTS FOR CURRENT ZONE COMPLETE ===`);
    }

    spawnClouds() {
        this.clouds.clear(true, true);
        const maxClouds = GAME_CONSTANTS.OBSTACLES.CLOUD_COUNT;
        
        for (let i = 0; i < maxClouds; i++) {
            const cloud = this.clouds.create(0, 0, 'cloud').setActive(false).setVisible(false);
            this._resetCloud(cloud);
        }
        
        console.log(`Spawned ${maxClouds} clouds`);
    }

    spawnCoinsAndGasTanks() {
        this.coins.clear(true, true);
        this.gasTanks.clear(true, true);
        
        const maxCoins = GAME_CONSTANTS.OBSTACLES.COIN_COUNT;
        const maxGasTanks = GAME_CONSTANTS.OBSTACLES.GAS_TANK_COUNT;
        
        for (let i = 0; i < maxCoins; i++) {
            const coin = this.coins.create(0, 0, 'coin').setActive(false).setVisible(false);
            this._resetCoin(coin);
        }
        
        for (let i = 0; i < maxGasTanks; i++) {
            const gasTank = this.gasTanks.create(0, 0, 'gas_tank').setActive(false).setVisible(false);
            this._resetGasTank(gasTank);
        }
        
        console.log(`Spawned ${maxCoins} coins and ${maxGasTanks} gas tanks`);
    }

    getCurrentAltitudeZone() {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        
        for (const [zoneName, zone] of Object.entries(GAME_CONSTANTS.ALTITUDE_ZONES)) {
            if (playerY >= zone.min && playerY <= zone.max) {
                return { name: zoneName, ...zone };
            }
        }
        
        // Default to GROUND zone if player doesn't exist yet
        return GAME_CONSTANTS.ALTITUDE_ZONES.GROUND;
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
        this._cleanupGroup(this.coins, 'coin');
        this._cleanupGroup(this.gasTanks, 'gasTank');
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
        const balloonCount = Math.min(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT, maxObjects / 2);
        const birdCount = Math.min(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT, maxObjects / 2);
        
        console.log(`=== GROUND OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${balloonCount} balloons and ${birdCount} birds in GROUND/LOW_ALTITUDE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        
        for (let i = 0; i < balloonCount; i++) {
            console.log(`Creating balloon ${i + 1}/${balloonCount}`);
            const balloon = this.balloons.create(0, 0, 'balloon').setActive(false).setVisible(false);
            if (balloon) {
                console.log(`Balloon ${i + 1} created successfully`);
                this._resetBalloon(balloon, 'balloon');
            } else {
                console.log(`FAILED to create balloon ${i + 1}`);
            }
        }
        for (let i = 0; i < birdCount; i++) {
            console.log(`Creating bird ${i + 1}/${birdCount}`);
            const bird = this.birds.create(0, 0, 'birds').setActive(false).setVisible(false);
            if (bird) {
                console.log(`Bird ${i + 1} created successfully`);
                this._resetBird(bird, 'birds');
            } else {
                console.log(`FAILED to create bird ${i + 1}`);
            }
        }
        console.log(`=== GROUND OBJECT SPAWNING COMPLETE ===`);
    }

    _spawnHighAltitudeObjects(maxObjects) {
        const balloonCount = Math.min(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT, maxObjects / 2);
        const planeCount = Math.min(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT, maxObjects / 2);
        
        console.log(`=== HIGH ALTITUDE OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${balloonCount} balloons and ${planeCount} planes in HIGH_ALTITUDE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        
        for (let i = 0; i < balloonCount; i++) {
            console.log(`Creating high-altitude balloon ${i + 1}/${balloonCount}`);
            const balloon = this.balloons.create(0, 0, 'balloon').setActive(false).setVisible(false);
            if (balloon) {
                console.log(`High-altitude balloon ${i + 1} created successfully`);
                this._resetBalloon(balloon, 'balloon');
            } else {
                console.log(`FAILED to create high-altitude balloon ${i + 1}`);
            }
        }
        for (let i = 0; i < planeCount; i++) {
            console.log(`Creating plane ${i + 1}/${planeCount}`);
            const bird = this.birds.create(0, 0, 'plane').setActive(false).setVisible(false);
            if (bird) {
                console.log(`Plane ${i + 1} created successfully`);
                this._resetBird(bird, 'plane');
            } else {
                console.log(`FAILED to create plane ${i + 1}`);
            }
        }
        console.log(`=== HIGH ALTITUDE OBJECT SPAWNING COMPLETE ===`);
    }

    _spawnSpaceObjects(maxObjects) {
        const satelliteCount = Math.min(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT, maxObjects / 2);
        const martianCount = Math.min(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT, maxObjects / 2);
        
        console.log(`=== SPACE OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${satelliteCount} satellites and ${martianCount} martians in SPACE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        
        for (let i = 0; i < satelliteCount; i++) {
            console.log(`Creating satellite ${i + 1}/${satelliteCount}`);
            const balloon = this.balloons.create(0, 0, 'satellite').setActive(false).setVisible(false);
            if (balloon) {
                console.log(`Satellite ${i + 1} created successfully`);
                this._resetBalloon(balloon, 'satellite');
            } else {
                console.log(`FAILED to create satellite ${i + 1}`);
            }
        }
        for (let i = 0; i < martianCount; i++) {
            console.log(`Creating martian ${i + 1}/${martianCount}`);
            const bird = this.birds.create(0, 0, 'martian').setActive(false).setVisible(false);
            if (bird) {
                console.log(`Martian ${i + 1} created successfully`);
                this._resetBird(bird, 'martian');
            } else {
                console.log(`FAILED to create martian ${i + 1}`);
            }
        }
        console.log(`=== SPACE OBJECT SPAWNING COMPLETE ===`);
    }

    _resetBalloon(balloon, textureType) {
        balloon.body.enable = true;

        if (textureType === 'balloon') {
            const balloonTextures = ['balloon', 'balloon_2'];
            const randomTexture = Phaser.Math.RND.pick(balloonTextures);
            
            // Check if texture exists
            if (this.scene.textures.exists(randomTexture)) {
                balloon.setTexture(randomTexture);
                console.log(`Balloon texture set to: ${randomTexture} (exists)`);
            } else {
                console.log(`ERROR: Balloon texture '${randomTexture}' does not exist!`);
                balloon.setTexture('balloon'); // Fallback
            }
        } else {
            if (this.scene.textures.exists(textureType)) {
                balloon.setTexture(textureType);
                console.log(`Balloon texture set to: ${textureType} (exists)`);
            } else {
                console.log(`ERROR: Balloon texture '${textureType}' does not exist!`);
                balloon.setTexture('balloon'); // Fallback
            }
        }

        balloon.setDisplaySize(GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE, GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE);
        balloon.refreshBody();
        balloon.setCircle(balloon.width / 2);
        balloon.setActive(true).setVisible(true);
        
        console.log(`Balloon created: active=${balloon.active}, visible=${balloon.visible}, texture=${balloon.texture.key}`);

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
        
        console.log(`Balloon positioned at (${x}, ${y})`);

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
            
            // Check if texture exists
            if (this.scene.textures.exists(randomTexture)) {
                bird.setTexture(randomTexture);
                console.log(`Bird texture set to: ${randomTexture} (exists)`);
            } else {
                console.log(`ERROR: Bird texture '${randomTexture}' does not exist!`);
                bird.setTexture('birds'); // Fallback
            }
        } else {
            if (this.scene.textures.exists(textureType)) {
                bird.setTexture(textureType);
                console.log(`Bird texture set to: ${textureType} (exists)`);
            } else {
                console.log(`ERROR: Bird texture '${textureType}' does not exist!`);
                bird.setTexture('birds'); // Fallback
            }
        }

        bird.displayWidth = GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE;
        bird.scaleY = bird.scaleX;
        bird.refreshBody();
        bird.body.setSize(bird.width * 0.85, bird.height * 0.85).setOffset(bird.width * 0.075, bird.height * 0.075);
        bird.setActive(true).setVisible(true);
        
        console.log(`Bird created: active=${bird.active}, visible=${bird.visible}, texture=${bird.texture.key}`);

        const birdX = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        const birdY = Phaser.Math.Between(GAME_CONSTANTS.SKY.SPACE_Y, this.scene.groundLevel - 400);
        bird.setPosition(birdX, birdY);
        const velocityX = Phaser.Math.Between(75, 125) * (Math.random() > 0.5 ? 1 : -1);
        bird.body.setVelocityX(velocityX);
        bird.setFlipX(velocityX > 0);
        
        console.log(`Bird positioned at (${birdX}, ${birdY}) with velocity ${velocityX}`);

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

    _resetCoin(coin) {
        coin.body.enable = true;
        coin.setDisplaySize(60, 60);
        coin.refreshBody();
        coin.setCircle(coin.width / 2);
        coin.setActive(true).setVisible(true);

        this.scene.tweens.killTweensOf(coin);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        const y = Phaser.Math.Between(GAME_CONSTANTS.SKY.SPACE_Y, this.scene.groundLevel - 400);
        
        coin.setPosition(x, y);
        coin.body.setVelocity(0, 0);

        const coinId = `coin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        coin.setName(coinId);
        this.assetAgeMap.set(coinId, this.scene.dayCount);

        // Coin spinning animation
        this.scene.tweens.add({
            targets: coin,
            angle: 360,
            duration: 2000,
            ease: 'Linear',
            repeat: -1
        });

        // Coin floating animation
        this.scene.tweens.add({
            targets: coin,
            y: y - 20,
            duration: Phaser.Math.Between(1500, 2500),
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });
    }

    _resetGasTank(gasTank) {
        gasTank.body.enable = true;
        gasTank.setDisplaySize(80, 80);
        gasTank.refreshBody();
        gasTank.setCircle(gasTank.width / 2);
        gasTank.setActive(true).setVisible(true);

        this.scene.tweens.killTweensOf(gasTank);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        const y = Phaser.Math.Between(GAME_CONSTANTS.SKY.SPACE_Y, this.scene.groundLevel - 400);
        
        gasTank.setPosition(x, y);
        gasTank.body.setVelocity(0, 0);

        const gasTankId = `gasTank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gasTank.setName(gasTankId);
        this.assetAgeMap.set(gasTankId, this.scene.dayCount);

        // Gas tank floating animation
        this.scene.tweens.add({
            targets: gasTank,
            y: y - 15,
            duration: Phaser.Math.Between(2000, 3000),
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });
    }
} 