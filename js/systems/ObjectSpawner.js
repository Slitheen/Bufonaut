import { GAME_CONSTANTS } from '../config/GameConfig.js';

export class ObjectSpawner {
    constructor(scene) {
        this.scene = scene;
        this.assetMaxAge = 4;
        this.assetAgeMap = new Map();
        this.currentAltitudeZone = null;
        
        // Object pooling system
        this.objectPools = {
            balloons: new Map(), // Map of texture -> array of objects
            birds: new Map()
        };
        this.poolSize = GAME_CONSTANTS.PERFORMANCE.OBJECT_POOL_SIZE; // Number of objects to pre-create per texture type
        
        // Zone buffering - pre-spawn objects for adjacent zones
        this.zoneBuffer = {
            current: null,
            adjacent: new Set(),
            transitionDistance: GAME_CONSTANTS.PERFORMANCE.ZONE_BUFFER_DISTANCE // Distance from zone boundary to start pre-spawning
        };
        
        // Cleanup tracking
        this.lastGroundCleanup = 0;
        
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
        
        // Initialize object pools
        this.initializeObjectPools();
    }

    initializeObjectPools() {
        console.log('Initializing object pools...');
        
        // Validate textures exist before initializing pools
        const allBalloonTextures = ['balloon', 'balloon_2', 'hot_air_balloon', 'satellite'];
        const allBirdTextures = ['birds', 'birds_2', 'plane', 'martian'];
        
        // Filter out textures that don't exist
        const validBalloonTextures = allBalloonTextures.filter(texture => {
            const exists = this.scene.textures.exists(texture);
            if (!exists) {
                console.warn(`Balloon texture '${texture}' does not exist, skipping pool initialization`);
            }
            return exists;
        });
        
        const validBirdTextures = allBirdTextures.filter(texture => {
            const exists = this.scene.textures.exists(texture);
            if (!exists) {
                console.warn(`Bird texture '${texture}' does not exist, skipping pool initialization`);
            }
            return exists;
        });
        
        console.log(`Valid balloon textures: ${validBalloonTextures.join(', ')}`);
        console.log(`Valid bird textures: ${validBirdTextures.join(', ')}`);
        
        // Initialize balloon pools with valid textures only
        validBalloonTextures.forEach(texture => {
            this.objectPools.balloons.set(texture, []);
            for (let i = 0; i < this.poolSize; i++) {
                const obj = this.balloons.create(0, 0, texture).setActive(false).setVisible(false);
                this.objectPools.balloons.get(texture).push(obj);
            }
        });
        
        // Initialize bird pools with valid textures only
        validBirdTextures.forEach(texture => {
            this.objectPools.birds.set(texture, []);
            for (let i = 0; i < this.poolSize; i++) {
                const obj = this.birds.create(0, 0, texture).setActive(false).setVisible(false);
                this.objectPools.birds.get(texture).push(obj);
            }
        });
        
        console.log('All object pools initialized:', {
            balloonPools: validBalloonTextures.length,
            birdPools: validBirdTextures.length,
            poolSize: this.poolSize,
            totalObjects: (validBalloonTextures.length + validBirdTextures.length) * this.poolSize
        });
    }

    getPooledObject(texture, type) {
        // Validate texture exists before attempting to use it
        if (!this.scene.textures.exists(texture)) {
            console.warn(`Texture '${texture}' does not exist, using fallback`);
            // Use fallback texture based on type
            texture = type === 'balloons' ? 'balloon' : 'birds';
            if (!this.scene.textures.exists(texture)) {
                console.error(`Fallback texture '${texture}' also does not exist!`);
                return null;
            }
        }
        
        const pool = this.objectPools[type].get(texture);
        if (pool && pool.length > 0) {
            const obj = pool.pop();
            
            // Validate the object is still valid
            if (!obj || !obj.scene || !obj.scene.sys) {
                console.warn(`Pooled ${type} object is invalid, creating new one`);
                return this.createNewObject(texture, type);
            }
            
            // Ensure the object has a physics body when retrieved from pool
            if (!obj.body) {
                console.warn(`Pooled ${type} object missing physics body, creating one`);
                obj.body = this.scene.physics.add.existing(obj, false);
            }
            
            // Unified approach - enable physics for all objects
            obj.body.setEnable(true);
            
            return obj;
        }
        
        // Pool is empty - create new object
        console.warn(`Pool empty for ${texture}, creating new object and expanding pool`);
        return this.createNewObject(texture, type);
    }

    createNewObject(texture, type) {
        const newObj = this[type].create(0, 0, texture).setActive(false).setVisible(false);
        
        // Ensure new object has physics body
        if (!newObj.body) {
            newObj.body = this.scene.physics.add.existing(newObj, false);
        }
        
        // Unified approach - enable physics for all objects
        newObj.body.setEnable(true);
        
        // Initialize pool if it doesn't exist
        const pool = this.objectPools[type].get(texture);
        if (!pool) {
            this.objectPools[type].set(texture, []);
        }
        
        // Add the new object to the pool for future reuse
        this.objectPools[type].get(texture).push(newObj);
        
        return newObj;
    }

