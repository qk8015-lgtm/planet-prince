import { Application, Graphics, Container, Text, TextStyle } 
  from "https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.mjs";

import { Aura } from "./aura.js";


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

// -----------------------------
// 三關 timeline（第二週新增）
// -----------------------------
const levelTimelines = [
  // Level 1
  [
    { t: 1.0, lane: 1, type: "light" },
    { t: 2.0, lane: 0, type: "light" },
    { t: 3.0, lane: 2, type: "light" },
  ],

  // Level 2
  [
    { t: 1.0, lane: 1, type: "light" },
    { t: 1.8, lane: 0, type: "light" },
    { t: 2.6, lane: 2, type: "dark"  },
  ],

  // Level 3
  [
    { t: 0.8, lane: 1, type: "dark"  },
    { t: 1.4, lane: 0, type: "light" },
    { t: 2.0, lane: 2, type: "dark"  },
  ],
];


// [新增] 第二週：變數與 UI
let auras = [];     // 存放場上的光暈物件
let spawnTimer = 0; // 生成計時器
let score = 0;      // 分數
let currentLevel = 0;      // 0 = 第一關, 1 = 第二關, 2 = 第三關
let gameTime = 0;          // 本關卡時間（秒）
let nextEventIndex = 0;    // timeline 事件索引

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

  // 用鍵盤數字 1,2,3 手動切換關卡（方便測試）
  if (e.key === "1") {
    startLevel(0); // 第一關
  }
  if (e.key === "2") {
    startLevel(1); // 第二關
  }
  if (e.key === "3") {
    startLevel(2); // 第三關
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
  // 每幀累加時間（秒）
  const deltaSeconds = app.ticker.deltaMS / 1000;
  gameTime += deltaSeconds;

  // 1. 平滑切軌
  const targetX = lanes[currentLane];
  ball.x = lerp(ball.x, targetX, 0.1);

  // 2. 光球輕微呼吸（視覺＋生命感）
  glow.scale.x = 1 + Math.sin(performance.now() / 500) * 0.05;
  glow.scale.y = glow.scale.x;

  // -----------------------------
  // [新增] 第二週邏輯：光暈生成與碰撞
  // -----------------------------
  
  // A. 依照 timeline 生成光暈 / 暗球
  const timeline = levelTimelines[currentLevel];

  while (
    nextEventIndex < timeline.length &&
    timeline[nextEventIndex].t <= gameTime
  ) {
    const evt = timeline[nextEventIndex];
    spawnAuraFromEvent(evt);
    nextEventIndex++;
  }


  // B. 更新光暈位置與碰撞
  for (let i = auras.length - 1; i >= 0; i--) {
      const aura = auras[i];
      aura.update(); // 讓光暈往下跑

      // 碰撞判定：同軌道&&距離夠近
      const distY = Math.abs(aura.view.y - ball.y);
      if (aura.active && aura.lane === currentLane && distY < 50) {
        aura.active = false;

        if (aura.type === "light") {
          score += 10;
        } else if (aura.type === "dark") {
          score -= 5; // 或扣命，看你們設計
        }

        scoreText.text = "Score: " + score;
      }


      // 移除失效物件
      if (!aura.active) {
          auraLayer.removeChild(aura.view);
          auras.splice(i, 1);
      }
  }
}

// 依照 timeline 事件生成 Aura（光暈 / 暗球）
function spawnAuraFromEvent(evt) {
  const laneIndex = evt.lane;
  const x = lanes[laneIndex];

  // 給不同關卡不同速度（之後可以微調）
  const baseSpeed = 5;
  const levelSpeedMul = [1.0, 1.2, 1.5]; // Level 1, 2, 3 速度倍率
  const speed = baseSpeed * levelSpeedMul[currentLevel];

  const aura = new Aura(x, laneIndex, evt.type, speed);

  auraLayer.addChild(aura.view);
  auras.push(aura);
}

// 開始 / 重設某一個關卡
// -----------------------------
function startLevel(levelIndex) {
  currentLevel = levelIndex;
  gameTime = 0;
  nextEventIndex = 0;

  // 清空場上的光暈
  for (let aura of auras) {
    auraLayer.removeChild(aura.view);
  }
  auras = [];

  console.log("Start Level", currentLevel + 1);
}

