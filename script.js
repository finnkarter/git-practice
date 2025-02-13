// script.js

// ======================
// 캔버스 및 배경 효과 설정
// ======================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const stars = [];
const starCount = 100;
for (let i = 0; i < starCount; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 1.5,
    alpha: Math.random(),
    speed: Math.random() * 0.5 + 0.2,
  });
}
function drawStars() {
  stars.forEach(star => {
    ctx.globalAlpha = star.alpha;
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
    star.y += star.speed;
    if (star.y > canvas.height) {
      star.y = 0;
      star.x = Math.random() * canvas.width;
    }
  });
  ctx.globalAlpha = 1;
}

// ======================
// UI 요소 및 변수
// ======================
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const multiplierEl = document.getElementById("multiplier");
const upgradeBtn = document.getElementById("upgradeBtn");
const upgradeCostEl = document.getElementById("upgradeCost");
const powerupStatusEl = document.getElementById("powerupStatus");
const bossHealthEl = document.getElementById("bossHealth");
const bossHealthBarEl = document.getElementById("bossHealthBar");
const darkModeButton = document.getElementById("darkModeButton");

// 클리커 및 추가 UI 요소
const autoClickerBtn = document.getElementById("autoClickerBtn");
const autoClickerStatusEl = document.getElementById("autoClickerStatus");
const activateAutoClickerBtn = document.getElementById("activateAutoClickerBtn");
const prestigeBtn = document.getElementById("prestigeBtn");
const prestigeStatusEl = document.getElementById("prestigeStatus");
const toggleFireModeBtn = document.getElementById("toggleFireModeBtn");
const changeTurretSkinBtn = document.getElementById("changeTurretSkinBtn");
// 업적 목록은 별도 페이지로 제공하고, 인게임 알림만 사용합니다.

let score = 0;
let wave = 1;
let turretDamage = 1;
let upgradeCost = 50;
let powerupActive = false;
let powerupTimer = 0;
let lastTime = 0;
let gameOver = false;
let weaponType = "normal"; // "normal" 또는 "spread"
let slowMotionActive = false;
let slowMotionTimer = 0;
let scoreMultiplier = 1.0;

let combo = 0;
let comboTimeout = null;
function updateComboTimer() {
  if (comboTimeout) clearTimeout(comboTimeout);
  comboTimeout = setTimeout(() => {
    combo = 0;
    updateUI();
  }, 3000);
}

// 클리커 관련 변수
let autoClickers = 0;
let autoClickerCost = 100;
let autoClickerActive = false; // 오토 클릭기 활성화 여부
let prestigePoints = 0;
let prestigeThreshold = 1000;
let prestigeMultiplier = 1;

// ======================
// 업적 시스템 (인게임 알림 전용)
// ======================
const achievements = [
  { id: "first_blood", description: "First Blood - Score 10+", achieved: false, condition: () => score >= 10 },
  { id: "enemy_slayer", description: "Enemy Slayer - Destroy 50 enemies", achieved: false, count: 0, condition: function() { return this.count >= 50; } },
  { id: "turret_master", description: "Turret Master - Upgrade turret 10 times", achieved: false, count: 0, condition: function() { return this.count >= 10; } },
];
function updateAchievements() {
  achievements.forEach(ach => {
    if (!ach.achieved && ach.condition.call(ach)) {
      ach.achieved = true;
      showAchievementNotification("Achievement Unlocked: " + ach.description);
    }
  });
}
function showAchievementNotification(text) {
  const notif = document.createElement("div");
  notif.className = "achievement-notification";
  notif.textContent = text;
  document.body.appendChild(notif);
  setTimeout(() => { notif.classList.add("fade-out"); }, 2000);
  setTimeout(() => { document.body.removeChild(notif); }, 3000);
}

// ======================
// 플레이어 터렛 (고정)
// ======================
const turret = {
  x: canvas.width / 2,
  y: canvas.height - 40,
  angle: -Math.PI / 2,
  size: 40,
};

const projectiles = [];
const enemies = [];
const powerups = [];

// ======================
// 오디오 효과 (파일 경로는 실제 리소스에 맞게 설정)
// ======================
const shootSound = new Audio('audio/shoot.mp3');
const explosionSound = new Audio('audio/explosion.mp3');
const upgradeSound = new Audio('audio/upgrade.mp3');

