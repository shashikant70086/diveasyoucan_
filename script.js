// Canvas setup
const c = document.getElementById('mainCvs');
const ctx = c.getContext('2d');
let W = c.width = window.innerWidth;
let H = c.height = window.innerHeight;



const G = 0.04;        
const FRIC = 0.94;    
const POWER = 0.14;    
const MAX_SPD = 2.8;  


// Assets
const imgs = {
    sub: 'img1.png', //player sprite
    coin: 'img2.png', //pearl/coin sprite
    tank: 'img3.png', //oxygen tank sprite
    e1: 'img6.png', //shark sprite
    e2: 'img4.png', //fish sprite
    e3: 'img5.png' //jellyfish sprite
};


const sprites = {};
Object.keys(imgs).forEach(k => {
    sprites[k] = new Image();
    sprites[k].src = imgs[k];

});

// drawing scale factor for all sprites (2x increase)
const SPRITE_SCALE = 2; // multiply original sizes by this when drawing


let p = { x: W/2, y: 40, vx: 0, vy: 0, air: 100, health: 100, gold: 0, over: false, shake:0 };

let camY = 0;

let objects = [];

let keys = {};

let mouse = { x: W/2, y: H/2 };

window.onmousemove = e => { mouse.x = e.clientX; mouse.y = e.clientY; };


// Handle keys
window.onkeydown = e => keys[e.key.toLowerCase()] = true;
window.onkeyup = e => keys[e.key.toLowerCase()] = false;


function spawnStuff(yPos) {
    // spawn a mix of mobs, coins and tanks. mobs are more frequent.
    const count = 6;
    // spread items more evenly across the gap and vertical zone
    // use consistent spacing with a little jitter so they don't all clump
    const gap = Math.max(240, W - (yPos * 0.075));
    const L = (W - gap) / 2;
    const R = W - L;
    for(let i=0;i<count;i++){
        const roll = Math.random();
        let item = { t: 'coin', img: sprites.coin };

        if(roll < 0.62) { // mob (majority)
            item.t = 'mob';
            const mRoll = Math.random();
            if(mRoll < 0.08) { // rare: e1
                item.mobType = 'e1'; item.img = sprites.e1; item.dmg = 1;
            } else if(mRoll < 0.6) { // common: e2
                item.mobType = 'e2'; item.img = sprites.e2; item.dmg = 5;
            } else { // medium: e3
                item.mobType = 'e3'; item.img = sprites.e3; item.dmg = 50;
            }
        } else if(roll < 0.87) { // coin
            item.t = 'coin'; item.img = sprites.coin;
        } else { // tank
            item.t = 'tank'; item.img = sprites.tank;
        }

        // horizontal position evenly spaced within gap, with small jitter
        let xPos;
        if(item.t === 'mob' && item.mobType === 'e1') {
            // still spawn e1 at walls, with slight vertical offset
            xPos = Math.random() < 0.5 ? (L + 20) : (R - 20);
        } else {
            const frac = count > 1 ? i / (count - 1) : 0.5;
            const baseX = L + 20 + frac * (gap - 40);
            xPos = baseX + (Math.random() - 0.5) * 50; // jitter +/-25px
            xPos = Math.max(L + 15, Math.min(R - 15, xPos));
        }

        // vertical position spaced out over a taller band
        const band = 650;
        const yOffset = (i / count) * band + Math.random() * (band / count);

        objects.push({
            x: xPos,
            y: yPos + H + yOffset,
            t: item.t,
            img: item.img,
            mobType: item.mobType || null,
            dmg: item.dmg || 0,
            sideV: (Math.random() - 0.5) * 0.9,
            timer: Math.random() * 10
        });
    }
}