    returnToPool(obj, type) {
        if (!obj) return;
        
        // Validate the object is still valid before returning to pool
        if (!obj.scene || !obj.scene.sys) {
            console.warn('Invalid object detected, destroying instead of returning to pool');
            obj.destroy();
            return;
        }
        
        const texture = obj.texture.key;
        const pool = this.objectPools[type].get(texture);
        
        if (pool && pool.length < this.poolSize * 1.5) { // Allow pools to grow up to 150% of original size
            // Kill any existing tweens/animations to prevent glitches
            this.scene.tweens.killTweensOf(obj);
            
            // Reset all object properties
            obj.setActive(false).setVisible(false);
            obj.setPosition(0, 0);
            obj.setRotation(0); // Reset rotation
            obj.setAlpha(1); // Reset alpha
            
            // Safely reset physics body
            if (obj.body) {
                obj.body.setVelocity(0, 0);
                obj.body.setAngularVelocity(0);
                obj.body.setEnable(false); // Disable physics while in pool
                obj.body.setBounce(0, 0); // Reset bounce
                obj.body.setFriction(0.1); // Reset friction
            }
            
            pool.push(obj);
        } else {
            // Destroy if pool is too full
            obj.destroy();
        }
    }

    checkPoolHealth() {
        // Monitor pool health and log warnings if pools are getting critically low
        let lowPools = [];
        let needsReplenishment = false;
        
        this.objectPools.balloons.forEach((pool, texture) => {
            if (pool.length < 2) { // Reduced warning threshold from 3 to 2
                lowPools.push(`balloons:${texture}(${pool.length})`);
                needsReplenishment = true;
            }
        });
        
        this.objectPools.birds.forEach((pool, texture) => {
            if (pool.length < 2) { // Reduced warning threshold from 3 to 2
                lowPools.push(`birds:${texture}(${pool.length})`);
                needsReplenishment = true;
            }
        });
        
        if (lowPools.length > 0) {
            console.warn(`Low pool levels detected: ${lowPools.join(', ')}`);
        }
        
        // Only replenish pools if they're critically low
        if (needsReplenishment && lowPools.length > 2) { // Only replenish if multiple pools are low
            this.replenishPools();
        }
    }

    replenishPools() {
        console.log('Replenishing critically low object pools...');
        
        // Replenish balloon pools that are critically low
        this.objectPools.balloons.forEach((pool, texture) => {
            if (pool.length < 2) {
                const needed = Math.min(5, this.poolSize - pool.length); // Add up to 5 objects
                for (let i = 0; i < needed; i++) {
                    const obj = this.balloons.create(0, 0, texture).setActive(false).setVisible(false);
                    pool.push(obj);
                }
                console.log(`Replenished ${texture} balloon pool with ${needed} objects`);
            }
        });
        
        // Replenish bird pools that are critically low
        this.objectPools.birds.forEach((pool, texture) => {
            if (pool.length < 2) {
                const needed = Math.min(5, this.poolSize - pool.length); // Add up to 5 objects
                for (let i = 0; i < needed; i++) {
                    const obj = this.birds.create(0, 0, texture).setActive(false).setVisible(false);
                    pool.push(obj);
                }
                console.log(`Replenished ${texture} bird pool with ${needed} objects`);
            }
        });
    }

    cleanupInvalidPoolObjects() {
        // Clean up invalid objects from balloon pools
        this.objectPools.balloons.forEach((pool, texture) => {
            const validObjects = pool.filter(obj => obj && obj.scene && obj.scene.sys);
            const invalidCount = pool.length - validObjects.length;
            if (invalidCount > 0) {
                console.warn(`Cleaned up ${invalidCount} invalid balloon objects from ${texture} pool`);
            }
            this.objectPools.balloons.set(texture, validObjects);
        });
        
        // Clean up invalid objects from bird pools
        this.objectPools.birds.forEach((pool, texture) => {
            const validObjects = pool.filter(obj => obj && obj.scene && obj.scene.sys);
            const invalidCount = pool.length - validObjects.length;
            if (invalidCount > 0) {
                console.warn(`Cleaned up ${invalidCount} invalid bird objects from ${texture} pool`);
            }
            this.objectPools.birds.set(texture, validObjects);
        });
    }

    spawnObjectsForMultipleZones() {
        console.log(`=== SPAWN OBJECTS FOR MULTIPLE ZONES CALLED ===`);
        const currentZone = this.getCurrentAltitudeZone();
        
        console.log(`Current zone detected: ${currentZone.name} (player Y: ${this.scene.player ? this.scene.player.y : 'no player'})`);
        
        // Only return objects to pools if this is the initial spawn or if we're changing zones
        if (!this.currentAltitudeZone || this.currentAltitudeZone !== currentZone.name) {
            console.log(`Returning existing objects to pools...`);
            this.returnActiveObjectsToPools();
        }
        
        const maxObjects = Math.min(GAME_CONSTANTS.PERFORMANCE.MAX_ACTIVE_OBJECTS, 
            GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT + GAME_CONSTANTS.OBSTACLES.BIRD_COUNT);
        
        console.log(`Max objects allowed: ${maxObjects}`);
        console.log(`BALLOON_COUNT: ${GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT}`);
        console.log(`BIRD_COUNT: ${GAME_CONSTANTS.OBSTACLES.BIRD_COUNT}`);
        
        // Spawn objects ONLY for the current zone
        console.log(`Spawning objects for current zone: ${currentZone.name}`);
        
        if (currentZone.name === 'Ground Level' || currentZone.name === 'Low Altitude') {
            // Spawn ground/low altitude objects (balloons and birds)
            console.log(`Calling _spawnGroundObjects...`);
            this._spawnGroundObjects(maxObjects);
        } else if (currentZone.name === 'Mid Altitude') {
            // Spawn mid altitude objects (mix of low and high altitude assets)
            console.log(`Calling _spawnMidAltitudeObjects...`);
            this._spawnMidAltitudeObjects(maxObjects);
        } else if (currentZone.name === 'High Altitude') {
            // Spawn high altitude objects (hot air balloons and planes)
            console.log(`Calling _spawnHighAltitudeObjects...`);
            this._spawnHighAltitudeObjects(maxObjects);
        } else if (currentZone.name === 'Space') {
            // Spawn space objects (satellites and martians)
            console.log(`Calling _spawnSpaceObjects...`);
            this._spawnSpaceObjects(maxObjects);
        }
        
        // Update current zone
        this.currentAltitudeZone = currentZone.name;
        
        console.log(`=== SPAWN OBJECTS FOR MULTIPLE ZONES COMPLETE ===`);
    }

