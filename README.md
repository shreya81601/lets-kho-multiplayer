# Let's Kho - Multiplayer Kho-Kho Game

A digital version of the traditional Indian chase game Kho-Kho, built with React and Firebase. Play online with friends or locally on the same device!

## Features

- **Online Multiplayer**: Play with friends using room codes
- **Local Multiplayer**: Play on the same device
- **Real-time Gameplay**: Smooth 60 FPS gameplay with Firebase sync
- **Traditional Rules**: Authentic Kho-Kho gameplay mechanics

## Live Demo

Visit: [https://shreya81601.github.io/lets-kho-multiplayer/](https://shreya81601.github.io/lets-kho-multiplayer/)

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment to GitHub Pages

This project is set up to automatically deploy to GitHub Pages using GitHub Actions.

### One-Time Setup

1. Go to your repository on GitHub
2. Click on **Settings** → **Pages**
3. Under "Build and deployment":
   - Source: Select **GitHub Actions**
4. That's it! The site will deploy automatically on every push to main

### Manual Deployment (Optional)

If you prefer manual deployment:

```bash
npm run deploy
```

This will build the project and deploy to the `gh-pages` branch.

## How to Play

### Blue Team (Chaser)
- **Controls**: W, A, S, D + SPACEBAR
- **Objective**: Tag all 3 defenders within 5 minutes
- Press SPACEBAR near seated teammates to perform "Kho" (switch)
- Can only move in ONE direction (left OR right) between poles

### Red Team (Defender)
- **Controls**: Arrow Keys
- **Objective**: Survive for 5 minutes
- Complete freedom of movement
- Avoid being tagged by the active chaser

## Tech Stack

- React 18
- Vite
- Firebase Firestore (for online multiplayer)
- Tailwind CSS
- HTML5 Canvas

## Project Structure

```
lets-kho-multiplayer/
├── src/
│   ├── KhoKhoGame.jsx    # Main game component
│   └── index.jsx          # App entry point
├── index.html
├── vite.config.js
├── package.json
└── .github/
    └── workflows/
        └── deploy.yml     # GitHub Actions deployment
```

## License

MIT
