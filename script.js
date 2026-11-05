const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const p1HealthEl = document.getElementById('p1-health');
const p2HealthEl = document.getElementById('p2-health');

const groundY = 430;
const gravity = 0.8;
const floorHeight = 80;

const keys = {};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

class Fighter {
  constructor(x, color, controls, facing = 1) {
    this.x = x;
    this.y = groundY;
    this.width = 72;
    this.height = 110;
    this.vx = 0;
    this.vy = 0;
    this.speed = 5;
    this.jumpStrength = 15;
    this.color = color;
    this.controls = controls;
    this.facing = facing;
    this.health = 100;
    this.attackCooldown = 0;
    this.hitFlash = 0;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackRange = 75;
    this.attackDamage = 12;
  }

  update(opponent) {
    const left = this.controls.left;
    const right = this.controls.right;
    const jump = this.controls.jump;
    const attack = this.controls.attack;

    if (keys[left]) this.vx = -this.speed;
    else if (keys[right]) this.vx = this.speed;
    else this.vx *= 0.7;

    if (Math.abs(this.vx) < 0.4) this.vx = 0;

    if (keys[jump] && this.y >= groundY - 1) {
      this.vy = -this.jumpStrength;
    }

    if (keys[attack] && this.attackCooldown <= 0) {
      this.startAttack();
    }

    this.x += this.vx;
    this.x = clamp(this.x, 40, canvas.width - 110);

    this.vy += gravity;
    this.y += this.vy;

    if (this.y > groundY) {
      this.y = groundY;
      this.vy = 0;
    }

    if (this.attackCooldown > 0) this.attackCooldown -= 1;
    if (this.hitFlash > 0) this.hitFlash -= 1;
    if (this.isAttacking) {
      this.attackTimer -= 1;
      if (this.attackTimer <= 0) this.isAttacking = false;
    }

    const dx = opponent.x - this.x;
    this.facing = dx >= 0 ? 1 : -1;

    this.handleAttackHit(opponent);
  }

  startAttack() {
    this.isAttacking = true;
    this.attackTimer = 18;
    this.attackCooldown = 22;
  }

  handleAttackHit(opponent) {
    if (!this.isAttacking) return;

    const reach = this.attackRange;
    const distance = Math.abs(opponent.x - this.x);
    const verticalOverlap = Math.abs(opponent.y - this.y) < 90;
    const facingCorrect = (this.facing === 1 && opponent.x >= this.x) || (this.facing === -1 && opponent.x <= this.x);

    if (distance < reach && verticalOverlap && facingCorrect && opponent.hitFlash <= 0) {
      opponent.health = clamp(opponent.health - this.attackDamage, 0, 100);
      opponent.hitFlash = 10;
      opponent.vx += this.facing * 8;
      statusEl.textContent = this.color === 'blue' ? 'Player 1 lands a hit!' : 'CPU lands a hit!';
    }
  }

  draw() {
    const bodyX = this.x;
    const bodyY = this.y;

    ctx.save();
    ctx.translate(bodyX + this.width / 2, bodyY + this.height / 2);
    ctx.scale(this.facing, 1);
    ctx.translate(-(bodyX + this.width / 2), -(bodyY + this.height / 2));

    const flashColor = this.hitFlash > 0 ? '#fff' : this.color;

    ctx.fillStyle = flashColor;
    ctx.fillRect(bodyX + 14, bodyY + 16, 44, 52);
    ctx.fillRect(bodyX + 8, bodyY + 30, 14, 38);
    ctx.fillRect(bodyX + 50, bodyY + 30, 14, 38);
    ctx.fillRect(bodyX + 18, bodyY + 68, 18, 36);
    ctx.fillRect(bodyX + 34, bodyY + 68, 18, 36);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bodyX + 6, bodyY + 8, 18, 18);
    ctx.fillRect(bodyX + 48, bodyY + 8, 18, 18);

    if (this.isAttacking) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      const punchX = this.facing === 1 ? bodyX + this.width : bodyX - 22;
      ctx.fillRect(punchX, bodyY + 28, 22, 18);
    }

    ctx.restore();
  }
}

const p1 = new Fighter(180, 'blue', {
  left: 'a',
  right: 'd',
  jump: 'w',
  attack: 'f',
});

const p2 = new Fighter(660, 'red', {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  attack: '/',
});

let timer = 60;
let isGameOver = false;
let lastTime = 0;

function updateHUD() {
  p1HealthEl.style.width = `${p1.health}%`;
  p2HealthEl.style.width = `${p2.health}%`;
  timerEl.textContent = timer;
}

function gameOver(winner) {
  isGameOver = true;
  statusEl.textContent = winner ? `${winner} wins!` : 'Draw!';
  setTimeout(() => {
    p1.health = 100;
    p2.health = 100;
    timer = 60;
    isGameOver = false;
    statusEl.textContent = 'FIGHT!';
    updateHUD();
  }, 1800);
}

function updateAI() {
  if (isGameOver) return;

  const dx = p1.x - p2.x;
  const dist = Math.abs(dx);

  if (dist > 120) {
    if (dx > 0) keys.ArrowRight = true;
    else keys.ArrowLeft = true;
  } else {
    delete keys.ArrowRight;
    delete keys.ArrowLeft;
  }

  if (p2.y >= groundY && Math.random() < 0.025) {
    keys.ArrowUp = true;
  }

  if (dist < 90 && Math.random() < 0.06) {
    keys['/'] = true;
  }
}

function update() {
  if (isGameOver) return;

  p1.update(p2);
  p2.update(p1);

  if (p1.health <= 0 || p2.health <= 0) {
    const winner = p1.health > p2.health ? 'Player 1' : p2.health > p1.health ? 'Player 2' : null;
    gameOver(winner);
  }

  updateAI();
  updateHUD();
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(0, 0, canvas.width, 300);

  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(0, 300, canvas.width, 60);

  ctx.fillStyle = '#166534';
  ctx.fillRect(0, 360, canvas.width, floorHeight);

  ctx.fillStyle = '#334155';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(80 + i * 90, 200 + (i % 2) * 12, 26, 26);
  }

  p1.draw();
  p2.draw();
}

function loop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if (!isGameOver && delta > 0) {
    if (Math.floor(timestamp / 1000) !== Math.floor((timestamp - delta) / 1000)) {
      timer = Math.max(0, timer - 1);
    }

    if (timer <= 0) {
      const winner = p1.health === p2.health ? null : p1.health > p2.health ? 'Player 1' : 'Player 2';
      gameOver(winner);
    }
  }

  update();
  drawArena();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = true;
  if (key === '/') keys['/'] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(key)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  delete keys[key];
  if (key === '/') delete keys['/'];
});

updateHUD();
requestAnimationFrame(loop);
