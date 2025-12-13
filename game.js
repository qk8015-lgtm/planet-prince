import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Aura } from "./aura.js";
import { DecorSystem } from "./decor.js";

/* =========================================
   全域變數與狀態管理
   ========================================= */
let gameStarted = false;
let gameOver = false;
let gameCleared = false;         // 第三關破關畫面
let awaitingLevelStart = true;   // 是否正在看關卡封面
let pendingLevel = 0;            // 封面要開始的關卡

// 遊戲內核心狀態
let levelStartTime = Date.now();
let hasStoryTriggered = false;     // 本關卡是否已觸發過故事
let isGamePaused = false;          // 是否暫停 (顯示故事時)
let firstStoryOrbSpawned = false;  // 是否已嘗試生成第一顆故事球
let isStoryOrbOnScreen = false; // 檢查場上是否已經有一顆故事球
let resumeCooldown = 0;         // 關閉故事後的緩衝計時器

// 分數與時間
let score = 0;
let combo = 0;
let bestScore = parseInt(localStorage.getItem("bestScore") || "0", 10);
let gameTime = 0;
let currentLevel = 0;

// 物件陣列
let auras = [];
const trail = [];

// 節奏控制
let beatIndex = 0;
let nextHitTime = 0;
let nextSpawnTime = 0;

/* =========================================
   DOM 元素取得
   ========================================= */
const startOverlay = document.getElementById("start-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");
const clearOverlay = document.getElementById("clear-overlay");
const clearBody = document.getElementById("clear-body");
const coverTitle = document.getElementById("cover-title");
const coverBody = document.getElementById("cover-body");
const coverHint = document.getElementById("cover-hint");
const uiScore = document.getElementById("score-text");
const uiCombo = document.getElementById("combo-text");
const storyModal = document.getElementById('story-modal');
const storyTextDiv = document.getElementById('story-text');

/* =========================================
   故事與文字資料
   ========================================= */
const levelStories = [
  {
    title: "風之星",
    body: "異鄉遊子來到陌生星球 \n這顆星球永遠吹著溫柔的風。\n雲海像呼吸一樣起伏，星光會隨著風聲閃爍。\n他聽到一個聲音：只要順著風走，就不會迷路。"
  },
  {
    title: "影之域",
    body: "這個區域曾經充滿光。 \n但有一天，人們開始忘記彼此的聲音，\n影子便悄悄出現了。\n光不再總是指引方向，\n有時，它會被黑暗遮住。"
  },
  {
    title: "心之核",
    body: "這顆星球沒有名字。\n因為每個來到這裡的人，\n都用自己的記憶為它命名。\n\n當光聚集時，\n你會聽見曾經走過的所有旋律。"
  }
];

const clearText = "旅途結束\n 光不會消失。\n它只是，\n在下一段旅程裡等你。";

const Stories = {
    1: `這裡的風，從不停止。
有人害怕它的力量，
有人學會聽它的節奏。

當你不再抗拒，
風會帶你前往下一道光。`,

    2: `有些光，會熄滅。
有些路，會走錯。

影子不是敵人，
它只是提醒你——
曾經，你也迷失過。`,

    3: `你走過風，
穿越影子，

現在，光在等待你。

不是為了抵達終點，
而是為了記住——
你曾經發光。`
};

/* =========================================
   介面控制函式
   ========================================= */
function showLevelCover(levelIndex) {
  pendingLevel = levelIndex;
  awaitingLevelStart = true;
  gameStarted = false;
  gameOver = false;

  const story = levelStories[levelIndex] || { title: `LEVEL ${levelIndex + 1}`, body: "" };
  if (coverTitle) coverTitle.textContent = story.title;
  if (coverBody) coverBody.textContent = story.body;
  if (coverHint) coverHint.textContent = "按 Enter 開始";

  if (startOverlay) startOverlay.style.display = "flex";
  if (gameoverOverlay) gameoverOverlay.style.display = "none";
  if (clearOverlay) clearOverlay.style.display = "none";
}

