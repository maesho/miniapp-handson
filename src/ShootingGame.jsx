import React, { useEffect, useRef, useState } from 'react';
import liff from '@line/liff';

const ShootingGame = () => {
  const canvasRef = useRef(null);
  const audioContext = useRef(null);
  const [gameState, setGameState] = useState({
    player: { x: 200, y: 500, powerLevel: 1 },
    bullets: [],
    enemies: [],
    powerups: [],
    score: 0,
    highScore: parseInt(localStorage.getItem('shootingGameHighScore') || '0'),
    gameOver: false,
    difficulty: 1
  });

  const [dimensions] = useState({
    width: 400,
    height: 600
  });

  // シェア機能
  const handleShare = () => {
    if (liff.isApiAvailable('shareTargetPicker')) {
      liff.shareTargetPicker([
        {
          type: 'flex',
          altText: 'シューティングゲームのスコアをシェア！',
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: 'https://example.com/game-image.png', // ゲーム画像のURLに置き換えてください
              size: 'full',
              aspectRatio: '20:13',
              aspectMode: 'cover'
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: `シューティングゲームで${gameState.score}点をとったよ！`,
                  size: 'lg',
                  weight: 'bold',
                  wrap: true
                },
                {
                  type: 'text',
                  text: '手軽に遊べるミニゲーム',
                  size: 'sm',
                  color: '#999999',
                  margin: 'md'
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'uri',
                    label: '遊んでみる！',
                    uri: `https://liff.line.me/${liff.id}`
                  },
                  style: 'primary'
                }
              ]
            }
          }
        }
      ])
      .then((res) => {
        if (res) {
          alert('シェアしました！');
        } else {
          alert('シェアをキャンセルしました。');
        }
      })
      .catch((error) => {
        alert('エラーが発生しました。');
        console.error(error);
      });
    }
  };

  // 効果音生成
  const createSound = (frequency, type = 'square') => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const oscillator = audioContext.current.createOscillator();
    const gainNode = audioContext.current.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.current.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.current.destination);
    oscillator.start();
    oscillator.stop(audioContext.current.currentTime + 0.5);
  };

  // 敵の種類を定義
  const enemyTypes = {
    normal: { width: 20, height: 20, color: '#ff0000', speed: 2, points: 100, hp: 1 },
    fast: { width: 15, height: 15, color: '#ff00ff', speed: 4, points: 150, hp: 1 },
    tank: { width: 30, height: 30, color: '#8B0000', speed: 1, points: 200, hp: 3 }
  };

  // パワーアップの種類を定義
  const powerupTypes = {
    multishot: { color: '#00ffff', effect: 'multishot' },
    speedup: { color: '#ffff00', effect: 'speedup' },
    shield: { color: '#0000ff', effect: 'shield' }
  };

  // ゲームループの設定
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastEnemySpawn = 0;
    let lastPowerupSpawn = 0;

    const gameLoop = (timestamp) => {
      if (gameState.gameOver) {
        cancelAnimationFrame(animationFrameId);
        return;
      }

      // 画面クリア
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // 敵の生成
      if (timestamp - lastEnemySpawn > 1000 / gameState.difficulty) {
        const enemyType = Math.random() > 0.7 ? 
          (Math.random() > 0.5 ? 'fast' : 'tank') : 'normal';
        setGameState(prev => ({
          ...prev,
          enemies: [...prev.enemies, {
            ...enemyTypes[enemyType],
            x: Math.random() * (dimensions.width - enemyTypes[enemyType].width),
            y: 0,
            type: enemyType
          }]
        }));
        lastEnemySpawn = timestamp;
      }

      // パワーアップアイテムの生成
      if (timestamp - lastPowerupSpawn > 10000) {
        const powerupType = Object.keys(powerupTypes)[Math.floor(Math.random() * Object.keys(powerupTypes).length)];
        setGameState(prev => ({
          ...prev,
          powerups: [...prev.powerups, {
            ...powerupTypes[powerupType],
            x: Math.random() * (dimensions.width - 20),
            y: 0,
            width: 15,
            height: 15,
            type: powerupType
          }]
        }));
        lastPowerupSpawn = timestamp;
      }

      // オブジェクトの移動
      setGameState(prev => ({
        ...prev,
        bullets: prev.bullets
          .map(bullet => ({ ...bullet, y: bullet.y - 7 }))
          .filter(bullet => bullet.y > 0),
        enemies: prev.enemies
          .map(enemy => ({ ...enemy, y: enemy.y + enemy.speed }))
          .filter(enemy => enemy.y < dimensions.height),
        powerups: prev.powerups
          .map(powerup => ({ ...powerup, y: powerup.y + 1 }))
          .filter(powerup => powerup.y < dimensions.height),
        difficulty: Math.min(5, 1 + Math.floor(prev.score / 1000))
      }));

      // 衝突判定
      setGameState(prev => {
        const newEnemies = [...prev.enemies];
        const newBullets = [...prev.bullets];
        const newPowerups = [...prev.powerups];
        let newScore = prev.score;
        let isGameOver = prev.gameOver;
        let newPlayer = { ...prev.player };

        // 弾と敵の衝突判定
        for (let i = newBullets.length - 1; i >= 0; i--) {
          for (let j = newEnemies.length - 1; j >= 0; j--) {
            if (checkCollision(newBullets[i], newEnemies[j])) {
              newBullets.splice(i, 1);
              newEnemies[j].hp--;
              if (newEnemies[j].hp <= 0) {
                newScore += newEnemies[j].points;
                newEnemies.splice(j, 1);
                createSound(440);
              }
              break;
            }
          }
        }

        // プレイヤーとパワーアップの衝突判定
        for (let i = newPowerups.length - 1; i >= 0; i--) {
          if (checkCollision(prev.player, newPowerups[i])) {
            const powerup = newPowerups[i];
            newPowerups.splice(i, 1);
            createSound(660);
            
            switch (powerup.type) {
              case 'multishot':
                newPlayer.powerLevel = Math.min(3, newPlayer.powerLevel + 1);
                break;
              case 'speedup':
                break;
              case 'shield':
                newPlayer.shield = true;
                break;
              default:
                break;
            }
          }
        }

        // プレイヤーと敵の衝突判定
        for (const enemy of newEnemies) {
          if (checkCollision(prev.player, enemy)) {
            if (newPlayer.shield) {
              newPlayer.shield = false;
              createSound(220);
            } else {
              isGameOver = true;
              createSound(110);
              if (newScore > prev.highScore) {
                localStorage.setItem('shootingGameHighScore', newScore.toString());
              }
            }
            break;
          }
        }

        return {
          ...prev,
          enemies: newEnemies,
          bullets: newBullets,
          powerups: newPowerups,
          score: newScore,
          gameOver: isGameOver,
          player: newPlayer,
          highScore: Math.max(prev.highScore, newScore)
        };
      });

      // 描画
      // プレイヤー
      ctx.fillStyle = gameState.player.shield ? '#00ffff' : '#00ff00';
      ctx.fillRect(gameState.player.x - 15, gameState.player.y - 15, 30, 30);

      // パワーレベル表示
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < gameState.player.powerLevel; i++) {
        ctx.fillRect(gameState.player.x - 10 + i * 10, gameState.player.y + 20, 5, 5);
      }

      // 弾
      ctx.fillStyle = '#ffff00';
      gameState.bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
      });

      // 敵
      gameState.enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        if (enemy.type === 'tank') {
          ctx.fillStyle = '#00ff00';
          const hpWidth = (enemy.hp / enemyTypes.tank.hp) * enemy.width;
          ctx.fillRect(enemy.x, enemy.y - 5, hpWidth, 3);
        }
      });

      // パワーアップ
      gameState.powerups.forEach(powerup => {
        ctx.fillStyle = powerup.color;
        ctx.beginPath();
        ctx.arc(powerup.x + 7.5, powerup.y + 7.5, 7.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // スコア表示
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${gameState.score}`, 10, 30);
      ctx.fillText(`High Score: ${gameState.highScore}`, 10, 60);
      ctx.fillText(`Level: ${gameState.difficulty}`, 10, 90);

      if (gameState.gameOver) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', dimensions.width / 2, dimensions.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText('Click to restart', dimensions.width / 2, dimensions.height / 2 + 40);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, dimensions]);

  // クリックイベントの処理
  const handleCanvasClick = (e) => {
    if (gameState.gameOver) {
      setGameState({
        player: { x: 200, y: 500, powerLevel: 1 },
        bullets: [],
        enemies: [],
        powerups: [],
        score: 0,
        highScore: gameState.highScore,
        gameOver: false,
        difficulty: 1
      });
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    createSound(880);

    setGameState(prev => {
      const newBullets = [];
      if (prev.player.powerLevel >= 1) newBullets.push({ x, y: prev.player.y - 20, width: 4, height: 4 });
      if (prev.player.powerLevel >= 2) {
        newBullets.push({ x: x - 10, y: prev.player.y - 20, width: 4, height: 4 });
        newBullets.push({ x: x + 10, y: prev.player.y - 20, width: 4, height: 4 });
      }
      if (prev.player.powerLevel >= 3) {
        newBullets.push({ x: x - 20, y: prev.player.y - 20, width: 4, height: 4 });
        newBullets.push({ x: x + 20, y: prev.player.y - 20, width: 4, height: 4 });
      }

      return {
        ...prev,
        player: { ...prev.player, x },
        bullets: [...prev.bullets, ...newBullets]
      };
    });
  };

  // 衝突判定関数
  const checkCollision = (rect1, rect2) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + (rect1.width || 30) > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + (rect1.height || 30) > rect2.y;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-xl font-bold">Shooting Game</div>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleCanvasClick}
        className="border border-gray-400"
      />
      {!gameState.gameOver ? (
        <div className="text-sm space-y-1">
          <div>Click to shoot and move player horizontally</div>
          <div>Collect power-ups to enhance your ship:</div>
          <div>🔵 Shield - Protects from one hit</div>
          <div>🌟 Multi-shot - Increases number of bullets</div>
          <div>💨 Speed-up - Temporary speed boost</div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-sm font-bold">Click anywhere to restart</div>
          <button 
            onClick={handleShare}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            シェア！
          </button>
        </div>
      )}
    </div>
  );
};

export default ShootingGame;