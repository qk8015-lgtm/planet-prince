import { Graphics } from "https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.mjs";

export class Aura {
  // 新增 type 和 speed 參數，給預設值
  constructor(x, laneIndex, type = "light", speed = 6) {
    this.lane = laneIndex;
    this.type = type;   // "light" 或 "dark"
    this.active = true;
    this.speed = speed; // 速度由外面決定（不同關卡可不同）

    this.view = new Graphics();

    if (type === "light") {
      // 光暈：亮黃色
      this.view.circle(0, 0, 20);
      this.view.fill({ color: 0xffff00, alpha: 0.8 }); 
    
      this.view.circle(0, 0, 30);
      this.view.fill({ color: 0xffff00, alpha: 0.3 });
    } else if (type === "dark") {
      // 暗球：偏紫或深藍
      this.view.circle(0, 0, 20);
      this.view.fill({ color: 0x663399, alpha: 0.9 }); 
    
      this.view.circle(0, 0, 30);
      this.view.fill({ color: 0x221133, alpha: 0.4 });
    }

    // 初始位置 (從上方出現)
    this.view.x = x;
    this.view.y = -100; 
  }


  update() {
    this.view.y += this.speed;

    if (this.view.y > window.innerHeight + 50) {
      this.active = false;
    }
  }
}