function showClearScreen() {
  gameCleared = true;
  gameStarted = false;
  awaitingLevelStart = false;

  if (clearBody) clearBody.textContent = clearText;
  if (clearOverlay) clearOverlay.style.display = "flex";

  if (gameoverOverlay) gameoverOverlay.style.display = "none";
  if (startOverlay) startOverlay.style.display = "none";
}

function showStory(level) {
    if (!Stories[level]) return;
    storyTextDiv.textContent = Stories[level];
    
    // 顯示視窗並暫停
    if (storyModal) {
        storyModal.classList.remove('hidden');
        storyModal.style.display = 'flex';
    }
    isGamePaused = true;
    window.addEventListener('keydown', handleStoryEnter);
}

function handleStoryEnter(e) {
    if (e.code === 'Enter') closeStory();
}

function closeStory() {
    if (storyModal) {
        storyModal.classList.add('hidden');
        setTimeout(() => { storyModal.style.display = 'none'; }, 500);
    }
    window.removeEventListener('keydown', handleStoryEnter);
    
    isGamePaused = false;
    
    // ★★★ 新增：給予 2 秒的緩衝時間，這段時間不會觸發碰撞 ★★★
    resumeCooldown = 2.0; 
}

function updateUI() {
    const remaining = Math.max(0, Math.ceil(60 - gameTime));
    uiScore.innerText = `Score: ${score} | Time: ${remaining}s | Best: ${bestScore}`;
    uiCombo.innerText = `Combo x${combo}`;
}

// 一開始先顯示第一關封面
showLevelCover(0);

/* =========================================
   音效與場景系統
   ========================================= */
class SynthAudio {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    playTone(freq, type, duration, vol = 0.1) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playSwitch(){ this.playTone(300,"sine",0.1,0.05); }
    playHit(){ 
        this.playTone(880,"sine",0.1,0.1);
        setTimeout(()=>this.playTone(1760,"sine",0.2,0.05),50);
    }
    playExplode(){
        this.playTone(100,"sawtooth",0.3,0.1);
        this.playTone(50,"square",0.4,0.1);
    }
}
const audioSys = new SynthAudio();

function createCloudTexture(){
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    for(let i=0;i<120;i++){
        const x = Math.random()*512;
        const y = Math.random()*512;
        const r = Math.random()*80+60;
        const g = ctx.createRadialGradient(x,y,0, x,y,r);
        g.addColorStop(0,"rgba(255,255,255,0.12)");
        g.addColorStop(1,"rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x081e3e, 0.012);
scene.background = new THREE.Color(0x081e3e);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,4,12);
camera.lookAt(0,1,-10);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.45, 0.88);
composer.addPass(bloom);

scene.add(new THREE.AmbientLight(0x1c395f, 2.0));
const sunLight = new THREE.DirectionalLight(0xa48080, 0.6);
sunLight.position.set(0,6,-60);
scene.add(sunLight);

const decorSys = new DecorSystem(scene);

/* =========================================
   天空、雲、星與主角
   ========================================= */
const skyGeo = new THREE.SphereGeometry(600, 32, 32);
const skyMat = new THREE.ShaderMaterial({
    uniforms: {
        topColor:    { value: new THREE.Color(0x081e3e) },
        midColor:    { value: new THREE.Color(0x1c395f) },
        lowColor:    { value: new THREE.Color(0x555674) },
        bottomColor: { value: new THREE.Color(0xa48080) },
    },
    vertexShader: `
        varying vec3 vPos;
        void main(){
            vPos = (modelMatrix * vec4(position,1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vPos;
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor; uniform vec3 bottomColor;
        void main(){
            float h = normalize(vPos).y;
            vec3 col = bottomColor;
            if(h > -0.2 && h <= 0.1){ col = mix(bottomColor, lowColor, (h+0.2)/0.3); }
            else if(h > 0.1 && h <= 0.5){ col = mix(lowColor, midColor, (h-0.1)/0.4); }
            else if(h > 0.5){ col = mix(midColor, topColor, (h-0.5)/0.5); }
            gl_FragColor = vec4(col,1.0);
        }
    `,
    side: THREE.BackSide
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// 夕陽
const sunCore = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshBasicMaterial({color: 0xffc8a8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending}));
sunCore.position.set(0, 3, -260);
scene.add(sunCore);
const sunGlowMid = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshBasicMaterial({color: 0xf4d6c8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending}));
sunGlowMid.position.copy(sunCore.position);
scene.add(sunGlowMid);

// 雲海
const cloudTextureNear = createCloudTexture(); cloudTextureNear.repeat.set(8, 8);
const cloudTextureFar = createCloudTexture(); cloudTextureFar.repeat.set(5, 5);
const cloudGeo = new THREE.PlaneGeometry(900, 900);

const cloud1 = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({map: cloudTextureNear, color: 0x6675aa, transparent: true, opacity: 0.9, roughness: 0.9}));
cloud1.rotation.x = -Math.PI / 2; cloud1.position.y = -6; scene.add(cloud1);