// ======================
// 클래스 정의
// ======================
class Projectile {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.speed = 7;
    this.angle = angle;
  }
  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }
  draw() {
    ctx.beginPath();
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    grad.addColorStop(0, "#FFEB3B");
    grad.addColorStop(1, "#FFC107");
    ctx.fillStyle = grad;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Enemy {
  constructor(x, y, radius, speed, hp, isBoss = false, hasShield = false) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speed = speed;
    this.hp = hp;
    this.maxHp = hp;
    this.isBoss = isBoss;
    this.hasShield = hasShield;
  }
  update(deltaTime) {
    const factor = slowMotionActive ? 0.5 : 1;
    this.y += this.speed * deltaTime * factor;
    if (!this.isBoss) {
      this.x += Math.sin(this.y / 20) * 0.5 * factor;
    }
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    const grad = ctx.createRadialGradient(0, 0, this.radius / 2, 0, 0, this.radius);
    grad.addColorStop(0, this.isBoss ? "#FF7043" : "#66BB6A");
    grad.addColorStop(1, this.isBoss ? "#D84315" : "#388E3C");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.hasShield) {
      ctx.strokeStyle = "#00BCD4";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 체력바 그리기
    ctx.fillStyle = "#f44336";
    const barWidth = this.radius * 2;
    const barHeight = 5;
    const hpPercent = this.hp / this.maxHp;
    ctx.fillRect(-this.radius, -this.radius - 10, barWidth * hpPercent, barHeight);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(-this.radius, -this.radius - 10, barWidth, barHeight);
    ctx.restore();
  }
}

class Powerup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 20;
    this.duration = 5000;
    this.type = Math.random() < 0.7 ? "damage" : "slow";
  }
  update(deltaTime) {
    this.y += 0.5 * deltaTime;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "16px Roboto";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.type === "damage" ? "x2" : "Slow", 0, 0);
    ctx.restore();
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = Math.random() * 3 + 2;
    this.speed = Math.random() * 2 + 1;
    this.angle = Math.random() * Math.PI * 2;
    this.alpha = 1;
  }
  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.alpha -= 0.02;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.fillStyle = "#FF5722";
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
const particles = [];
function createParticleExplosion(x, y) {
  for (let i = 0; i < 20; i++) {
    particles.push(new Particle(x, y));
  }
  explosionSound.play();
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].alpha <= 0) {
      particles.splice(i, 1);
    }
  }
  requestAnimationFrame(updateParticles);
}
updateParticles();

// ======================
// 오토 클릭기: 활성화 시 1초마다 자동 발사 및 점수 증가
// ======================
setInterval(() => {
  if (autoClickerActive) {
    fireProjectileWithAngle(turret.angle);
    score += Math.floor(autoClickers * prestigeMultiplier);
    updateUI();
  }
}, 1000);

// ======================
// 웨이브 및 적 스폰
// ======================
function startWave() {
  enemies.length = 0;
  const enemyCount = 5 + wave * 2;
  for (let i = 0; i < enemyCount; i++) {
    const radius = 20;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -Math.random() * 200;
    const speed = 0.5 + Math.random() * (wave * 0.1);
    const hp = wave >= 5 ? 5 : 3;
    const isBoss = (wave % 5 === 0 && i === 0);
    const hasShield = (wave % 7 === 0 && Math.random() < 0.5);
    enemies.push(new Enemy(x, y, isBoss ? radius * 1.5 : radius, speed, isBoss ? hp * 3 : hp, isBoss, hasShield));
  }
  if (Math.random() < 0.3) {
    const puX = Math.random() * (canvas.width - 40) + 20;
    const puY = Math.random() * (canvas.height / 2);
    powerups.push(new Powerup(puX, puY));
  }
}
setInterval(() => {
  if (enemies.length === 0 && !gameOver) {
    wave++;
    startWave();
    combo = 0;
  }
}, 1000);

