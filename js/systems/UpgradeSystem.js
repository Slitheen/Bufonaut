import { GAME_CONSTANTS, UI_THEME } from '../config/GameConfig.js';

export class UpgradeSystem {
    constructor(scene) {
        this.scene = scene;
        this.materials = 0;
        this.upgrades = {
            string: {
                name: 'Bungee Cord',
                assetKey: 'upgrade_string',
                level: 1,
                maxLevel: 10,
                cost: 10,
                power: 3.0,
                increment: 0.5
            },
            frame: {
                name: 'Launcher Frame',
                assetKey: 'upgrade_frame',
                level: 1,
                maxLevel: 10,
                cost: 15,
                power: 2.0,
                increment: 0.3
            },
            spaceShip: {
                name: 'Rocket Hull',
                assetKey: 'upgrade_ship',
                level: 1,
                maxLevel: 10,
                cost: 25,
                power: 1.0,
                increment: 0.2
            },
            rocket: {
                name: 'Guidance Rocket',
                assetKey: 'upgrade_rocket',
                level: 0,
                maxLevel: 1,
                cost: 500,
                thrust: 10
            }
        };
    }

    getTotalLaunchPower() {
        return this.upgrades.string.power + this.upgrades.frame.power + this.upgrades.spaceShip.power;
    }

    hasRocket() {
        return this.upgrades.rocket.level > 0;
    }

    buyUpgrade(key) {
        const upgrade = this.upgrades[key];
        if (upgrade.level < upgrade.maxLevel && this.materials >= upgrade.cost) {
            this.materials -= upgrade.cost;
            upgrade.level++;

            if (key === 'rocket') {
                // This is a one-time purchase that unlocks a feature
                return { maxFuel: 100, fuel: 100, texture: 'bufo_rocket' };
            } else {
                // This is a standard, multi-level upgrade
                upgrade.cost = Math.floor(upgrade.cost * GAME_CONSTANTS.UPGRADES.COST_MULTIPLIER);
                upgrade.power += upgrade.increment;
            }
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

    addMaterials(amount) {
        this.materials += amount;
        return this.materials;
    }

    getMaterials() {
        return this.materials;
    }
} 