const cloud2 = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({map: cloudTextureFar, color: 0x1c395f, transparent: true, opacity: 0.6, roughness: 1.0}));
cloud2.rotation.x = -Math.PI / 2; cloud2.position.y = -14; cloud2.scale.set(1.4, 1.4, 1.4); scene.add(cloud2);

const cloud3 = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({map: cloudTextureNear, color: 0x0b1220, transparent: true, opacity: 0.35, roughness: 1.0}));
cloud3.rotation.x = -Math.PI / 2; cloud3.position.y = -3; cloud3.scale.set(0.9, 0.9, 0.9); scene.add(cloud3);

// 星星
function createStarTexture() {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, "rgba(255,255,255,1.0)"); grad.addColorStop(0.4, "rgba(255,255,255,1.0)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.8)"); grad.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}
const starTexture = createStarTexture();
const starsGeo = new THREE.BufferGeometry(); const starsPos = [];
for (let i = 0; i < 2000; i++) starsPos.push((Math.random() - 0.5) * 900, Math.random() * 200 + 50, (Math.random() - 0.5) * 900);
starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({size: 5.0, map: starTexture, color: 0xdde6ff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false});
const stars = new THREE.Points(starsGeo, starsMat); scene.add(stars);

const bigStarsGeo = new THREE.BufferGeometry(); const bigStarsPos = [];
for (let i = 0; i < 120; i++) bigStarsPos.push((Math.random() - 0.5) * 600, Math.random() * 180 + 40, (Math.random() - 0.5) * 600);
bigStarsGeo.setAttribute("position", new THREE.Float32BufferAttribute(bigStarsPos, 3));
const bigStarsMat = new THREE.PointsMaterial({size: 10.0, map: starTexture, color: 0xffffff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false});
const bigStars = new THREE.Points(bigStarsGeo, bigStarsMat); scene.add(bigStars);

// 玩家與拖尾
const lanesX = [-4,0,4];
let currentLaneIndex = 1;
const player = new THREE.Mesh(new THREE.SphereGeometry(0.7,32,32), new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xccffff, emissiveIntensity:1.5}));
player.position.set(0,1,0); scene.add(player);

for(let i=0;i<8;i++){
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.4 - i*0.04, 16,16), new THREE.MeshBasicMaterial({color:0xaaddff, transparent:true, opacity:0.5 - i*0.05}));
    scene.add(t); trail.push(t);
}

/* =========================================
   遊戲核心邏輯：初始化與生成
   ========================================= */

// 重置關卡狀態 (包含故事球標記)
function initLevel(level) {
    levelStartTime = Date.now(); 
    hasStoryTriggered = false;    
    firstStoryOrbSpawned = false; 
    
    // ★★★ 新增重置 ★★★
    isStoryOrbOnScreen = false;
    resumeCooldown = 0;
}

function getAuraFallTime(levelIndex) {
    const speed = 5 + levelIndex * 2;
    const zSpeed = speed * 10;
    return 100 / zSpeed;
}

