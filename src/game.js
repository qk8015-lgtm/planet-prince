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

// -----------------------------
// 給第二週的人：光暈資料格式
// -----------------------------
export function createAura() {
  return {
    sprite: null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    score: 10,
    isFake: false,
    active: false, 
  };
}

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
  // 1. 光球自動往上移動
  ball.y -= 2;

  // 循環回到底部
  if (ball.y < -30) {
    ball.y = app.screen.height + 30;
  }

  // 2. 平滑切軌
  const targetX = lanes[currentLane];
  ball.x = lerp(ball.x, targetX, 0.1);

  // 3. 光球輕微呼吸（視覺＋生命感）
  glow.scale.x = 1 + Math.sin(performance.now() / 500) * 0.05;
  glow.scale.y = glow.scale.x;
}

import { lanes, currentLane, setLane } from "./core/lane.js";
import { createPlayer, updatePlayer } from "./objects/player.js";
import { updateMovement } from "./core/movement.js";
