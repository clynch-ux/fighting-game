const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const p1HealthEl = document.getElementById('p1-health');
const p2HealthEl = document.getElementById('p2-health');
const playerChoice = document.getElementById('player-choice');
const cpuChoice = document.getElementById('cpu-choice');
const playerStats = document.getElementById('player-stats');
const cpuStats = document.getElementById('cpu-stats');
const groundY = 430;
const gravity = 0.8;
const keys = {};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Ratings affect movement speed, attack damage, blocking strength, and jump height.
const roster = {
  swift: { name: 'Swift', color: '#38bdf8', speed: 6.4, power: 8, guard: 5, jump: 16 },
  titan: { name: 'Titan', color: '#f97316', speed: 3.8, power: 16, guard: 9, jump: 12 },
  balanced: { name: 'Balanced', color: '#a78bfa', speed: 5, power: 12, guard: 7, jump: 14 },
  guardian: { name: 'Guardian', color: '#34d399', speed: 4.4, power: 10, guard: 10, jump: 13 }
};

function ratingsHTML(character) {
  const rating = (value) => `${value}/10`;
  return `<span class="stat">Speed<strong>${rating(Math.round(character.speed * 1.5))}</strong></span>
    <span class="stat">Power<strong>${rating(Math.round(character.power / 1.6))}</strong></span>
    <span class="stat">Guard<strong>${rating(character.guard)}</strong></span>
    <span class="stat">Jump<strong>${rating(Math.round(character.jump / 1.8))}</strong></span>`;
}

for (const [id, character] of Object.entries(roster)) {
  playerChoice.add(new Option(character.name, id));
  cpuChoice.add(new Option(character.name, id));
}
cpuChoice.value = 'titan';

class Fighter {
  constructor(x, characterId, controls, isCPU = false) {
    this.startX = x;
    this.controls = controls;
    this.isCPU = isCPU;
    this.x = x;
    this.y = groundY;
    this.width = 72;
    this.height = 110;
    this.vx = 0;
    this.vy = 0;
    this.health = 100;
    this.hitFlash = 0;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.hitThisAttack = false;
    this.blocking = false;
    this.setCharacter(characterId);
  }

  setCharacter(characterId) {
    this.character = roster[characterId];
    this.color = this.character.color;
    this.speed = this.character.speed;
    this.jumpStrength = this.character.jump;
    this.attackDamage = this.character.power;
    this.guard = this.character.guard;
  }

  reset(x = this.startX) {
    this.x = x;
    this.y = groundY;
    this.vx = 0;
    this.vy = 0;
    this.health = 100;
    this.hitFlash = 0;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.hitThisAttack = false;
    this.blocking = false;
  }

  update(opponent, input) {
    this.facing = opponent.x >= this.x ? 1 : -1;
    this.blocking = Boolean(input.block) && this.y >= groundY - 1;

    if (!this.blocking) {
      if (input.left) this.vx = -this.speed;
      else if (input.right) this.vx = this.speed;
      else this.vx *= 0.72;
      if (Math.abs(this.vx) < 0.35) this.vx = 0;

      if (input.jump && this.y >= groundY - 1) this.vy = -this.jumpStrength;
      if (input.attack && this.attackCooldown <= 0) this.startAttack();
    } else {
      this.vx *= 0.55;
    }

    this.x = clamp(this.x + this.vx, 35, canvas.width - 105);
    this.vy += gravity;
    this.y += this.vy;
    if (this.y > groundY) { this.y = groundY; this.vy = 0; }

    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.isAttacking && --this.attackTimer <= 0) this.isAttacking = false;
    this.handleAttackHit(opponent);
  }

  startAttack() {
    this.isAttacking = true;
    this.attackTimer = 16;
    this.attackCooldown = 28;
    this.hitThisAttack = false;
  }

  handleAttackHit(opponent) {
    if (!this.isAttacking || this.hitThisAttack) return;
    const distance = Math.abs((opponent.x + opponent.width / 2) - (this.x + this.width / 2));
    const verticalOverlap = Math.abs(opponent.y - this.y) < 85;
    const facingCorrect = this.facing === 1 ? opponent.x > this.x : opponent.x < this.x;
    if (distance > 82 || !verticalOverlap || !facingCorrect) return;

    this.hitThisAttack = true;
    const damage = opponent.blocking
      ? Math.max(1, Math.round(this.attackDamage * (1 - opponent.guard * 0.075)))
      : this.attackDamage;
    opponent.health = clamp(opponent.health - damage, 0, 100);
    opponent.hitFlash = opponent.blocking ? 4 : 10;
    opponent.vx += this.facing * (opponent.blocking ? 2 : 7);
    statusEl.textContent = opponent.blocking ? `${opponent.character.name} blocks!` : `${this.character.name} lands a hit!`;
  }

  draw() {
    const x = this.x;
    const y = this.y;
    ctx.save();
    ctx.translate(x + this.width / 2, y + this.height / 2);
    ctx.scale(this.facing, 1);
    ctx.translate(-(x + this.width / 2), -(y + this.height / 2));

    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
    ctx.fillRect(x + 14, y + 16, 44, 52);
    ctx.fillRect(x + 8, y + 30, 14, 38);
    ctx.fillRect(x + 50, y + 30, 14, 38);
    ctx.fillRect(x + 18, y + 68, 18, 36);
    ctx.fillRect(x + 34, y + 68, 18, 36);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 6, y + 8, 18, 18);
    ctx.fillRect(x + 48, y + 8, 18, 18);

    if (this.blocking) {
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x + this.width / 2, y + 48, 42, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
    if (this.isAttacking) {
      ctx.fillStyle = '#fff3a3';
      ctx.fillRect(x + this.width - 2, y + 28, 24, 18);
    }
    ctx.restore();
  }
}

