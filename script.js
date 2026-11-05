(() => {
  const roster = {
    swift: { name: 'Swift', style: 'Speed specialist', color: '#38bdf8', speed: 9, power: 5, guard: 5, jump: 9 },
    titan: { name: 'Titan', style: 'Heavy hitter', color: '#fb923c', speed: 4, power: 10, guard: 8, jump: 5 },
    balanced: { name: 'Balanced', style: 'All-rounder', color: '#a78bfa', speed: 7, power: 7, guard: 7, jump: 7 },
    guardian: { name: 'Guardian', style: 'Defensive expert', color: '#34d399', speed: 5, power: 6, guard: 10, jump: 6 }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const savedChoice = () => {
    try { return localStorage.getItem('pixelClashFighter'); } catch { return null; }
  };
  const saveChoices = (player, cpu) => {
    try {
      localStorage.setItem('pixelClashFighter', player);
      localStorage.setItem('pixelClashCPU', cpu);
    } catch { /* The game still works if browser storage is disabled. */ }
  };

  function portrait(color, id) {
    const accents = {
      swift: '<path d="M22 30h36l-5 10H27z" fill="#e0f2fe"/><path d="M20 27l-9-9 4 17 10 2M60 27l9-9-4 17-10 2" fill="#e0f2fe"/>',
      titan: '<path d="M20 20l8-10 10 7 10-7 12 10-5 12H25z" fill="#fed7aa"/><path d="M28 34h24v7H28z" fill="#7c2d12"/>',
      balanced: '<path d="M19 18l9-8h24l9 8-4 8H23z" fill="#ede9fe"/><path d="M28 31h24v6H28z" fill="#4c1d95"/>',
      guardian: '<path d="M18 16l12-8h20l12 8-4 18H22z" fill="#d1fae5"/><path d="M29 30h22v8H29z" fill="#064e3b"/>'
    };
    return `<svg viewBox="0 0 80 100" role="img" aria-label="${roster[id].name} fighter">
      <path d="M24 50h32l8 34H16z" fill="${color}"/><path d="M26 78h12v19H23zM43 78h12l6 19H42z" fill="#172033"/>
      <path d="M17 51h11v27H13zM52 51h11l5 27H55z" fill="${color}"/><circle cx="40" cy="30" r="19" fill="#f2c9a5"/>
      ${accents[id]}<path d="M31 31h5M44 31h5" stroke="#172033" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  function statMarkup(character) {
    return [['Speed', character.speed], ['Power', character.power], ['Guard', character.guard], ['Jump', character.jump]]
      .map(([label, value]) => `<div class="stat-row"><span>${label}</span><span class="stat-meter"><i style="width:${value * 10}%"></i></span><span class="stat-value">${value}</span></div>`)
      .join('');
  }

  function setupMenu() {
    const cards = document.getElementById('character-roster');
    if (!cards) return;

    let selectedId = roster[savedChoice()] ? savedChoice() : 'swift';
    const selectedName = document.getElementById('selected-name');
    const opponentName = document.getElementById('opponent-name');

    function render() {
      cards.innerHTML = Object.entries(roster).map(([id, character]) => `
        <button class="character-card ${id === selectedId ? 'selected' : ''}" type="button" data-character="${id}" aria-pressed="${id === selectedId}" style="--fighter-color:${character.color}">
          <span class="selection-mark" aria-hidden="true">✓</span>
          <span class="portrait">${portrait(character.color, id)}</span>
          <span class="character-name">${character.name}</span>
          <span class="character-style">${character.style}</span>
          <span class="stat-list">${statMarkup(character)}</span>
        </button>`).join('');
      selectedName.textContent = roster[selectedId].name;
      const opponents = Object.keys(roster).filter(id => id !== selectedId);
      const preview = opponents[Math.floor(Math.random() * opponents.length)];
      opponentName.textContent = roster[preview].name;
      cards.querySelectorAll('[data-character]').forEach(card => {
        card.addEventListener('click', () => {
          selectedId = card.dataset.character;
          render();
        });
      });
    }

    render();
    document.getElementById('fight-button').addEventListener('click', () => {
      const opponents = Object.keys(roster).filter(id => id !== selectedId);
      const cpuId = opponents[Math.floor(Math.random() * opponents.length)];
      saveChoices(selectedId, cpuId);
      window.location.href = 'fight.html';
    });
  }

  function setupFight() {
    const canvas = document.getElementById('game');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const groundY = 430;
    const gravity = 0.78;
    const keys = Object.create(null);
    let timer = 60;
    let gameOver = false;
    let lastTimestamp = 0;
    let cpuAttackWait = 0;
    let cpuBlockWait = 0;
    let cpuJumpWait = 0;

    let playerId = 'swift';
    let cpuId = 'titan';
    try {
      const savedPlayer = localStorage.getItem('pixelClashFighter');
      const savedCPU = localStorage.getItem('pixelClashCPU');
      if (roster[savedPlayer]) playerId = savedPlayer;
      if (roster[savedCPU]) cpuId = savedCPU;
    } catch { /* Defaults are used when browser storage is disabled. */ }

    class Fighter {
      constructor(x, id, isCPU = false) {
        this.startX = x;
        this.isCPU = isCPU;
        this.width = 72;
        this.height = 110;
        this.facing = isCPU ? -1 : 1;
        this.setCharacter(id);
        this.reset(x);
      }

      setCharacter(id) {
        this.id = id;
        this.character = roster[id];
      }

      reset(x = this.startX) {
        this.x = x;
        this.y = groundY;
        this.vx = 0;
        this.vy = 0;
        this.health = 100;
        this.hitFlash = 0;
        this.attackCooldown = 0;
        this.attackTimer = 0;
        this.isAttacking = false;
        this.hitThisAttack = false;
        this.blocking = false;
      }

      update(opponent, input) {
        this.facing = opponent.x >= this.x ? 1 : -1;
        this.blocking = Boolean(input.block) && this.y >= groundY - 1;

        if (this.blocking) {
          this.vx *= 0.55;
        } else {
          if (input.left) this.vx = -this.character.speed * 0.58;
          else if (input.right) this.vx = this.character.speed * 0.58;
          else this.vx *= 0.76;
          if (Math.abs(this.vx) < 0.25) this.vx = 0;
          if (input.jump && this.y >= groundY - 1) this.vy = -(9 + this.character.jump * 0.48);
          if (input.attack && this.attackCooldown <= 0) this.startAttack();
        }

        this.x = clamp(this.x + this.vx, 30, canvas.width - this.width - 30);
        this.vy += gravity;
        this.y += this.vy;
        if (this.y > groundY) { this.y = groundY; this.vy = 0; }
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.attackTimer > 0 && --this.attackTimer === 0) this.isAttacking = false;
        if (this.hitFlash > 0) this.hitFlash--;
        this.resolveHit(opponent);
      }

      startAttack() {
        this.isAttacking = true;
        this.attackTimer = 17;
        this.attackCooldown = 30;
        this.hitThisAttack = false;
      }

      resolveHit(opponent) {
        if (!this.isAttacking || this.hitThisAttack) return;
        const distance = Math.abs((opponent.x + opponent.width / 2) - (this.x + this.width / 2));
        if (distance > 83 || Math.abs(opponent.y - this.y) > 85) return;
        if ((this.facing === 1 && opponent.x < this.x) || (this.facing === -1 && opponent.x > this.x)) return;

        this.hitThisAttack = true;
        const rawDamage = 5 + this.character.power * 1.05;
        const damage = opponent.blocking
          ? Math.max(1, Math.round(rawDamage * (1 - opponent.character.guard * 0.075)))
          : Math.round(rawDamage);
        opponent.health = clamp(opponent.health - damage, 0, 100);
        opponent.hitFlash = opponent.blocking ? 5 : 10;
        opponent.vx += this.facing * (opponent.blocking ? 1.5 : 6);
        document.getElementById('status').textContent = opponent.blocking ? 'BLOCKED!' : 'HIT!';
      }

      draw() {
        const x = this.x;
        const y = this.y;
        ctx.save();
        ctx.translate(x + this.width / 2, 0);
        ctx.scale(this.facing, 1);
        ctx.translate(-(x + this.width / 2), 0);
        ctx.fillStyle = '#07101b55';
        ctx.beginPath();
        ctx.ellipse(x + this.width / 2, groundY + 105, 37, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        const color = this.hitFlash ? '#ffffff' : this.character.color;
        ctx.fillStyle = color;
        ctx.fillRect(x + 14, y + 34, 44, 49);
        ctx.fillRect(x + 8, y + 47, 14, 35);
        ctx.fillRect(x + 50, y + 47, 14, 35);
        ctx.fillRect(x + 18, y + 82, 18, 30);
        ctx.fillRect(x + 36, y + 82, 18, 30);
        ctx.fillStyle = '#f2c9a5';
        ctx.fillRect(x + 18, y + 8, 36, 31);
        ctx.fillStyle = '#172033';
        ctx.fillRect(x + (this.facing === 1 ? 42 : 23), y + 19, 5, 5);
        ctx.fillStyle = color;
        ctx.fillRect(x + 14, y + 5, 44, 10);

        if (this.blocking) {
          ctx.strokeStyle = '#a5f3fc';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(x + this.width / 2, y + 57, 48, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
        }
        if (this.isAttacking) {
          ctx.fillStyle = '#fff3a3';
          ctx.fillRect(x + this.width - 1, y + 52, 28, 16);
        }
        ctx.restore();
      }
    }

    const player = new Fighter(180, playerId);
    const cpu = new Fighter(700, cpuId, true);

    function statSummary(character) {
      return `SPD ${character.speed} · POW ${character.power} · GRD ${character.guard} · JMP ${character.jump}`;
    }
    document.getElementById('player-name').textContent = roster[playerId].name.toUpperCase();
    document.getElementById('cpu-name').textContent = `CPU · ${roster[cpuId].name.toUpperCase()}`;
    document.getElementById('player-mini-stats').textContent = statSummary(roster[playerId]);
    document.getElementById('cpu-mini-stats').textContent = statSummary(roster[cpuId]);

    function updateHud() {
      document.getElementById('player-health').style.width = `${player.health}%`;
      document.getElementById('cpu-health').style.width = `${cpu.health}%`;
      document.getElementById('player-health-number').textContent = Math.ceil(player.health);
      document.getElementById('cpu-health-number').textContent = Math.ceil(cpu.health);
      document.getElementById('timer').textContent = Math.ceil(timer);
    }

    function resetRound() {
      player.reset(180);
      cpu.reset(700);
      timer = 60;
      gameOver = false;
      cpuAttackWait = 0;
      cpuBlockWait = 0;
      cpuJumpWait = 0;
      lastTimestamp = 0;
      document.getElementById('end-screen').hidden = true;
      document.getElementById('status').textContent = 'FIGHT!';
      updateHud();
    }

    function finishRound() {
      if (gameOver) return;
      gameOver = true;
      const title = player.health === cpu.health ? 'DRAW!' : player.health > cpu.health ? 'YOU WIN!' : 'CPU WINS!';
      document.getElementById('result-title').textContent = title;
      document.getElementById('result-detail').textContent = `${roster[playerId].name} vs ${roster[cpuId].name} · ${Math.ceil(timer)} seconds left`;
      document.getElementById('end-screen').hidden = false;
      document.getElementById('status').textContent = 'ROUND OVER';
    }

    function cpuInput() {
      const deltaX = player.x - cpu.x;
      const distance = Math.abs(deltaX);
      const input = { left: false, right: false, jump: false, attack: false, block: false };
      if (distance > 80) {
        input.left = deltaX < 0;
        input.right = deltaX > 0;
      } else if (player.isAttacking && cpuBlockWait <= 0 && Math.random() < 0.42) {
        input.block = true;
        cpuBlockWait = 38;
      } else if (cpuAttackWait <= 0) {
        input.attack = true;
        cpuAttackWait = Math.max(24, 48 - roster[cpuId].speed);
      }
      if (cpuAttackWait > 0) cpuAttackWait--;
      if (cpuBlockWait > 0) cpuBlockWait--;
      if (cpuJumpWait <= 0 && Math.random() < 0.008) {
        input.jump = true;
        cpuJumpWait = 65;
      }
      if (cpuJumpWait > 0) cpuJumpWait--;
      return input;
    }

    function drawArena() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sky = ctx.createLinearGradient(0, 0, 0, 390);
      sky.addColorStop(0, '#2563a6');
      sky.addColorStop(1, '#a5d7e8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#d7e5a1';
      ctx.beginPath();
      ctx.moveTo(0, 324);
      ctx.lineTo(130, 235);
      ctx.lineTo(255, 325);
      ctx.lineTo(415, 215);
      ctx.lineTo(590, 325);
      ctx.lineTo(750, 230);
      ctx.lineTo(960, 330);
      ctx.lineTo(960, 430);
      ctx.lineTo(0, 430);
      ctx.fill();
      ctx.fillStyle = '#86b75d';
      ctx.fillRect(0, 430, canvas.width, 110);
      ctx.fillStyle = '#5c8a47';
      ctx.fillRect(0, 430, canvas.width, 12);
      ctx.fillStyle = '#34445a';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(50 + i * 95, 195 + (i % 2) * 16, 25, 25);
      }
      player.draw();
      cpu.draw();
    }

    function loop(timestamp) {
      const delta = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 0;
      lastTimestamp = timestamp;
      if (!gameOver) {
        timer = Math.max(0, timer - delta);
        player.update(cpu, { left: keys.a, right: keys.d, jump: keys.w, attack: keys.f, block: keys.s });
        cpu.update(player, cpuInput());
        updateHud();
        if (player.health <= 0 || cpu.health <= 0 || timer <= 0) finishRound();
      }
      drawArena();
      requestAnimationFrame(loop);
    }

    document.getElementById('rematch-button').addEventListener('click', resetRound);
    document.getElementById('rematch-top').addEventListener('click', resetRound);
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (['a', 'd', 'w', 'f', 's', 'r'].includes(key)) event.preventDefault();
      keys[key] = true;
      if (key === 'r') resetRound();
    });
    window.addEventListener('keyup', event => { delete keys[event.key.toLowerCase()]; });
    window.addEventListener('blur', () => { for (const key of Object.keys(keys)) delete keys[key]; });

    updateHud();
    document.getElementById('status').textContent = 'FIGHT!';
    requestAnimationFrame(loop);
  }

  setupMenu();
  setupFight();
})();
