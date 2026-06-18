class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || (Math.random() - 0.5) * 2;
        this.vy = options.vy || (Math.random() - 0.5) * 2;
        this.size = options.size || 3;
        this.color = options.color || '#00ffff';
        this.life = options.life || 1;
        this.maxLife = options.maxLife || 1;
        this.glow = options.glow || 15;
        this.mode = options.mode || 'starfield';
        this.alpha = options.alpha || 1;
        this.angle = Math.random() * Math.PI * 2;
        this.angleSpeed = (Math.random() - 0.5) * 0.02;
        this.tail = [];
        this.tailLength = options.tailLength || 0;
    }

    update(speed, mouseX, mouseY, interaction, canvasWidth, canvasHeight, mode) {
        this.speedMultiplier = speed;
        
        if (mouseX !== null && mouseY !== null) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 150;
            
            if (dist < maxDist && dist > 0) {
                const force = (maxDist - dist) / maxDist;
                const angle = Math.atan2(dy, dx);
                
                if (interaction === 'attract') {
                    this.vx += Math.cos(angle) * force * 0.5;
                    this.vy += Math.sin(angle) * force * 0.5;
                } else if (interaction === 'repel') {
                    this.vx -= Math.cos(angle) * force * 0.8;
                    this.vy -= Math.sin(angle) * force * 0.8;
                }
            }
        }

        this.updateByMode(mode, canvasWidth, canvasHeight);

        this.vx *= 0.98;
        this.vy *= 0.98;

        this.x += this.vx * speed;
        this.y += this.vy * speed;

        if (this.tailLength > 0) {
            this.tail.push({ x: this.x, y: this.y });
            if (this.tail.length > this.tailLength) {
                this.tail.shift();
            }
        }

        this.angle += this.angleSpeed;

        if (this.mode === 'fireworks') {
            this.life -= 0.008;
            this.alpha = Math.max(0, this.life);
        }
    }

    updateByMode(mode, canvasWidth, canvasHeight) {
        switch (mode) {
            case 'starfield':
                if (this.x < 0) this.x = canvasWidth;
                if (this.x > canvasWidth) this.x = 0;
                if (this.y < 0) this.y = canvasHeight;
                if (this.y > canvasHeight) this.y = 0;
                break;
            case 'fireworks':
                this.vy += 0.03;
                break;
            case 'waterflow':
                this.vy += 0.02;
                this.vx += Math.sin(this.y * 0.01 + this.angle) * 0.05;
                if (this.y > canvasHeight + 50) {
                    this.y = -50;
                    this.x = Math.random() * canvasWidth;
                    this.tail = [];
                    this.vx = (Math.random() - 0.5) * 1;
                    this.vy = Math.random() * 2 + 1;
                }
                if (this.x < -50) {
                    this.x = canvasWidth + 50;
                    this.tail = [];
                }
                if (this.x > canvasWidth + 50) {
                    this.x = -50;
                    this.tail = [];
                }
                break;
        }
    }

    draw(ctx) {
        ctx.save();
        
        if (this.tail.length > 1) {
            if (this.glow > 0) {
                ctx.shadowColor = this.color;
                ctx.shadowBlur = this.glow * 0.5;
            }
            ctx.beginPath();
            ctx.moveTo(this.tail[0].x, this.tail[0].y);
            for (let i = 1; i < this.tail.length; i++) {
                const prev = this.tail[i - 1];
                const curr = this.tail[i];
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                if (dx * dx + dy * dy < 10000) {
                    ctx.lineTo(curr.x, curr.y);
                } else {
                    ctx.moveTo(curr.x, curr.y);
                }
            }
            ctx.strokeStyle = this.hexToRgba(this.color, this.alpha * 0.4);
            ctx.lineWidth = this.size * 0.6;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        
        if (this.glow > 0) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.glow;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    isDead() {
        return this.life <= 0;
    }
}

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.mode = 'starfield';
        this.interaction = 'attract';
        this.mouseX = null;
        this.mouseY = null;
        this.particleCount = 200;
        this.particleColor = '#00ffff';
        this.particleSpeed = 1;
        this.particleSize = 3;
        this.glowIntensity = 15;
        this.animationId = null;
        this.lastFireworkTime = 0;
        this.fireworkInterval = 60;
        this.maxFireworkParticles = 500;

        this.resize();
        this.initParticles();
        this.bindEvents();
        this.animate();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    initParticles() {
        this.particles = [];
        
        switch (this.mode) {
            case 'starfield':
                this.createStarfieldParticles();
                break;
            case 'fireworks':
                this.createFireworksParticles();
                break;
            case 'waterflow':
                this.createWaterflowParticles();
                break;
        }
    }

    createStarfieldParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            const particle = new Particle(
                Math.random() * this.canvas.width,
                Math.random() * this.canvas.height,
                {
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: Math.random() * this.particleSize * 0.5 + this.particleSize * 0.5,
                    color: this.getRandomColorVariant(),
                    mode: 'starfield',
                    glow: this.glowIntensity,
                    alpha: Math.random() * 0.5 + 0.5,
                    tailLength: 0
                }
            );
            this.particles.push(particle);
        }
    }

    createFireworksParticles() {
        const targetParticles = Math.min(this.particleCount, this.maxFireworkParticles);
        const particlesPerFirework = Math.max(15, Math.floor(30 * (500 / Math.max(this.particleCount, 200))));
        while (this.particles.length < targetParticles * 0.3) {
            this.launchFirework(particlesPerFirework);
        }
    }

    launchFirework(customCount) {
        if (this.particles.length >= this.maxFireworkParticles) return;
        
        const startX = Math.random() * this.canvas.width;
        const targetY = Math.random() * this.canvas.height * 0.5 + 50;
        const particlesPerFirework = customCount || Math.max(15, Math.floor(30 * (500 / Math.max(this.particleCount, 200))));
        const hue = Math.random() * 360;
        const hexColor = this.hslToHex(hue, 100, 60);
        const actualCount = Math.min(particlesPerFirework, this.maxFireworkParticles - this.particles.length);

        for (let i = 0; i < actualCount; i++) {
            const angle = (Math.PI * 2 * i) / actualCount;
            const speed = Math.random() * 3 + 2;
            const particle = new Particle(startX, targetY, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * this.particleSize * 0.5 + this.particleSize * 0.5,
                color: hexColor,
                life: 1,
                maxLife: 1,
                mode: 'fireworks',
                glow: this.glowIntensity,
                tailLength: 6
            });
            this.particles.push(particle);
        }
    }

    createWaterflowParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            const particle = new Particle(
                Math.random() * this.canvas.width,
                Math.random() * this.canvas.height,
                {
                    vx: (Math.random() - 0.5) * 1,
                    vy: Math.random() * 2 + 1,
                    size: Math.random() * this.particleSize * 0.6 + this.particleSize * 0.4,
                    color: this.getBlueShade(),
                    mode: 'waterflow',
                    glow: this.glowIntensity,
                    alpha: Math.random() * 0.6 + 0.4,
                    tailLength: 10
                }
            );
            this.particles.push(particle);
        }
    }

    getRandomColorVariant() {
        const baseColor = this.particleColor;
        if (this.mode === 'starfield') {
            const colors = [
                '#ffffff', '#ffffaa', '#aaaaff', '#ffaaaa',
                '#aaffaa', baseColor
            ];
            return colors[Math.floor(Math.random() * colors.length)];
        }
        return baseColor;
    }

    getBlueShade() {
        const shades = ['#00ffff', '#00aaff', '#0066ff', '#66ccff', '#3399ff'];
        return shades[Math.floor(Math.random() * shades.length)];
    }

    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseX = null;
            this.mouseY = null;
        });

        window.addEventListener('resize', () => {
            this.resize();
            this.initParticles();
        });
    }

    update() {
        if (this.mode === 'fireworks') {
            this.lastFireworkTime++;
            const dynamicInterval = Math.max(30, this.fireworkInterval - Math.floor(this.particleCount / 50));
            if (this.lastFireworkTime >= dynamicInterval && this.particles.length < this.maxFireworkParticles) {
                this.launchFirework();
                this.lastFireworkTime = 0;
            }
        }

        const aliveParticles = [];
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.update(
                this.particleSpeed,
                this.mouseX,
                this.mouseY,
                this.interaction,
                this.canvas.width,
                this.canvas.height,
                this.mode
            );

            if (!p.isDead()) {
                aliveParticles.push(p);
            }
        }
        this.particles = aliveParticles;

        if (this.mode !== 'fireworks') {
            while (this.particles.length < this.particleCount) {
                this.addParticle();
            }
        }
    }

    addParticle() {
        let x, y;
        
        switch (this.mode) {
            case 'starfield':
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
                break;
            case 'waterflow':
                x = Math.random() * this.canvas.width;
                y = -20;
                break;
            default:
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
        }

        const particle = new Particle(x, y, {
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: this.particleSize,
            color: this.particleColor,
            mode: this.mode,
            glow: this.glowIntensity,
            tailLength: this.mode === 'waterflow' ? 12 : 0
        });
        this.particles.push(particle);
    }

    draw() {
        this.ctx.fillStyle = 'rgba(5, 5, 10, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (const particle of this.particles) {
            particle.size = this.particleSize;
            particle.glow = this.glowIntensity;
            particle.draw(this.ctx);
        }
    }

    animate() {
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    setMode(mode) {
        this.mode = mode;
        this.initParticles();
    }

    setParticleCount(count) {
        this.particleCount = count;
        if (this.mode !== 'fireworks') {
            this.initParticles();
        }
    }

    setColor(color) {
        this.particleColor = color;
        for (const p of this.particles) {
            if (this.mode !== 'fireworks') {
                p.color = color;
            }
        }
    }

    setSpeed(speed) {
        this.particleSpeed = speed;
    }

    setSize(size) {
        this.particleSize = size;
    }

    setGlow(intensity) {
        this.glowIntensity = intensity;
    }

    setInteraction(interaction) {
        this.interaction = interaction;
    }

    takeScreenshot() {
        const dataURL = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `particle-art-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    }

    reset() {
        this.particleCount = 200;
        this.particleColor = '#00ffff';
        this.particleSpeed = 1;
        this.particleSize = 3;
        this.glowIntensity = 15;
        this.interaction = 'attract';
        this.initParticles();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('particleCanvas');
    const system = new ParticleSystem(canvas);

    const countSlider = document.getElementById('particleCount');
    const countValue = document.getElementById('countValue');
    countSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        countValue.textContent = value;
        system.setParticleCount(value);
    });

    const colorPicker = document.getElementById('particleColor');
    colorPicker.addEventListener('input', (e) => {
        system.setColor(e.target.value);
    });

    const speedSlider = document.getElementById('particleSpeed');
    const speedValue = document.getElementById('speedValue');
    speedSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        speedValue.textContent = value.toFixed(1);
        system.setSpeed(value);
    });

    const sizeSlider = document.getElementById('particleSize');
    const sizeValue = document.getElementById('sizeValue');
    sizeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sizeValue.textContent = value.toFixed(1);
        system.setSize(value);
    });

    const glowSlider = document.getElementById('glowIntensity');
    const glowValue = document.getElementById('glowValue');
    glowSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        glowValue.textContent = value;
        system.setGlow(value);
    });

    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            system.setMode(btn.dataset.mode);
        });
    });

    const interactionButtons = document.querySelectorAll('.interaction-btn');
    interactionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            interactionButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            system.setInteraction(btn.dataset.interaction);
        });
    });

    const screenshotBtn = document.getElementById('screenshotBtn');
    screenshotBtn.addEventListener('click', () => {
        system.takeScreenshot();
    });

    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', () => {
        countSlider.value = 200;
        countValue.textContent = '200';
        colorPicker.value = '#00ffff';
        speedSlider.value = 1;
        speedValue.textContent = '1.0';
        sizeSlider.value = 3;
        sizeValue.textContent = '3.0';
        glowSlider.value = 15;
        glowValue.textContent = '15';
        
        interactionButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-interaction="attract"]').classList.add('active');
        
        modeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-mode="starfield"]').classList.add('active');
        
        system.reset();
    });
});