    returnActiveObjectsToPools() {
        let balloonsReturned = 0;
        let birdsReturned = 0;
        
        // Return active balloons to pools
        if (this.balloons) {
            this.balloons.getChildren().forEach(obj => {
                if (obj.active && obj.visible) {
                    this.returnToPool(obj, 'balloons');
                    balloonsReturned++;
                }
            });
        }
        
        // Return active birds to pools
        if (this.birds) {
            this.birds.getChildren().forEach(obj => {
                if (obj.active && obj.visible) {
                    this.returnToPool(obj, 'birds');
                    birdsReturned++;
                }
            });
        }
        
        console.log(`Returned ${balloonsReturned} balloons and ${birdsReturned} birds to pools`);
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
        const playerAltitude = this.scene.groundLevel - playerY;
        
        console.log(`Zone Detection Debug - Player Y: ${playerY}, Altitude: ${playerAltitude} ft`);
        
        // Redesigned zones to better match actual gameplay range (8000-12000 ft max)
        const altitudeZones = {
            GROUND: { 
                min: 0, 
                max: 2000, 
                name: 'Ground Level',
                yRange: { min: -2000, max: -400 } // Y offsets from ground level
            },
            LOW_ALTITUDE: { 
                min: 2000, 
                max: 5000, 
                name: 'Low Altitude',
                yRange: { min: -5000, max: -2000 }
            },
            MID_ALTITUDE: { 
                min: 5000, 
                max: 10000, 
                name: 'Mid Altitude',
                yRange: { min: -10000, max: -5000 }
            },
            HIGH_ALTITUDE: { 
                min: 10000, 
                max: 15000, 
                name: 'High Altitude',
                yRange: { min: -15000, max: -10000 }
            },
            SPACE: { 
                min: 15000, 
                max: 50000, 
                name: 'Space',
                yRange: { min: -20000, max: -15000 }
            }
        };
        
        for (const [zoneName, zone] of Object.entries(altitudeZones)) {
            if (playerAltitude >= zone.min && playerAltitude <= zone.max) {
                console.log(`Zone detected: ${zoneName} (Altitude range: ${zone.min} to ${zone.max} ft)`);
                return { name: zoneName, ...zone };
            }
        }
        
        // If player is at or below ground level (negative altitude), they're in GROUND zone
        if (playerAltitude <= 0) {
            console.log(`Player at or below ground level, defaulting to GROUND zone`);
            return altitudeZones.GROUND;
        }
        
        console.log(`No zone detected, defaulting to GROUND zone`);
        // Default to GROUND zone if player doesn't exist yet
        return altitudeZones.GROUND;
    }

    checkAltitudeZoneChange() {
        const currentZone = this.getCurrentAltitudeZone();
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        
        if (!this.currentAltitudeZone) {
            this.currentAltitudeZone = currentZone.name;
            console.log(`Initial zone set to: ${currentZone.name} (player Y: ${playerY})`);
            // Spawn objects for initial zone
            this.spawnObjectsForMultipleZones();
            return;
        }
        
        // Check for zone buffering - pre-spawn objects when approaching zone boundaries
        this.checkZoneBuffering(currentZone, playerY);
        
        // Monitor pool health less frequently to reduce performance impact
        if (this.scene.time.now % 5000 === 0) { // Check every 5 seconds instead of 2
            this.checkPoolHealth();
        }
        
        if (this.currentAltitudeZone !== currentZone.name) {
            console.log(`=== ZONE CHANGE DETECTED ===`);
            console.log(`From: ${this.currentAltitudeZone} to: ${currentZone.name}`);
            console.log(`Player Y: ${playerY}, Ground Level: ${this.scene.groundLevel}`);
            console.log(`Altitude: ${Math.round(this.scene.groundLevel - playerY)} ft`);
            
            this.currentAltitudeZone = currentZone.name;
            
            this.scene.showZoneTransition(currentZone.name);
            
            // Spawn objects for new zone without clearing existing ones
            console.log(`Spawning objects for new zone: ${currentZone.name}`);
            this.spawnObjectsForMultipleZones();
            
            // Only cleanup ground objects when entering very high altitude zones
            if (currentZone.name === 'Space') {
                console.log(`Entering Space - cleaning up ground objects`);
                this.cleanupGroundObjects();
            }
        } else {
            // Only respawn if we have very few objects - reduced threshold for less aggressive respawning
            const activeBalloons = this.balloons ? this.balloons.getChildren().filter(obj => obj.active && obj.visible).length : 0;
            const activeBirds = this.birds ? this.birds.getChildren().filter(obj => obj.active && obj.visible).length : 0;
            const totalExpected = (GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT + GAME_CONSTANTS.OBSTACLES.BIRD_COUNT) * 0.4; // Adjusted for new spawn counts
            const totalActive = activeBalloons + activeBirds;
            
            // Only respawn if we have less than 15% of expected objects (reduced from 25%)
            if (totalActive < totalExpected * 0.15) {
                console.log(`Critical low object count detected in ${currentZone.name}: ${totalActive}/${totalExpected} objects active, respawning...`);
                this.spawnObjectsForMultipleZones();
            }
        }
    }

