import * as THREE from 'three';

export class Aura {
  constructor(laneX, laneIndex, type = "light", speed = 0.5) {
    this.lane = laneIndex;
    this.type = type; 
    this.active = true;
    this.speed = speed;

    this.mesh = new THREE.Group();

    const geometry = new THREE.SphereGeometry(0.8, 32, 32); 
    let material;

    if (type === "light") {
      // [修改] 光暈：暖金色，降低刺眼度
      material = new THREE.MeshStandardMaterial({
        color: 0xffaa00,       // 橘黃色本體
        emissive: 0xff8800,    // 自發光改為較深的橘色
        emissiveIntensity: 1.0, // [關鍵] 強度降低 (原本是 2.0)
        roughness: 0.4,        // 增加粗糙度，讓表面光澤更柔和
        metalness: 0.1
      });
      
      // 內部的點光源也調弱
      const light = new THREE.PointLight(0xffaa00, 2, 8); // 強度從 5 降為 2
      this.mesh.add(light);

    } else if (type === "dark") {
      // 暗球：維持深色
      material = new THREE.MeshStandardMaterial({
        color: 0x110022,
        emissive: 0x110033,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0.8
      });
      
      const wireGeo = new THREE.IcosahedronGeometry(1.2, 0);
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x440088, wireframe: true });
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.userData.isRotator = true; 
      this.mesh.add(wire);
    }

    const sphere = new THREE.Mesh(geometry, material);
    this.mesh.add(sphere);

    this.mesh.position.set(laneX, 1, -100); 
  }

  update(delta) {
    const zSpeed = this.speed * 10 * delta; 
    this.mesh.position.z += zSpeed;

    if (this.type === "dark") {
        this.mesh.children.forEach(child => {
            if (child.userData.isRotator) {
                child.rotation.x += delta;
                child.rotation.y += delta;
            }
        });
    }

    if (this.mesh.position.z > 10) {
      this.active = false;
    }
  }
}