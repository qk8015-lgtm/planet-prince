import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Aura } from "./aura.js";
let gameStarted = false;
let gameOver = false;

const startOverlay = document.getElementById("start-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");

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

const cloudTexture = createCloudTexture();
cloudTexture.repeat.set(6,6);

const cloudGeo = new THREE.PlaneGeometry(900,900);

// 上層 #555674
const cloudMat1 = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    color: 0x555674,
    transparent: true,
    opacity: 0.8,
    roughness: 0.9
});
const cloud1 = new THREE.Mesh(cloudGeo, cloudMat1);
cloud1.rotation.x = -Math.PI/2;
cloud1.position.y = -6;
scene.add(cloud1);

// 下層 #1c395f
const cloudMat2 = cloudMat1.clone();
cloudMat2.color.set(0x1c395f);
cloudMat2.opacity = 0.55;

const cloud2 = new THREE.Mesh(cloudGeo, cloudMat2);
cloud2.rotation.x = -Math.PI/2;
cloud2.position.y = -14;
cloud2.scale.set(1.4,1.4,1.4);
scene.add(cloud2);

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

// 幾何結構
const starsGeo = new THREE.BufferGeometry();
const starsPos = [];

// 星星位置填入
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

// 材質
const starsMat = new THREE.PointsMaterial({
    size: 4.0,
    map: starTexture,
    color: 0xdde6ff,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

// 創建星星物件並加入場景
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);


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

const levelConfig = [
    { spawnInterval: 1.2, darkChance: 0.0 },
    { spawnInterval: 0.9, darkChance: 0.3 },
    { spawnInterval: 0.6, darkChance: 0.5 }
];

let auras = [];
let score = 0;
let combo = 0;
let bestScore = parseInt(localStorage.getItem("bestScore") || "0", 10);
let gameTime = 0;
let spawnTimer = 0;
let currentLevel = 0;

const LEVEL_DURATION = 60;

const uiScore = document.getElementById("score-text");
const uiCombo = document.getElementById("combo-text");

function updateUI() {
    const remaining = Math.max(0, Math.ceil(LEVEL_DURATION - gameTime));

    uiScore.innerText =
        `Score: ${score} | Time: ${remaining}s | Best: ${bestScore}`;

    uiCombo.innerText = `Combo x${combo}`;
}


/* ========== 12. 鍵盤控制 ========== */
window.addEventListener("keydown", (e) => {

    /* ============================
       遊戲結束狀態下的操作
    ============================ */
    if (gameOver) {

        // Enter → 重玩同關卡
        if (e.key === "Enter") {
            gameOver = false;
            gameStarted = true;
            gameoverOverlay.style.display = "none";
            startLevel(currentLevel);
            return;
        }

        // 1 / 2 / 3 → 切換不同關卡
        if (e.key === "1") {
            restartToLevel(0);
            return;
        }
        if (e.key === "2") {
            restartToLevel(1);
            return;
        }
        if (e.key === "3") {
            restartToLevel(2);
            return;
        }

        return; // gameOver 狀態結束
    }

    /* ============================
       初次開始遊戲：Enter 關閉開場畫面
    ============================ */
    if (e.key === "Enter" && !gameStarted) {
        gameStarted = true;
        startOverlay.style.display = "none";
        startLevel(0);
        return;
    }

    /* ============================
       還沒開始 → 禁止操作
    ============================ */
    if (!gameStarted) return;

    /* ============================
       正常遊戲操作
    ============================ */
    if (e.key === "ArrowLeft" && currentLaneIndex > 0) {
        currentLaneIndex--;
        audioSys.playSwitch();
    }

    if (e.key === "ArrowRight" && currentLaneIndex < lanesX.length - 1) {
        currentLaneIndex++;
        audioSys.playSwitch();
    }

    if (e.key === "1") startLevel(0);
    if (e.key === "2") startLevel(1);
    if (e.key === "3") startLevel(2);
});



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
}
function restartToLevel(levelIndex) {
    gameOver = false;
    gameoverOverlay.style.display = "none";
    startLevel(levelIndex);
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
    // === 背景仍然動 ===
    cloudTexture.offset.y -= 0.015 * delta;
    cloudTexture.offset.x += 0.004 * delta;

    stars.rotation.y += 0.0008;
    stars.position.y = Math.sin(time * 0.2) * 2;

    composer.render();
    return; // 不執行任何遊戲內容
}



    /* ---------------------------------------------------
       雲海動畫
    --------------------------------------------------- */
    cloudTexture.offset.y -= 0.015 * delta;
    cloudTexture.offset.x += 0.004 * delta;

    /* ---------------------------------------------------
       星星閃爍（整體呼吸式亮暗，不會爆錯）
    --------------------------------------------------- */
    const noise = Math.sin(time * 2.0);         // 呼吸強弱
    const flicker = 0.85 + noise * 0.15;        // 0.7–1.0
    starsMat.opacity = flicker;                 // ⭐ 安全且有效

    /* ---------------------------------------------------
       星星輕微飄動（宇宙漂移感）
    --------------------------------------------------- */
    stars.rotation.y += 0.0008;                 // 慢速旋轉
    stars.position.y = Math.sin(time * 0.2) * 2;// 上下飄動
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
       遊戲時間 & 產生球
    --------------------------------------------------- */
    gameTime += delta;
spawnTimer += delta;

/* -----------------------------
   關卡時間內：正常生成 Aura
------------------------------ */
if (gameTime < LEVEL_DURATION) {

    const cfg = levelConfig[currentLevel];
    if (spawnTimer > cfg.spawnInterval) {
        spawnTimer = 0;
        spawnAura();
    }

/* -----------------------------
   時間到：進入遊戲結束狀態
------------------------------ */
} else {

    if (!gameOver) {
        gameOver = true;
        gameStarted = false;                 // ❗ 停止遊戲邏輯運作
        gameoverOverlay.style.display = "flex"; // 顯示灰色遮罩
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