function update() {
    if(p.over) return;


    // Control logic
    if(keys['w'] || keys['arrowup']) p.vy -= POWER;
    if(keys['s'] || keys['arrowdown']) p.vy += POWER;
    if(keys['a'] || keys['arrowleft']) p.vx -= POWER;
    if(keys['d'] || keys['arrowright']) p.vx += POWER;


    // Physics
    p.vy += G;
    p.vx *= FRIC;
    p.vy *= FRIC;


    // Speed clamping
    p.vx = Math.max(-MAX_SPD, Math.min(MAX_SPD, p.vx));
    p.vy = Math.max(-MAX_SPD, Math.min(MAX_SPD, p.vy));


    p.x += p.vx;
    p.y += p.vy;


    // Mariana Trench Squeeze logic
    let gap = Math.max(240, W - (p.y * 0.075));
    let L_wall = (W - gap) / 2;
    let R_wall = W - L_wall;


    // Wall collision
    if(p.x < L_wall + 15) { p.x = L_wall + 15; p.vx *= -0.3; }
    if(p.x > R_wall - 15) { p.x = R_wall - 15; p.vx *= -0.3; }


    camY = p.y - H/2;


    // --- REFILL / DRAIN LOGIC ---
    if(p.y < 100) {
        p.air = Math.min(100, p.air + 0.12);
    } else {
        p.air -= 0.006; // very slow auto-decrease
    }


    // Object interactions - iterate backwards when removing
    for(let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];


        if(obj.t === 'mob') {
            if(obj.mobType === 'e1') {
                // home from wall toward diver slowly
                const sx = Math.sign(p.x - obj.x) || 1;
                obj.x += sx * 0.9; // horizontal homing
                obj.y += Math.sign(p.y - obj.y) * 0.2; // slight vertical approach
            } else {
                obj.x += obj.sideV;
                if(obj.x < L_wall + 8 || obj.x > R_wall - 8) obj.sideV *= -1;
                // bob vertically a little
                obj.y += Math.sin((Date.now()/1000) + obj.timer) * 0.3;
            }
        }
        // ensure everything stays within wall bounds, coins/tanks too
        if(obj.x < L_wall + 15) obj.x = L_wall + 15;
        if(obj.x > R_wall - 15) obj.x = R_wall - 15;


        const dist = Math.hypot(p.x - obj.x, p.y - obj.y);
        if(dist < 34) {
            if(obj.t === 'coin') {
                p.gold += 10;
            } else if(obj.t === 'tank') {
                p.air = Math.min(100, p.air + 28); // tank restores oxygen only
            } else if(obj.t === 'mob') {
                // apply damage to both oxygen and health (health is non-recoverable)
                const dmg = obj.dmg || 5;
                p.air = Math.max(0, p.air - dmg);
                p.health = Math.max(0, p.health - dmg);
                p.shake = 12; // trigger shake/glow
            }
            objects.splice(i, 1);
        }
    }



    // Infinity spawning
    if(objects.length < 18 || (objects.length && objects[objects.length-1].y < p.y + H)) {
        spawnStuff(p.y);
    }


    // Fail state
    if(p.air <= 0 || p.health <= 0) {
        p.over = true;
        document.getElementById('final-depth').innerText = Math.floor(p.y);
        document.getElementById('msg-box').style.display = 'block';
    }


    draw(L_wall, R_wall, gap);
    requestAnimationFrame(update);
}


