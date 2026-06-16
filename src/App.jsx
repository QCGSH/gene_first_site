import { useState, useRef, useEffect, useCallback } from 'react';
import "./App.css"

const BrickBreakerGame = () => {
  const canvasRef = useRef(null);
  const gameData = useRef({
    ball: {
      x: 0,
      y: 0,
      r: 10,
      dx: 5,
      dy: -5,
      color: '#0ff'
    },
    paddle: {
      w: 120,
      h: 15,
      x: 0,
      y: 0,
      speed: 12,
      color: '#0f0'
    },
    brickConfig: {
      rows: 1,
      cols: 4,
      w: 0, // 先给0，resize后再计算真实宽度
      h: 20,
      gap: 12,
      top: 40
    },
    bricks: [],
    keys: { left: false, right: false },
    animationId: null,
    currentScore: 0
  });

  const [score, setScore] = useState(0);
  const [gameIsOver, setGameIsOver] = useState(false);

  // 动态设置画布真实宽高（填满屏幕）
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 可用可视区域高度，减去顶部信息栏预留高度
    const infoHeight = 40;
    const w = Math.min(window.innerWidth * 0.95, 800);
    const h = window.innerHeight - infoHeight - 20;
    // 设置画布真实像素尺寸
    canvas.width = w;
    canvas.height = h;

    const data = gameData.current;
    // ========== 关键修复：窗口/画布尺寸确定后再计算砖块宽度 ==========
    const totalGap = (data.brickConfig.cols - 1) * data.brickConfig.gap;
    data.brickConfig.w = (canvas.width - 60 - totalGap) / data.brickConfig.cols;

    // 重置小球、挡板初始位置
    data.ball.x = canvas.width / 2;
    data.ball.y = canvas.height - 50;
    data.paddle.x = canvas.width / 2 - data.paddle.w / 2;
    data.paddle.y = canvas.height - 30;

    initBricks();
  }, []);

  const initBricks = useCallback(() => {
    const data = gameData.current;
    const { rows, cols, w, h, gap, top } = data.brickConfig;
    data.bricks = [];
    // 防御：宽度非法则不生成砖块
    if (isNaN(w) || w <= 0) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        data.bricks.push({
          x: c * (w + gap) + 30, // 左右各预留30边距，和计算匹配
          y: r * (h + gap) + top,
          w,
          h,
          alive: true,
          color: `hsl(${r * 40}, 100%, 60%)`
        });
      }
    }
  }, []);

  const renderScene = useCallback((ctx, canvas) => {
    const data = gameData.current;
    const { ball, paddle, bricks } = data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 小球
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();

    // 挡板
    ctx.fillStyle = paddle.color;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    // 砖块
    bricks.forEach(brick => {
      if (brick.alive) {
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }
    });
  }, []);

  const updatePaddle = useCallback(() => {
    const data = gameData.current;
    const { paddle, keys } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (keys.left && paddle.x > 0) paddle.x -= paddle.speed;
    if (keys.right && paddle.x + paddle.w < canvas.width) paddle.x += paddle.speed;

    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.w > canvas.width) paddle.x = canvas.width - paddle.w;
  }, []);

  const collisionCheck = useCallback(() => {
    const data = gameData.current;
    const { ball, paddle, bricks } = data;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.dx = -ball.dx;
    if (ball.y - ball.r < 0) ball.dy = -ball.dy;

    // 落地失败
    if (ball.y + ball.r > canvas.height) {
      confirm(`游戏结束！得分：${data.currentScore}`);
      setGameIsOver(true)
      window.location.reload();
      return;
    }

    // 挡板碰撞
    if (ball.x > paddle.x && ball.x < paddle.x + paddle.w && ball.y + ball.r > paddle.y) {
      ball.dy = -ball.dy;
      const hitPos = ball.x - (paddle.x + paddle.w / 2);
      ball.dx = hitPos * 0.1;
    }

    let allDestroyed = true;
    bricks.forEach(brick => {
      if (brick.alive) {
        allDestroyed = false;
        if (
          ball.x > brick.x &&
          ball.x < brick.x + brick.w &&
          ball.y - ball.r < brick.y + brick.h &&
          ball.y + ball.r > brick.y
        ) {
          ball.dy = -ball.dy;
          brick.alive = false;
          data.currentScore += 10;
          setScore(data.currentScore);
        }
      }
    });

    if (allDestroyed) {
      const ok = confirm(`恭喜通关！得分：${data.currentScore}\n奖励: 给你看看我的宝子和小咪`);
      if (ok) setGameIsOver(true);
      else window.location.reload();
    }
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameIsOver) return;
    const ctx = canvas.getContext('2d');
    const data = gameData.current;

    updatePaddle();
    collisionCheck();

    data.ball.x += data.ball.dx;
    data.ball.y += data.ball.dy;

    renderScene(ctx, canvas);
    data.animationId = requestAnimationFrame(gameLoop);
  }, [gameIsOver, updatePaddle, collisionCheck, renderScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = gameData.current;

    // 初始化尺寸、分数、砖块
    resizeCanvas();
    data.currentScore = 0;
    setScore(0);

    // 键盘事件
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') data.keys.left = true;
      if (e.key === 'ArrowRight') data.keys.right = true;
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft') data.keys.left = false;
      if (e.key === 'ArrowRight') data.keys.right = false;
    };

    // 触摸滑动
    const onTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const touchX = (touch.clientX - rect.left) * scaleX;
      data.paddle.x = touchX - data.paddle.w / 2;
    };

    // 窗口大小变化重绘画布
    const onResize = () => resizeCanvas();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('resize', onResize);

    data.animationId = requestAnimationFrame(gameLoop);

    // 销毁清理
    return () => {
      cancelAnimationFrame(data.animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
    };
  }, [resizeCanvas, gameLoop]);

  return (
    <div style={pageStyle}>
      <div style={infoBarStyle}>
        <div>得分：<span>{score}</span></div>
        <div style={tipTextStyle}>电脑←→方向键 / 手机左右滑动屏幕操控挡板</div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          border: '3px solid #fff',
          background: '#000',
          touchAction: 'none',
          width: 'min(95vw, 800px)',
          height: 'calc(100vh - 60px)',
          display: gameIsOver ? 'none' : 'block'
        }}
      />

      <div
        style={{
          display: gameIsOver ? 'flex' : 'none',
          marginTop: 10,
          gap: 10
        }}
      >
        <img
          src="./1023535d5a8a7dd69bac5eb3edea7e70.jpg"
          alt="奖励图1"
          style={imgStyle}
        />
        <img
          src="./fcf0509d56bbaaa65caa6e6eb5949be6.jpg"
          alt="奖励图2"
          style={imgStyle}
        />
      </div>
    </div>
  );
};

const pageStyle = {
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  background: '#1a1a1a',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  overflow: 'hidden'
};

const infoBarStyle = {
  color: '#fff',
  fontSize: 16,
  marginBottom: 8,
  width: 'min(95vw, 800px)',
  display: 'flex',
  justifyContent: 'space-between'
};

const tipTextStyle = {
  fontSize: 'clamp(10px, 2vw, 16px)'
};

const imgStyle = {
  width: 300,
  border: '3px solid white',
  objectFit: 'contain',
  marginRight: 20
};

export default BrickBreakerGame;