// ======================
// 게임 루프 및 업데이트
// ======================
function gameLoop(timeStamp) {
  if (gameOver) return;
  const deltaTime = (timeStamp - lastTime) / 16.67;
  lastTime = timeStamp;
  
  drawStars();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();
  
  drawTurret();
  
  // 발사체 업데이트 (역순 순회)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.update();
    p.draw();
    if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
      projectiles.splice(i, 1);
    }
  }
  
  // 적 업데이트 (역순 순회)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(deltaTime * (slowMotionActive ? 0.5 : 1));
    enemy.draw();
    const distToTurret = Math.hypot(enemy.x - turret.x, enemy.y - turret.y);
    if (distToTurret - enemy.radius - turret.size / 2 < 0) {
      endGame();
      return;
    }
    // 발사체와 적 충돌 검사
    for (let j = projectiles.length - 1; j >= 0; j--) {
      const p = projectiles[j];
      const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (dist < enemy.radius + p.radius) {
        if (enemy.hasShield) {
          enemy.hasShield = false;
        } else {
          enemy.hp -= turretDamage;
        }
        projectiles.splice(j, 1);
        if (enemy.hp <= 0) {
          score += enemy.isBoss ? 100 : 20;
          createParticleExplosion(enemy.x, enemy.y);
          enemies.splice(i, 1);
          combo++;
          updateComboTimer();
          // 업적: 적 제거 카운트 업데이트
          let enemyAch = achievements.find(a => a.id === "enemy_slayer");
          if (enemyAch) enemyAch.count = (enemyAch.count || 0) + 1;
          updateAchievements();
          break;
        }
      }
    }
  }
  
  // 파워업 업데이트
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.update(deltaTime);
    pu.draw();
    const d = Math.hypot(pu.x - turret.x, pu.y - turret.y);
    if (d < pu.size + turret.size / 2) {
      activatePowerup(pu.type);
      powerups.splice(i, 1);
    }
  }
  
  if (slowMotionActive) {
    slowMotionTimer -= deltaTime * 16.67;
    if (slowMotionTimer <= 0) slowMotionActive = false;
  }
  
  updateUI();
  
  const bossEnemy = enemies.find(e => e.isBoss);
  if (bossEnemy) {
    bossHealthBarEl.style.display = "block";
    bossHealthEl.textContent = Math.floor(bossEnemy.hp);
  } else {
    bossHealthBarEl.style.display = "none";
  }
  
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

// ======================
// 터렛 스킨 관련
// ======================
const turretSkins = [
  { gradient: ["#fff", "#aaa"] },
  { gradient: ["#FFD700", "#FFA500"] },
  { gradient: ["#00FF7F", "#32CD32"] },
  { gradient: ["#87CEFA", "#4682B4"] },
];
let currentTurretSkinIndex = 0;

// ======================
// 터렛 그리기 (터렛 스킨 적용)
// ======================
function drawTurret() {
  ctx.save();
  ctx.translate(turret.x, turret.y);
  ctx.rotate(turret.angle);
  const skin = turretSkins[currentTurretSkinIndex];
  const grad = ctx.createLinearGradient(-10, -20, 10, 20);
  grad.addColorStop(0, skin.gradient[0]);
  grad.addColorStop(1, skin.gradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -20, 20, 40);
  ctx.beginPath();
  ctx.arc(0, 0, turret.size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#555";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();
}

// ======================
// 발사체 생성 함수 (터렛 좌표에서 발사)
// ======================
function fireProjectileWithAngle(angle) {
  const projectile = new Projectile(turret.x, turret.y, angle);
  projectiles.push(projectile);
  shootSound.play();
}

// ======================
// 마우스 클릭 이벤트: 터렛 조준 및 발사
// ======================
canvas.addEventListener("click", (e) => {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  turret.angle = Math.atan2(clickY - turret.y, clickX - turret.x);
  if (weaponType === "spread") {
    const offsets = [-10, 0, 10];
    offsets.forEach(offset => {
      const angle = turret.angle + offset * Math.PI / 180;
      fireProjectileWithAngle(angle);
    });
  } else {
    fireProjectileWithAngle(turret.angle);
  }
});

// ======================
// 마우스 움직임 이벤트: 터렛이 마우스 방향을 향하도록 함
// ======================
canvas.addEventListener("mousemove", (e) => {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  turret.angle = Math.atan2(mouseY - turret.y, mouseX - turret.x);
});

// ======================
// 파워업 활성화 (타입에 따라 작동)
// ======================
function activatePowerup(type) {
  if (type === "damage") {
    if (!powerupActive) {
      powerupActive = true;
      turretDamage *= 2;
      updateUI();
      setTimeout(() => {
        turretDamage = Math.floor(turretDamage / 2);
        powerupActive = false;
        updateUI();
      }, 5000);
    }
  } else if (type === "slow") {
    if (!slowMotionActive) {
      slowMotionActive = true;
      slowMotionTimer = 5000;
      updateUI();
    }
  }
}

// ======================
// 폭탄 능력: 스페이스바 누르면 모든 적 제거 및 보너스 점수
// ======================
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !gameOver) {
    enemies.splice(0, enemies.length);
    score += 100;
    updateUI();
    createParticleExplosion(canvas.width / 2, canvas.height / 2);
  }
});

