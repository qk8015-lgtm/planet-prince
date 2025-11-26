import { Graphics } from "https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.mjs";

export class Aura {
  constructor(x, laneIndex) {
    // 1. 基本屬性
    this.lane = laneIndex; 
    this.active = true;
    this.speed = 6;

    // 2. 建立外觀 (黃色光暈)
    this.view = new Graphics();
    this.view.circle(0, 0, 20);
    this.view.fill({ color: 0xffff00, alpha: 0.8 });
    // 發光
    this.view.circle(0, 0, 30);
    this.view.fill({ color: 0xffff00, alpha: 0.3 });

    // 3. 初始位置
    this.view.x = x;
    this.view.y = -100; // 從螢幕上方外面開始
  }

  update() {
    this.view.y += this.speed;
    if (this.view.y > window.innerHeight + 50) {
      this.active = false;
    }
  }
}
