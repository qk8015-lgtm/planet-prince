import { Graphics } from "https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.mjs";

export class Aura {
  constructor(x, laneIndex) {
    this.lane = laneIndex;
    this.active = true;
    this.speed = 6;

    // 外觀
    this.view = new Graphics();
    
    // 內圈實心
    this.view.circle(0, 0, 20);
    this.view.fill({ color: 0xffff00, alpha: 0.8 }); 
    
    // 外圈發光
    this.view.circle(0, 0, 30);
    this.view.fill({ color: 0xffff00, alpha: 0.3 });

    // 初始位置 (從上方出現)
    this.view.x = x;
    this.view.y = -100; 
  }

  update() {
    this.view.y += this.speed;

    // 超出邊界檢查
    if (this.view.y > window.innerHeight + 50) {
      this.active = false;
    }
  }
}
