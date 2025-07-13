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
                maxLevel: 10,
                cost: 100, // Reduced initial cost
                thrust: 6, // Base thrust
                fuelCapacity: 50, // Base fuel capacity
                fuelEfficiency: 1.0, // Base fuel efficiency (1.0 = normal consumption)
                canMoveUp: false, // Unlocked at level 3
                baseThrust: 6,
                baseFuelCapacity: 50,
                baseFuelEfficiency: 1.0
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
                thrust: 0,
                fuelEfficiency: 1.0
            };
        }
        
        return {
            hasRocket: true,
            canMoveUp: rocket.canMoveUp,
            fuelCapacity: rocket.fuelCapacity,
            thrust: rocket.thrust,
            fuelEfficiency: rocket.fuelEfficiency,
            level: rocket.level
        };
    }

    buyUpgrade(key) {
        const upgrade = this.upgrades[key];
        if (upgrade.level < upgrade.maxLevel && this.coins >= upgrade.cost) {
            this.coins -= upgrade.cost;
            upgrade.level++;

            // Update upgrade building indicator after spending coins
            if (this.scene.uiSystem && this.scene.uiSystem.updateUpgradeBuildingIndicator) {
                this.scene.uiSystem.updateUpgradeBuildingIndicator();
            }

            if (key === 'rocket') {
                // Handle tiered rocket upgrades
                return this.handleRocketUpgrade(upgrade);
            } else {
                // This is a standard, multi-level upgrade
                upgrade.cost = Math.floor(upgrade.cost * GAME_CONSTANTS.UPGRADES.COST_MULTIPLIER);
                upgrade.power += upgrade.increment;
                
                // Return success result for non-rocket upgrades too
                return {
                    success: true,
                    upgradeKey: key,
                    newLevel: upgrade.level,
                    newPower: upgrade.power,
                    newCost: upgrade.cost
                };
            }
        }
        return null;
    }

    handleRocketUpgrade(upgrade) {
        // Calculate progressive improvements for each level
        const level = upgrade.level;
        
        // Progressive cost scaling (slower than standard upgrades)
        const costs = [0, 100, 150, 200, 275, 350, 450, 575, 725, 900, 0]; // Level 10 = max
        
        // Progressive thrust improvements
        const baseThrust = upgrade.baseThrust;
        upgrade.thrust = baseThrust + (level * 2); // +2 thrust per level
        
        // Progressive fuel capacity improvements  
        const baseFuel = upgrade.baseFuelCapacity;
        upgrade.fuelCapacity = baseFuel + (level * 20); // +20 fuel per level
        
        // Progressive fuel efficiency improvements (lower consumption)
        const baseFuelEff = upgrade.baseFuelEfficiency;
        upgrade.fuelEfficiency = baseFuelEff - (level * 0.08); // -8% consumption per level
        
        // Unlock upward movement at level 3
        upgrade.canMoveUp = level >= 3;
        
        // Set cost for next level
        if (level < upgrade.maxLevel) {
            upgrade.cost = costs[level + 1];
        } else {
            upgrade.cost = 0; // Max level reached
        }
        
        // Return rocket configuration for this level
        return { 
            maxFuel: upgrade.fuelCapacity, 
            fuel: upgrade.fuelCapacity, 
            texture: 'bufo_rocket',
            canMoveUp: upgrade.canMoveUp,
            thrust: upgrade.thrust,
            fuelEfficiency: upgrade.fuelEfficiency
        };
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
        
        // Update upgrade building indicator if UI system exists
        if (this.scene.uiSystem && this.scene.uiSystem.updateUpgradeBuildingIndicator) {
            this.scene.uiSystem.updateUpgradeBuildingIndicator();
        }
        
        return this.coins;
    }

    getCoins() {
        return this.coins;
    }
} 