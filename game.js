import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Aura } from "./aura.js";
let gameStarted = false;
let gameOver = false;

const startOverlay = document.getElementById("start-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");

const clearOverlay = document.getElementById("clear-overlay");
const clearBody = document.getElementById("clear-body");
const coverTitle = document.getElementById("cover-title");
const coverBody = document.getElementById("cover-body");
const coverHint = document.getElementById("cover-hint");

let awaitingLevelStart = true;   // 是否正在看關卡封面
let pendingLevel = 0;            // 封面要開始的關卡
let gameCleared = false;         // 第三關破關畫面
/* ========== 關卡封面文字 ========== */
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

const clearText = "光不會消失。\n它只是，\n在下一段旅程裡等你。";

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

// 一開始先顯示第一關封面
showLevelCover(0);


/* ========== 1. 音效系統 ========== */
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

/* ========== 2. 雲紋貼圖 ========== */
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
/* ========== 3. 場景初始化 ========== */

const scene = new THREE.Scene();

// Fog 使用你的 #081e3e
scene.fog = new THREE.FogExp2(0x081e3e, 0.012);

// 背景深藍 #081e3e
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

/* ========== 4. Bloom ========== */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));

const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.8,
    0.45,
    0.88
);
composer.addPass(bloom);

/* ========== 5. 光源 ========== */

// 環境光 → #1c395f
scene.add(new THREE.AmbientLight(0x1c395f, 2.0));

// 夕陽光 → #a48080（溫柔暖粉）
const sunLight = new THREE.DirectionalLight(0xa48080, 0.6);
sunLight.position.set(0,6,-60);
scene.add(sunLight);
/* ========== 6. 多層天空 Shader ========== */

