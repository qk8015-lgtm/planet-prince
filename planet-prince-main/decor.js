import * as THREE from 'three';

export class DecorSystem {
  constructor(scene) {
    this.scene = scene;
    this.decors = [];
    this.timer = 0;
    this.spawnInterval = 1.0; 
  }

  spawnDecor(level) {
    // 防呆：如果沒傳入 level，預設為 0
    if (level === undefined) level = 0;

    // 距離設定 (維持你的設定：左右分佈較遠)
    const isLeft = Math.random() > 0.5;
    const xRange = isLeft ? -35 - Math.random() * 40 : 35 + Math.random() * 40;
    
    // 高度分佈
    const yRange = (Math.random() - 0.5) * 20; 

    // 決定種類
    let type;
    if (level === 0) {
      type = "crystal"; // 第一關只有水晶
    } else {
      type = Math.random() > 0.4 ? "rock" : "crystal"; // 後面關卡混合
    }
    
    let mesh;

    if (type === "rock") {
      // ===== 岩石 (維持不變) =====
      const geom = new THREE.DodecahedronGeometry(Math.random() * 2.5 + 1.5, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8c857b,
        roughness: 0.9,
        flatShading: true,
      });
      mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      
    } else {
      // ===== 水晶 (短胖版) =====
      
      let baseColor, emissiveColor, emissiveIntensity;

      if (level === 2) {
        // Level 2 (第三關)：粉色
        baseColor = 0xffccea;     
        emissiveColor = 0xff77aa; 
        emissiveIntensity = 1.5;
      } else {
        // Level 0 & 1 (第一、二關)：淺紫色
        baseColor = 0xeedaff;     
        emissiveColor = 0xaa77ff; 
        emissiveIntensity = 1.8;  
      }

      // ★ 修改1：高度變短 (原本的 2/3)
      // (Math.random() * 6 + 5) * 0.66 大約範圍在 3.3 ~ 7.3
      const height = (Math.random() * 6 + 5) * 0.66; 

      // ★ 修改2：半徑變粗 (原本的 3 倍)
      const geom = new THREE.CylinderGeometry(
          (Math.random() * 0.3 + 0.2) * 1.5, // 頂部半徑變粗
          (Math.random() * 0.4 + 0.5) * 1.5, // 底部半徑變粗
          height, 
          5 + Math.floor(Math.random() * 3) 
      );

      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: emissiveColor,
        emissiveIntensity: emissiveIntensity,
        roughness: 0.05,       
        metalness: 0.4,        
        flatShading: true,     
        transparent: true,     
        opacity: 0.85,         
        side: THREE.DoubleSide 
      });
      mesh = new THREE.Mesh(geom, mat);
      
      mesh.rotation.z = (Math.random() - 0.5) * 1.0;
      mesh.rotation.x = (Math.random() - 0.5) * 1.0;
      mesh.rotation.y = Math.random() * Math.PI;
    }

    mesh.position.set(xRange, yRange, -120);
    
    this.decors.push({
      mesh: mesh,
      speedFactor: 0.4 + Math.random() * 0.3, 
      rotSpeed: (Math.random() - 0.5) * 0.8
    });

    this.scene.add(mesh);
  }

  update(delta, currentLevel) {
    this.timer += delta;

    if (this.timer > this.spawnInterval) {
      this.spawnDecor(currentLevel);
      this.timer = 0;
    }

    for (let i = this.decors.length - 1; i >= 0; i--) {
      const d = this.decors[i];
      const moveSpeed = 18 * d.speedFactor; 
      d.mesh.position.z += moveSpeed * delta;
      d.mesh.rotation.x += d.rotSpeed * delta;
      d.mesh.rotation.y += d.rotSpeed * delta;

      if (d.mesh.position.z > 40) {
        this.scene.remove(d.mesh);
        this.decors.splice(i, 1);
      }
    }
  }
}