const levelConfig = [
    { spawnInterval: 1.2, darkChance: 0.0, beatInterval: 0.67, beatOffset: 1.0 },
    { spawnInterval: 0.9, darkChance: 0.3, beatInterval: 0.55, beatOffset: 1.0 },
    { spawnInterval: 0.6, darkChance: 0.5, beatInterval: 0.50, beatOffset: 1.0 }
];

const BGM_VOLUME = 0.7;
const bgmTracks = [
    new Howl({ src: ['./1.mp3'], loop: true, volume: 0 }),
    new Howl({ src: ['./2.mp3'], loop: true, volume: 0 }),
    new Howl({ src: ['./3.mp3'], loop: true, volume: 0 })
];
let currentBgmIndex = null;

function playBgmForLevel(levelIndex) {
    if (currentBgmIndex !== null) {
        const old = bgmTracks[currentBgmIndex];
        if (old && old.playing()) old.stop();
    }
    currentBgmIndex = levelIndex;
    const bgm = bgmTracks[levelIndex];
    if (!bgm) return;
    bgm.volume(0); bgm.play(); bgm.fade(0, BGM_VOLUME, 800);
}

function fadeOutBgm() {
    if (currentBgmIndex === null) return;
    const bgm = bgmTracks[currentBgmIndex];
    if (!bgm || !bgm.playing()) return;
    const fromVol = bgm.volume();
    bgm.fade(fromVol, 0, 800);
    setTimeout(() => { if (bgm.playing()) bgm.stop(); }, 800);
}

// 產生 Aura (核心邏輯：隨機 -> 強制)
// 產生 Aura (修正版：防止 material undefined 錯誤)
function spawnAura(){
    const cfg = levelConfig[currentLevel];
    const lane = Math.floor(Math.random()*3);
    
    // 預設隨機屬性
    let type = Math.random() < cfg.darkChance ? "dark" : "light";
    let isStoryOrb = false;

    // ★★★ 修正邏輯：限制場上同時只能有一顆故事球 ★★★
    // 條件：時間超過10秒 && 尚未觸發過故事 && 場上目前沒有故事球
    if (gameTime >= 10 && !hasStoryTriggered && !isStoryOrbOnScreen) {
        type = "light";
        isStoryOrb = true;
        isStoryOrbOnScreen = true; // 標記場上已有球
        firstStoryOrbSpawned = true;
    }

    const aura = new Aura(lanesX[lane], lane, type, 5 + currentLevel*2);

    if (isStoryOrb) {
        aura.isStoryOrb = true; 
        
        // 變色處理
        aura.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                // 建議複製材質以避免污染其他光球
                child.material = child.material.clone(); 
                if (child.material.color) child.material.color.setHex(0x9d7cf3);
                if (child.material.emissive) child.material.emissive.setHex(0x6644aa);
                child.material.emissiveIntensity = 2.0;
            }
        });
    }

    scene.add(aura.mesh);
    auras.push(aura);
}

function startLevel(level){
    currentLevel = level;
    score = 0;
    combo = 0;
    gameTime = 0;
    
    auras.forEach(a => scene.remove(a.mesh));
    auras = [];

    // ★★★ 初始化狀態 ★★★
    initLevel(level);

    beatIndex = 0;
    const cfg = levelConfig[level];
    const fallTime = getAuraFallTime(level);

    nextHitTime = cfg.beatOffset;
    nextSpawnTime = Math.max(0, nextHitTime - fallTime);

    if (gameStarted) playBgmForLevel(level);
}

function handleAuraHit(type){
    if(type==="light"){
        combo++;
        score += 10 + combo*2;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("bestScore", bestScore);
        }
        audioSys.playHit();
        player.material.emissiveIntensity = 4;
        setTimeout(()=>player.material.emissiveIntensity=1.5,100);
    } else {
        combo = 0;
        score = Math.max(0, score-20);
        audioSys.playExplode();
    }
}