const skyGeo = new THREE.SphereGeometry(600, 32, 32);
const skyMat = new THREE.ShaderMaterial({
    uniforms: {
        topColor:    { value: new THREE.Color(0x081e3e) }, // 深藍
        midColor:    { value: new THREE.Color(0x1c395f) }, // 藍
        lowColor:    { value: new THREE.Color(0x555674) }, // 紫灰
        bottomColor: { value: new THREE.Color(0xa48080) }, // 暖粉
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
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 lowColor;
        uniform vec3 bottomColor;

        void main(){
            float h = normalize(vPos).y;

            vec3 col = bottomColor;

            if(h > -0.2 && h <= 0.1){
                col = mix(bottomColor, lowColor, (h+0.2)/0.3);
            }
            else if(h > 0.1 && h <= 0.5){
                col = mix(lowColor, midColor, (h-0.1)/0.4);
            }
            else if(h > 0.5){
                col = mix(midColor, topColor, (h-0.5)/0.5);
            }

            gl_FragColor = vec4(col,1.0);
        }
    `,
    side: THREE.BackSide
});
scene.add(new THREE.Mesh(skyGeo, skyMat));
/* ========== 7. 夕陽（暖粉） ========== */

// 近層核心（略亮，但不要太大）
const sunCore = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshBasicMaterial({
        color: 0xffc8a8,       // 柔亮桃橘
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending
    })
);
sunCore.position.set(0, 3, -260);
scene.add(sunCore);

// 中層柔光（比核心大一圈，柔亮）
const sunGlowMid = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshBasicMaterial({
        color: 0xf4d6c8,       // 淡粉白
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending
    })
);
sunGlowMid.position.copy(sunCore.position);
scene.add(sunGlowMid);



/* ========== 8. 雲海（#555674 + #1c395f） ========== */

// ===== 多層雲海（前景＋遠景＋霧）=====

// 近景雲（細節比較多、動得比較快）
const cloudTextureNear = createCloudTexture();
cloudTextureNear.repeat.set(8, 8);

// 遠景雲（較大片、動得比較慢）
const cloudTextureFar = createCloudTexture();
cloudTextureFar.repeat.set(5, 5);

const cloudGeo = new THREE.PlaneGeometry(900, 900);

// 近景上層雲
const cloudMat1 = new THREE.MeshStandardMaterial({
    map: cloudTextureNear,
    color: 0x6675aa,
    transparent: true,
    opacity: 0.9,
    roughness: 0.9
});
const cloud1 = new THREE.Mesh(cloudGeo, cloudMat1);
cloud1.rotation.x = -Math.PI / 2;
cloud1.position.y = -6;
scene.add(cloud1);

// 遠景下層雲
const cloudMat2 = new THREE.MeshStandardMaterial({
    map: cloudTextureFar,
    color: 0x1c395f,
    transparent: true,
    opacity: 0.6,
    roughness: 1.0
});
const cloud2 = new THREE.Mesh(cloudGeo, cloudMat2);
cloud2.rotation.x = -Math.PI / 2;
cloud2.position.y = -14;
cloud2.scale.set(1.4, 1.4, 1.4);
scene.add(cloud2);

// 最上面的一層薄霧，讓畫面更柔和
const cloudMat3 = new THREE.MeshStandardMaterial({
    map: cloudTextureNear,
    color: 0x0b1220,
    transparent: true,
    opacity: 0.35,
    roughness: 1.0
});
const cloud3 = new THREE.Mesh(cloudGeo, cloudMat3);
cloud3.rotation.x = -Math.PI / 2;
cloud3.position.y = -3;
cloud3.scale.set(0.9, 0.9, 0.9);
scene.add(cloud3);


/* ========== 9. 星星（柔光發亮版） ========== */

// 產生柔光星點貼圖
function createStarTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
    grad.addColorStop(1.0, "rgba(255,255,255,0)");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
}

const starTexture = createStarTexture();

/* ===== 1. 遠處小星星（原本那一層）===== */

const starsGeo = new THREE.BufferGeometry();
const starsPos = [];

for (let i = 0; i < 2000; i++) {
    starsPos.push(
        (Math.random() - 0.5) * 900,
        Math.random() * 200 + 50,
        (Math.random() - 0.5) * 900
    );
}

starsGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starsPos, 3)
);

const starsMat = new THREE.PointsMaterial({
    size: 4.5,                  // ⭐ 原本 4.0 → 稍微放大
    map: starTexture,
    color: 0xdde6ff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

/* ===== 2. 近處大星星（新加一層）===== */

const bigStarsGeo = new THREE.BufferGeometry();
const bigStarsPos = [];

for (let i = 0; i < 120; i++) {   // 少量但每顆都大顆
    bigStarsPos.push(
        (Math.random() - 0.5) * 600,
        Math.random() * 180 + 40,
        (Math.random() - 0.5) * 600
    );
}

bigStarsGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(bigStarsPos, 3)
);

const bigStarsMat = new THREE.PointsMaterial({
    size: 10.0,                 // ⭐ 大顆星星
    map: starTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const bigStars = new THREE.Points(bigStarsGeo, bigStarsMat);
scene.add(bigStars);



/* ========== 10. 玩家 / 拖尾 ========== */

const lanesX = [-4,0,4];
let currentLaneIndex = 1;

const player = new THREE.Mesh(
    new THREE.SphereGeometry(0.7,32,32),
    new THREE.MeshStandardMaterial({
        color:0xffffff,
        emissive:0xccffff,
        emissiveIntensity:1.5
    })
);
player.position.set(0,1,0);
scene.add(player);

const trail = [];
for(let i=0;i<8;i++){
    const t = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 - i*0.04, 16,16),
        new THREE.MeshBasicMaterial({
            color:0xaaddff,
            transparent:true,
            opacity:0.5 - i*0.05
        })
    );
    scene.add(t);
    trail.push(t);
}

/* ========== 11. 關卡邏輯 ========== */

// 每一關：暗球機率 + BGM 節奏（可以之後微調）
const levelConfig = [
    // Level 1：假設 BGM 約 90 BPM → 一拍約 0.67 秒
    { spawnInterval: 1.2, darkChance: 0.0, beatInterval: 0.67, beatOffset: 1.0 },

    // Level 2：假設比較快，例如 110 BPM → 一拍約 0.55 秒
    { spawnInterval: 0.9, darkChance: 0.3, beatInterval: 0.55, beatOffset: 1.0 },

    // Level 3：再快一點，例如 120 BPM → 一拍 0.5 秒
    { spawnInterval: 0.6, darkChance: 0.5, beatInterval: 0.50, beatOffset: 1.0 }
];

/* ========== 背景音樂（每一關一首） ========== */

const BGM_VOLUME = 0.7;

// 依照你的檔名
const bgmTracks = [
    new Howl({ src: ['./1.mp3'], loop: true, volume: 0 }),
    new Howl({ src: ['./2.mp3'], loop: true, volume: 0 }),
    new Howl({ src: ['./3.mp3'], loop: true, volume: 0 })
];

let currentBgmIndex = null;

// 播放對應關卡的 BGM
function playBgmForLevel(levelIndex) {
    // 停掉上一首（如果有）
    if (currentBgmIndex !== null) {
        const old = bgmTracks[currentBgmIndex];
        if (old && old.playing()) {
            old.stop();
        }
    }

    currentBgmIndex = levelIndex;
    const bgm = bgmTracks[levelIndex];
    if (!bgm) return;

    bgm.volume(0);            // 從 0 開始
    bgm.play();               // 播放
    bgm.fade(0, BGM_VOLUME, 800); // 0.8 秒淡入
}

// 遊戲結束時把目前 BGM 淡出
function fadeOutBgm() {
    if (currentBgmIndex === null) return;

    const bgm = bgmTracks[currentBgmIndex];
    if (!bgm || !bgm.playing()) return;

    const fromVol = bgm.volume();
    bgm.fade(fromVol, 0, 800);    // 0.8 秒淡出
    setTimeout(() => {
        if (bgm.playing()) bgm.stop();
    }, 800);
}

let auras = [];
let score = 0;
let combo = 0;
let bestScore = parseInt(localStorage.getItem("bestScore") || "0", 10);
let gameTime = 0;
let spawnTimer = 0;   // 之後其實不會用到，但保留沒關係
let currentLevel = 0;

// ===== 節奏用變數 =====
let beatIndex = 0;     // 第幾個節奏點（0, 1, 2, 3, ...）
let nextHitTime = 0;   // 下一顆球「碰到主角」的時間（秒）
let nextSpawnTime = 0; // 下一顆球「生成」的時間（秒）

// 計算「球從生成位置掉到主角位置」需要多久（依關卡速度）
function getAuraFallTime(levelIndex) {
    const speed = 5 + levelIndex * 2;  // spawnAura 裡的速度設定
    const zSpeed = speed * 10;         // Aura.update 裡：this.speed * 10 * delta
    const startZ = -100;
    const targetZ = 0;                 // 主角在 z = 0
    const distance = targetZ - startZ; // 100
    return distance / zSpeed;          // time = distance / speed
}


const LEVEL_DURATION = 60;

const uiScore = document.getElementById("score-text");
const uiCombo = document.getElementById("combo-text");

function updateUI() {
    const remaining = Math.max(0, Math.ceil(LEVEL_DURATION - gameTime));

    uiScore.innerText =
        `Score: ${score} | Time: ${remaining}s | Best: ${bestScore}`;

    uiCombo.innerText = `Combo x${combo}`;
}


window.addEventListener("keydown", (e) => {

  // 防止方向鍵讓頁面滾動（有時會導致看起來沒反應）
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
  }

  // 破關畫面（第三關結束）
  if (gameCleared) {
    if (e.key === "Enter") {
      gameCleared = false;
      if (clearOverlay) clearOverlay.style.display = "none";
      showLevelCover(0);
    }
    return;
  }

  // 關卡封面：Enter 開始該關
  if (awaitingLevelStart) {
    if (e.key === "Enter") {
      awaitingLevelStart = false;
      gameStarted = true;
      if (startOverlay) startOverlay.style.display = "none";
      startLevel(pendingLevel);
    }
    return;
  }

  // 遊戲結束狀態（前兩關）
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

  // 正在遊戲中才允許移動
  if (!gameStarted) return;

  // ✅ 玩家移動（用 e.key 比較保險）
  // ✅ 玩家移動：改 currentLaneIndex（你的玩家平滑移動用的是這個）
if (e.key === "ArrowLeft") {
  currentLaneIndex = Math.max(0, currentLaneIndex - 1);
  audioSys.playSwitch();
} else if (e.key === "ArrowRight") {
  currentLaneIndex = Math.min(2, currentLaneIndex + 1);
  audioSys.playSwitch();
}

}, { passive: false });





/* ========== 13. Aura 生成 ========== */

function spawnAura(){
    const cfg = levelConfig[currentLevel];
    const lane = Math.floor(Math.random()*3);
    const type = Math.random() < cfg.darkChance ? "dark" : "light";

    const aura = new Aura(lanesX[lane], lane, type, 5 + currentLevel*2);
    scene.add(aura.mesh);
    auras.push(aura);
}

function startLevel(level){
    currentLevel = level;
    score = 0;
    combo = 0;
    gameTime = 0;
    spawnTimer = 0;

    auras.forEach(a => scene.remove(a.mesh));
    auras = [];

    // ===== 節奏系統初始化 =====
    beatIndex = 0;
    const cfg = levelConfig[level];
    const fallTime = getAuraFallTime(level);

    // 第一顆球「碰撞」的節奏點時間
    nextHitTime = cfg.beatOffset;

    // 球要提早 fallTime 秒生成，才能準時撞到主角
    nextSpawnTime = Math.max(0, nextHitTime - fallTime);

    // ===== 播放 BGM =====
    if (gameStarted) {
        playBgmForLevel(level);
    }
}

function restartToLevel(levelIndex) {
    gameOver = false;
    gameStarted = true;              // 直接進入遊戲狀態
    gameoverOverlay.style.display = "none";
    startLevel(levelIndex);          // 這邊會自動播該關 BGM
}


/* ========== 14. 碰撞 ========== */

function handleAuraHit(type){
    if(type==="light"){
        combo++;
        score += 10 + combo*2;
        // === 檢查是否刷新最高分 ===
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

/* ========== 15. 主動畫迴圈 ========== */

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = performance.now() * 0.001;  
    // === Enter 前：背景（雲海、星星）可動，但遊戲不更新 ===
if (!gameStarted) {
    // === 雲海動畫（標題畫面時也會動）===

    // 貼圖捲動：近景動快一點、遠景動慢一點
    cloudTextureNear.offset.y -= 0.02 * delta;
    cloudTextureNear.offset.x += 0.005 * delta;

    cloudTextureFar.offset.y -= 0.008 * delta;
    cloudTextureFar.offset.x += 0.002 * delta;

    // 雲層上下輕微起伏 + 一點點旋轉
    cloud1.position.y = -6 + Math.sin(time * 0.4) * 0.3;
    cloud2.position.y = -14 + Math.cos(time * 0.25) * 0.6;
    cloud3.position.y = -3 + Math.sin(time * 0.6 + 1.0) * 0.4;
    cloud3.rotation.z = Math.sin(time * 0.2) * 0.03;

    // 星星維持原本的
    stars.rotation.y += 0.0008;
    stars.position.y = Math.sin(time * 0.2) * 2;

    composer.render();
    return;
}




    /* ---------------------------------------------------
   雲海動畫（遊戲進行中）
--------------------------------------------------- */
cloudTextureNear.offset.y -= 0.02 * delta;
cloudTextureNear.offset.x += 0.005 * delta;

cloudTextureFar.offset.y -= 0.008 * delta;
cloudTextureFar.offset.x += 0.002 * delta;

cloud1.position.y = -6 + Math.sin(time * 0.4) * 0.3;
cloud2.position.y = -14 + Math.cos(time * 0.25) * 0.6;
cloud3.position.y = -3 + Math.sin(time * 0.6 + 1.0) * 0.4;
cloud3.rotation.z = Math.sin(time * 0.2) * 0.03;


    /* ---------------------------------------------------
       星星閃爍（整體呼吸式亮暗，不會爆錯）
    --------------------------------------------------- */
    const noise = Math.sin(time * 2.0);         // 呼吸強弱
    const flicker = 0.85 + noise * 0.15;        // 0.7–1.0
    starsMat.opacity = flicker;  
    
    // 大顆星星也一起閃，但幅度略不同
bigStarsMat.opacity = 0.6 + noise * 0.3;   // 0.3～0.9 左右


    /* ---------------------------------------------------
       星星輕微飄動（宇宙漂移感）
    --------------------------------------------------- */
    stars.rotation.y += 0.0008;                 // 慢速旋轉
    stars.position.y = Math.sin(time * 0.2) * 2;// 上下飄動

    bigStars.rotation.y += 0.0005;
bigStars.position.y = Math.sin(time * 0.3 + 1.5) * 3;

    /* ---------------------------------------------------
   Level 2 & Level 3 搖晃系統
--------------------------------------------------- */

// Level 2：小幅度輕微搖擺（偏安定）
if (currentLevel === 1) {

    const shake = Math.sin(time * 0.8) * 0.05;   // 速度慢 + 幅度小
    camera.rotation.z = shake;

    // 雲海輕微上下漂浮
    cloud1.position.y = -6 + Math.sin(time * 0.6) * 0.15;
    cloud2.position.y = -14 + Math.sin(time * 0.5) * 0.25;

    cloud1.rotation.z = shake * 0.3;
    cloud2.rotation.z = shake * 0.4;

// Level 3：暴風大搖晃（你原本要的強效果）
} else if (currentLevel === 2) {

    const shake = Math.sin(time * 1.2) * 0.25;   // 明顯傾斜
    camera.rotation.z = shake;

    camera.position.y = 4 + Math.sin(time * 1.8) * 0.35;

    cloud1.rotation.z = shake * 0.9;
    cloud2.rotation.z = shake * 1.1;

    cloud1.position.y = -6 + Math.sin(time * 1.4) * 0.7;
    cloud2.position.y = -14 + Math.sin(time * 1.1) * 1.0;

// Level 1：正常（無搖晃）
} else {
    camera.rotation.z = 0;
    camera.position.y = 4;

    cloud1.rotation.z = 0;
    cloud2.rotation.z = 0;

    cloud1.position.y = -6;
    cloud2.position.y = -14;
}


    /* ---------------------------------------------------
       玩家平滑移動
    --------------------------------------------------- */
    const tx = lanesX[currentLaneIndex];
    player.position.x += (tx - player.position.x) * 8 * delta;
    player.position.y = 1 + Math.sin(time * 2) * 0.3;

    /* ---------------------------------------------------
       拖尾更新
    --------------------------------------------------- */
    trail[0].position.copy(player.position);
    for (let i = 1; i < trail.length; i++) {
        trail[i].position.lerp(trail[i - 1].position, 0.4);
    }

    /* ---------------------------------------------------
   遊戲時間 & 產生球（節奏版）
--------------------------------------------------- */
gameTime += delta;

/* -----------------------------
   關卡時間內：照 BGM 節奏生成 Aura
------------------------------ */
if (gameTime < LEVEL_DURATION) {

    const cfg = levelConfig[currentLevel];
    const fallTime = getAuraFallTime(currentLevel);

    // 如果還沒設定過，就從第一個節奏點開始
    if (beatIndex === 0 && nextSpawnTime === 0) {
        nextHitTime = cfg.beatOffset;
        nextSpawnTime = Math.max(0, nextHitTime - fallTime);
    }

    // 有可能一個 frame 跨過兩個節奏點，用 while 確保不漏拍
    while (gameTime >= nextSpawnTime) {
        spawnAura();   // 生成一顆球（之後會在 nextHitTime 左右撞到主角）
        beatIndex++;

        // 下一顆球「預期碰撞」的時間＝起始 offset + 拍數 * 每拍秒數
        nextHitTime = cfg.beatOffset + beatIndex * cfg.beatInterval;
        nextSpawnTime = Math.max(0, nextHitTime - fallTime);

        // 超過關卡時間就不用再排新的球
        if (nextHitTime > LEVEL_DURATION) break;
    }

/* -----------------------------
   時間到：進入遊戲結束狀態
------------------------------ */
} else {

  if (!gameOver) {
    gameOver = true;
    gameStarted = false;

    // 若你有 BGM（可選）
    if (typeof fadeOutBgm === "function") fadeOutBgm();

    // 第三關結束 → 破關畫面；其他關 → 原本的遊戲結束畫面
    if (currentLevel === 2) {
      showClearScreen();
    } else {
      if (gameoverOverlay) gameoverOverlay.style.display = "flex";
    }
  }
}




updateUI();


    /* ---------------------------------------------------
       碰撞判定
    --------------------------------------------------- */
    for (let i = auras.length - 1; i >= 0; i--) {
        const a = auras[i];
        a.update(delta);

        const dx = Math.abs(a.mesh.position.x - player.position.x);
        const dz = Math.abs(a.mesh.position.z - player.position.z);

        if (a.active && dx < 1.5 && dz < 1.2) {
            a.active = false;
            handleAuraHit(a.type);
        }

        if (!a.active) {
            scene.remove(a.mesh);
            auras.splice(i, 1);
        }
    }

    /* ---------------------------------------------------
       渲染
    --------------------------------------------------- */
    composer.render();
}

animate();