    checkZoneBuffering(currentZone, playerY) {
        // Check if player is approaching zone boundaries and pre-spawn objects
        const playerAltitude = this.scene.groundLevel - playerY;
        const zoneBoundaries = [
            { zone: 'Ground Level', boundary: 2000 },
            { zone: 'Low Altitude', boundary: 5000 },
            { zone: 'Mid Altitude', boundary: 10000 },
            { zone: 'High Altitude', boundary: 15000 }
        ];
        
        for (const boundary of zoneBoundaries) {
            const distanceToBoundary = Math.abs(playerAltitude - boundary.boundary);
            
            // Only pre-spawn when very close to boundary (reduced from transitionDistance)
            if (distanceToBoundary < 500) { // Reduced from transitionDistance (2000) to 500
                // Player is approaching a zone boundary
                const targetZone = boundary.zone;
                
                if (!this.zoneBuffer.adjacent.has(targetZone)) {
                    console.log(`Zone buffering: Pre-spawning objects for ${targetZone} (distance to boundary: ${distanceToBoundary} ft)`);
                    this.zoneBuffer.adjacent.add(targetZone);
                    
                    // Pre-spawn fewer objects to reduce flickering
                    let preloadCount = 3; // Reduced from 10 to 3
                    
                    // Extra preloading for mid and high altitude zones (player's main range)
                    if (targetZone === 'Mid Altitude' || targetZone === 'High Altitude' || targetZone === 'Space') {
                        preloadCount = 5; // Reduced from 15 to 5
                        console.log(`Enhanced preloading for ${targetZone}: ${preloadCount} objects`);
                    }
                    
                    this.preSpawnZoneObjects(targetZone, preloadCount);
                }
            } else {
                // Player is moving away from boundary, clear from buffer
                this.zoneBuffer.adjacent.delete(boundary.zone);
            }
        }
        
        // Reduced preloading for high altitude zones
        this.checkHighAltitudePreloading(playerAltitude);
    }

    preSpawnZoneObjects(zoneName, count) {
        // Pre-spawn a small number of objects for the target zone
        const maxObjects = Math.min(count, 5);
        
        switch (zoneName) {
            case 'Ground Level':
            case 'Low Altitude':
                this._preSpawnGroundObjects(maxObjects);
                break;
            case 'Mid Altitude':
                this._preSpawnMidAltitudeObjects(maxObjects);
                break;
            case 'High Altitude':
                this._preSpawnHighAltitudeObjects(maxObjects);
                break;
            case 'Space':
                this._preSpawnSpaceObjects(maxObjects);
                break;
        }
    }

    _preSpawnGroundObjects(count) {
        for (let i = 0; i < count; i++) {
            const balloon = this.getPooledObject('balloon', 'balloons');
            if (balloon) {
                this._resetBalloon(balloon, 'balloon');
            }
            
            const bird = this.getPooledObject('birds', 'birds');
            if (bird) {
                this._resetBird(bird, 'birds');
            }
        }
    }

    _preSpawnHighAltitudeObjects(count) {
        for (let i = 0; i < count; i++) {
            const balloon = this.getPooledObject('hot_air_balloon', 'balloons');
            if (balloon) {
                this._resetBalloon(balloon, 'hot_air_balloon');
            }
            
            const bird = this.getPooledObject('plane', 'birds');
            if (bird) {
                this._resetBird(bird, 'plane');
            }
        }
    }

    _preSpawnSpaceObjects(count) {
        for (let i = 0; i < count; i++) {
            const balloon = this.getPooledObject('satellite', 'balloons');
            if (balloon) {
                this._resetBalloon(balloon, 'satellite');
            }
            
            const bird = this.getPooledObject('martian', 'birds');
            if (bird) {
                this._resetBird(bird, 'martian');
            }
        }
    }

    _preSpawnMidAltitudeObjects(count) {
        for (let i = 0; i < count; i++) {
            // Mix of balloons and hot air balloons for variety
            const balloonType = Math.random() > 0.5 ? 'balloon_2' : 'hot_air_balloon';
            const balloon = this.getPooledObject(balloonType, 'balloons');
            if (balloon) {
                this._resetBalloon(balloon, balloonType);
            }
            
            // Mix of birds and planes for variety
            const birdType = Math.random() > 0.5 ? 'birds_2' : 'plane';
            const bird = this.getPooledObject(birdType, 'birds');
            if (bird) {
                this._resetBird(bird, birdType);
            }
        }
    }

    checkHighAltitudePreloading(playerAltitude) {
        // Adjusted preloading for the new zone boundaries
        if (playerAltitude >= 4500 && playerAltitude < 5000) {
            // Preload mid altitude objects when approaching mid altitude zone
            if (!this.zoneBuffer.adjacent.has('Mid Altitude')) {
                console.log(`Early preloading: Mid Altitude objects (player at ${playerAltitude} ft)`);
                this.zoneBuffer.adjacent.add('Mid Altitude');
                this.preSpawnZoneObjects('Mid Altitude', 4); // Increased for player's main range
            }
        }
        
        if (playerAltitude >= 9500 && playerAltitude < 10000) {
            // Preload high altitude objects when approaching high altitude zone
            if (!this.zoneBuffer.adjacent.has('High Altitude')) {
                console.log(`Early preloading: High Altitude objects (player at ${playerAltitude} ft)`);
                this.zoneBuffer.adjacent.add('High Altitude');
                this.preSpawnZoneObjects('High Altitude', 4); // Increased for player's reachable range
            }
        }
        
        if (playerAltitude >= 14500 && playerAltitude < 15000) {
            // Preload space objects when very close to space boundary
            if (!this.zoneBuffer.adjacent.has('Space')) {
                console.log(`Early preloading: Space objects (player at ${playerAltitude} ft)`);
                this.zoneBuffer.adjacent.add('Space');
                this.preSpawnZoneObjects('Space', 3); // Reduced since less reachable
            }
        }
        
        // Only cleanup ground objects when player is well into mid altitude
        if (playerAltitude >= 7000) { // Increased from 12000 to 7000 for better performance
            this.cleanupGroundObjects();
        }
    }

