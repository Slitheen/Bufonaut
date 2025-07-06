import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class UpgradeSystem {
    constructor(scene) {
        this.scene = scene;
        this.coins = 0;
        this.upgrades = {
            string: {
                name: 'Bungee Cord',
                assetKey: 'upgrade_string',
                level: 1,
                maxLevel: 10,
                cost: 10,
                power: 2.0,
                increment: 0.4
            },
            frame: {
                name: 'Launcher Frame',
                assetKey: 'upgrade_frame',
                level: 1,
                maxLevel: 10,
                cost: 15,
                power: 2.0,
                increment: 0.4
            },
            spaceShip: {
                name: 'Rocket Hull',
                assetKey: 'upgrade_ship',
                level: 1,
                maxLevel: 10,
                cost: 25,
                power: 2.0,
                increment: 0.4
            },
            rocket: {
                name: 'Guidance Rocket',
                assetKey: 'upgrade_rocket',
                level: 0,
                maxLevel: 3,
                cost: 250, // Tier 1 cost
                thrust: 8,
                fuelCapacity: 50, // Tier 1 fuel capacity
                canMoveUp: false, // Tier 1: only left/right
                tier1Cost: 250,
                tier2Cost: 400,
                tier3Cost: 600
            }
        };
    }

    getTotalLaunchPower() {
        return this.upgrades.string.power + this.upgrades.frame.power + this.upgrades.spaceShip.power;
    }

    hasRocket() {
        return this.upgrades.rocket.level > 0;
    }

    getRocketCapabilities() {
        const rocket = this.upgrades.rocket;
        if (rocket.level === 0) {
            return {
                hasRocket: false,
                canMoveUp: false,
                fuelCapacity: 0,
                thrust: 0
            };
        }
        
        return {
            hasRocket: true,
            canMoveUp: rocket.canMoveUp,
            fuelCapacity: rocket.fuelCapacity,
            thrust: rocket.thrust,
            level: rocket.level
        };
    }

    buyUpgrade(key) {
        const upgrade = this.upgrades[key];
        if (upgrade.level < upgrade.maxLevel && this.coins >= upgrade.cost) {
            this.coins -= upgrade.cost;
            upgrade.level++;

            if (key === 'rocket') {
                // Handle tiered rocket upgrades
                return this.handleRocketUpgrade(upgrade);
            } else {
                // This is a standard, multi-level upgrade
                upgrade.cost = Math.floor(upgrade.cost * GAME_CONSTANTS.UPGRADES.COST_MULTIPLIER);
                upgrade.power += upgrade.increment;
            }
        }
        return null;
    }

    handleRocketUpgrade(upgrade) {
        switch (upgrade.level) {
            case 1: // Tier 1: Basic left/right movement with small fuel tank
                upgrade.cost = upgrade.tier2Cost; // Set cost for next tier
                upgrade.fuelCapacity = 50;
                upgrade.canMoveUp = false;
                upgrade.thrust = 8;
                return { 
                    maxFuel: upgrade.fuelCapacity, 
                    fuel: upgrade.fuelCapacity, 
                    texture: 'bufo_rocket',
                    canMoveUp: false
                };
            
            case 2: // Tier 2: Same functionality but larger fuel tank
                upgrade.cost = upgrade.tier3Cost; // Set cost for next tier
                upgrade.fuelCapacity = 150;
                upgrade.canMoveUp = false;
                upgrade.thrust = 8;
                return { 
                    maxFuel: upgrade.fuelCapacity, 
                    fuel: upgrade.fuelCapacity, 
                    texture: 'bufo_rocket',
                    canMoveUp: false
                };
            
            case 3: // Tier 3: Full functionality with upward movement
                upgrade.cost = 0; // Max level reached
                upgrade.fuelCapacity = 200;
                upgrade.canMoveUp = true;
                upgrade.thrust = 10;
                return { 
                    maxFuel: upgrade.fuelCapacity, 
                    fuel: upgrade.fuelCapacity, 
                    texture: 'bufo_rocket',
                    canMoveUp: true
                };
        }
        return null;
    }

    areAllUpgradesMaxed() {
        for (const key in this.upgrades) {
            const upgrade = this.upgrades[key];
            if (upgrade.level < upgrade.maxLevel) {
                return false;
            }
        }
        return true;
    }

    addCoins(amount) {
        this.coins += amount;
        return this.coins;
    }

    getCoins() {
        return this.coins;
    }
} 