function draw(L, R, gap) {
    // clear canvas so underlying body background image is visible
    ctx.clearRect(0,0,W,H);
    // first draw a heavy 90% opaque black overlay
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0,0,W,H);


    // compute torch direction toward mouse
    const sx = p.x;
    const sy = H/2;
    const dx = mouse.x - sx;
    const dy = mouse.y - sy;
    const angle = Math.atan2(dy, dx);
    const coneLength = H * 0.6;
    const halfAngle = Math.PI / 8; // narrower than before


    // compute cone tip coordinates
    const tipX = sx + Math.cos(angle) * coneLength;
    const tipY = sy + Math.sin(angle) * coneLength;


    // gradient along the cone
    const grad = ctx.createLinearGradient(sx, sy, tipX, tipY);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');


    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle - halfAngle) * coneLength, sy + Math.sin(angle - halfAngle) * coneLength);
    ctx.lineTo(sx + Math.cos(angle + halfAngle) * coneLength, sy + Math.sin(angle + halfAngle) * coneLength);
    ctx.closePath();
    ctx.fill();
    ctx.restore();


    // optional soft circle around player to brighten immediate area
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const glowRadius = 600; // radius used both for gradient and visibility checks
    const rgrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
    rgrad.addColorStop(0, 'rgba(0,0,0,1)');
    rgrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rgrad;
    ctx.beginPath();
    ctx.arc(sx, sy, glowRadius, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();


    ctx.save();
    ctx.translate(0, -camY);


    // Trench walls
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, p.y - H, L, H*2);
    ctx.fillRect(R, p.y - H, W - R, H*2);


    // Boundary line
    ctx.strokeStyle = '#048';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(L, p.y - H, gap, H*25);


    // Items - only draw if within torch or glow radius
    objects.forEach(obj => {
        // compute relative pos to player on screen
        const sx = obj.x;
        const sy = obj.y - camY;
        const dx = sx - p.x;
        const dy = sy - H/2;
        const dist = Math.hypot(dx, dy);
        // compute cone parameters (same as above)
        const mx = mouse.x;
        const my = mouse.y;
        const ang = Math.atan2(my - H/2, mx - p.x);
        const halfAng = Math.PI/8;
        const coneLen = H * 0.6;
        const objAng = Math.atan2(dy, dx);
        const angDiff = Math.abs(((objAng - ang + Math.PI) % (2*Math.PI)) - Math.PI);
        const insideCone = (dist < coneLen && angDiff < halfAng);
        const glowRadius = 600; // match the soft circle radius above
        const insideGlow = dist < glowRadius;
        if(insideCone || insideGlow) {
            let b = Math.sin(Date.now()/1000 + obj.timer) * 5;
            const halfSize = 15 * SPRITE_SCALE;
            const size = 30 * SPRITE_SCALE;
            ctx.drawImage(obj.img, obj.x - halfSize, obj.y - halfSize + b, size, size);
        }
    });


    // Diver

    // handle shake/glow on player
    if(p.shake > 0) {
        const shakeAmt = 3;
        const ox = (Math.random()*2-1) * shakeAmt;
        const oy = (Math.random()*2-1) * shakeAmt;
        ctx.translate(ox, oy);
        p.shake--;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    if(p.vx < -0.15) ctx.scale(-1, 1);
    // glow effect
    if(p.shake > 0) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 12;
    } else {
        ctx.shadowBlur = 0;
    }
    const diverHalf = 20 * SPRITE_SCALE;
    const diverSize = 40 * SPRITE_SCALE;
    ctx.drawImage(sprites.sub, -diverHalf, -diverHalf, diverSize, diverSize);
    ctx.restore();

    ctx.restore();


    // Stats UI
    document.getElementById('depth-txt').innerText = Math.floor(p.y);
    document.getElementById('gold-txt').innerText = p.gold;
    document.getElementById('air-level').style.width = p.air + '%';
    document.getElementById('health-level').style.width = p.health + '%';


    // Visual feedback for oxygen refill
    if(p.y < 100) {
        document.getElementById('air-level').style.backgroundColor = 'rgb(30, 255, 0)';
    } else {
        document.getElementById('air-level').style.backgroundColor = 'rgb(0, 255, 0)';
    }
    // Health tint depending on remaining health
    if(p.health > 60) document.getElementById('health-level').style.backgroundColor = '#f44';
    else if(p.health > 25) document.getElementById('health-level').style.backgroundColor = '#fa8';
    else document.getElementById('health-level').style.backgroundColor = '#a33';

}


window.onload = update;