/* =========================================
   輸入控制
   ========================================= */
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();

  if (gameCleared) {
    if (e.key === "Enter") {
      gameCleared = false;
      if (clearOverlay) clearOverlay.style.display = "none";
      showLevelCover(0);
    }
    return;
  }

  if (awaitingLevelStart) {
    if (e.key === "Enter") {
      awaitingLevelStart = false;
      gameStarted = true;
      if (startOverlay) startOverlay.style.display = "none";
      startLevel(pendingLevel);
    }
    return;
  }

  if (gameOver) {
    if (e.key === "Enter") {
      gameOver = false;
      if (gameoverOverlay) gameoverOverlay.style.display = "none";
      showLevelCover(currentLevel);
      return;
    }
    if (e.key === "1") { gameOver = false; showLevelCover(0); return; }
    if (e.key === "2") { gameOver = false; showLevelCover(1); return; }
    if (e.key === "3") { gameOver = false; showLevelCover(2); return; }
    return;
  }

  if (!gameStarted || isGamePaused) return;

  if (e.key === "ArrowLeft") {
    currentLaneIndex = Math.max(0, currentLaneIndex - 1);
    audioSys.playSwitch();
  } else if (e.key === "ArrowRight") {
    currentLaneIndex = Math.min(2, currentLaneIndex + 1);
    audioSys.playSwitch();
  }

}, { passive: false });