const p1 = new Fighter(180, playerChoice.value, { left: 'a', right: 'd', jump: 'w', attack: 'f', block: 's' });
const p2 = new Fighter(660, cpuChoice.value, {}, true);
let timer = 60;
let isGameOver = false;
let lastTime = 0;
let cpuJumpWait = 0;
let cpuAttackWait = 0;

function updateSelection() {
  playerStats.innerHTML = ratingsHTML(roster[playerChoice.value]);
  cpuStats.innerHTML = ratingsHTML(roster[cpuChoice.value]);
  document.getElementById('player-name').textContent = `Player 1 — ${roster[playerChoice.value].name}`;
  document.getElementById('cpu-name').textContent = `CPU — ${roster[cpuChoice.value].name}`;
}

function resetRound() {
  p1.setCharacter(playerChoice.value);
  p2.setCharacter(cpuChoice.value);
  p1.reset(180);
  p2.reset(660);
  timer = 60;
  isGameOver = false;
  cpuJumpWait = 0;
  cpuAttackWait = 0;
  statusEl.textContent = 'FIGHT!';
  updateHUD();
}

function updateHUD() {
  p1HealthEl.style.width = `${p1.health}%`;
  p2HealthEl.style.width = `${p2.health}%`;
  timerEl.textContent = Math.ceil(timer);
}

function gameOver() {
  isGameOver = true;
  const winner = p1.health === p2.health ? 'Draw!' : p1.health > p2.health ? 'Player 1 wins!' : 'CPU wins!';
  statusEl.textContent = `${winner} Press R to play again.`;
}

function updateAI() {
  const distance = p1.x - p2.x;
  const absoluteDistance = Math.abs(distance);
  const input = { left: false, right: false, jump: false, attack: false, block: false };
  if (absoluteDistance > 88) {
    input.left = distance < 0;
    input.right = distance > 0;
  } else {
    // CPU blocks some incoming attacks and attacks when it has an opening.
    input.block = p1.isAttacking && Math.random() < 0.75;
    if (!input.block && cpuAttackWait <= 0) {
      input.attack = true;
      cpuAttackWait = 38;
    }
  }
  if (cpuAttackWait > 0) cpuAttackWait--;
  if (cpuJumpWait <= 0 && Math.random() < 0.012) {
    input.jump = true;
    cpuJumpWait = 70;
  }
  if (cpuJumpWait > 0) cpuJumpWait--;
  return input;
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(0, 0, canvas.width, 300);
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(0, 300, canvas.width, 60);
  ctx.fillStyle = '#166534';
  ctx.fillRect(0, 360, canvas.width, 180);
  ctx.fillStyle = '#334155';
  for (let i = 0; i < 10; i++) ctx.fillRect(80 + i * 90, 200 + (i % 2) * 12, 26, 26);
  p1.draw();
  p2.draw();
}

function loop(timestamp) {
  const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
  lastTime = timestamp;
  if (!isGameOver) {
    timer = Math.max(0, timer - delta);
    p1.update(p2, {
      left: keys.a, right: keys.d, jump: keys.w, attack: keys.f, block: keys.s
    });
    p2.update(p1, updateAI());
    if (p1.health <= 0 || p2.health <= 0 || timer <= 0) gameOver();
    updateHUD();
  }
  drawArena();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = true;
  if (key === 'r') resetRound();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) event.preventDefault();
});
window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  delete keys[key];
});
playerChoice.addEventListener('change', () => { updateSelection(); resetRound(); });
cpuChoice.addEventListener('change', () => { updateSelection(); resetRound(); });
updateSelection();
updateHUD();
requestAnimationFrame(loop);
