# 🚀 Bufonaut - Reach for the Sky!

**A fun physics-based launching game where you help Bufo reach new heights!**

[🎮 Play Now](https://slitheen.github.io/Bufonaut/) | [📖 How to Play](#how-to-play) | [🛠️ Development](#development)

## 🎯 About the Game

Bufonaut is a charming physics-based game where you launch a cute character (Bufo) as high as possible using a slingshot. Navigate through different altitude zones, collect coins, and upgrade your launcher to reach even greater heights!

### 🎮 Key Features
- **Slingshot launching** with upgradeable power
- **Altitude-based zones** with different objects and challenges
- **Rocket controls** for precise navigation when airborne
- **Upgrade system** with coins economy
- **Beautiful cloud-themed UI** with animated elements
- **Performance optimized** for smooth gameplay

## 🎮 How to Play

1. **Launch**: Click and drag to pull back the slingshot, then release to launch Bufo
2. **Navigate**: Use WASD keys to control Bufo when airborne (if you have rocket upgrades)
3. **Collect**: Gather coins from various objects in the sky
4. **Upgrade**: Use coins to upgrade your launcher between attempts
5. **Reach Higher**: Try to beat your previous altitude records!

## 🚀 Quick Start

### **Play Online**
Simply visit: **[https://slitheen.github.io/Bufonaut/](https://slitheen.github.io/Bufonaut/)**

### **Run Locally**
```bash
# Clone the repository
git clone https://github.com/Slitheen/Bufonaut.git
cd Bufonaut

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:8080 in your browser
```

## 🏗️ Development

### **Modular Game Structure**

The game has been successfully refactored from a single 1700-line file into a clean, modular structure:

```
Bufonaut/
├── index.html                 # Main HTML file
├── package.json              # Development dependencies
├── js/
│   ├── main.js               # Entry point (5 lines!)
│   ├── config/
│   │   └── GameConfig.js     # All game constants and config
│   ├── scenes/
│   │   ├── MainMenuScene.js  # Main menu
│   │   ├── SplashScreenScene.js # Story intro
│   │   └── GameScene.js      # Main gameplay
│   └── systems/
│       ├── UpgradeSystem.js  # Upgrade and economy logic
│       ├── ObjectSpawner.js  # Object spawning and management
│       ├── CollisionSystem.js # Collision detection and effects
│       └── UISystem.js       # All UI creation and management
├── assets/                   # Game assets
└── game.js.backup           # Original monolithic file (backup)
```

## 🚀 How to Run the Modular Version

### **Option 1: Development Server (Recommended)**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:8080 in your browser
```

### **Option 2: Simple HTTP Server**
```bash
# If you have Python installed
python -m http.server 8080

# Or use any other local server
# Then open http://localhost:8080
```

### **Option 3: VS Code Live Server**
- Install the "Live Server" extension
- Right-click on `index.html` and select "Open with Live Server"

## 🎯 Benefits of the New Structure

### **✅ Maintainability**
- **Easy to find code** - Each file has a specific purpose
- **Clear separation of concerns** - UI, logic, and data are separated
- **Easier debugging** - Issues can be isolated to specific modules

### **✅ Scalability**
- **Add new features** without touching existing code
- **Reuse components** across different parts of the game
- **Team development** - Multiple people can work on different modules

### **✅ Performance**
- **Lazy loading** - Only load what you need
- **Better caching** - Browser can cache individual modules
- **Tree shaking** - Unused code can be eliminated

### **✅ Development Experience**
- **Faster compilation** - Smaller files compile faster
- **Better IDE support** - Autocomplete and navigation work better
- **Version control** - Easier to track changes and resolve conflicts

## 🛠️ How to Work With This Structure

### **Adding New Features**
1. **New UI elements** → Add to `js/systems/UISystem.js`
2. **New game mechanics** → Create a new system in `js/systems/`
3. **New configuration** → Add to `js/config/GameConfig.js`
4. **New scenes** → Create in `js/scenes/` and import in `main.js`

### **Modifying Existing Features**
- **Upgrade system** → Edit `js/systems/UpgradeSystem.js`
- **Object spawning** → Edit `js/systems/ObjectSpawner.js`
- **Collisions & effects** → Edit `js/systems/CollisionSystem.js`
- **UI layout** → Edit `js/systems/UISystem.js`
- **Game constants** → Edit `js/config/GameConfig.js`

### **File Organization Principles**
- **Single Responsibility** - Each file has one clear purpose
- **Dependency Injection** - Systems receive dependencies through constructor
- **Configuration Driven** - Game behavior controlled by constants
- **Event Driven** - Systems communicate through events when possible

## 🔧 Development Workflow

1. **Start development server** (needed for ES6 modules)
2. **Edit specific module** for your feature
3. **Test changes** in isolation when possible
4. **Import and integrate** with other modules
5. **Update documentation** for new features

## 📝 Migration Notes

✅ **Original `game.js` backed up** as `game.js.backup`  
✅ **All functionality preserved** in modular structure  
✅ **Performance optimizations** maintained  
✅ **ES6 modules** properly configured  
✅ **Development server** ready to use  

## 🎮 Game Features

- **Slingshot launching** with upgradeable power
- **Altitude-based zones** with different objects
- **Rocket controls** for precise navigation
- **Upgrade system** with coins economy
- **Asset age tracking** to prevent clutter
- **Performance optimized** for smooth gameplay

## 🐛 Troubleshooting

### **Module Loading Issues**
- Make sure you're using a local server (not opening the HTML file directly)
- Check browser console for import/export errors
- Verify all file paths are correct

### **Performance Issues**
- Check that all performance constants are properly set in `GameConfig.js`
- Monitor browser dev tools for memory leaks
- Use the performance settings in `GAME_CONSTANTS.PERFORMANCE`

### **Missing Features**
- Compare with `game.js.backup` to ensure all methods were migrated
- Check that all systems are properly initialized in `GameScene.js`
- Verify collision detection is set up correctly

The modular structure is now ready for development! 🚀

## 🌐 Hosting

This game is hosted on **GitHub Pages** and is automatically deployed whenever changes are pushed to the main branch.

- **Live Game**: [https://slitheen.github.io/Bufonaut/](https://slitheen.github.io/Bufonaut/)
- **Repository**: [https://github.com/Slitheen/Bufonaut](https://github.com/Slitheen/Bufonaut)

### **Easy Deployment**
Use the included `deploy.bat` script for quick updates:
```bash
./deploy.bat
```

## 🤝 Contributing

Feel free to fork this project and submit pull requests! This is a great project for learning game development with Phaser 3 and modular JavaScript architecture.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Made with ❤️ using Phaser 3 and modern JavaScript** 