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
        this.poolSize = GAME_CONSTANTS.PERFORMANCE.OBJECT_POOL_SIZE;
        
        // NEW: Asset Tracking System for Visual Continuity
        this.assetTracker = {
            // Track all active assets with their positions and visibility
            trackedAssets: new Map(), // asset.id -> { asset, lastPosition, isVisible, lastSeen, zone }
            
            // Screen bounds for visibility detection
            viewportBounds: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                buffer: 200 // Extra buffer beyond screen edges
            },
            
            // Persistence settings
            visibilityBuffer: 300, // Keep assets this far beyond screen edge
            maxInvisibleTime: 3000, // Max time to keep invisible assets (ms)
            
            // NEW: Asset Cycling System
            cycling: {
                enabled: true,
                horizontalCycling: true, // Cycle assets horizontally (left/right)
                verticalCycling: false, // Don't cycle vertically to avoid altitude confusion
                cycleBuffer: 100, // How far outside screen to start cycling
                replacementSpawning: true, // Spawn new assets when old ones are removed
                lastCycleTime: 0,
                cycleInterval: 100, // Check for cycling every 100ms
                
                // Track recently cycled assets to prevent immediate re-cycling
                recentlyCycled: new Set(),
                cooldownTime: 2000 // 2 second cooldown before asset can be cycled again
            },
            
            // Asset grid for intelligent gap detection
            grid: {
                cellSize: 200, // Grid cell size in pixels
                occupiedCells: new Set(), // Set of "x,y" grid coordinates with assets
                gridBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }
            },
            
            // Transition management
            isTransitioning: false,
            transitionStartTime: 0,
            preserveAllDuringTransition: true
        };
        
        // Zone buffering - pre-spawn objects for adjacent zones
        this.zoneBuffer = {
            current: null,
            adjacent: new Set(),
            transitionDistance: GAME_CONSTANTS.PERFORMANCE.ZONE_BUFFER_DISTANCE
        };
        
        // Cleanup tracking
        this.lastGroundCleanup = 0;
        
        // NEW: Dynamic Algorithm Properties
        this.dynamicSpawning = {
            // Density curve parameters
            baseDensity: 1.0,           // Base density multiplier at ground level
            decayRate: 0.8,             // Exponential decay rate (0.8 = 20% reduction per 1000ft)
            minDensity: 0.15,           // Minimum density at highest altitudes (15% of base)
            
            // Gap prevention
            maxGapDistance: 800,        // Maximum vertical gap between assets (in pixels)
            gapCheckRadius: 400,        // Radius to check for existing assets
            minAssetSpacing: 200,       // Minimum spacing between assets
            
            // Atmospheric zones with smooth transitions
            atmosphericZones: [
                {
                    name: 'Surface',
                    altitudeRange: { min: 0, max: 1500 },
                    densityMultiplier: 1.0,
                    assetTypes: {
                        balloon: { weight: 0.6, textures: ['balloon', 'balloon_2'] },
                        bird: { weight: 0.4, textures: ['birds', 'birds_2'] }
                    },
                    spawnPattern: 'scattered',
                    clusterProbability: 0.3
                },
                {
                    name: 'Lower Atmosphere',
                    altitudeRange: { min: 1500, max: 4000 },
                    densityMultiplier: 1.0,
                    assetTypes: {
                        balloon: { weight: 0.5, textures: ['balloon_2', 'hot_air_balloon'] },
                        bird: { weight: 0.35, textures: ['birds_2', 'plane'] },
                        cloud: { weight: 0.15, textures: ['cloud', 'cloud_2'] }
                    },
                    spawnPattern: 'mixed',
                    clusterProbability: 0.25
                },
                {
                    name: 'Middle Atmosphere',
                    altitudeRange: { min: 4000, max: 8000 },
                    densityMultiplier: 1.0,
                    assetTypes: {
                        balloon: { weight: 0.4, textures: ['hot_air_balloon', 'balloon_2'] },
                        bird: { weight: 0.3, textures: ['plane', 'birds_2'] },
                        cloud: { weight: 0.3, textures: ['cloud_2', 'cloud_3', 'cloud_4'] }
                    },
                    spawnPattern: 'paths',
                    clusterProbability: 0.2
                },
                {
                    name: 'Upper Atmosphere',
                    altitudeRange: { min: 8000, max: 15000 },
                    densityMultiplier: 1.0,
                    assetTypes: {
                        balloon: { weight: 0.3, textures: ['hot_air_balloon', 'satellite'] },
                        bird: { weight: 0.25, textures: ['plane', 'martian'] },
                        cloud: { weight: 0.45, textures: ['cloud_4', 'cloud_5', 'cloud_6'] }
                    },
                    spawnPattern: 'sparse_paths',
                    clusterProbability: 0.1
                },
                {
                    name: 'Space',
                    altitudeRange: { min: 15000, max: 50000 },
                    densityMultiplier: 1.0,
                    assetTypes: {
                        balloon: { weight: 0.4, textures: ['satellite'] },
                        bird: { weight: 0.4, textures: ['martian'] },
                        cloud: { weight: 0.2, textures: ['cloud_6', 'cloud_7'] }
                    },
                    spawnPattern: 'strategic_paths',
                    clusterProbability: 0.05
                }
            ]
        };
        
        // Track spawned assets for gap prevention
        this.spawnedAssets = new Map(); // altitude -> array of asset positions
        
        // Create physics groups
        this.balloons = scene.physics.add.group({ allowGravity: false });
        this.birds = scene.physics.add.group({ allowGravity: false });
        this.clouds = scene.physics.add.group({ allowGravity: false });
        this.coins = scene.physics.add.group({ allowGravity: false });
        this.gasTanks = scene.physics.add.group({ allowGravity: false });
        
        console.log('ObjectSpawner physics groups created with dynamic algorithm');
        
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

    // NEW: Dynamic density calculation - CONSISTENT for testing
    calculateDensityAtAltitude(altitude) {
        // Return consistent density for all altitudes during testing
        return 1.0; // Constant density across all altitudes
    }

    // NEW: Get atmospheric zone for given altitude
    getAtmosphericZone(altitude) {
        const zones = this.dynamicSpawning.atmosphericZones;
        
        for (let zone of zones) {
            if (altitude >= zone.altitudeRange.min && altitude <= zone.altitudeRange.max) {
                return zone;
            }
        }
        
        // Default to highest zone if beyond range
        return zones[zones.length - 1];
    }

    // NEW: Calculate total assets needed for current view
    calculateAssetsForCurrentView() {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const playerAltitude = this.scene.groundLevel - playerY;
        const viewHeight = this.scene.cameras.main.height;
        const spawnRadius = viewHeight * 2; // Spawn in 2x screen height radius
        
        // Calculate altitude range for current view
        const minAltitude = Math.max(0, this.scene.groundLevel - (playerY + spawnRadius));
        const maxAltitude = Math.max(0, this.scene.groundLevel - (playerY - spawnRadius));
        
        console.log(`Calculating assets for view: ${Math.round(minAltitude)}-${Math.round(maxAltitude)}ft`);
        
        let totalAssets = 0;
        const altitudeStep = 100; // Check density every 100ft
        
        // Integrate density over altitude range
        for (let alt = minAltitude; alt <= maxAltitude; alt += altitudeStep) {
            const density = this.calculateDensityAtAltitude(alt);
            const zone = this.getAtmosphericZone(alt);
            const zoneDensity = density * zone.densityMultiplier;
            
            // Increased base asset count for better gameplay
            const baseAssetsPerSlice = 2.0; // Base multiplier
            const assetsForThisSlice = baseAssetsPerSlice * zoneDensity;
            totalAssets += assetsForThisSlice;
            
            // Debug logging for altitude bands
            if (alt % 1000 === 0) { // Log every 1000ft
                console.log(`Altitude ${alt}ft: density=${density.toFixed(3)}, zone=${zone.name}, zoneDensity=${zoneDensity.toFixed(3)}, assets=${assetsForThisSlice.toFixed(2)}`);
            }
        }
        
        // No minimum limits - use natural density calculation for consistent density
        console.log(`Total calculated assets: ${Math.round(totalAssets)}`);
        return Math.round(totalAssets);
    }

    // NEW: Check for dangerous gaps and ensure viable paths
    checkForGapsAndEnsureViability() {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const playerAltitude = this.scene.groundLevel - playerY;
        const { maxGapDistance, gapCheckRadius } = this.dynamicSpawning;
        
        // Check for vertical gaps in spawn grid
        const checkAltitudeRange = 3000; // Check 3000ft above player
        const gridSize = 200; // Check every 200ft
        
        for (let alt = playerAltitude; alt < playerAltitude + checkAltitudeRange; alt += gridSize) {
            const y = this.scene.groundLevel - alt;
            
            // Check if there are any assets in this altitude band
            const hasAssets = this.checkForAssetsInRange(y, gapCheckRadius);
            
            if (!hasAssets) {
                // Found a gap - spawn emergency assets
                this.spawnEmergencyAssets(y, alt);
            }
        }
    }

    // NEW: Check if assets exist in a given range
    checkForAssetsInRange(centerY, radius) {
        const allAssets = [
            ...this.balloons.getChildren(),
            ...this.birds.getChildren(),
            ...this.clouds.getChildren()
        ];
        
        return allAssets.some(asset => {
            if (!asset.active || !asset.visible) return false;
            return Math.abs(asset.y - centerY) <= radius;
        });
    }

    // NEW: Spawn emergency assets to prevent gaps
    spawnEmergencyAssets(y, altitude) {
        const zone = this.getAtmosphericZone(altitude);
        const assetCount = Math.max(5, Math.floor(this.calculateDensityAtAltitude(altitude) * 8)); // Even more aggressive
        
        console.log(`Spawning ${assetCount} emergency assets at altitude ${altitude}ft to prevent gap`);
        
        let spawnedCount = 0;
        let attempts = 0;
        const maxAttempts = assetCount * 4; // Allow even more attempts
        
        while (spawnedCount < assetCount && attempts < maxAttempts) {
            const assetType = this.selectAssetTypeForZone(zone);
            const texture = this.selectTextureForAssetType(zone, assetType);
            
            const x = Phaser.Math.Between(30, this.scene.cameras.main.width - 30);
            const adjustedY = y + Phaser.Math.Between(-300, 300); // Even larger variation
            
            const asset = this.spawnSingleAsset(assetType, texture, x, adjustedY, true); // Emergency spawn
            
            if (asset) {
                spawnedCount++;
                console.log(`Emergency spawn success: ${assetType} at (${x}, ${adjustedY})`);
            }
            
            attempts++;
        }
        
        console.log(`Emergency spawning complete: ${spawnedCount}/${assetCount} assets spawned in ${attempts} attempts`);
    }

    // NEW: Select asset type based on zone weights
    selectAssetTypeForZone(zone) {
        const rand = Math.random();
        let cumulativeWeight = 0;
        
        for (const [assetType, config] of Object.entries(zone.assetTypes)) {
            cumulativeWeight += config.weight;
            if (rand <= cumulativeWeight) {
                return assetType;
            }
        }
        
        // Fallback to first asset type
        return Object.keys(zone.assetTypes)[0];
    }

    // NEW: Select texture for asset type
    selectTextureForAssetType(zone, assetType) {
        const config = zone.assetTypes[assetType];
        if (!config || !config.textures) return 'balloon'; // fallback
        
        return Phaser.Math.RND.pick(config.textures);
    }

    // NEW: Spawn single asset with validation
    spawnSingleAsset(assetType, texture, x, y, isEmergencySpawn = false) {
        // Check if the area is already occupied to prevent overcrowding
        // Skip occupation check for emergency spawns to ensure viable paths
        if (!isEmergencySpawn && this.isScreenAreaOccupied(x, y, 80)) {
            console.log(`Area at (${x}, ${y}) occupied, skipping spawn`);
            return null;
        }
        
        let asset = null;
        
        if (assetType === 'balloon') {
            asset = this.getPooledObject(texture, 'balloons');
            if (asset) {
                this._resetBalloon(asset, texture);
                asset.setPosition(x, y);
                console.log(`Spawned balloon: ${texture} at (${x}, ${y})`);
                
                // Register with tracking system
                this.registerAsset(asset, 'balloon');
            }
        } else if (assetType === 'bird') {
            asset = this.getPooledObject(texture, 'birds');
            if (asset) {
                this._resetBird(asset, texture);
                asset.setPosition(x, y);
                console.log(`Spawned bird: ${texture} at (${x}, ${y})`);
                
                // Register with tracking system
                this.registerAsset(asset, 'bird');
            }
        } else if (assetType === 'cloud') {
            // For clouds, create directly and reset position
            asset = this.clouds.create(x, y, texture);
            if (asset) {
                asset.setActive(true).setVisible(true);
                asset.setDisplaySize(GAME_CONSTANTS.UI_SCALE.CLOUD_SIZE, GAME_CONSTANTS.UI_SCALE.CLOUD_HEIGHT);
                asset.refreshBody();
                asset.setCircle(asset.width / 2);
                asset.body.setVelocity(0, 0);
                console.log(`Spawned cloud: ${texture} at (${x}, ${y})`);
                
                // Register with tracking system
                this.registerAsset(asset, 'cloud');
            }
        }
        
        if (asset) {
            console.log(`Successfully spawned ${assetType} at (${x}, ${y})`);
        } else {
            console.log(`Failed to spawn ${assetType} at (${x}, ${y})`);
        }
        
        return asset;
    }

    // NEW: Main dynamic spawning method
    spawnDynamicAssets() {
        console.log('=== DYNAMIC ASSET SPAWNING ===');
        
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const playerAltitude = this.scene.groundLevel - playerY;
        console.log(`Player altitude: ${Math.round(playerAltitude)} ft`);
        
        // Update asset tracking to maintain accurate visibility data
        this.updateAssetTracking();
        
        // NEW: Handle off-screen asset cycling
        this.cycleOffScreenAssets();
        
        // Calculate visible assets and screen coverage
        const visibleAssets = this.getVisibleAssets();
        const screenCoverage = this.calculateScreenCoverage();
        console.log(`Visible assets: ${visibleAssets.length}, Screen coverage: ${screenCoverage.toFixed(2)}`);
        
        // Calculate how many assets we need based on gaps
        const targetAssetCount = this.calculateAssetsForCurrentView();
        const currentActiveAssets = this.getActiveAssetCount();
        console.log(`Target: ${targetAssetCount}, Current active: ${currentActiveAssets}`);
        
        // Debug: Check atmospheric zone
        const currentZone = this.getAtmosphericZone(playerAltitude);
        console.log(`Current atmospheric zone: ${currentZone.name} (${currentZone.altitudeRange.min}-${currentZone.altitudeRange.max}ft)`);
        
        // Only clean up truly inactive objects, preserving visible ones
        this.returnInactiveObjectsToPools();
        
        // Check if we need more assets based on screen gaps
        const gapsDetected = this.detectScreenGaps();
        
        // Be more aggressive about spawning to ensure enough assets
        if (gapsDetected.length === 0 && visibleAssets.length >= Math.max(15, targetAssetCount * 0.7)) {
            console.log('Screen reasonably covered, minimal spawning needed');
            // Still spawn some assets to maintain density
            if (currentActiveAssets < targetAssetCount * 0.9) {
                this.spawnAssetsInGaps(Math.min(5, targetAssetCount - currentActiveAssets));
            }
            return;
        }
        
        // Calculate spawn count based on actual need - be more generous
        const assetsToSpawn = Math.min(
            targetAssetCount - currentActiveAssets, 
            Math.max(8, gapsDetected.length + 8), // Spawn more generously
            25 // Higher maximum spawning rate per frame
        );
        
        if (assetsToSpawn > 0) {
            console.log(`Spawning ${assetsToSpawn} assets to fill ${gapsDetected.length} detected gaps`);
            
            // Spawn assets intelligently in gaps
            this.spawnAssetsInGaps(assetsToSpawn);
            
            // Check for emergency gaps that need immediate filling
            this.checkForGapsAndEnsureViability();
        } else {
            console.log('No additional assets needed - screen is well covered');
        }
        
        console.log('=== DYNAMIC ASSET SPAWNING COMPLETE ===');
    }

    // NEW: Spawn assets using density distribution
    spawnAssetsWithDensityDistribution(totalAssets) {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const spawnRadius = this.scene.cameras.main.height * 1.5;
        
        console.log(`Spawning ${totalAssets} assets with density distribution`);
        console.log(`Player Y: ${playerY}, Spawn radius: ${spawnRadius}`);
        
        let actualSpawned = 0;
        
        for (let i = 0; i < totalAssets; i++) {
            // Choose random altitude within spawn radius
            const minY = playerY - spawnRadius;
            const maxY = playerY + spawnRadius;
            const y = Phaser.Math.Between(minY, maxY);
            const altitude = Math.max(0, this.scene.groundLevel - y);
            
            // Get zone and calculate spawn probability
            const zone = this.getAtmosphericZone(altitude);
            const density = this.calculateDensityAtAltitude(altitude);
            const spawnProbability = density * zone.densityMultiplier;
            
            console.log(`Attempt ${i+1}: Altitude ${Math.round(altitude)}ft, Zone: ${zone.name}, Spawn probability: ${spawnProbability.toFixed(3)}`);
            
            // Use probability to determine if we should spawn here
            if (Math.random() < spawnProbability) {
                const assetType = this.selectAssetTypeForZone(zone);
                const texture = this.selectTextureForAssetType(zone, assetType);
                
                console.log(`Spawning ${assetType} with texture ${texture} at altitude ${Math.round(altitude)}ft`);
                
                // Apply spawn pattern
                const positions = this.generateSpawnPositions(zone, y, 1);
                
                for (const pos of positions) {
                    const asset = this.spawnSingleAsset(assetType, texture, pos.x, pos.y);
                    if (asset) {
                        actualSpawned++;
                        console.log(`Successfully spawned ${assetType} at (${pos.x}, ${pos.y})`);
                    } else {
                        console.log(`Failed to spawn ${assetType} at (${pos.x}, ${pos.y})`);
                    }
                }
            }
        }
        
        console.log(`Actually spawned: ${actualSpawned}/${totalAssets} assets`);
    }

    // NEW: Generate spawn positions based on zone pattern
    generateSpawnPositions(zone, baseY, count) {
        const positions = [];
        const pattern = zone.spawnPattern;
        
        switch (pattern) {
            case 'scattered':
                for (let i = 0; i < count; i++) {
                    positions.push({
                        x: Phaser.Math.Between(50, this.scene.cameras.main.width - 50),
                        y: baseY + Phaser.Math.Between(-100, 100)
                    });
                }
                break;
                
            case 'mixed':
                // Mix of scattered and occasional clusters
                if (Math.random() < zone.clusterProbability) {
                    // Create cluster
                    const centerX = Phaser.Math.Between(200, this.scene.cameras.main.width - 200);
                    const clusterSize = Phaser.Math.Between(2, 4);
                    
                    for (let i = 0; i < clusterSize; i++) {
                        positions.push({
                            x: centerX + Phaser.Math.Between(-150, 150),
                            y: baseY + Phaser.Math.Between(-80, 80)
                        });
                    }
                } else {
                    // Regular scattered
                    positions.push({
                        x: Phaser.Math.Between(50, this.scene.cameras.main.width - 50),
                        y: baseY + Phaser.Math.Between(-80, 80)
                    });
                }
                break;
                
            case 'paths':
                // Create predictable paths for strategic navigation
                const pathCount = Math.ceil(count / 2);
                for (let i = 0; i < pathCount; i++) {
                    const pathX = (i + 1) * (this.scene.cameras.main.width / (pathCount + 1));
                    positions.push({
                        x: pathX + Phaser.Math.Between(-100, 100),
                        y: baseY + Phaser.Math.Between(-60, 60)
                    });
                }
                break;
                
            case 'sparse_paths':
                // Wider paths with more spacing
                const sparsePathX = Phaser.Math.Between(150, this.scene.cameras.main.width - 150);
                positions.push({
                    x: sparsePathX,
                    y: baseY + Phaser.Math.Between(-120, 120)
                });
                break;
                
            case 'strategic_paths':
                // Very strategic placement for high altitude
                const strategicX = this.scene.cameras.main.width / 2 + Phaser.Math.Between(-200, 200);
                positions.push({
                    x: strategicX,
                    y: baseY + Phaser.Math.Between(-80, 80)
                });
                break;
        }
        
        return positions;
    }

    // NEW: Get count of active assets
    getActiveAssetCount() {
        const activeBalloons = this.balloons.getChildren().filter(obj => obj.active && obj.visible).length;
        const activeBirds = this.birds.getChildren().filter(obj => obj.active && obj.visible).length;
        const activeClouds = this.clouds.getChildren().filter(obj => obj.active && obj.visible).length;
        
        return activeBalloons + activeBirds + activeClouds;
    }

    // MODIFIED: Update main spawning method to use dynamic algorithm
    spawnObjectsForMultipleZones() {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const playerAltitude = this.scene.groundLevel - playerY;
        
        console.log(`=== SPAWNING FOR MULTIPLE ZONES - Player at ${Math.round(playerAltitude)}ft ===`);
        
        // Clear grid if player is near ground level (new day/restart)
        if (playerAltitude < 500) {
            this.clearAssetGrid();
        }
        
        // Debug grid state
        this.debugGridState();
        
        // Use new dynamic spawning algorithm
        this.spawnDynamicAssets();
        
        // Still spawn coins and gas tanks with old method (they're fine)
        this.spawnCoinsAndGasTanks();
        
        // Test spawning disabled for consistent density testing
        // if (playerAltitude > 4000) {
        //     console.log(`DEBUG: Player above 4000ft, testing emergency spawns`);
        //     this.spawnTestAssetsAtAltitude(playerAltitude);
        // }
    }
    
    // NEW: Test method to force spawning at specific altitudes
    spawnTestAssetsAtAltitude(altitude) {
        const zone = this.getAtmosphericZone(altitude);
        const y = this.scene.groundLevel - altitude;
        
        console.log(`Test spawning at altitude ${altitude}ft, zone: ${zone.name}`);
        
        // Force spawn 3 assets for testing
        for (let i = 0; i < 3; i++) {
            const assetType = this.selectAssetTypeForZone(zone);
            const texture = this.selectTextureForAssetType(zone, assetType);
            const x = Phaser.Math.Between(100, this.scene.cameras.main.width - 100);
            const testY = y + Phaser.Math.Between(-200, 200);
            
            console.log(`Test spawning ${assetType} with texture ${texture} at (${x}, ${testY})`);
            const asset = this.spawnSingleAsset(assetType, texture, x, testY);
            
            if (asset) {
                console.log(`Test spawn successful: ${assetType} at altitude ${altitude}ft`);
            } else {
                console.log(`Test spawn failed: ${assetType} at altitude ${altitude}ft`);
            }
        }
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

    returnInactiveObjectsToPools() {
        // Update asset tracking first to identify protected assets
        this.updateAssetTracking();
        
        // NEW: Handle off-screen asset cycling
        this.cycleOffScreenAssets();
        
        let balloonsReturned = 0;
        let birdsReturned = 0;
        const protectedAssets = this.getProtectedAssets();
        const protectedAssetIds = new Set(protectedAssets.map(data => data.asset.trackingId));
        
        console.log(`Protected assets: ${protectedAssetIds.size}, Transitioning: ${this.assetTracker.isTransitioning}`);
        
        // Return inactive balloons to pools (but protect visible ones)
        if (this.balloons) {
            this.balloons.getChildren().forEach(obj => {
                const isProtected = obj.trackingId && protectedAssetIds.has(obj.trackingId);
                const isInactive = !obj.active || !obj.visible;
                
                // During transitions, be even more conservative
                if (this.assetTracker.isTransitioning) {
                    // Only return truly inactive objects during transitions
                    if (!obj.active) {
                        this.returnToPool(obj, 'balloons');
                        balloonsReturned++;
                        if (obj.trackingId) {
                            this.unregisterAsset(obj.trackingId);
                        }
                    }
                } else {
                    // Normal mode: return inactive objects that aren't protected
                    if (isInactive && !isProtected) {
                        this.returnToPool(obj, 'balloons');
                        balloonsReturned++;
                        if (obj.trackingId) {
                            this.unregisterAsset(obj.trackingId);
                        }
                    }
                }
            });
        }
        
        // Return inactive birds to pools (but protect visible ones)
        if (this.birds) {
            this.birds.getChildren().forEach(obj => {
                const isProtected = obj.trackingId && protectedAssetIds.has(obj.trackingId);
                const isInactive = !obj.active || !obj.visible;
                
                // During transitions, be even more conservative
                if (this.assetTracker.isTransitioning) {
                    // Only return truly inactive objects during transitions
                    if (!obj.active) {
                        this.returnToPool(obj, 'birds');
                        birdsReturned++;
                        if (obj.trackingId) {
                            this.unregisterAsset(obj.trackingId);
                        }
                    }
                } else {
                    // Normal mode: return inactive objects that aren't protected
                    if (isInactive && !isProtected) {
                        this.returnToPool(obj, 'birds');
                        birdsReturned++;
                        if (obj.trackingId) {
                            this.unregisterAsset(obj.trackingId);
                        }
                    }
                }
            });
        }
        
        console.log(`Returned ${balloonsReturned} balloons and ${birdsReturned} birds to pools (protected ${protectedAssetIds.size} visible assets)`);
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
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const playerAltitude = this.scene.groundLevel - playerY;
        const currentZone = this.getAtmosphericZone(playerAltitude);
        
        if (!this.currentAltitudeZone) {
            this.currentAltitudeZone = currentZone.name;
            console.log(`Initial zone set to: ${currentZone.name} (player Y: ${playerY})`);
            // Spawn objects for initial zone
            this.spawnObjectsForMultipleZones();
            return;
        }
        
        // Monitor pool health less frequently to reduce performance impact
        if (this.scene.time.now % 5000 === 0) { // Check every 5 seconds instead of 2
            this.checkPoolHealth();
        }
        
        // Check if we need to spawn more objects (dynamic algorithm handles this continuously)
        const currentActiveAssets = this.getActiveAssetCount();
        const targetAssetCount = this.calculateAssetsForCurrentView();
        
        // Spawn more objects if needed - much more frequently for better coverage
        if (currentActiveAssets < targetAssetCount * 0.85 && this.scene.time.now % 200 === 0) {
            console.log(`Dynamic respawn: ${currentActiveAssets}/${targetAssetCount} objects active at ${Math.round(playerAltitude)}ft`);
            this.spawnObjectsForMultipleZones();
        }
        
        // Proactive gap filling - check every 100ms for empty areas ahead of player
        if (this.scene.time.now % 100 === 0) {
            this.proactiveGapFilling(playerAltitude);
        }
        
        // Show zone transition when entering new atmospheric zone
        if (this.currentAltitudeZone !== currentZone.name) {
            console.log(`=== ATMOSPHERIC ZONE CHANGE ===`);
            console.log(`From: ${this.currentAltitudeZone} to: ${currentZone.name}`);
            console.log(`Player Altitude: ${Math.round(playerAltitude)} ft`);
            
            // Start transition mode to preserve visible assets
            this.startTransition();
            
            this.currentAltitudeZone = currentZone.name;
            
            // Show zone transition notification
            this.scene.showZoneTransition(currentZone.name);
            
            // Schedule transition end after brief period for asset adjustment
            this.scene.time.delayedCall(1500, () => {
                this.endTransition();
            });
            
            // Only cleanup very distant objects to maintain performance
            if (currentZone.name === 'Space') {
                console.log(`Entering Space - cleaning up ground objects`);
                this.cleanupGroundObjects();
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
            
            // Pre-spawn when approaching boundary (increased for earlier spawning)
            if (distanceToBoundary < 1500) { // Increased from 500 to 1500 for earlier spawning
                // Player is approaching a zone boundary
                const targetZone = boundary.zone;
                
                if (!this.zoneBuffer.adjacent.has(targetZone)) {
                    console.log(`Zone buffering: Pre-spawning objects for ${targetZone} (distance to boundary: ${distanceToBoundary} ft)`);
                    this.zoneBuffer.adjacent.add(targetZone);
                    
                    // Increase pre-spawn count for better object availability
                    let preloadCount = 8; // Increased from 3 to 8
                    
                    // Extra preloading for mid and high altitude zones (player's main range)
                    if (targetZone === 'Mid Altitude' || targetZone === 'High Altitude' || targetZone === 'Space') {
                        preloadCount = 12; // Increased from 5 to 12
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
        // Pre-spawn objects for the target zone with increased capacity
        const maxObjects = Math.min(count, 15); // Increased from 5 to 15
        
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
        // Enhanced preloading with earlier triggers and more objects
        if (playerAltitude >= 3500 && playerAltitude < 5000) {
            // Preload mid altitude objects earlier when approaching mid altitude zone
            if (!this.zoneBuffer.adjacent.has('Mid Altitude')) {
                console.log(`Early preloading: Mid Altitude objects (player at ${playerAltitude} ft)`);
                this.zoneBuffer.adjacent.add('Mid Altitude');
                this.preSpawnZoneObjects('Mid Altitude', 10); // Increased from 4 to 10
            }
        }
        
        if (playerAltitude >= 8000 && playerAltitude < 10000) {
            // Preload high altitude objects earlier when approaching high altitude zone
            if (!this.zoneBuffer.adjacent.has('High Altitude')) {
                console.log(`Early preloading: High Altitude objects (player at ${playerAltitude} ft)`);
                this.zoneBuffer.adjacent.add('High Altitude');
                this.preSpawnZoneObjects('High Altitude', 10); // Increased from 4 to 10
            }
        }
        
        if (playerAltitude >= 12000 && playerAltitude < 15000) {
            // Preload space objects earlier when approaching space boundary
            if (!this.zoneBuffer.adjacent.has('Space')) {
                console.log(`Early preloading: Space objects (player at ${playerAltitude} ft)`);
                this.zoneBuffer.adjacent.add('Space');
                this.preSpawnZoneObjects('Space', 8); // Increased from 3 to 8
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

        // Improved positioning: spawn balloons ahead of player trajectory
        let x;
        if (this.scene.player && this.scene.isAirborne) {
            // If player is airborne, consider their horizontal velocity for predictive spawning
            const playerVelX = this.scene.player.body.velocity.x;
            const baseX = this.scene.player.x;
            
            // Spawn objects in a wider area ahead of player's movement
            if (Math.abs(playerVelX) > 50) { // Player has significant horizontal movement
                const ahead = playerVelX > 0 ? 200 : -200; // Spawn ahead in movement direction
                x = Phaser.Math.Between(
                    Math.max(50, baseX + ahead - 150), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + ahead + 150)
                );
            } else {
                // No significant movement, spawn around player
                x = Phaser.Math.Between(
                    Math.max(50, baseX - 200), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + 200)
                );
            }
        } else {
            // Default random positioning
            x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        }
        
        // Position based on current position (if already set) or texture type
        const groundLevel = this.scene.groundLevel;
        let y;
        if (balloon.x !== 0 && balloon.y !== 0) {
            // Position already set by dynamic spawning, keep it
            x = balloon.x;
            y = balloon.y;
        } else {
            // Old method fallback - Position based on texture type using updated zone boundaries
            let minY, maxY;
            
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
            
            y = Phaser.Math.Between(minY, maxY);
        }
        
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

        // Improved positioning: spawn birds ahead of player trajectory
        let birdX;
        if (this.scene.player && this.scene.isAirborne) {
            // If player is airborne, consider their horizontal velocity for predictive spawning
            const playerVelX = this.scene.player.body.velocity.x;
            const baseX = this.scene.player.x;
            
            // Spawn objects in a wider area ahead of player's movement
            if (Math.abs(playerVelX) > 50) { // Player has significant horizontal movement
                const ahead = playerVelX > 0 ? 200 : -200; // Spawn ahead in movement direction
                birdX = Phaser.Math.Between(
                    Math.max(50, baseX + ahead - 150), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + ahead + 150)
                );
            } else {
                // No significant movement, spawn around player
                birdX = Phaser.Math.Between(
                    Math.max(50, baseX - 200), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + 200)
                );
            }
        } else {
            // Default random positioning
            birdX = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        }
        
        // Position based on current position (if already set) or texture type
        const groundLevel = this.scene.groundLevel;
        let birdY;
        if (bird.x !== 0 && bird.y !== 0) {
            // Position already set by dynamic spawning, keep it
            birdX = bird.x;
            birdY = bird.y;
        } else {
            // Old method fallback - Position based on texture type using updated zone boundaries
            let minY, maxY;
            
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
            
            birdY = Phaser.Math.Between(minY, maxY);
        }
        
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

        // Improved positioning: spawn coins ahead of player trajectory
        let x;
        if (this.scene.player && this.scene.isAirborne) {
            // If player is airborne, consider their horizontal velocity for predictive spawning
            const playerVelX = this.scene.player.body.velocity.x;
            const baseX = this.scene.player.x;
            
            // Spawn objects in a wider area ahead of player's movement
            if (Math.abs(playerVelX) > 50) { // Player has significant horizontal movement
                const ahead = playerVelX > 0 ? 200 : -200; // Spawn ahead in movement direction
                x = Phaser.Math.Between(
                    Math.max(50, baseX + ahead - 150), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + ahead + 150)
                );
            } else {
                // No significant movement, spawn around player
                x = Phaser.Math.Between(
                    Math.max(50, baseX - 200), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + 200)
                );
            }
        } else {
            // Default random positioning
            x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        }
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

        // Improved positioning: spawn gas tanks ahead of player trajectory
        let x;
        if (this.scene.player && this.scene.isAirborne) {
            // If player is airborne, consider their horizontal velocity for predictive spawning
            const playerVelX = this.scene.player.body.velocity.x;
            const baseX = this.scene.player.x;
            
            // Spawn objects in a wider area ahead of player's movement
            if (Math.abs(playerVelX) > 50) { // Player has significant horizontal movement
                const ahead = playerVelX > 0 ? 200 : -200; // Spawn ahead in movement direction
                x = Phaser.Math.Between(
                    Math.max(50, baseX + ahead - 150), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + ahead + 150)
                );
            } else {
                // No significant movement, spawn around player
                x = Phaser.Math.Between(
                    Math.max(50, baseX - 200), 
                    Math.min(this.scene.cameras.main.width - 50, baseX + 200)
                );
            }
        } else {
            // Default random positioning
            x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
        }
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

    // =================================================================
    // ASSET TRACKING SYSTEM - Maintains Visual Continuity
    // =================================================================

    updateViewportBounds() {
        const camera = this.scene.cameras.main;
        const buffer = this.assetTracker.visibilityBuffer;
        
        this.assetTracker.viewportBounds = {
            left: camera.scrollX - buffer,
            right: camera.scrollX + camera.width + buffer,
            top: camera.scrollY - buffer,
            bottom: camera.scrollY + camera.height + buffer,
            buffer: buffer
        };
    }

    isAssetVisible(asset) {
        const bounds = this.assetTracker.viewportBounds;
        return (
            asset.x >= bounds.left &&
            asset.x <= bounds.right &&
            asset.y >= bounds.top &&
            asset.y <= bounds.bottom
        );
    }

    registerAsset(asset, assetType) {
        if (!asset || !asset.x || !asset.y) return;
        
        // Generate unique ID if not exists
        if (!asset.trackingId) {
            asset.trackingId = `${assetType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const altitude = this.scene.groundLevel - asset.y;
        const zone = this.getAtmosphericZone(altitude);
        
        this.assetTracker.trackedAssets.set(asset.trackingId, {
            asset: asset,
            type: assetType,
            lastPosition: { x: asset.x, y: asset.y },
            isVisible: this.isAssetVisible(asset),
            lastSeen: Date.now(),
            zone: zone.name,
            altitude: altitude,
            isProtected: false // Will be set to true for visible assets
        });
        
        // Update grid occupation
        this.updateAssetGrid(asset, true);
        
        console.log(`Registered ${assetType} asset ${asset.trackingId} at altitude ${Math.round(altitude)}ft in ${zone.name}`);
    }

    updateAssetTracking() {
        this.updateViewportBounds();
        const currentTime = Date.now();
        const assetsToRemove = [];
        
        for (const [trackingId, data] of this.assetTracker.trackedAssets) {
            const { asset, type } = data;
            
            // Check if asset still exists and is valid
            if (!asset || !asset.scene || !asset.active) {
                assetsToRemove.push(trackingId);
                continue;
            }
            
            // Update position and visibility
            const wasVisible = data.isVisible;
            data.lastPosition = { x: asset.x, y: asset.y };
            data.isVisible = this.isAssetVisible(asset);
            data.altitude = this.scene.groundLevel - asset.y;
            
            // Update last seen time if visible
            if (data.isVisible) {
                data.lastSeen = currentTime;
                data.isProtected = true; // Protect visible assets from removal
            } else {
                data.isProtected = false;
            }
            
            // Update zone if asset moved significantly
            const zone = this.getAtmosphericZone(data.altitude);
            if (zone.name !== data.zone) {
                data.zone = zone.name;
                console.log(`Asset ${trackingId} moved to zone: ${zone.name}`);
            }
            
            // Mark for removal if invisible too long (unless transitioning)
            const invisibleTime = currentTime - data.lastSeen;
            if (!data.isVisible && invisibleTime > this.assetTracker.maxInvisibleTime && !this.assetTracker.isTransitioning) {
                console.log(`Asset ${trackingId} invisible for ${invisibleTime}ms, marking for removal`);
                assetsToRemove.push(trackingId);
            }
        }
        
        // Remove tracked assets that should be cleaned up
        for (const trackingId of assetsToRemove) {
            this.unregisterAsset(trackingId);
        }
    }

    unregisterAsset(trackingId) {
        const data = this.assetTracker.trackedAssets.get(trackingId);
        if (data) {
            // Update grid
            this.updateAssetGrid(data.asset, false);
            
            // Remove from tracking
            this.assetTracker.trackedAssets.delete(trackingId);
            console.log(`Unregistered asset ${trackingId}`);
        }
    }

    updateAssetGrid(asset, isOccupying) {
        const grid = this.assetTracker.grid;
        const cellX = Math.floor(asset.x / grid.cellSize);
        const cellY = Math.floor(asset.y / grid.cellSize);
        const cellKey = `${cellX},${cellY}`;
        
        if (isOccupying) {
            grid.occupiedCells.add(cellKey);
        } else {
            grid.occupiedCells.delete(cellKey);
        }
    }

    getVisibleAssets() {
        const visibleAssets = [];
        for (const [trackingId, data] of this.assetTracker.trackedAssets) {
            if (data.isVisible && data.asset.active) {
                visibleAssets.push(data);
            }
        }
        return visibleAssets;
    }

    getProtectedAssets() {
        const protectedAssets = [];
        for (const [trackingId, data] of this.assetTracker.trackedAssets) {
            if (data.isProtected && data.asset.active) {
                protectedAssets.push(data);
            }
        }
        return protectedAssets;
    }

    isScreenAreaOccupied(x, y, radius = 80) {
        // Much more lenient occupation detection
        const grid = this.assetTracker.grid;
        
        // Only check immediate cell, not surrounding cells
        const centerCellX = Math.floor(x / grid.cellSize);
        const centerCellY = Math.floor(y / grid.cellSize);
        const cellKey = `${centerCellX},${centerCellY}`;
        
        // Check if this exact cell is occupied
        if (grid.occupiedCells.has(cellKey)) {
            // Double-check by looking for actual nearby assets
            let nearbyAssets = 0;
            for (const [trackingId, data] of this.assetTracker.trackedAssets) {
                if (data.asset.active && data.isVisible) {
                    const distance = Math.sqrt((x - data.asset.x) ** 2 + (y - data.asset.y) ** 2);
                    if (distance < radius) {
                        nearbyAssets++;
                    }
                }
            }
            
            // Only consider occupied if there are multiple nearby assets
            return nearbyAssets >= 2;
        }
        
        return false;
    }

    startTransition() {
        this.assetTracker.isTransitioning = true;
        this.assetTracker.transitionStartTime = Date.now();
        console.log('Asset tracker: Started transition mode - preserving all assets');
    }

    endTransition() {
        this.assetTracker.isTransitioning = false;
        console.log('Asset tracker: Ended transition mode');
    }

    // NEW: Intelligent Gap Detection Methods
    calculateScreenCoverage() {
        const camera = this.scene.cameras.main;
        const screenArea = camera.width * camera.height;
        const assetAreaCovered = this.getVisibleAssets().length * (150 * 150); // Rough estimate
        return Math.min(assetAreaCovered / screenArea, 1.0);
    }

    detectScreenGaps() {
        const camera = this.scene.cameras.main;
        const gaps = [];
        const gridSize = 200; // Smaller grid for better gap detection
        
        // Scan screen in grid pattern for empty areas
        for (let x = camera.scrollX; x < camera.scrollX + camera.width; x += gridSize) {
            for (let y = camera.scrollY; y < camera.scrollY + camera.height; y += gridSize) {
                // Check if this area is occupied
                if (!this.isScreenAreaOccupied(x, y, gridSize / 2)) {
                    gaps.push({ x: x, y: y, priority: this.calculateGapPriority(x, y) });
                }
            }
        }
        
        // Sort gaps by priority (higher priority = more important to fill)
        gaps.sort((a, b) => b.priority - a.priority);
        
        console.log(`Detected ${gaps.length} gaps in current screen`);
        return gaps.slice(0, 10); // Return top 10 priority gaps
    }

    calculateGapPriority(x, y) {
        const camera = this.scene.cameras.main;
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        
        // Higher priority for areas closer to center screen
        const centerX = camera.scrollX + camera.width / 2;
        const centerY = camera.scrollY + camera.height / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const centerProximity = Math.max(0, 1 - distanceFromCenter / (camera.width / 2));
        
        // Higher priority for areas in player's path
        const playerProximity = Math.max(0, 1 - Math.abs(y - playerY) / 500);
        
        // Combine factors
        return centerProximity * 0.6 + playerProximity * 0.4;
    }

    spawnAssetsInGaps(maxAssets) {
        const gaps = this.detectScreenGaps();
        let spawned = 0;
        
        for (const gap of gaps) {
            if (spawned >= maxAssets) break;
            
            // Determine altitude and zone for this gap
            const altitude = this.scene.groundLevel - gap.y;
            const zone = this.getAtmosphericZone(altitude);
            
            // Select appropriate asset type and texture
            const assetType = this.selectAssetTypeForZone(zone);
            const texture = this.selectTextureForAssetType(zone, assetType);
            
            // Add some randomization to the exact position
            const spawnX = gap.x + Phaser.Math.Between(-100, 100);
            const spawnY = gap.y + Phaser.Math.Between(-50, 50);
            
            // Attempt to spawn the asset (treat as emergency to bypass occupation check)
            const asset = this.spawnSingleAsset(assetType, texture, spawnX, spawnY, true);
            
            if (asset) {
                spawned++;
                console.log(`Filled gap with ${assetType} at (${spawnX}, ${spawnY}), altitude ${Math.round(altitude)}ft`);
            }
        }
        
        console.log(`Filled ${spawned}/${maxAssets} gaps`);
        return spawned;
    }

    // =================================================================
    // END ASSET TRACKING SYSTEM
    // =================================================================

    // NEW: Clear the entire grid if it gets into a bad state
    clearAssetGrid() {
        this.assetTracker.grid.occupiedCells.clear();
        console.log('Asset grid cleared - all cells marked as unoccupied');
    }

    // NEW: Proactive gap filling to prevent empty areas ahead of player
    proactiveGapFilling(playerAltitude) {
        const playerY = this.scene.player ? this.scene.player.y : this.scene.groundLevel;
        const playerVelocityY = this.scene.player ? this.scene.player.body.velocity.y : 0;
        
        // Look ahead based on player's velocity
        const lookAheadDistance = Math.abs(playerVelocityY) * 0.5; // Look ahead 0.5 seconds
        const minLookAhead = 800; // Minimum look ahead distance
        const actualLookAhead = Math.max(minLookAhead, lookAheadDistance);
        
        // Check areas ahead of player movement
        const checkY = playerY - actualLookAhead; // Above player (negative Y is up)
        const checkAltitude = this.scene.groundLevel - checkY;
        
        // Only check if we're looking at a reasonable altitude
        if (checkAltitude > 0 && checkAltitude < 25000) {
            const assetsInArea = this.checkForAssetsInRange(checkY, 400);
            
            if (!assetsInArea) {
                console.log(`Proactive gap filling: No assets found ahead at altitude ${Math.round(checkAltitude)}ft`);
                this.spawnEmergencyAssets(checkY, checkAltitude);
            }
        }
    }

    // NEW: Debug method to show grid state
    debugGridState() {
        const grid = this.assetTracker.grid;
        console.log(`Grid state: ${grid.occupiedCells.size} occupied cells out of tracked assets: ${this.assetTracker.trackedAssets.size}`);
        
        if (grid.occupiedCells.size > 0) {
            console.log('Occupied cells:', Array.from(grid.occupiedCells).slice(0, 10)); // Show first 10
        }
    }

    // NEW: Asset Cycling System
    cycleOffScreenAssets() {
        if (!this.assetTracker.cycling.enabled) return;
        
        const currentTime = Date.now();
        const cycleConfig = this.assetTracker.cycling;
        
        // Only run cycling at specified intervals
        if (currentTime - cycleConfig.lastCycleTime < cycleConfig.cycleInterval) {
            return;
        }
        cycleConfig.lastCycleTime = currentTime;
        
        // Clean up recently cycled assets that are past cooldown
        for (const trackingId of cycleConfig.recentlyCycled) {
            const data = this.assetTracker.trackedAssets.get(trackingId);
            if (!data || currentTime - data.lastCycleTime > cycleConfig.cooldownTime) {
                cycleConfig.recentlyCycled.delete(trackingId);
            }
        }
        
        this.updateViewportBounds();
        const bounds = this.assetTracker.viewportBounds;
        const buffer = cycleConfig.cycleBuffer;
        
        // Check all tracked assets for cycling opportunities
        for (const [trackingId, data] of this.assetTracker.trackedAssets) {
            const { asset, type } = data;
            
            // Skip if asset is invalid or recently cycled
            if (!asset || !asset.scene || !asset.active || cycleConfig.recentlyCycled.has(trackingId)) {
                continue;
            }
            
            // Check if asset is outside cycling bounds
            const isOutsideLeft = asset.x < bounds.left - buffer;
            const isOutsideRight = asset.x > bounds.right + buffer;
            const isOutsideTop = asset.y < bounds.top - buffer;
            const isOutsideBottom = asset.y > bounds.bottom + buffer;
            
            // Handle horizontal cycling
            if (cycleConfig.horizontalCycling && (isOutsideLeft || isOutsideRight)) {
                this.cycleAssetHorizontally(asset, data, isOutsideLeft, bounds);
                cycleConfig.recentlyCycled.add(trackingId);
                data.lastCycleTime = currentTime;
                console.log(`Cycled asset ${trackingId} horizontally`);
            }
            
            // Handle vertical cycling (currently disabled but available)
            if (cycleConfig.verticalCycling && (isOutsideTop || isOutsideBottom)) {
                this.cycleAssetVertically(asset, data, isOutsideTop, bounds);
                cycleConfig.recentlyCycled.add(trackingId);
                data.lastCycleTime = currentTime;
                console.log(`Cycled asset ${trackingId} vertically`);
            }
        }
    }
    
    cycleAssetHorizontally(asset, data, isOutsideLeft, bounds) {
        const screenWidth = bounds.right - bounds.left;
        const buffer = this.assetTracker.cycling.cycleBuffer;
        
        if (isOutsideLeft) {
            // Move asset to right side of screen
            asset.x = bounds.right + buffer;
        } else {
            // Move asset to left side of screen
            asset.x = bounds.left - buffer;
        }
        
        // Randomize Y position slightly to avoid rigid patterns
        const yVariation = 50; // ±50 pixels
        asset.y += (Math.random() - 0.5) * yVariation;
        
        // Update tracking data
        data.lastPosition = { x: asset.x, y: asset.y };
        data.isVisible = this.isAssetVisible(asset);
        data.lastSeen = Date.now();
        
        // Update grid position
        this.updateAssetGrid(asset, true);
        
        // For birds, reset any movement tweens to prevent conflicts
        if (data.type === 'birds' && asset.moveTween) {
            asset.moveTween.stop();
            this.startBirdMovement(asset);
        }
    }
    
    cycleAssetVertically(asset, data, isOutsideTop, bounds) {
        const screenHeight = bounds.bottom - bounds.top;
        const buffer = this.assetTracker.cycling.cycleBuffer;
        
        if (isOutsideTop) {
            // Move asset to bottom of screen
            asset.y = bounds.bottom + buffer;
        } else {
            // Move asset to top of screen
            asset.y = bounds.top - buffer;
        }
        
        // Randomize X position slightly to avoid rigid patterns
        const xVariation = 100; // ±100 pixels
        asset.x += (Math.random() - 0.5) * xVariation;
        
        // Update tracking data
        data.lastPosition = { x: asset.x, y: asset.y };
        data.isVisible = this.isAssetVisible(asset);
        data.lastSeen = Date.now();
        
        // Update grid position
        this.updateAssetGrid(asset, true);
    }
    
    startBirdMovement(bird) {
        if (!bird || !bird.scene || !bird.active) return;
        
        // Create horizontal movement for birds
        const direction = Math.random() < 0.5 ? -1 : 1;
        const speed = 100 + Math.random() * 100; // 100-200 pixels per second
        const distance = 300 + Math.random() * 200; // 300-500 pixels
        
        bird.moveTween = this.scene.tweens.add({
            targets: bird,
            x: bird.x + (direction * distance),
            duration: (distance / speed) * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
}