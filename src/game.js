import { Application, Graphics, Container } 
  from "https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.mjs";

// -----------------------------
// 基本 PIXI 初始化
// -----------------------------
const app = new Application();
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  background: 0x0b0f1a,
});
document.body.appendChild(app.canvas);

// -----------------------------
// 星軌座標
// -----------------------------
const lanes = [
  app.screen.width * 0.3,
  app.screen.width * 0.5,
  app.screen.width * 0.7,
];
let currentLane = 1;

// -----------------------------
// 畫三條星軌線（美化版）
// -----------------------------
const trackLayer = new Graphics();
trackLayer.lineStyle({ width: 2, color: 0x33415c, alpha: 0.5 });

for (let x of lanes) {
  trackLayer.moveTo(x, 0);
  trackLayer.lineTo(x, app.screen.height);
}

app.stage.addChild(trackLayer);

// -----------------------------
// 光球（含外光暈）
// -----------------------------
const ball = new Graphics()
  .circle(0, 0, 25)
  .fill(0xffe08a);

// 外光暈（Glow）
const glow = new Graphics()
  .circle(0, 0, 45)
  .fill(0xffe08a, 0.15);

ball.addChild(glow);

// 初始位置
ball.x = lanes[currentLane];
ball.y = app.screen.height * 0.8;

app.stage.addChild(ball);

// -----------------------------
// 給第二週的人用：光暈容器
// -----------------------------
export const auraLayer = new Container();
app.stage.addChild(auraLayer);

// [新增] 第二週：變數與 UI
let auras = [];     // 存放場上的光暈物件
let spawnTimer = 0; // 生成計時器
let score = 0;      // 分數

const scoreStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 36,
    fill: '#ffffff',
    fontWeight: 'bold',
});
const scoreText = new Text({ text: 'Score: 0', style: scoreStyle });
scoreText.x = 20;
scoreText.y = 20;
app.stage.addChild(scoreText);

// -----------------------------
// 鍵盤控制左右切軌
// -----------------------------
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" && currentLane > 0) {
    currentLane--;
    playLaneSwitchSound();
  }
  if (e.key === "ArrowRight" && currentLane < lanes.length - 1) {
    currentLane++;
    playLaneSwitchSound();
  }
});

// 預留給第二週/第三週補音效
function playLaneSwitchSound() {
  console.log("Lane switch");
}

// -----------------------------
// 線性插值（平滑動畫）
// -----------------------------
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// -----------------------------
// UPDATE（主要遊戲迴圈）
// -----------------------------
app.ticker.add(update);

function update() {
  // 1. 平滑切軌
  const targetX = lanes[currentLane];
  ball.x = lerp(ball.x, targetX, 0.1);

  // 2. 光球輕微呼吸（視覺＋生命感）
  glow.scale.x = 1 + Math.sin(performance.now() / 500) * 0.05;
  glow.scale.y = glow.scale.x;

  // -----------------------------
  // [新增] 第二週邏輯：光暈生成與碰撞
  // -----------------------------
  
  // A. 生成邏輯 (每 60 frame 一次)
  spawnTimer++;
  if (spawnTimer > 60) {
      spawnNewAura();
      spawnTimer = 0;
  }

  // B. 更新光暈位置與碰撞
  for (let i = auras.length - 1; i >= 0; i--) {
      const aura = auras[i];
      aura.update(); // 讓光暈往下跑

      // 碰撞判定：同軌道&&距離夠近
      const distY = Math.abs(aura.view.y - ball.y);
      if (aura.active && aura.lane === currentLane && distY < 50) {
          // 吃到了
          aura.active = false;
          score += 10;
          scoreText.text = "Score: " + score;
          console.log("Score!", score);
      }

      // 移除失效物件
      if (!aura.active) {
          auraLayer.removeChild(aura.view);
          auras.splice(i, 1);
      }
  }
}

// [新增] 輔助函式：生成光暈
function spawnNewAura() {
    const laneIndex = Math.floor(Math.random() * 3);
    const x = lanes[laneIndex];
    const aura = new Aura(x, laneIndex);
    
    auraLayer.addChild(aura.view); 
    auras.push(aura);
}

import { lanes, currentLane, setLane } from "./core/lane.js";
import { createPlayer, updatePlayer } from "./objects/player.js";
import { updateMovement } from "./core/movement.js";