/* =========================================
   主動畫迴圈
   ========================================= */
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = performance.now() * 0.001;  

    // 1. 未開始時的動畫 (只跑背景)
    if (!gameStarted) {
        cloudTextureNear.offset.y -= 0.02 * delta; cloudTextureNear.offset.x += 0.005 * delta;
        cloudTextureFar.offset.y -= 0.008 * delta; cloudTextureFar.offset.x += 0.002 * delta;
        cloud1.position.y = -6 + Math.sin(time * 0.4) * 0.3;
        cloud2.position.y = -14 + Math.cos(time * 0.25) * 0.6;
        cloud3.position.y = -3 + Math.sin(time * 0.6 + 1.0) * 0.4;
        cloud3.rotation.z = Math.sin(time * 0.2) * 0.03;
        stars.rotation.y += 0.0008; stars.position.y = Math.sin(time * 0.2) * 2;
        composer.render();
        return;
    }

    // 2. 背景特效持續更新
    cloudTextureNear.offset.y -= 0.02 * delta; cloudTextureNear.offset.x += 0.005 * delta;
    cloudTextureFar.offset.y -= 0.008 * delta; cloudTextureFar.offset.x += 0.002 * delta;
    cloud1.position.y = -6 + Math.sin(time * 0.4) * 0.3;
    cloud2.position.y = -14 + Math.cos(time * 0.25) * 0.6;
    cloud3.position.y = -3 + Math.sin(time * 0.6 + 1.0) * 0.4;
    cloud3.rotation.z = Math.sin(time * 0.2) * 0.03;
    const noise = Math.sin(time * 2.0);        
    starsMat.opacity = 0.9 + noise * 0.1;   
    bigStarsMat.opacity = 0.95 + noise * 0.05; 
    stars.rotation.y += 0.0008; stars.position.y = Math.sin(time * 0.2) * 2;
    bigStars.rotation.y += 0.0005; bigStars.position.y = Math.sin(time * 0.3 + 1.5) * 3;

    // 3. 暫停檢查
    if (isGamePaused) { composer.render(); return; }

    // 4. 遊戲邏輯 (鏡頭搖晃)
    if (currentLevel === 1) {
        const shake = Math.sin(time * 0.8) * 0.05; camera.rotation.z = shake;
        cloud1.position.y = -6 + Math.sin(time * 0.6) * 0.15;
        cloud2.position.y = -14 + Math.sin(time * 0.5) * 0.25;
        cloud1.rotation.z = shake * 0.3; cloud2.rotation.z = shake * 0.4;
    } else if (currentLevel === 2) {
        const shake = Math.sin(time * 1.2) * 0.25; camera.rotation.z = shake;
        camera.position.y = 4 + Math.sin(time * 1.8) * 0.35;
        cloud1.rotation.z = shake * 0.9; cloud2.rotation.z = shake * 1.1;
        cloud1.position.y = -6 + Math.sin(time * 1.4) * 0.7;
        cloud2.position.y = -14 + Math.sin(time * 1.1) * 1.0;
    } else {
        camera.rotation.z = 0; camera.position.y = 4;
        cloud1.rotation.z = 0; cloud2.rotation.z = 0;
        cloud1.position.y = -6; cloud2.position.y = -14;
    }

    // 玩家平滑移動
    const tx = lanesX[currentLaneIndex];
    player.position.x += (tx - player.position.x) * 8 * delta;
    player.position.y = 1 + Math.sin(time * 2) * 0.3;

    // 拖尾更新
    trail[0].position.copy(player.position);
    for (let i = 1; i < trail.length; i++) trail[i].position.lerp(trail[i - 1].position, 0.4);

    gameTime += delta;
    decorSys.update(delta, currentLevel);
    
    // 生成光球 (60秒倒數)
    if (gameTime < 60) {
        const cfg = levelConfig[currentLevel];
        const fallTime = getAuraFallTime(currentLevel);
        if (beatIndex === 0 && nextSpawnTime === 0) {
            nextHitTime = cfg.beatOffset;
            nextSpawnTime = Math.max(0, nextHitTime - fallTime);
        }
        while (gameTime >= nextSpawnTime) {
            spawnAura();   
            beatIndex++;
            nextHitTime = cfg.beatOffset + beatIndex * cfg.beatInterval;
            nextSpawnTime = Math.max(0, nextHitTime - fallTime);
            if (nextHitTime > 60) break;
        }
    } else {
        // 遊戲結束
        if (!gameOver) {
            gameOver = true;
            gameStarted = false;
            if (typeof fadeOutBgm === "function") fadeOutBgm();
            if (currentLevel === 2) showClearScreen();
            else if (gameoverOverlay) gameoverOverlay.style.display = "flex";
        }
    }

    updateUI();

    // ★★★ 1. 更新無敵時間倒數 (放在迴圈外面) ★★★
    if (resumeCooldown > 0) {
        resumeCooldown -= delta;
    }

    // 碰撞判定迴圈
    for (let i = auras.length - 1; i >= 0; i--) {
        const a = auras[i];
        a.update(delta);

        const dx = Math.abs(a.mesh.position.x - player.position.x);
        const dz = Math.abs(a.mesh.position.z - player.position.z);
        
        // 判斷是否發生碰撞
        const isCollision = (dx < 1.5 && dz < 1.2);

        if (a.active && isCollision) {
            // --- 撞到球的邏輯 ---
            if (a.isStoryOrb) {
                // 如果還在冷卻時間 (剛按 Enter)，忽略碰撞讓球穿過去
                if (resumeCooldown > 0) {
                    // Do nothing
                } else {
                    // 正常觸發故事
                    hasStoryTriggered = true;
                    a.active = false;
                    isStoryOrbOnScreen = false; // ★ 吃到球了，釋放標記

                    scene.remove(a.mesh);
                    auras.splice(i, 1);
                    
                    showStory(currentLevel + 1);
                    continue; // 處理完畢，直接跳下一輪
                }
            } else {
                // 普通球 (Light / Dark)
                a.active = false;
                handleAuraHit(a.type);
            }
        }

        // --- 移除物件邏輯 (吃到 或 飛出畫面) ---
        // 假設 z > 20 代表已經飛到玩家背後很遠了
        if (!a.active || a.mesh.position.z > 20) {
            
            // ★ 如果這顆是「還沒吃到」就飛走的故事球，要重置標記，讓下一顆可以生成
            if (a.active && a.isStoryOrb) {
                isStoryOrbOnScreen = false; 
            }

            scene.remove(a.mesh);
            auras.splice(i, 1);
        }
    }
    composer.render();
}

animate();