    cleanupGroundObjects() {
        // Prevent cleanup from running too frequently
        if (this.lastGroundCleanup && this.scene.time.now - this.lastGroundCleanup < 5000) {
            return; // Only cleanup every 5 seconds
        }
        this.lastGroundCleanup = this.scene.time.now;
        
        // Return ground-level objects to pools when player is high enough
        let cleanedCount = 0;
        
        if (this.balloons) {
            this.balloons.getChildren().forEach(obj => {
                if (obj.active && obj.visible && obj.texture && 
                    (obj.texture.key === 'balloon' || obj.texture.key === 'balloon_2')) {
                    this.returnToPool(obj, 'balloons');
                    cleanedCount++;
                }
            });
        }
        
        if (this.birds) {
            this.birds.getChildren().forEach(obj => {
                if (obj.active && obj.visible && obj.texture && 
                    (obj.texture.key === 'birds' || obj.texture.key === 'birds_2')) {
                    this.returnToPool(obj, 'birds');
                    cleanedCount++;
                }
            });
        }
        
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} ground objects`);
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
        // Reduce object counts for better spacing and performance
        const balloonCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT * 0.4), maxObjects / 3); // Reduced from /2
        const birdCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT * 0.4), maxObjects / 3); // Reduced from /2
        
        console.log(`=== GROUND OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${balloonCount} balloons and ${birdCount} birds in GROUND/LOW_ALTITUDE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        
        // Spawn ground/low altitude objects using object pooling
        for (let i = 0; i < balloonCount; i++) {
            console.log(`Creating balloon ${i + 1}/${balloonCount}`);
            // Randomly choose between balloon and balloon_2 for variety
            const textureType = Math.random() > 0.5 ? 'balloon' : 'balloon_2';
            const balloon = this.getPooledObject(textureType, 'balloons');
            if (balloon) {
                console.log(`Balloon ${i + 1} created successfully`);
                this._resetBalloon(balloon, textureType);
            } else {
                console.log(`FAILED to create balloon ${i + 1}`);
            }
        }
        for (let i = 0; i < birdCount; i++) {
            console.log(`Creating bird ${i + 1}/${birdCount}`);
            // Randomly choose between birds and birds_2 for variety
            const textureType = Math.random() > 0.5 ? 'birds' : 'birds_2';
            const bird = this.getPooledObject(textureType, 'birds');
            if (bird) {
                console.log(`Bird ${i + 1} created successfully`);
                this._resetBird(bird, textureType);
            } else {
                console.log(`FAILED to create bird ${i + 1}`);
            }
        }
        
