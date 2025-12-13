import * as THREE from 'three';

export class Aura {
  constructor(laneX, laneIndex, type = "light", speed = 0.5) {
    this.lane = laneIndex;
    this.type = type;
    this.active = true;
    this.speed = speed;
    this.time = 0;          // 給星星閃爍用

    // 用一個 Group 裝所有零件
    this.mesh = new THREE.Group();

    if (type === "light") {
      // ===== 小星星核心 =====
      const coreGeom = new THREE.IcosahedronGeometry(0.6, 0); // 類似小多面體星星
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffffdd,
        emissive: 0xffffee,
        emissiveIntensity: 2.0,
        roughness: 0.2,
        metalness: 0.4,
      });
      const core = new THREE.Mesh(coreGeom, coreMat);

      // ===== 外層光暈（淡淡發光球）=====
      const glowGeom = new THREE.SphereGeometry(1.1, 20, 20);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffbb,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);

      this.mesh.add(glow);
      this.mesh.add(core);
    } else {
      // ===== 暗色小星星（也有光暈）=====
        const coreGeom = new THREE.IcosahedronGeometry(0.6, 0);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x222233,          // 比較暗的本體
            emissive: 0x220011,       // 深紅／紫色微發光
            emissiveIntensity: 0.9,
            roughness: 0.4,
            metalness: 0.2,
        });
        const core = new THREE.Mesh(coreGeom, coreMat);

        // 外層暗色光暈
        const glowGeom = new THREE.SphereGeometry(1.1, 20, 20);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x551122,          // 深紅紫色光暈
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);

        this.mesh.add(glow);
        this.mesh.add(core);
    }
    // 初始位置：跟原本一樣在某一條 lane、遠方 z = -100
    this.mesh.position.set(laneX, 0.6, -100);
  }

  update(delta) {
    if (!this.active) return;

    this.time += delta;

    // ===== 光球：閃爍、小小跳動 =====
    if (this.type === "light") {
      const s = 1 + 0.15 * Math.sin(this.time * 8.0); // 亮度跳動
      this.mesh.scale.set(s, s, s);
    }

    // ===== 暗球：旋轉外圈 =====
    if (this.type === "dark") {
      this.mesh.children.forEach(child => {
        if (child.userData && child.userData.isRotator) {
          child.rotation.z += delta * 1.5;
        }
      });
    }

    // ===== 往玩家方向移動（跟原本一樣公式）=====
    this.mesh.position.z += this.speed * 10 * delta;

    // 飛過頭就標記為失效，讓 game.js 把它移除
    if (this.mesh.position.z > 10) {
      this.active = false;
    }
  }
}