// ======================
// 클리커 게임 추가 요소: 오토 클릭기 구매, 활성화 및 프레스티지
// ======================

// 오토 클릭기 구매
autoClickerBtn.addEventListener("click", () => {
  if (score >= autoClickerCost) {
    score -= autoClickerCost;
    autoClickers++;
    autoClickerCost = Math.floor(autoClickerCost * 1.5);
    updateUI();
  } else {
    alert("Not enough score for Auto Clicker!");
  }
});

// 오토 클릭기 활성화 버튼
activateAutoClickerBtn.addEventListener("click", () => {
  if (autoClickers > 0) {
    autoClickerActive = true;
  } else {
    alert("Please purchase an Auto Clicker first!");
  }
});

// 프레스티지
prestigeBtn.addEventListener("click", () => {
  if (score >= prestigeThreshold) {
    prestigePoints++;
    prestigeMultiplier *= 1.1;
    score = 0;
    wave = 1;
    turretDamage = 1;
    autoClickers = 0;
    autoClickerCost = 100;
    upgradeCost = 50;
    enemies.length = 0;
    updateUI();
    alert("Prestige activated! Your multiplier increased.");
  } else {
    alert("Reach " + prestigeThreshold + " score to Prestige!");
  }
});

// ======================
// 추가: 발사 모드 토글 버튼
// ======================
toggleFireModeBtn.addEventListener("click", () => {
  if (weaponType === "normal") {
    weaponType = "spread";
    toggleFireModeBtn.textContent = "Fire Mode: Spread";
  } else {
    weaponType = "normal";
    toggleFireModeBtn.textContent = "Fire Mode: Normal";
  }
});

// ======================
// 추가: 터렛 스킨 변경 버튼
// ======================
changeTurretSkinBtn.addEventListener("click", () => {
  currentTurretSkinIndex = (currentTurretSkinIndex + 1) % turretSkins.length;
  showAchievementNotification("Turret Skin Changed!");
});

// ======================
// 다크 모드 토글
// ======================
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  darkModeButton.textContent = document.body.classList.contains("dark-mode")
    ? "라이트 모드"
    : "다크 모드";
}
darkModeButton.addEventListener("click", toggleDarkMode);

// ======================
// 업그레이드 터렛 (데미지 증가)
// ======================
upgradeBtn.addEventListener("click", () => {
  if (score >= upgradeCost) {
    score -= upgradeCost;
    turretDamage++;
    let turretAch = achievements.find(a => a.id === "turret_master");
    if (turretAch) turretAch.count = (turretAch.count || 0) + 1;
    upgradeCost = Math.floor(upgradeCost * 1.5);
    updateUI();
    upgradeSound.play();
    updateAchievements();
  } else {
    alert("Not enough score for upgrade!");
  }
});

// ======================
// UI 업데이트 함수
// ======================
function updateUI() {
  scoreMultiplier = 1 + combo * 0.1;
  scoreEl.textContent = "Score: " + score;
  waveEl.textContent = "Wave: " + wave;
  upgradeCostEl.textContent = "Cost: " + upgradeCost;
  powerupStatusEl.textContent = powerupActive ? "Damage Boost" : (slowMotionActive ? "Slow Time" : "None");
  multiplierEl.textContent = "Multiplier: x" + scoreMultiplier.toFixed(1);
  
  autoClickerStatusEl.textContent = "Auto Clickers: " + autoClickers + " (Cost: " + autoClickerCost + ")";
  prestigeStatusEl.textContent = "Prestige Points: " + prestigePoints + " (Multiplier: x" + prestigeMultiplier.toFixed(2) + ")";
  updateAchievements();
}

// ======================
// 게임 종료 처리
// ======================
function endGame() {
  gameOver = true;
  alert("Game Over! Final Score: " + score);
}