        console.log(`=== GROUND OBJECT SPAWNING COMPLETE ===`);
    }

    _spawnHighAltitudeObjects(maxObjects) {
        // Reduce object counts for better spacing and performance
        const balloonCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT * 0.4), maxObjects / 3); // Reduced from /2
        const planeCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT * 0.4), maxObjects / 3); // Reduced from /2
        
        console.log(`=== HIGH ALTITUDE OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${balloonCount} hot air balloons and ${planeCount} planes in HIGH_ALTITUDE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        console.log(`Available textures: hot_air_balloon=${this.scene.textures.exists('hot_air_balloon')}, plane=${this.scene.textures.exists('plane')}`);
        console.log(`Player Y: ${this.scene.player ? this.scene.player.y : 'no player'}, Ground Level: ${this.scene.groundLevel}`);
        console.log(`Camera scroll Y: ${this.scene.cameras.main.scrollY}`);
        
        // Spawn high altitude objects using object pooling
        for (let i = 0; i < balloonCount; i++) {
            console.log(`Creating high altitude balloon ${i + 1}/${balloonCount}`);
            const balloon = this.getPooledObject('hot_air_balloon', 'balloons');
            if (balloon) {
                console.log(`High altitude balloon ${i + 1} created successfully`);
                this._resetBalloon(balloon, 'hot_air_balloon');
            } else {
                console.log(`FAILED to create high altitude balloon ${i + 1}`);
            }
        }
        for (let i = 0; i < planeCount; i++) {
            console.log(`Creating plane ${i + 1}/${planeCount}`);
            const bird = this.getPooledObject('plane', 'birds');
            if (bird) {
                console.log(`Plane ${i + 1} created successfully`);
                this._resetBird(bird, 'plane');
            } else {
                console.log(`FAILED to create plane ${i + 1}`);
            }
        }
        
        // Debug: Check final object counts
        const finalBalloonCount = this.balloons ? this.balloons.getChildren().filter(obj => obj.active && obj.visible).length : 0;
        const finalBirdCount = this.birds ? this.birds.getChildren().filter(obj => obj.active && obj.visible).length : 0;
        console.log(`Final object counts - Balloons: ${finalBalloonCount}, Birds/Planes: ${finalBirdCount}`);
        
        console.log(`=== HIGH ALTITUDE OBJECT SPAWNING COMPLETE ===`);
    }

    _spawnSpaceObjects(maxObjects) {
        // Reduce object counts for better spacing and performance
        const satelliteCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT * 0.4), maxObjects / 3); // Reduced from /2
        const martianCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT * 0.4), maxObjects / 3); // Reduced from /2
        
        console.log(`=== SPACE OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${satelliteCount} satellites and ${martianCount} martians in SPACE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        console.log(`Available textures: satellite=${this.scene.textures.exists('satellite')}, martian=${this.scene.textures.exists('martian')}`);
        
        for (let i = 0; i < satelliteCount; i++) {
            console.log(`Creating satellite ${i + 1}/${satelliteCount}`);
            const balloon = this.getPooledObject('satellite', 'balloons');
            if (balloon) {
                console.log(`Satellite ${i + 1} created successfully`);
                this._resetBalloon(balloon, 'satellite');
            } else {
                console.log(`FAILED to create satellite ${i + 1}`);
            }
        }
        for (let i = 0; i < martianCount; i++) {
            console.log(`Creating martian ${i + 1}/${martianCount}`);
            const bird = this.getPooledObject('martian', 'birds');
            if (bird) {
                console.log(`Martian ${i + 1} created successfully`);
                this._resetBird(bird, 'martian');
            } else {
                console.log(`FAILED to create martian ${i + 1}`);
            }
        }
        console.log(`=== SPACE OBJECT SPAWNING COMPLETE ===`);
    }

    _spawnMidAltitudeObjects(maxObjects) {
        // Increase object counts for the player's main gameplay range (5000-10000 ft)
        const balloonCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BALLOON_COUNT * 0.6), maxObjects / 2); // Increased from 0.4 to 0.6
        const birdCount = Math.min(Math.floor(GAME_CONSTANTS.OBSTACLES.BIRD_COUNT * 0.6), maxObjects / 2); // Increased from 0.4 to 0.6
        
        console.log(`=== MID ALTITUDE OBJECT SPAWNING ===`);
        console.log(`Attempting to spawn ${balloonCount} mixed balloons and ${birdCount} mixed birds in MID_ALTITUDE zone`);
        console.log(`Balloons group exists: ${this.balloons ? 'YES' : 'NO'}`);
        console.log(`Birds group exists: ${this.birds ? 'YES' : 'NO'}`);
        
        // Spawn mid altitude objects with variety
        for (let i = 0; i < balloonCount; i++) {
            console.log(`Creating mid altitude balloon ${i + 1}/${balloonCount}`);
            // Mix of balloon_2 and hot_air_balloon for variety in player's range
            const balloonType = Math.random() > 0.5 ? 'balloon_2' : 'hot_air_balloon';
            const balloon = this.getPooledObject(balloonType, 'balloons');
            if (balloon) {
                console.log(`Mid altitude balloon ${i + 1} created successfully (${balloonType})`);
                this._resetBalloon(balloon, balloonType);
            } else {
                console.log(`FAILED to create mid altitude balloon ${i + 1}`);
            }
        }
        
        for (let i = 0; i < birdCount; i++) {
            console.log(`Creating mid altitude bird ${i + 1}/${birdCount}`);
            // Mix of birds_2 and plane for variety in player's range
            const birdType = Math.random() > 0.5 ? 'birds_2' : 'plane';
            const bird = this.getPooledObject(birdType, 'birds');
            if (bird) {
                console.log(`Mid altitude bird ${i + 1} created successfully (${birdType})`);
                this._resetBird(bird, birdType);
            } else {
                console.log(`FAILED to create mid altitude bird ${i + 1}`);
            }
        }
        
        // Debug: Check final object counts
        const finalBalloonCount = this.balloons ? this.balloons.getChildren().filter(obj => obj.active && obj.visible).length : 0;
        const finalBirdCount = this.birds ? this.birds.getChildren().filter(obj => obj.active && obj.visible).length : 0;
        console.log(`Final object counts - Balloons: ${finalBalloonCount}, Birds: ${finalBirdCount}`);
        
        console.log(`=== MID ALTITUDE OBJECT SPAWNING COMPLETE ===`);
    }

    _resetBalloon(balloon, textureType) {
        // Validate the balloon object is still valid
        if (!balloon || !balloon.scene || !balloon.scene.sys) {
            console.error('Invalid balloon object, cannot reset');
            return;
        }
        
        // Ensure physics body exists and is ENABLED for all objects (unified approach)
        if (!balloon.body) {
            console.warn('Balloon has no physics body, creating one');
            balloon.body = this.scene.physics.add.existing(balloon, false);
        }
        // Enable physics body for all objects - unified physics behavior
        balloon.body.enable = true;

        // Texture should already be set correctly from pool, only set if different
        if (balloon.texture.key !== textureType) {
            if (this.scene.textures.exists(textureType)) {
                balloon.setTexture(textureType);
            } else {
                console.warn(`Balloon texture '${textureType}' does not exist, using fallback`);
                balloon.setTexture('balloon');
            }
        }

        // Size variations based on asset type for better visual variety
        let assetSize = GAME_CONSTANTS.UI_SCALE.BALLOON_SIZE;
        if (textureType === 'satellite') {
            assetSize = 60; // Satellites are smaller
        } else if (textureType === 'hot_air_balloon') {
            assetSize = 90; // Hot air balloons are larger
        } else if (textureType === 'balloon_2') {
            assetSize = 85; // Balloon_2 is larger
        } else {
            assetSize = 80; // Default balloon size
        }

        // Unified size and physics setup
        balloon.setDisplaySize(assetSize, assetSize);
        balloon.refreshBody();
        balloon.setCircle(balloon.width / 2);
        balloon.setActive(true).setVisible(true);

        // Kill any existing tweens and ensure clean state
        this.scene.tweens.killTweensOf(balloon);
        balloon.setRotation(0);
        balloon.setAlpha(1);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        
        // Position based on texture type using updated zone boundaries
        let minY, maxY;
        const groundLevel = this.scene.groundLevel;
        
        if (textureType === 'satellite') {
            // Space zone: 15000+ ft (Y: groundLevel - 20000 to groundLevel - 15000)
            minY = groundLevel - 20000;
            maxY = groundLevel - 15000;
        } else if (textureType === 'hot_air_balloon') {
            // Can appear in both Mid Altitude and High Altitude zones for variety
            if (Math.random() > 0.3) {
                // 70% chance: Mid Altitude zone (5000-10000 ft) - player's main range
                minY = groundLevel - 10000;
                maxY = groundLevel - 5000;
            } else {
                // 30% chance: High Altitude zone (10000-15000 ft) - stretch goal
                minY = groundLevel - 15000;
                maxY = groundLevel - 10000;
            }
        } else if (textureType === 'balloon_2') {
            // Can appear in Low Altitude and Mid Altitude zones for variety
            if (Math.random() > 0.3) {
                // 70% chance: Mid Altitude zone (5000-10000 ft) - player's main range
                minY = groundLevel - 10000;
                maxY = groundLevel - 5000;
            } else {
                // 30% chance: Low Altitude zone (2000-5000 ft)
                minY = groundLevel - 5000;
                maxY = groundLevel - 2000;
            }
        } else {
            // Ground zone: 0-2000 ft (Y: groundLevel - 2000 to groundLevel - 400)
            minY = groundLevel - 2000;
            maxY = groundLevel - 400;
        }
        
        const y = Phaser.Math.Between(minY, maxY);
        balloon.setPosition(x, y);
        
        console.log(`Balloon created: texture=${balloon.texture.key}, size=${assetSize}, position=(${x}, ${y}), altitude=${Math.round(groundLevel - y)} ft`);
        
        // Unified physics behavior - all objects get horizontal velocity
        const velocityX = Phaser.Math.Between(50, 100) * (Math.random() > 0.5 ? 1 : -1); // Reduced velocity for better control
        balloon.body.setVelocityX(velocityX);
        balloon.setFlipX(velocityX > 0);

        const balloonId = `balloon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        balloon.setName(balloonId);
        this.assetAgeMap.set(balloonId, this.scene.dayCount);

        // Much gentler animation for balloons - hover instead of wave
        const animationRange = 3; // Reduced from 10 to 3 for gentle hovering
        this.scene.tweens.add({
            targets: balloon,
            y: y - animationRange,
            duration: Phaser.Math.Between(3000, 4000), // Increased duration for very gentle movement
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });
    }

    _resetBird(bird, textureType) {
        // Validate the bird object is still valid
        if (!bird || !bird.scene || !bird.scene.sys) {
            console.error('Invalid bird object, cannot reset');
            return;
        }
        
        // Ensure physics body exists and is enabled (unified approach)
        if (!bird.body) {
            console.warn('Bird has no physics body, creating one');
            bird.body = this.scene.physics.add.existing(bird, false);
        }
        bird.body.enable = true;

        // Texture should already be set correctly from pool, only set if different
        if (bird.texture.key !== textureType) {
            if (this.scene.textures.exists(textureType)) {
                bird.setTexture(textureType);
            } else {
                console.warn(`Bird texture '${textureType}' does not exist, using fallback`);
                bird.setTexture('birds');
            }
        }

        // Size variations based on asset type for better visual variety
        let assetSize = 80; // Base bird size (not balloon size)
        if (textureType === 'martian') {
            assetSize = 70; // Martians are medium-sized
        } else if (textureType === 'plane') {
            assetSize = 85; // Planes are larger
        } else if (textureType === 'birds_2') {
            assetSize = 72; // Birds_2 increased by 10% (was 65, now 72)
        } else {
            assetSize = 80; // Default bird size
        }

        // Unified size and physics setup
        bird.setDisplaySize(assetSize, assetSize);
        bird.scaleY = bird.scaleX;
        bird.refreshBody();
        bird.body.setSize(bird.width * 0.85, bird.height * 0.85).setOffset(bird.width * 0.075, bird.height * 0.075);
        bird.setActive(true).setVisible(true);

        // Kill any existing tweens and ensure clean state
        this.scene.tweens.killTweensOf(bird);
        bird.setRotation(0);
        bird.setAlpha(1);

        const birdX = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        
        // Position based on texture type using updated zone boundaries
        let minY, maxY;
        const groundLevel = this.scene.groundLevel;
        
        if (textureType === 'martian') {
            // Space zone: 15000+ ft (Y: groundLevel - 20000 to groundLevel - 15000)
            minY = groundLevel - 20000;
            maxY = groundLevel - 15000;
        } else if (textureType === 'plane') {
            // Can appear in both Mid Altitude and High Altitude zones for variety
            if (Math.random() > 0.3) {
                // 70% chance: Mid Altitude zone (5000-10000 ft) - player's main range
                minY = groundLevel - 10000;
                maxY = groundLevel - 5000;
            } else {
                // 30% chance: High Altitude zone (10000-15000 ft) - stretch goal
                minY = groundLevel - 15000;
                maxY = groundLevel - 10000;
            }
        } else if (textureType === 'birds_2') {
            // Can appear in Low Altitude and Mid Altitude zones for variety
            if (Math.random() > 0.3) {
                // 70% chance: Mid Altitude zone (5000-10000 ft) - player's main range
                minY = groundLevel - 10000;
                maxY = groundLevel - 5000;
            } else {
                // 30% chance: Low Altitude zone (2000-5000 ft)
                minY = groundLevel - 5000;
                maxY = groundLevel - 2000;
            }
        } else {
            // Ground zone: 0-2000 ft (Y: groundLevel - 2000 to groundLevel - 400)
            minY = groundLevel - 2000;
            maxY = groundLevel - 400;
        }
        
        const birdY = Phaser.Math.Between(minY, maxY);
        bird.setPosition(birdX, birdY);
        
        console.log(`Bird created: texture=${bird.texture.key}, size=${assetSize}, position=(${birdX}, ${birdY}), altitude=${Math.round(groundLevel - birdY)} ft`);
        
        // Unified physics behavior - reduced velocity for better control
        const velocityX = Phaser.Math.Between(50, 100) * (Math.random() > 0.5 ? 1 : -1);
        bird.body.setVelocityX(velocityX);
        bird.setFlipX(velocityX > 0);

        const birdId = `bird_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        bird.setName(birdId);
        this.assetAgeMap.set(birdId, this.scene.dayCount);
    }

    _resetCloud(cloud) {
        // Ensure physics body exists and is enabled
        if (!cloud.body) {
            console.warn('Cloud has no physics body, creating one');
            cloud.body = this.scene.physics.add.existing(cloud, false);
        }
        cloud.body.enable = true;

        const cloudTextures = ['cloud', 'cloud_2', 'cloud_3', 'cloud_4', 'cloud_5', 'cloud_6', 'cloud_7'];
        const randomTexture = Phaser.Math.RND.pick(cloudTextures);
        cloud.setTexture(randomTexture);

        cloud.setDisplaySize(GAME_CONSTANTS.UI_SCALE.CLOUD_SIZE, GAME_CONSTANTS.UI_SCALE.CLOUD_HEIGHT);
        cloud.refreshBody();
        cloud.setCircle(cloud.width / 2);
        cloud.setActive(true).setVisible(true);

        // Kill any existing tweens and ensure clean state
        this.scene.tweens.killTweensOf(cloud);
        cloud.setRotation(0);
        cloud.setAlpha(1);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        // Constrain cloud positioning to prevent rapid vertical movements
        // Clouds should spawn in the middle altitude range (4000-12000 ft)
        const groundLevel = this.scene.groundLevel;
        const minY = groundLevel - 12000; // 12000 ft altitude
        const maxY = groundLevel - 4000;  // 4000 ft altitude
        const y = Phaser.Math.Between(minY, maxY);
        cloud.setPosition(x, y);
        cloud.body.setVelocity(0, 0);

        const cloudId = `cloud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        cloud.setName(cloudId);
        this.assetAgeMap.set(cloudId, this.scene.dayCount);

        // Reduced animation range to prevent rapid vertical movements
        const animationRange = 15; // Reduced from 20 to 15
        this.scene.tweens.add({
            targets: cloud,
            y: y - animationRange,
            duration: Phaser.Math.Between(3000, 4000), // Increased duration for smoother movement
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });

        const horizontalDistance = Phaser.Math.Between(50, 150);
        const horizontalDuration = Phaser.Math.Between(4000, 6000); // Increased duration for smoother movement
        
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

        // Kill any existing tweens and ensure clean state
        this.scene.tweens.killTweensOf(coin);
        coin.setRotation(0);
        coin.setAlpha(1);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        // Constrain coin positioning to prevent rapid vertical movements
        // Coins should spawn in a reasonable altitude range (1000-8000 ft)
        const groundLevel = this.scene.groundLevel;
        const minY = groundLevel - 8000;  // 8000 ft altitude
        const maxY = groundLevel - 1000;  // 1000 ft altitude
        const y = Phaser.Math.Between(minY, maxY);
        
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

        // Reduced coin floating animation range
        const animationRange = 10; // Reduced from 20 to 10
        this.scene.tweens.add({
            targets: coin,
            y: y - animationRange,
            duration: Phaser.Math.Between(2000, 3000), // Increased duration for smoother movement
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

        // Kill any existing tweens and ensure clean state
        this.scene.tweens.killTweensOf(gasTank);
        gasTank.setRotation(0);
        gasTank.setAlpha(1);

        const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        // Constrain gas tank positioning to prevent rapid vertical movements
        // Gas tanks should spawn in a reasonable altitude range (2000-10000 ft)
        const groundLevel = this.scene.groundLevel;
        const minY = groundLevel - 10000; // 10000 ft altitude
        const maxY = groundLevel - 2000;  // 2000 ft altitude
        const y = Phaser.Math.Between(minY, maxY);
        
        gasTank.setPosition(x, y);
        gasTank.body.setVelocity(0, 0);

        const gasTankId = `gasTank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gasTank.setName(gasTankId);
        this.assetAgeMap.set(gasTankId, this.scene.dayCount);

        // Reduced gas tank floating animation range
        const animationRange = 12; // Reduced from 15 to 12
        this.scene.tweens.add({
            targets: gasTank,
            y: y - animationRange,
            duration: Phaser.Math.Between(2500, 3500), // Increased duration for smoother movement
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            useRadians: true
        });
    }
}