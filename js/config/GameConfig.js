// Game Configuration and Constants
export const UI_THEME = {
    primary: '#4A90E2',      // Modern blue
    secondary: '#F5A623',    // Warm orange
    success: '#7ED321',      // Green
    danger: '#D0021B',       // Red
    background: '#2C3E50',   // Dark blue-gray
    surface: '#34495E',      // Lighter surface
    text: '#ECF0F1',         // Light text
    textSecondary: '#BDC3C7' // Muted text
};

export const GAME_CONSTANTS = {
    WORLD_TOP: -50000,
    GROUND_HEIGHT: 120,
    PLAYER: {
        SIZE: 75,
        START_Y_OFFSET: 60,
        NUDGE_THRUST: .5,
        MAX_VELOCITY: 1500,
    },
    OBSTACLES: {
        BALLOON_COUNT: 6,
        BIRD_COUNT: 4,
        CLOUD_COUNT: 3,
        BALLOON_BOOST: -900,
        BIRD_BOOST: -700,
        CLOUD_SLOWDOWN: 0.7,
    },
    REWARDS: {
        BASE_MATERIALS: 0,
        DISTANCE_DIVISOR: 75,
    },
    SKY: {
        SUNSET_Y: -4000,
        SPACE_Y: -12000,
    },
    UPGRADES: {
        COST_MULTIPLIER: 1.8
    },
    ALTITUDE_ZONES: {
        GROUND: { min: 0, max: -2000, name: 'Ground Level' },
        LOW_ALTITUDE: { min: -2000, max: -6000, name: 'Low Altitude' },
        HIGH_ALTITUDE: { min: -6000, max: -15000, name: 'High Altitude' },
        SPACE: { min: -15000, max: -50000, name: 'Space' }
    },
    UI_SCALE: {
        SCALE_FACTOR: 1.5,
        TITLE_FONT: '72px',
        STAT_FONT: '48px',
        BUTTON_FONT: '36px',
        SMALL_FONT: '24px',
        ALTITUDE_FONT: '42px',
        FUEL_FONT: '12px',
        UPGRADE_ICON_SIZE: 96,
        BALLOON_SIZE: 105,
        CLOUD_SIZE: 150,
        CLOUD_HEIGHT: 90,
        TITLE_IMAGE_WIDTH: 600,
        TITLE_IMAGE_HEIGHT: 120,
    },
    PERFORMANCE: {
        UPDATE_FREQUENCY: 1,
        ZONE_CHECK_FREQUENCY: 144, // Increased for 144 FPS
        ROTATION_FREQUENCY: 8, // Increased for smoother rotation at 144 FPS
        CAMERA_SMOOTHING: 0.12, // Slightly increased for smoother camera at 144 FPS
        MAX_ACTIVE_OBJECTS: 20 // Optimized for 144 FPS performance
    }
};

export const PHASER_CONFIG = {
    type: Phaser.AUTO,
    width: 1080,  // Restored original resolution
    height: 1920, // Restored original resolution
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    fps: {
        target: 144, // Optimized for 144Hz displays
        forceSetTimeOut: true
    },
    render: {
        pixelArt: false,
        antialias: true, // Re-enabled for smooth edges
        roundPixels: false, // Disabled for smoother rendering
        powerPreference: 'high-performance',
        backgroundColor: '#000000',
        batchSize: 2048,
        maxTextures: 16,
        mipmapFilter: 'LINEAR',
        antialiasGL: true // Re-enabled
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false,
            fps: 144, // Match game frame rate for smooth physics
            timeScale: 1,
            velocityIterations: 1, // Reduced from 2
            positionIterations: 1, // Reduced from 2
            maxObjects: 1000, // Limit physics objects
            overlapBias: 4,
            tileBias: 4
        }
    },
    callbacks: {
        preBoot: function (game) {
            // Set canvas optimization before it's used
            if (game.canvas) {
                game.canvas.setAttribute('willReadFrequently', 'true');
            }
        }
    }
}; 