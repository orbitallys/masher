const selectSound = new Audio('assets/select.wav');
const placeSound  = new Audio('assets/place.wav');
const finishSound = new Audio('assets/finish.wav');
const bonkSound   = new Audio('assets/bonk.wav');

const screens = {
    menu:        document.getElementById('menu-screen'),
    game:        document.getElementById('game-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
    finished:    document.getElementById('finished-screen')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

const cursorEl = document.getElementById('custom-cursor');

document.addEventListener('mousemove', e => {
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top  = e.clientY + 'px';
});
document.addEventListener('mouseenter', () => { cursorEl.style.display = 'block'; });
document.addEventListener('mouseleave', () => { cursorEl.style.display = 'none';  });

function setCursor(src) { cursorEl.src = src; }

const TOTAL_TIME = 55;
const MAX_METER  = 100;
const BASE_POWER = 0.2;

const POTATO_STAGES = [
    { min: 0,  max: 16,  src: 'assets/potato.png'      },
    { min: 17, max: 32,  src: 'assets/potatomash1.png' },
    { min: 33, max: 46,  src: 'assets/potatomash2.png' },
    { min: 47, max: 58,  src: 'assets/potatomash3.png' },
    { min: 59, max: 70,  src: 'assets/potatomash4.png' },
    { min: 71, max: 84,  src: 'assets/potatomash5.png' },
    { min: 85, max: 100, src: 'assets/potatomash6.png' },
];

const RESULTS = [
    { min: 0,  max: 10,  src: 'assets/crookedpotato.png', label: 'Crooked Potato'    },
    { min: 11, max: 19,  src: 'assets/crookedpotato.png', label: 'Crooked Potato'    },
    { min: 20, max: 30,  src: 'assets/wedges.png',        label: 'Wedges'           },
    { min: 31, max: 39,  src: 'assets/wedges.png',        label: 'Wedges'           },
    { min: 40, max: 57,  src: 'assets/creampotato.png',   label: 'Cream Potato'      },
    { min: 58, max: 58,  src: 'assets/rarepotato.png',    label: 'Rare Potato' },
    { min: 59, max: 75,  src: 'assets/fries.png',         label: 'Fries'            },
    { min: 76, max: 90,  src: 'assets/potatosalad.png',   label: 'Potato Salad'     },
    { min: 91, max: 100, src: 'assets/mashedpotatos.png', label: 'Mashed Potatoes'  },
];

const PUP_TYPES = [
    { type: 'pup1', src: 'assets/pup1.png', multi: 1.2, weight: 60, speed: 1.2 },
    { type: 'pup2', src: 'assets/pup2.png', multi: 1.8, weight: 25, speed: 2.0 },
    { type: 'pup3', src: 'assets/pup3.png', multi: 2.3, weight: 12, speed: 2.8 },
    { type: 'pup4', src: 'assets/pup4.png', multi: 3.0, weight: 3,  speed: 4.5 },
];

let playerName     = 'Guest';
let mashLevel      = 0;
let timeLeft       = TOTAL_TIME;
let gameActive     = false;
let mashLocked     = false;
let gameStartTime  = 0;
let elapsedSeconds = 0;
let timerInterval  = null;
let activePupMulti = 1;
let pupExpireAt    = 0;
let activePupDrops = [];
let animFrameId    = null;
let lastFrameTime  = null;

const meterFill    = document.getElementById('meter-fill');
const meterValue   = document.getElementById('meter-value');
const timerDisplay = document.getElementById('timer-display');
const potatoImg    = document.getElementById('potato-img');
const mashArea     = document.getElementById('mash-area');
const pupNotify    = document.getElementById('pup-notify');
const activePupImg = document.getElementById('active-pup');
const pupTimerBar  = document.getElementById('pup-timer-bar');
const pupTimerCont = document.getElementById('pup-timer-bar-container');
const btnFinish    = document.getElementById('btn-finish');
const tutorialOverlay = document.getElementById('tutorial-overlay');

document.getElementById('btn-begin').addEventListener('click', () => {
    const v = document.getElementById('player-name').value.trim();
    if (v) playerName = v;
    beginFlow();
});

document.getElementById('btn-leaderboard').addEventListener('click', () => {
    renderLeaderboard();
    showScreen('leaderboard');
});

document.getElementById('btn-back-menu').addEventListener('click', () => showScreen('menu'));

document.getElementById('btn-menu-from-finish').addEventListener('click', () => {
    setCursor('assets/cursor.png');
    showScreen('menu');
});

btnFinish.addEventListener('click', endGame);

document.getElementById('btn-tutorial-start').addEventListener('click', () => {
    tutorialOverlay.classList.add('fade-out');
    tutorialOverlay.addEventListener('animationend', () => {
        tutorialOverlay.style.display = 'none';
        startGame();
    }, { once: true });
});

function beginFlow() {
    resetState();
    showScreen('game');
    setCursor('assets/cursor.png');
    tutorialOverlay.style.display = 'flex';
    tutorialOverlay.classList.remove('fade-out');
}

function startGame() {
    gameActive    = true;
    gameStartTime = Date.now();
    timerInterval = setInterval(tickTimer, 1000);
    schedulePupDrop();
    lastFrameTime = null;
    animFrameId = requestAnimationFrame(animatePups);
}

function resetState() {
    mashLevel      = 0;
    timeLeft       = TOTAL_TIME;
    gameActive     = false;
    mashLocked     = false;
    gameStartTime  = 0;
    elapsedSeconds = 0;
    activePupMulti = 1;
    pupExpireAt    = 0;

    activePupDrops.forEach(p => p.el.remove());
    activePupDrops = [];

    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    clearInterval(timerInterval);

    updateMeter();
    updatePotatoSprite();
    updateTimerDisplay();
    timerDisplay.classList.remove('urgent');

    btnFinish.style.display    = 'none';
    activePupImg.style.display = 'none';
    pupTimerCont.style.display = 'none';
}

function tickTimer() {
    if (!gameActive) return;
    timeLeft--;
    updateTimerDisplay();
    checkPupExpiry();
    if (timeLeft <= 0) {
        if (!mashLocked) {
            mashLocked = true;
            elapsedSeconds = TOTAL_TIME;
        }
        endGame();
    } else if (timeLeft <= 10) timerDisplay.classList.add('urgent');
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

mashArea.addEventListener('pointerdown', e => {
    if (tutorialOverlay.style.display !== 'none') return;

    const potatoRect = potatoImg.getBoundingClientRect();
    const cx = e.clientX;
    const cy = e.clientY;

    if (cx < potatoRect.left || cx > potatoRect.right || cy < potatoRect.top || cy > potatoRect.bottom) return;

    if (!gameActive || mashLocked) {
        bonkSound.currentTime = 0;
        bonkSound.play();
        return;
    }

    doMash(cx, cy);
});

function doMash(cx, cy) {
    const power = BASE_POWER * activePupMulti;
    mashLevel = Math.min(MAX_METER, mashLevel + power);

    placeSound.currentTime = 0;
    placeSound.play();

    setCursor('assets/clutch.png');
    setTimeout(() => setCursor('assets/cursor.png'), 120);

    potatoImg.style.animation = 'none';
    void potatoImg.offsetWidth;
    potatoImg.style.animation = 'mashflash 0.1s ease';

    updateMeter();
    updatePotatoSprite();
    spawnParticle(cx, cy, power);

    if (mashLevel >= MAX_METER) {
        mashLocked = true;
        elapsedSeconds = Math.round((Date.now() - gameStartTime) / 1000);
        btnFinish.style.display = 'block';
    }
}

function updateMeter() {
    meterFill.style.height = Math.min(100, mashLevel) + '%';
    meterValue.textContent = Math.floor(mashLevel);
}

function updatePotatoSprite() {
    const level = Math.floor(mashLevel);
    for (const stage of POTATO_STAGES) {
        if (level >= stage.min && level <= stage.max) {
            if (!potatoImg.src.endsWith(stage.src.replace('assets/', ''))) {
                potatoImg.src = stage.src;
            }
            break;
        }
    }
}

function spawnParticle(cx, cy, power) {
    const rect = mashArea.getBoundingClientRect();
    const el   = document.createElement('div');
    el.className   = 'mash-particle';
    el.textContent = '+' + power.toFixed(2);
    el.style.left  = (cx - rect.left - 20) + 'px';
    el.style.top   = (cy - rect.top  - 20) + 'px';
    mashArea.appendChild(el);
    setTimeout(() => el.remove(), 700);
}

function weightedRandom(types) {
    const total = types.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of types) { r -= t.weight; if (r <= 0) return t; }
    return types[0];
}

function schedulePupDrop() {
    if (!gameActive) return;
    const delay = 5000 + Math.random() * 8000;
    setTimeout(() => {
        if (gameActive) { dropPup(); schedulePupDrop(); }
    }, delay);
}

function dropPup() {
    const cfg  = weightedRandom(PUP_TYPES);
    const rect = mashArea.getBoundingClientRect();
    const el   = document.createElement('img');

    el.className    = 'pup-drop';
    el.src          = cfg.src;
    el.dataset.type = cfg.type;
    el.style.left   = (Math.random() * (rect.width - 48)) + 'px';
    el.style.top    = '-48px';

    el.addEventListener('pointerdown', e => {
        e.stopPropagation();
        collectPup(el, cfg);
    });

    mashArea.appendChild(el);
    activePupDrops.push({ el, speed: cfg.speed });
}

function animatePups(timestamp) {
    if (!gameActive) {
        animFrameId = requestAnimationFrame(animatePups);
        return;
    }

    if (lastFrameTime === null) lastFrameTime = timestamp;
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    const cappedDelta = Math.min(delta, 100);
    const scale = cappedDelta / 16.67;

    const rect = mashArea.getBoundingClientRect();

    activePupDrops = activePupDrops.filter(p => {
        const top    = parseFloat(p.el.style.top) || 0;
        const newTop = top + p.speed * scale;
        if (newTop > rect.height) {
            p.el.remove();
            return false;
        }
        p.el.style.top = newTop + 'px';
        return true;
    });

    animFrameId = requestAnimationFrame(animatePups);
}

function collectPup(el, cfg) {
    el.remove();
    activePupDrops = activePupDrops.filter(p => p.el !== el);

    activePupMulti = cfg.multi;
    pupExpireAt    = Date.now() + 10000;

    activePupImg.src           = cfg.src;
    activePupImg.style.display = 'block';
    pupTimerCont.style.display = 'block';
    pupTimerBar.style.width    = '100%';

    selectSound.currentTime = 0;
    selectSound.play();

    showPupNotify(`x${cfg.multi} power-up (10s)`);
}

function checkPupExpiry() {
    if (activePupMulti === 1) return;
    const remaining = pupExpireAt - Date.now();
    if (remaining <= 0) {
        activePupMulti             = 1;
        activePupImg.style.display = 'none';
        pupTimerCont.style.display = 'none';
        showPupNotify('Power-up expired!');
    } else {
        pupTimerBar.style.width = (remaining / 10000 * 100) + '%';
    }
}

function showPupNotify(msg) {
    pupNotify.textContent   = msg;
    pupNotify.style.display = 'block';
    clearTimeout(pupNotify._t);
    pupNotify._t = setTimeout(() => { pupNotify.style.display = 'none'; }, 2200);
}

function endGame() {
    gameActive = false;
    clearInterval(timerInterval);

    if (!mashLocked) {
        mashLocked     = true;
        elapsedSeconds = Math.round((Date.now() - gameStartTime) / 1000);
    }

    finishSound.currentTime = 0;
    finishSound.play();

    const level  = Math.floor(mashLevel);
    let   result = RESULTS[0];
    for (const r of RESULTS) {
        if (level >= r.min && level <= r.max) { result = r; break; }
    }

    const tm = Math.floor(elapsedSeconds / 60);
    const ts = elapsedSeconds % 60;
    const timeStr = `Time taken: ${tm}:${ts.toString().padStart(2, '0')}`;

    document.getElementById('result-level').textContent  = `Mashed: ${level}`;
    document.getElementById('result-player').textContent = playerName;

    const resultPotato   = document.getElementById('result-potato');
    const resultMadeLabel = document.getElementById('result-made-label');
    const resultFoodName = document.getElementById('result-food-name');
    const resultTime     = document.getElementById('result-time');

    resultPotato.src = result.src;
    resultFoodName.textContent = result.label;
    resultTime.textContent     = timeStr;

    resultMadeLabel.style.display = 'none';
    resultFoodName.style.display  = 'none';
    resultTime.style.display      = 'none';

    resultPotato.style.transform = 'scale(0)';
    resultPotato.style.opacity   = '0';
    resultPotato.classList.remove('pop-in');
    void resultPotato.offsetWidth;
    resultPotato.classList.add('pop-in');

    setTimeout(() => {
        resultMadeLabel.style.display = 'block';
        resultFoodName.style.display  = 'block';
        setTimeout(() => {
            resultTime.style.display = 'block';
        }, 200);
    }, 520);

    saveToLeaderboard(playerName, level, elapsedSeconds);
    showScreen('finished');
}

function saveToLeaderboard(name, level, seconds) {
    let board = JSON.parse(localStorage.getItem('potatoLeaderboard')) || [];
    board.push({ name, level, seconds });
    board.sort((a, b) => b.level - a.level || a.seconds - b.seconds);
    board = board.slice(0, 10);
    localStorage.setItem('potatoLeaderboard', JSON.stringify(board));
}

function renderLeaderboard() {
    const list  = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    const board = JSON.parse(localStorage.getItem('potatoLeaderboard')) || [];
    if (!board.length) {
        list.innerHTML = '<li>No potatoes mashed yet!</li>';
    } else {
        board.forEach((e, i) => {
            const li = document.createElement('li');
            const tm = Math.floor((e.seconds || 0) / 60);
            const ts = (e.seconds || 0) % 60;
            const timeStr = `${tm}:${ts.toString().padStart(2, '0')}`;
            li.textContent = `${i + 1}. ${e.name} — ${e.level}  (${timeStr})`;
            list.appendChild(li);
        });
    }
}

(function () {
    const leftAds  = ['assets/ad-left.png',  'assets/ad-left2.png',  'assets/ad-left3.png'];
    const rightAds = ['assets/ad-right.png', 'assets/ad-right2.png', 'assets/ad-right3.png'];

    function updateAds() {
        const l = document.getElementById('ad-left');
        const r = document.getElementById('ad-right');
        if (l) l.src = leftAds[Math.floor(Math.random()  * leftAds.length)];
        if (r) r.src = rightAds[Math.floor(Math.random() * rightAds.length)];
        setTimeout(updateAds, Math.floor(Math.random() * 20000 + 20000));
    }
    updateAds();
})();