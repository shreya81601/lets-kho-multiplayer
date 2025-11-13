import React, { useState, useEffect, useRef } from 'react';

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;
const PLAYER_SIZE = 20;
const POLE_WIDTH = 15;
const POLE_HEIGHT = 60;
const CENTER_LANE_Y = FIELD_HEIGHT / 2;
const CENTER_LANE_HEIGHT = 12;
const GAME_DURATION = 300;

// Firebase configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAE_fPR-TVuUkosZv-4eWZ6VAtSB-IHtSc",
  authDomain: "lets-kho-multiplayer.firebaseapp.com",
  databaseURL: "https://lets-kho-multiplayer-default-rtdb.firebaseio.com",
  projectId: "lets-kho-multiplayer",
  storageBucket: "lets-kho-multiplayer.firebasestorage.app",
  messagingSenderId: "338126570546",
  appId: "1:338126570546:web:01657761a046ac7686682b"
};

export default function KhoKhoWebsite() {
  const [screen, setScreen] = useState('landing');
  const [gameMode, setGameMode] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [tagMessage, setTagMessage] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  
  const canvasRef = useRef(null);
  const keysPressed = useRef({});
  const gameLoopRef = useRef(null);
  const firestoreListenerRef = useRef(null);
  const firebaseDB = useRef(null);
  const gameStateRef = useRef(null);
  const gameModeRef = useRef(null);
  const playerRoleRef = useRef(null);
  const handleKhoSwitchRef = useRef(null);

  // Initialize Firebase
  useEffect(() => {
    const loadFirebase = async () => {
      try {
        // Load Firebase scripts
        const script1 = document.createElement('script');
        script1.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js';
        document.head.appendChild(script2);

        await new Promise((resolve) => {
          script2.onload = resolve;
        });

        // Initialize Firebase
        if (window.firebase && !window.firebase.apps.length) {
          window.firebase.initializeApp(FIREBASE_CONFIG);
          firebaseDB.current = window.firebase.database();
          setFirebaseReady(true);
        }
      } catch (error) {
        console.error('Firebase initialization error:', error);
        setFirebaseError('Failed to initialize Firebase. Online multiplayer unavailable.');
      }
    };

    loadFirebase();
  }, []);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createInitialGameState = () => {
    const chasers = [];
    const leftPoleX = 50;
    const rightPoleX = FIELD_WIDTH - 50;
    const availableSpace = rightPoleX - leftPoleX;
    const spacing = availableSpace / 9;
    
    for (let i = 0; i < 8; i++) {
      chasers.push({
        x: leftPoleX + spacing * (i + 1),
        y: CENTER_LANE_Y,
        direction: i % 2 === 0 ? 'up' : 'down',
        sitting: true
      });
    }

    return {
      chasers,
      activeChaser: { 
        x: 30,
        y: CENTER_LANE_Y,
        direction: 'up',
        displayDirection: 'up',
        side: 'top',
        horizontalDirection: 'right'
      },
      defenders: [
        { x: FIELD_WIDTH - 30, y: CENTER_LANE_Y, active: true },
        { x: FIELD_WIDTH - 30, y: CENTER_LANE_Y, active: false },
        { x: FIELD_WIDTH - 30, y: CENTER_LANE_Y, active: false }
      ],
      currentDefenderIndex: 0,
      timeRemaining: GAME_DURATION,
      gameOver: false,
      winner: null
    };
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!firebaseReady) {
      alert('Firebase is still loading. Please try again in a moment.');
      return;
    }

    const code = generateRoomCode();
    const roomData = {
      code,
      host: playerName,
      players: [playerName],
      status: 'waiting',
      gameState: null,
      createdAt: Date.now()
    };

    try {
      await firebaseDB.current.ref('rooms/' + code).set(roomData);
      setCurrentRoom(code);
      setPlayerRole('blue');
      setScreen('lobby');
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room: ' + error.message);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      alert('Please enter your name and room code');
      return;
    }

    if (!firebaseReady) {
      alert('Firebase is still loading. Please try again in a moment.');
      return;
    }

    try {
      const roomRef = firebaseDB.current.ref('rooms/' + roomCode.toUpperCase());
      const roomSnap = await roomRef.once('value');

      if (!roomSnap.exists()) {
        alert('Room not found!');
        return;
      }

      const roomData = roomSnap.val();

      if (roomData.players.length >= 2) {
        alert('Room is full!');
        return;
      }

      await roomRef.update({
        players: [...roomData.players, playerName]
      });

      setCurrentRoom(roomCode.toUpperCase());
      setPlayerRole('red');
      setScreen('lobby');
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room: ' + error.message);
    }
  };

  const startOnlineGame = async () => {
    if (!currentRoom || !firebaseReady) return;

    const initialState = createInitialGameState();

    try {
      await firebaseDB.current.ref('rooms/' + currentRoom).update({
        status: 'playing',
        gameState: initialState
      });
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const startLocalGame = () => {
    setGameState(createInitialGameState());
    setGameMode('local');
    setScreen('game');
  };

  // Listen for lobby changes
  useEffect(() => {
    if (currentRoom && screen === 'lobby' && firebaseReady) {
      const roomRef = firebaseDB.current.ref('rooms/' + currentRoom);
      const listener = roomRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.status === 'playing' && data.gameState) {
            setGameState(data.gameState);
            setScreen('game');
          }
        }
      });

      firestoreListenerRef.current = () => roomRef.off('value', listener);
      return () => roomRef.off('value', listener);
    }
  }, [currentRoom, screen, firebaseReady]);

  // Listen for game state changes
  useEffect(() => {
    if (gameMode === 'online' && currentRoom && screen === 'game' && firebaseReady) {
      const roomRef = firebaseDB.current.ref('rooms/' + currentRoom);
      const listener = roomRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.gameState) {
            setGameState(data.gameState);
          }
        }
      });

      firestoreListenerRef.current = () => roomRef.off('value', listener);
      return () => roomRef.off('value', listener);
    }
  }, [gameMode, currentRoom, screen, firebaseReady]);

  // Helper to remove undefined values (Firebase doesn't accept them)
  const cleanStateForFirebase = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(cleanStateForFirebase);

    const cleaned = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = cleanStateForFirebase(obj[key]);
      }
    }
    return cleaned;
  };

  const updateGameState = async (newState) => {
    if (gameModeRef.current === 'local') {
      setGameState(newState);
    } else if (gameModeRef.current === 'online' && currentRoom && firebaseReady) {
      try {
        const cleanedState = cleanStateForFirebase(newState);
        await firebaseDB.current.ref('rooms/' + currentRoom).update({
          gameState: cleanedState
        });
      } catch (error) {
        console.error('Error updating game state:', error);
      }
    }
  };

  // Keep refs in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    playerRoleRef.current = playerRole;
  }, [playerRole]);

  // Timer logic
  useEffect(() => {
    if (screen === 'game' && gameStateRef.current && !gameStateRef.current.gameOver && !isPaused) {
      const timer = setInterval(() => {
        const currentState = gameStateRef.current;
        if (!currentState || currentState.gameOver) return;

        const newState = { ...currentState };
        const newTime = newState.timeRemaining - 1;

        if (newTime <= 0) {
          newState.timeRemaining = 0;
          newState.gameOver = true;
          newState.winner = 'red';
        } else {
          newState.timeRemaining = newTime;
        }

        updateGameState(newState);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [screen, isPaused]);

  // Define handleKhoSwitch function
  const handleKhoSwitch = () => {
    const currentState = gameStateRef.current;
    if (!currentState || currentState.gameOver) return;
    if (gameModeRef.current === 'online' && playerRoleRef.current !== 'blue') return;

    const { activeChaser, chasers } = currentState;

    for (let i = 0; i < chasers.length; i++) {
      const chaser = chasers[i];
      if (!chaser.sitting) continue;

      const dx = activeChaser.x - chaser.x;
      const dy = activeChaser.y - chaser.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isBehind = (chaser.direction === 'up' && dy > 0) ||
                       (chaser.direction === 'down' && dy < 0);

      if (distance < 50 && isBehind) {
        const newChasers = [...chasers];

        // Put the OLD active chaser back in the seat
        newChasers[i] = {
          x: chaser.x,
          y: chaser.y,
          direction: chaser.direction,
          side: chaser.direction === 'up' ? 'top' : 'bottom',
          sitting: true
        };

        // Create the NEW active chaser jumping from the seat
        const jumpDistance = 40;
        const newY = chaser.direction === 'up'
          ? chaser.y - jumpDistance
          : chaser.y + jumpDistance;

        const newActiveChaser = {
          x: chaser.x,
          y: newY,
          direction: chaser.direction,
          displayDirection: chaser.direction,
          sitting: false,
          side: chaser.direction === 'up' ? 'top' : 'bottom',
          horizontalDirection: null
        };

        updateGameState({
          ...currentState,
          activeChaser: newActiveChaser,
          chasers: newChasers
        });
        return;
      }
    }
  };

  // Store handler in ref so keyboard listener can access latest version
  useEffect(() => {
    handleKhoSwitchRef.current = handleKhoSwitch;
  });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;

      if (e.key === ' ') {
        e.preventDefault();
        if (handleKhoSwitchRef.current) {
          handleKhoSwitchRef.current();
        }
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const checkTagCollision = (chaser, defender) => {
    const dx = chaser.x - defender.x;
    const dy = chaser.y - defender.y;
    return Math.sqrt(dx * dx + dy * dy) < PLAYER_SIZE * 1.2;
  };

  const isAtPole = (x, y) => {
    const leftPoleX = 50;
    const rightPoleX = FIELD_WIDTH - 50;
    const poleY = CENTER_LANE_Y;
    
    const atLeftPole = Math.abs(x - leftPoleX) < 25 && Math.abs(y - poleY) < 40;
    const atRightPole = Math.abs(x - rightPoleX) < 25 && Math.abs(y - poleY) < 40;
    
    return atLeftPole || atRightPole;
  };

  const isBetweenPoles = (x) => {
    const leftPoleX = 50;
    const rightPoleX = FIELD_WIDTH - 50;
    return x >= leftPoleX && x <= rightPoleX;
  };

  const isOutsidePoles = (x) => {
    const leftPoleX = 50;
    const rightPoleX = FIELD_WIDTH - 50;
    return x < leftPoleX || x > rightPoleX;
  };

  const canCrossCenterLine = (x, y) => {
    return isAtPole(x, y);
  };

  // Game loop
  useEffect(() => {
    if (screen !== 'game' || !gameStateRef.current || gameStateRef.current.gameOver || isPaused) return;

    gameLoopRef.current = setInterval(() => {
      const currentState = gameStateRef.current;
      if (!currentState || currentState.gameOver) return;

      const canControlBlue = gameModeRef.current === 'local' || playerRoleRef.current === 'blue';
      const canControlRed = gameModeRef.current === 'local' || playerRoleRef.current === 'red';

      const blueSpeed = 3.6;
      const redSpeed = 3;
      let newState = { ...currentState };

      // Blue player movement
      if (canControlBlue) {
        let { activeChaser } = currentState;
        let newX = activeChaser.x;
        let newY = activeChaser.y;
        let newDirection = activeChaser.direction;
        let newSide = activeChaser.side;
        let newHorizontalDirection = activeChaser.horizontalDirection || null;

        const centerTop = CENTER_LANE_Y - CENTER_LANE_HEIGHT / 2;
        const centerBottom = CENTER_LANE_Y + CENTER_LANE_HEIGHT / 2;

        if (newY < centerTop) {
          newSide = 'top';
        } else if (newY > centerBottom) {
          newSide = 'bottom';
        }

        let displayDirection = activeChaser.displayDirection || activeChaser.direction;

        if (activeChaser.direction === 'up') {
          if (keysPressed.current['w']) {
            newY = Math.max(PLAYER_SIZE, newY - blueSpeed);
            displayDirection = 'up';
          }
          if (keysPressed.current['s']) {
            const maxY = newSide === 'top' ? centerTop - PLAYER_SIZE : FIELD_HEIGHT - PLAYER_SIZE;
            newY = Math.min(maxY, newY + blueSpeed);
            displayDirection = 'up';
          }
        } else if (activeChaser.direction === 'down') {
          if (keysPressed.current['w']) {
            const minY = newSide === 'bottom' ? centerBottom + PLAYER_SIZE : PLAYER_SIZE;
            newY = Math.max(minY, newY - blueSpeed);
            displayDirection = 'down';
          }
          if (keysPressed.current['s']) {
            newY = Math.min(FIELD_HEIGHT - PLAYER_SIZE, newY + blueSpeed);
            displayDirection = 'down';
          }
        }

        const betweenPoles = isBetweenPoles(newX);
        
        if (keysPressed.current['a']) {
          if (newHorizontalDirection === null || !betweenPoles) {
            newHorizontalDirection = 'left';
          }
          if (!betweenPoles || newHorizontalDirection === 'left') {
            newX = Math.max(PLAYER_SIZE, newX - blueSpeed);
            displayDirection = 'left';
          }
        }
        if (keysPressed.current['d']) {
          if (newHorizontalDirection === null || !betweenPoles) {
            newHorizontalDirection = 'right';
          }
          if (!betweenPoles || newHorizontalDirection === 'right') {
            newX = Math.min(FIELD_WIDTH - PLAYER_SIZE, newX + blueSpeed);
            displayDirection = 'right';
          }
        }

        if (!canCrossCenterLine(newX, newY) && !isOutsidePoles(newX)) {
          if (newSide === 'top' && newY > centerTop - PLAYER_SIZE) {
            newY = centerTop - PLAYER_SIZE;
          } else if (newSide === 'bottom' && newY < centerBottom + PLAYER_SIZE) {
            newY = centerBottom + PLAYER_SIZE;
          }
        }

        if (isAtPole(newX, newY) || isOutsidePoles(newX)) {
          if (keysPressed.current['w'] && activeChaser.direction === 'down') {
            newDirection = 'up';
            displayDirection = 'up';
          } else if (keysPressed.current['s'] && activeChaser.direction === 'up') {
            newDirection = 'down';
            displayDirection = 'down';
          }
        }

        let blocked = false;
        for (const chaser of currentState.chasers) {
          if (!chaser.sitting) continue;
          
          const dx = Math.abs(newX - chaser.x);
          const dy = Math.abs(newY - chaser.y);
          
          if (dx < PLAYER_SIZE * 1.2 && dy < PLAYER_SIZE * 1.2) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          newState.activeChaser = {
            x: newX,
            y: newY,
            direction: newDirection,
            side: newSide,
            displayDirection: displayDirection,
            horizontalDirection: newHorizontalDirection
          };

          // Check for tag collision when blue player moves
          const { defenders, currentDefenderIndex } = newState;
          const defender = defenders[currentDefenderIndex];
          if (defender && defender.active) {
            if (checkTagCollision(newState.activeChaser, defender)) {
              const newDefenders = [...defenders];
              newDefenders[currentDefenderIndex].active = false;

              const nextIndex = currentDefenderIndex + 1;

              setTagMessage(`Defender ${currentDefenderIndex + 1} Tagged!`);
              setTimeout(() => setTagMessage(null), 3000);

              if (nextIndex >= 3) {
                newState.gameOver = true;
                newState.winner = 'blue';
              } else {
                newDefenders[nextIndex].active = true;
                newDefenders[nextIndex].x = FIELD_WIDTH - 30;
                newDefenders[nextIndex].y = CENTER_LANE_Y;
                newState.currentDefenderIndex = nextIndex;
              }

              newState.activeChaser = {
                x: 30,
                y: CENTER_LANE_Y,
                direction: 'up',
                displayDirection: 'up',
                side: 'top',
                horizontalDirection: 'right'
              };

              newState.defenders = newDefenders;
            }
          }
        }
      }

      // Red player movement
      if (canControlRed) {
        const { defenders, currentDefenderIndex } = currentState;
        const defender = defenders[currentDefenderIndex];
        
        if (defender.active) {
          let defX = defender.x;
          let defY = defender.y;

          if (keysPressed.current['arrowup']) {
            defY = Math.max(PLAYER_SIZE, defY - redSpeed);
          }
          if (keysPressed.current['arrowdown']) {
            defY = Math.min(FIELD_HEIGHT - PLAYER_SIZE, defY + redSpeed);
          }
          if (keysPressed.current['arrowleft']) {
            defX = Math.max(PLAYER_SIZE, defX - redSpeed);
          }
          if (keysPressed.current['arrowright']) {
            defX = Math.min(FIELD_WIDTH - PLAYER_SIZE, defX + redSpeed);
          }

          let redBlocked = false;
          for (const chaser of currentState.chasers) {
            if (!chaser.sitting) continue;
            
            const dx = Math.abs(defX - chaser.x);
            const dy = Math.abs(defY - chaser.y);
            
            if (dx < PLAYER_SIZE * 1.2 && dy < PLAYER_SIZE * 1.2) {
              redBlocked = true;
              break;
            }
          }

          if (!redBlocked) {
            const newDefenders = [...defenders];
            newDefenders[currentDefenderIndex] = { ...defender, x: defX, y: defY };
            newState.defenders = newDefenders;

            if (checkTagCollision(newState.activeChaser, { x: defX, y: defY })) {
              newDefenders[currentDefenderIndex].active = false;
              
              const nextIndex = currentDefenderIndex + 1;
              
              setTagMessage(`Defender ${currentDefenderIndex + 1} Tagged!`);
              setTimeout(() => setTagMessage(null), 3000);
              
              if (nextIndex >= 3) {
                newState.gameOver = true;
                newState.winner = 'blue';
              } else {
                newDefenders[nextIndex].active = true;
                newDefenders[nextIndex].x = FIELD_WIDTH - 30;
                newDefenders[nextIndex].y = CENTER_LANE_Y;
                newState.currentDefenderIndex = nextIndex;
              }
              
              newState.activeChaser = {
                x: 30,
                y: CENTER_LANE_Y,
                direction: 'up',
                displayDirection: 'up',
                side: 'top',
                horizontalDirection: 'right'
              };
              
              newState.defenders = newDefenders;
            }
          }
        }
      }

      updateGameState(newState);
    }, 1000 / 60);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [screen, isPaused, gameMode, playerRole]);

  // Canvas rendering
  useEffect(() => {
    if (screen !== 'game' || !gameState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      ctx.fillStyle = '#2d5016';
      ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

      const leftPoleX = 50;
      const rightPoleX = FIELD_WIDTH - 50;
      ctx.fillStyle = '#3d6626';
      ctx.fillRect(leftPoleX, CENTER_LANE_Y - CENTER_LANE_HEIGHT / 2, 
                   rightPoleX - leftPoleX, CENTER_LANE_HEIGHT);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(50 - POLE_WIDTH / 2, CENTER_LANE_Y - POLE_HEIGHT / 2, POLE_WIDTH, POLE_HEIGHT);
      ctx.fillRect(FIELD_WIDTH - 50 - POLE_WIDTH / 2, CENTER_LANE_Y - POLE_HEIGHT / 2, POLE_WIDTH, POLE_HEIGHT);

      gameState.chasers.forEach((chaser) => {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(chaser.x, chaser.y, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(chaser.direction === 'up' ? '↑' : '↓', chaser.x, chaser.y + 7);
      });

      ctx.fillStyle = '#1e40af';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gameState.activeChaser.x, gameState.activeChaser.y, PLAYER_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      const displayDir = gameState.activeChaser.displayDirection || gameState.activeChaser.direction;
      let arrow = '↑';
      if (displayDir === 'down') arrow = '↓';
      else if (displayDir === 'left') arrow = '←';
      else if (displayDir === 'right') arrow = '→';
      ctx.fillText(arrow, gameState.activeChaser.x, gameState.activeChaser.y + 8);

      gameState.defenders.forEach((defender, index) => {
        if (!defender.active && index !== gameState.currentDefenderIndex) return;
        
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = index === gameState.currentDefenderIndex ? '#fbbf24' : '#dc2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(defender.x, defender.y, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [screen, gameState]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const backToMenu = () => {
    if (firestoreListenerRef.current) {
      firestoreListenerRef.current();
    }
    setScreen('landing');
    setGameMode(null);
    setCurrentRoom(null);
    setPlayerRole(null);
    setGameState(null);
    setIsPaused(false);
  };

  const restartGame = () => {
    const newState = createInitialGameState();
    updateGameState(newState);
    setIsPaused(false);
  };

  // Landing Page
  if (screen === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-32 h-32 border-4 border-orange-500 rounded-full"></div>
            <div className="absolute bottom-20 right-20 w-40 h-40 border-4 border-green-600 rounded-full"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 border-4 border-orange-400 rounded-full"></div>
          </div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="mb-8">
              <h1 className="text-7xl md:text-8xl font-bold mb-4 bg-gradient-to-r from-orange-600 via-white to-green-600 bg-clip-text text-transparent" style={{WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                Let's Kho
              </h1>
              <div className="w-32 h-1 bg-gradient-to-r from-orange-500 to-green-600 mx-auto mb-6"></div>
              <p className="text-2xl text-gray-700 mb-4">Experience the Traditional Indian Chase Game</p>
              <p className="text-lg text-gray-600 italic">खो-खो • A Digital Celebration of India's Heritage Sport</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
              <button
                onClick={() => setScreen('modeSelect')}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 px-12 rounded-full text-xl transition-all transform hover:scale-105 shadow-lg"
              >
                🎮 Play Now
              </button>
              <button
                onClick={() => setScreen('about')}
                className="bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-12 rounded-full text-xl transition-all transform hover:scale-105 shadow-lg border-2 border-gray-200"
              >
                📖 Learn More
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Mode Selection Screen
  if (screen === 'modeSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4">
        <div className="max-w-4xl w-full">
          <button
            onClick={() => setScreen('landing')}
            className="mb-8 text-gray-600 hover:text-gray-800 flex items-center gap-2 transition"
          >
            ← Back to Home
          </button>
          
          <h2 className="text-5xl font-bold text-center mb-12 text-gray-800">Choose Game Mode</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-orange-200 hover:border-orange-400 transition-all transform hover:scale-105">
              <div className="text-6xl text-center mb-4">🌐</div>
              <h3 className="text-3xl font-bold text-center mb-4 text-orange-600">Play Online</h3>
              <p className="text-gray-600 text-center mb-6">Challenge friends from different devices using room codes</p>
              {firebaseError && (
                <p className="text-sm text-red-600 text-center mb-4">{firebaseError}</p>
              )}
              <button
                onClick={() => {
                  if (!firebaseReady) {
                    alert('Firebase is still loading. Please wait a moment and try again.');
                    return;
                  }
                  setGameMode('online');
                  setScreen('onlineSetup');
                }}
                disabled={!firebaseReady}
                className={`w-full ${firebaseReady ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-bold py-3 px-6 rounded-lg transition`}
              >
                {firebaseReady ? 'Create or Join Room' : 'Loading Firebase...'}
              </button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-green-200 hover:border-green-400 transition-all transform hover:scale-105">
              <div className="text-6xl text-center mb-4">🏠</div>
              <h3 className="text-3xl font-bold text-center mb-4 text-green-600">Play Locally</h3>
              <p className="text-gray-600 text-center mb-6">Play with a friend on the same device</p>
              <button
                onClick={startLocalGame}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition"
              >
                Start Local Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Online Setup Screen
  if (screen === 'onlineSetup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <button
            onClick={() => setScreen('modeSelect')}
            className="mb-8 text-gray-600 hover:text-gray-800 flex items-center gap-2 transition"
          >
            ← Back to Mode Selection
          </button>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-orange-200">
            <h2 className="text-4xl font-bold text-center mb-8 text-gray-800">Online Multiplayer</h2>
            
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Your Name:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6">
                <h3 className="text-xl font-bold text-center mb-4 text-orange-600">Create Room</h3>
                <p className="text-sm text-gray-600 text-center mb-4">Host a game and share the room code with your friend</p>
                <button
                  onClick={createRoom}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  Create Room
                </button>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6">
                <h3 className="text-xl font-bold text-center mb-4 text-green-600">Join Room</h3>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none mb-4 text-center font-mono text-lg"
                  maxLength={6}
                />
                <button
                  onClick={joinRoom}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby Screen
  if (screen === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-orange-200">
            <h2 className="text-4xl font-bold text-center mb-6 text-gray-800">Game Lobby</h2>
            
            <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-6 mb-6">
              <p className="text-center text-gray-700 mb-2">Room Code:</p>
              <p className="text-center text-4xl font-mono font-bold text-orange-600">{currentRoom}</p>
              <p className="text-center text-sm text-gray-600 mt-2">Share this code with your friend</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className={`p-4 rounded-lg ${playerRole === 'blue' ? 'bg-blue-100 border-2 border-blue-400' : 'bg-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Blue Team (Chaser)</span>
                  {playerRole === 'blue' && <span className="text-blue-600 font-bold">You</span>}
                </div>
              </div>
              
              <div className={`p-4 rounded-lg ${playerRole === 'red' ? 'bg-red-100 border-2 border-red-400' : 'bg-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Red Team (Defender)</span>
                  {playerRole === 'red' ? (
                    <span className="text-red-600 font-bold">You</span>
                  ) : (
                    <span className="text-gray-500">Waiting...</span>
                  )}
                </div>
              </div>
            </div>
            
            {playerRole === 'blue' && (
              <button
                onClick={startOnlineGame}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition mb-4"
              >
                Start Game
              </button>
            )}
            
            {playerRole === 'red' && (
              <p className="text-center text-gray-600 italic mb-4">Waiting for host to start the game...</p>
            )}
            
            <button
              onClick={backToMenu}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // About Screen
  if (screen === 'about') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setScreen('landing')}
            className="mb-8 text-gray-600 hover:text-gray-800 flex items-center gap-2 transition"
          >
            ← Back to Home
          </button>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border-t-8 border-orange-500">
            <h2 className="text-4xl font-bold mb-6 text-gray-800">About Kho-Kho</h2>
            <div className="prose prose-lg max-w-none text-gray-700 space-y-4">
              <p>
                Kho-Kho is one of the most popular traditional sports in India, with roots dating back to ancient times. 
                It's a fast-paced chase game that combines strategy, speed, and teamwork.
              </p>
              <p>
                The game is played between two teams of 12 players each (9 on the field, 3 substitutes). Eight chasers sit 
                in the center of the court in alternating directions, while one chaser is active. The defending team tries 
                to avoid being tagged for as long as possible.
              </p>
              <p>
                What makes Kho-Kho unique is the "Kho" - where the active chaser can tap a seated teammate who then springs 
                into action. This creates exciting strategic gameplay as teams coordinate to corner defenders.
              </p>
              <p className="font-semibold text-orange-600">
                This digital version brings the excitement of Kho-Kho to your screen, allowing you to play with friends 
                online or locally!
              </p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border-t-8 border-green-500">
            <h2 className="text-4xl font-bold mb-6 text-gray-800">How to Play</h2>
            
            <div className="space-y-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
                <h3 className="text-2xl font-bold text-blue-700 mb-3">Blue Team (Chaser) - WASD + Space</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• 8 seated chasers + 1 active chaser</li>
                  <li>• Active chaser is 20% faster than defenders</li>
                  <li>• Can only move in ONE direction (left OR right) between poles</li>
                  <li>• Change direction by reaching a pole or passing turn via "Kho"</li>
                  <li>• Cannot cross center line except at poles</li>
                  <li>• Press SPACEBAR near seated teammate (from behind) to switch</li>
                </ul>
              </div>
              
              <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg">
                <h3 className="text-2xl font-bold text-red-700 mb-3">Red Team (Defender) - Arrow Keys</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• 3 defenders = 3 lives</li>
                  <li>• One defender on field at a time</li>
                  <li>• Complete freedom of movement in all directions</li>
                  <li>• Can zigzag between seated chasers</li>
                  <li>• Avoid being tagged by the active chaser</li>
                </ul>
              </div>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg">
                <h3 className="text-2xl font-bold text-green-700 mb-3">Winning Conditions</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• <strong>Blue wins:</strong> Tag all 3 defenders within 5 minutes</li>
                  <li>• <strong>Red wins:</strong> Survive for 5 minutes without all defenders getting tagged</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <button
                onClick={() => setScreen('modeSelect')}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 px-12 rounded-full text-xl transition-all transform hover:scale-105 shadow-lg"
              >
                Ready to Play! 🎮
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Screen
  if (screen === 'game' && gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-4">
        <div className="bg-white rounded-lg shadow-2xl p-4 mb-4 flex items-center justify-between w-full max-w-4xl">
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Time</div>
              <div className="text-2xl font-bold text-green-800">{formatTime(gameState.timeRemaining)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-600">Lives</div>
              <div className="flex space-x-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      i < gameState.currentDefenderIndex ? 'bg-gray-300 text-gray-500' : 'bg-red-500 text-white'
                    }`}
                  >
                    {i < gameState.currentDefenderIndex && '✗'}
                  </div>
                ))}
              </div>
            </div>
            
            {gameMode === 'online' && (
              <div className="text-center">
                <div className="text-sm text-gray-600">Your Team</div>
                <div className={`text-xl font-bold ${playerRole === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
                  {playerRole === 'blue' ? 'Blue (Chaser)' : 'Red (Defender)'}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={restartGame}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg transition"
            >
              🔄 Restart
            </button>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg transition"
            >
              {isPaused ? '▶️' : '⏸️'}
            </button>
            <button
              onClick={backToMenu}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg transition"
            >
              🏠 Menu
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={FIELD_WIDTH}
          height={FIELD_HEIGHT}
          className="border-4 border-green-900 rounded-lg shadow-2xl"
        />

        {tagMessage && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                        bg-yellow-400 text-gray-900 font-bold text-3xl px-8 py-4 rounded-lg 
                        shadow-2xl border-4 border-yellow-600 animate-pulse">
            {tagMessage}
          </div>
        )}

        {isPaused && !gameState.gameOver && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                        bg-gray-900 bg-opacity-90 text-white font-bold text-4xl px-12 py-8 rounded-lg 
                        shadow-2xl border-4 border-gray-700">
            ⏸ PAUSED
          </div>
        )}

        <div className="mt-4 bg-white rounded-lg shadow-lg p-3 max-w-4xl w-full">
          <div className="flex justify-around text-xs text-gray-600">
            {gameMode === 'local' ? (
              <>
                <span><span className="font-bold text-blue-600">Blue:</span> WASD + SPACE</span>
                <span><span className="font-bold text-red-600">Red:</span> Arrow Keys</span>
              </>
            ) : (
              <>
                {playerRole === 'blue' && <span className="font-bold text-blue-600">You: WASD + SPACE (Kho)</span>}
                {playerRole === 'red' && <span className="font-bold text-red-600">You: Arrow Keys</span>}
              </>
            )}
            <span>Change direction at poles</span>
          </div>
        </div>

        {gameState.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 text-center max-w-md">
              <h2 className="text-4xl font-bold mb-4">
                {gameState.winner === 'blue' ? '🔵 Blue Team Wins!' : '🔴 Red Team Wins!'}
              </h2>
              <p className="text-xl text-gray-600 mb-6">
                {gameState.winner === 'blue' ? 'All defenders tagged!' : 'Survived 5 minutes!'}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={restartGame}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-lg transition"
                >
                  Play Again
                </button>
                <button
                  onClick={backToMenu}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
              