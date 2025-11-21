import { Application, Graphics } from "https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.mjs";

const app = new Application();
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  background: 0x0b0f1a,
});
document.body.appendChild(app.canvas);

app.ticker.add(update);
function update() {
  // 1. 光球自動往上移動
  ball.y -= 2;

  // 讓光球跑出畫面上方後，從底部重新出現（循環）
  if (ball.y < -30) {
    ball.y = app.screen.height + 30;
  }

  // 2. lerp 平滑切軌
  const targetX = lanes[currentLane];
  ball.x = lerp(ball.x, targetX, 0.1);
}


const lanes = [
  app.screen.width * 0.3,
  app.screen.width * 0.5,
  app.screen.width * 0.7
];
let currentLane = 1; // 一開始在中間

const ball = new Graphics()
  .circle(0, 0, 25)
  .fill(0xffe08a);

ball.y = app.screen.height * 0.8; // 在畫面偏下
ball.x = lanes[currentLane];

app.stage.addChild(ball);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" && currentLane > 0) {
    currentLane--;
  } 
  if (e.key === "ArrowRight" && currentLane < lanes.length - 1) {
    currentLane++;
  }
});
function lerp(a, b, t) {
  return a + (b - a) * t;
}

const trackLayer = new Graphics()
  .lineStyle({ width: 2, color: 0x33415c });

for (let x of lanes) {
  trackLayer.moveTo(x, 0);
  trackLayer.lineTo(x, app.screen.height);
}

app.stage.addChildAt(trackLayer, 0); // 放最底層
