class PerlinNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(512);
        const permutation = [];
        for (let i = 0; i < 256; i++) permutation[i] = i;
        let n = seed * 2147483647;
        for (let i = 255; i > 0; i--) {
            n = (n * 16807) % 2147483647;
            const j = n % (i + 1);
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }
        for (let i = 0; i < 512; i++) this.p[i] = permutation[i & 255];
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
                this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))),
            this.lerp(v,
                this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)))
        );
    }
}

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
        this.waveOffset = options.waveOffset || 0;
        this.waveLayer = options.waveLayer || 0;
        this.baseY = options.baseY || 0;
    }

    update(speed, mouseX, mouseY, interaction, canvasWidth, canvasHeight, mode, modeParams) {
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

        this.updateByMode(mode, canvasWidth, canvasHeight, modeParams || {});

        this.vx *= 0.98;
        this.vy *= 0.98;

        if (mode !== 'wave') {
            this.x += this.vx * speed;
            this.y += this.vy * speed;
        }

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

    updateByMode(mode, canvasWidth, canvasHeight, params) {
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
            case 'wave':
                const waveFreq = params.waveFrequency || 0.01;
                const waveAmp = params.waveAmplitude || 50;
                const waveLayers = params.waveLayers || 3;
                let yOffset = 0;
                for (let i = 0; i < waveLayers; i++) {
                    const layerFreq = waveFreq * (i + 1) * 0.7;
                    const layerAmp = waveAmp * (1 / (i + 1));
                    const phaseOffset = this.waveLayer * 0.5 + i * 1.3;
                    yOffset += Math.sin(this.x * layerFreq + phaseOffset + params.time) * layerAmp;
                }
                this.y = this.baseY + yOffset;
                this.x += this.vx;
                if (this.x > canvasWidth + 20) {
                    this.x = -20;
                    this.tail = [];
                }
                if (this.x < -20) {
                    this.x = canvasWidth + 20;
                    this.tail = [];
                }
                break;
            case 'flowfield':
                if (params && params.perlinNoise) {
                    const scale = params.flowScale || 0.005;
                    const force = params.flowForce || 0.3;
                    const noiseVal = params.perlinNoise(this.x * scale, this.y * scale, params.time * (params.flowSpeed || 0.0005));
                    const flowAngle = noiseVal * Math.PI * 4;
                    this.vx += Math.cos(flowAngle) * force;
                    this.vy += Math.sin(flowAngle) * force;
                    const maxV = 3;
                    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                    if (spd > maxV) {
                        this.vx = (this.vx / spd) * maxV;
                        this.vy = (this.vy / spd) * maxV;
                    }
                }
                const margin = 100;
                if (this.x < -margin) this.x = canvasWidth + margin;
                if (this.x > canvasWidth + margin) this.x = -margin;
                if (this.y < -margin) this.y = canvasHeight + margin;
                if (this.y > canvasHeight + margin) this.y = -margin;
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
        this.time = 0;
        this.perlin = new PerlinNoise(42);

        this.waveFrequency = 0.008;
        this.waveAmplitude = 60;
        this.waveLayers = 4;

        this.fractalDepth = 8;
        this.fractalBranchAngle = 0.5;
        this.fractalLengthRatio = 0.67;
        this.fractalInitialLength = 0;
        this.fractalAnimProgress = 0;
        this.fractalLines = [];

        this.flowScale = 0.004;
        this.flowForce = 0.25;
        this.flowSpeed = 0.7;

        this.colorTheme = 'cool';
        this.linkDistance = 0;
        this.fadeOut = 0.15;

        this.themeColors = {
            cool: ['#00ffff', '#00aaff', '#0066ff', '#66ccff', '#3399ff', '#00ccff'],
            warm: ['#ff6b6b', '#ffa502', '#ff7f50', '#ff4757', '#ff6348', '#ff3838'],
            neon: ['#ff00ff', '#00ffff', '#ffff00', '#ff0080', '#80ff00', '#00ff80']
        };

        this.currentPresetName = null;

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
        this.time = 0;
        this.fractalAnimProgress = 0;
        this.fractalLines = [];
        this.fractalInitialLength = this.canvas.height * 0.28;
        
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
            case 'wave':
                this.createWaveParticles();
                break;
            case 'fractal':
                this.generateFractalTree();
                this.createFractalParticles();
                break;
            case 'flowfield':
                this.createFlowfieldParticles();
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

    createWaveParticles() {
        const layers = this.waveLayers;
        const perLayer = Math.ceil(this.particleCount / layers);
        for (let layer = 0; layer < layers; layer++) {
            const baseY = this.canvas.height * (0.3 + (layer / layers) * 0.5);
            const layerHue = (layer / layers) * 60 + 180;
            for (let i = 0; i < perLayer; i++) {
                const x = (i / perLayer) * (this.canvas.width + 100) - 50;
                const color = this.hslToHex(layerHue + Math.random() * 30, 100, 60);
                const particle = new Particle(x, baseY, {
                    vx: 0.8 + layer * 0.3,
                    vy: 0,
                    size: this.particleSize * (1 - layer * 0.1),
                    color: color,
                    mode: 'wave',
                    glow: this.glowIntensity,
                    alpha: 0.7 + Math.random() * 0.3,
                    tailLength: 12,
                    waveOffset: Math.random() * Math.PI * 2,
                    waveLayer: layer,
                    baseY: baseY
                });
                this.particles.push(particle);
            }
        }
    }

    generateFractalTree() {
        this.fractalLines = [];
        const startX = this.canvas.width / 2;
        const startY = this.canvas.height;
        const angle = -Math.PI / 2;
        this.fractalBranch(startX, startY, this.fractalInitialLength, angle, 0);
    }

    fractalBranch(x, y, length, angle, depth) {
        if (depth >= this.fractalDepth || length < 2) return;
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        this.fractalLines.push({
            x1: x, y1: y, x2: endX, y2: endY,
            depth: depth,
            maxDepth: this.fractalDepth,
            length: length
        });
        const brAngle = this.fractalBranchAngle;
        const lenRatio = this.fractalLengthRatio;
        this.fractalBranch(endX, endY, length * lenRatio, angle - brAngle, depth + 1);
        this.fractalBranch(endX, endY, length * lenRatio, angle + brAngle, depth + 1);
        if (depth < 2) {
            this.fractalBranch(endX, endY, length * lenRatio * 0.9, angle, depth + 1);
        }
    }

    createFractalParticles() {
        const totalLines = this.fractalLines.length;
        if (totalLines === 0) return;
        const perLine = Math.max(1, Math.floor(this.particleCount / totalLines));
        for (let i = 0; i < totalLines; i++) {
            const line = this.fractalLines[i];
            const depthRatio = line.depth / line.maxDepth;
            const hue = 280 - depthRatio * 180;
            const lineColor = this.hslToHex(hue, 100, 60);
            for (let j = 0; j < perLine; j++) {
                const t = j / perLine;
                const px = line.x1 + (line.x2 - line.x1) * t;
                const py = line.y1 + (line.y2 - line.y1) * t;
                const particle = new Particle(px, py, {
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: (Math.random() - 0.5) * 0.2,
                    size: this.particleSize * (1 - depthRatio * 0.5),
                    color: lineColor,
                    mode: 'fractal',
                    glow: this.glowIntensity,
                    alpha: 0.6 + Math.random() * 0.4,
                    tailLength: 3,
                    lineIndex: i,
                    lineT: t
                });
                this.particles.push(particle);
            }
        }
    }

    createFlowfieldParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const hue = (i / this.particleCount) * 360;
            const color = this.hslToHex(hue, 100, 60);
            const particle = new Particle(x, y, {
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: Math.random() * this.particleSize * 0.5 + this.particleSize * 0.5,
                color: color,
                mode: 'flowfield',
                glow: this.glowIntensity,
                alpha: 0.7 + Math.random() * 0.3,
                tailLength: 15
            });
            this.particles.push(particle);
        }
    }

    getRandomColorVariant() {
        if (this.colorTheme === 'custom') {
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
        return this.getThemeColor();
    }

    getBlueShade() {
        if (this.colorTheme === 'custom') {
            const shades = ['#00ffff', '#00aaff', '#0066ff', '#66ccff', '#3399ff'];
            return shades[Math.floor(Math.random() * shades.length)];
        }
        return this.getThemeColor();
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
        this.time += this.particleSpeed;

        if (this.mode === 'fireworks') {
            this.lastFireworkTime++;
            const dynamicInterval = Math.max(30, this.fireworkInterval - Math.floor(this.particleCount / 50));
            if (this.lastFireworkTime >= dynamicInterval && this.particles.length < this.maxFireworkParticles) {
                this.launchFirework();
                this.lastFireworkTime = 0;
            }
        }

        if (this.mode === 'fractal') {
            this.fractalAnimProgress = Math.min(1, this.fractalAnimProgress + 0.002);
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                if (p.lineIndex !== undefined && this.fractalLines[p.lineIndex]) {
                    const line = this.fractalLines[p.lineIndex];
                    const lineStart = line.depth / this.fractalDepth;
                    const lineEnd = (line.depth + 1) / this.fractalDepth;
                    const lineProgress = line.maxDepth > 0 ? line.depth / line.maxDepth : 0;
                    if (this.fractalAnimProgress < lineProgress) {
                        p.alpha = 0;
                    } else {
                        const animT = Math.max(0, Math.min(1, (this.fractalAnimProgress - lineProgress) / (1 / this.fractalDepth)));
                        p.alpha = (0.6 + Math.random() * 0.4) * animT;
                    }
                    const pulse = Math.sin(this.time * 0.02 + p.lineT * 10 + line.depth) * 0.5 + 0.5;
                    p.x = line.x1 + (line.x2 - line.x1) * p.lineT + (Math.random() - 0.5) * 1.5;
                    p.y = line.y1 + (line.y2 - line.y1) * p.lineT + (Math.random() - 0.5) * 1.5;
                }
            }
        }

        const modeParams = {
            time: this.time * 0.02,
            waveFrequency: this.waveFrequency,
            waveAmplitude: this.waveAmplitude,
            waveLayers: this.waveLayers,
            perlinNoise: (x, y, z) => this.perlin.noise(x, y, z),
            flowScale: this.flowScale,
            flowForce: this.flowForce,
            flowSpeed: this.flowSpeed
        };

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
                this.mode,
                modeParams
            );

            if (!p.isDead()) {
                aliveParticles.push(p);
            }
        }
        this.particles = aliveParticles;

        if (this.mode !== 'fireworks' && this.mode !== 'fractal') {
            while (this.particles.length < this.particleCount) {
                this.addParticle();
            }
        }
    }

    addParticle() {
        let x, y, options;
        
        switch (this.mode) {
            case 'starfield':
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
                options = {
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: Math.random() * this.particleSize * 0.5 + this.particleSize * 0.5,
                    color: this.getRandomColorVariant(),
                    mode: 'starfield',
                    glow: this.glowIntensity,
                    alpha: Math.random() * 0.5 + 0.5,
                    tailLength: 0
                };
                break;
            case 'waterflow':
                x = Math.random() * this.canvas.width;
                y = -20;
                options = {
                    vx: (Math.random() - 0.5) * 1,
                    vy: Math.random() * 2 + 1,
                    size: Math.random() * this.particleSize * 0.6 + this.particleSize * 0.4,
                    color: this.getBlueShade(),
                    mode: 'waterflow',
                    glow: this.glowIntensity,
                    alpha: Math.random() * 0.6 + 0.4,
                    tailLength: 12
                };
                break;
            case 'wave':
                const layer = Math.floor(Math.random() * this.waveLayers);
                const baseY = this.canvas.height * (0.3 + (layer / this.waveLayers) * 0.5);
                const layerHue = (layer / this.waveLayers) * 60 + 180;
                x = -30;
                y = baseY;
                options = {
                    vx: 0.8 + layer * 0.3,
                    vy: 0,
                    size: this.particleSize * (1 - layer * 0.1),
                    color: this.hslToHex(layerHue + Math.random() * 30, 100, 60),
                    mode: 'wave',
                    glow: this.glowIntensity,
                    alpha: 0.7 + Math.random() * 0.3,
                    tailLength: 12,
                    waveOffset: Math.random() * Math.PI * 2,
                    waveLayer: layer,
                    baseY: baseY
                };
                break;
            case 'flowfield':
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
                const hue = Math.random() * 360;
                options = {
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * this.particleSize * 0.5 + this.particleSize * 0.5,
                    color: this.hslToHex(hue, 100, 60),
                    mode: 'flowfield',
                    glow: this.glowIntensity,
                    alpha: 0.7 + Math.random() * 0.3,
                    tailLength: 15
                };
                break;
            default:
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
                options = {
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: this.particleSize,
                    color: this.particleColor,
                    mode: this.mode,
                    glow: this.glowIntensity,
                    tailLength: 0
                };
        }

        this.particles.push(new Particle(x, y, options));
    }

    draw() {
        const trailAlpha = this.fadeOut;
        this.ctx.fillStyle = `rgba(5, 5, 10, ${trailAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.mode === 'fractal') {
            this.drawFractalLines();
        }

        if (this.linkDistance > 0 && this.mode !== 'fractal' && this.mode !== 'wave') {
            this.drawLinks();
        }

        for (const particle of this.particles) {
            particle.size = this.particleSize;
            particle.glow = this.glowIntensity;
            particle.draw(this.ctx);
        }
    }

    drawLinks() {
        const maxDist = this.linkDistance;
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < maxDist) {
                    const alpha = (1 - dist / maxDist) * 0.3;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawFractalLines() {
        for (let i = 0; i < this.fractalLines.length; i++) {
            const line = this.fractalLines[i];
            const lineProgress = line.maxDepth > 0 ? line.depth / line.maxDepth : 0;
            if (this.fractalAnimProgress < lineProgress) continue;
            const animT = Math.max(0, Math.min(1, (this.fractalAnimProgress - lineProgress) / (1 / this.fractalDepth)));
            const drawEndX = line.x1 + (line.x2 - line.x1) * animT;
            const drawEndY = line.y1 + (line.y2 - line.y1) * animT;
            const depthRatio = line.depth / line.maxDepth;
            const hue = 280 - depthRatio * 180;
            const alpha = animT * (0.4 + (1 - depthRatio) * 0.4);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(line.x1, line.y1);
            this.ctx.lineTo(drawEndX, drawEndY);
            this.ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
            this.ctx.lineWidth = Math.max(0.5, (1 - depthRatio) * 3);
            this.ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            this.ctx.shadowBlur = this.glowIntensity * 0.8;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
            this.ctx.restore();
        }
        if (this.fractalAnimProgress >= 1) {
            const pulse = Math.sin(this.time * 0.03) * 0.3 + 0.7;
            for (let i = 0; i < this.fractalLines.length; i++) {
                const line = this.fractalLines[i];
                if (line.depth === this.fractalDepth - 1 || !this.hasChildBranches(i)) {
                    const tipX = line.x2;
                    const tipY = line.y2;
                    const hue = 100 + Math.sin(this.time * 0.01 + i) * 30;
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(tipX, tipY, 2 * pulse, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${0.8 * pulse})`;
                    this.ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
                    this.ctx.shadowBlur = this.glowIntensity * pulse;
                    this.ctx.fill();
                    this.ctx.restore();
                }
            }
        }
    }

    hasChildBranches(lineIndex) {
        const line = this.fractalLines[lineIndex];
        for (let i = lineIndex + 1; i < this.fractalLines.length; i++) {
            const other = this.fractalLines[i];
            if (Math.abs(other.x1 - line.x2) < 0.1 && Math.abs(other.y1 - line.y2) < 0.1) {
                return true;
            }
        }
        return false;
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

    setWaveFrequency(val) {
        this.waveFrequency = val;
        if (this.mode === 'wave') this.initParticles();
    }

    setWaveAmplitude(val) {
        this.waveAmplitude = val;
    }

    setWaveLayers(val) {
        this.waveLayers = val;
        if (this.mode === 'wave') this.initParticles();
    }

    setFractalDepth(val) {
        this.fractalDepth = val;
        if (this.mode === 'fractal') {
            this.fractalAnimProgress = 0;
            this.generateFractalTree();
            this.createFractalParticles();
        }
    }

    setFractalBranchAngle(val) {
        this.fractalBranchAngle = val;
        if (this.mode === 'fractal') {
            this.fractalAnimProgress = 0;
            this.generateFractalTree();
            this.createFractalParticles();
        }
    }

    setFractalLengthRatio(val) {
        this.fractalLengthRatio = val;
        if (this.mode === 'fractal') {
            this.fractalAnimProgress = 0;
            this.generateFractalTree();
            this.createFractalParticles();
        }
    }

    setFlowScale(val) {
        this.flowScale = val;
    }

    setFlowForce(val) {
        this.flowForce = val;
    }

    setFlowSpeed(val) {
        this.flowSpeed = val;
    }

    setColorTheme(theme) {
        this.colorTheme = theme;
        if (theme === 'custom') return;
        
        const colors = this.themeColors[theme];
        if (colors) {
            for (const p of this.particles) {
                p.color = colors[Math.floor(Math.random() * colors.length)];
            }
        }
    }

    setLinkDistance(val) {
        this.linkDistance = val;
    }

    setFadeOut(val) {
        this.fadeOut = val;
    }

    getThemeColor() {
        if (this.colorTheme === 'custom') {
            return this.particleColor;
        }
        const colors = this.themeColors[this.colorTheme];
        return colors ? colors[Math.floor(Math.random() * colors.length)] : this.particleColor;
    }

    getCurrentPreset() {
        return {
            mode: this.mode,
            colorTheme: this.colorTheme,
            particleColor: this.particleColor,
            particleCount: this.particleCount,
            particleSpeed: this.particleSpeed,
            particleSize: this.particleSize,
            glowIntensity: this.glowIntensity,
            interaction: this.interaction,
            linkDistance: this.linkDistance,
            fadeOut: this.fadeOut,
            waveFrequency: this.waveFrequency,
            waveAmplitude: this.waveAmplitude,
            waveLayers: this.waveLayers,
            fractalDepth: this.fractalDepth,
            fractalBranchAngle: this.fractalBranchAngle,
            fractalLengthRatio: this.fractalLengthRatio,
            flowScale: this.flowScale,
            flowForce: this.flowForce,
            flowSpeed: this.flowSpeed
        };
    }

    loadPreset(preset) {
        this.mode = preset.mode;
        this.colorTheme = preset.colorTheme;
        this.particleColor = preset.particleColor || '#00ffff';
        this.particleCount = preset.particleCount;
        this.particleSpeed = preset.particleSpeed;
        this.particleSize = preset.particleSize;
        this.glowIntensity = preset.glowIntensity;
        this.interaction = preset.interaction;
        this.linkDistance = preset.linkDistance;
        this.fadeOut = preset.fadeOut;
        this.waveFrequency = preset.waveFrequency;
        this.waveAmplitude = preset.waveAmplitude;
        this.waveLayers = preset.waveLayers;
        this.fractalDepth = preset.fractalDepth;
        this.fractalBranchAngle = preset.fractalBranchAngle;
        this.fractalLengthRatio = preset.fractalLengthRatio;
        this.flowScale = preset.flowScale;
        this.flowForce = preset.flowForce;
        this.flowSpeed = preset.flowSpeed;
        this.initParticles();
    }

    randomizeCurrentMode() {
        const randomInRange = (min, max, step = 1) => {
            const range = (max - min) / step;
            return min + Math.floor(Math.random() * range) * step;
        };

        this.particleCount = randomInRange(50, 500, 10);
        this.particleSpeed = parseFloat(randomInRange(0.1, 5, 0.1).toFixed(1));
        this.particleSize = parseFloat(randomInRange(1, 10, 0.5).toFixed(1));
        this.glowIntensity = randomInRange(0, 30, 1);
        this.linkDistance = randomInRange(0, 300, 10);
        this.fadeOut = parseFloat(randomInRange(0.01, 0.3, 0.01).toFixed(2));

        const themes = ['cool', 'warm', 'neon'];
        this.colorTheme = themes[Math.floor(Math.random() * themes.length)];

        switch (this.mode) {
            case 'wave':
                this.waveFrequency = parseFloat(randomInRange(0.001, 0.03, 0.0005).toFixed(4));
                this.waveAmplitude = randomInRange(10, 150, 5);
                this.waveLayers = randomInRange(1, 8, 1);
                break;
            case 'fractal':
                this.fractalDepth = randomInRange(3, 12, 1);
                this.fractalBranchAngle = parseFloat(randomInRange(0.1, 1.2, 0.05).toFixed(2));
                this.fractalLengthRatio = parseFloat(randomInRange(0.4, 0.85, 0.01).toFixed(2));
                break;
            case 'flowfield':
                this.flowScale = parseFloat(randomInRange(0.001, 0.015, 0.0005).toFixed(4));
                this.flowForce = parseFloat(randomInRange(0.05, 1.0, 0.05).toFixed(2));
                this.flowSpeed = parseFloat(randomInRange(0.1, 2.0, 0.1).toFixed(2));
                break;
        }

        this.initParticles();
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
        this.colorTheme = 'cool';
        this.linkDistance = 0;
        this.fadeOut = 0.15;
        this.waveFrequency = 0.008;
        this.waveAmplitude = 60;
        this.waveLayers = 4;
        this.fractalDepth = 8;
        this.fractalBranchAngle = 0.5;
        this.fractalLengthRatio = 0.67;
        this.flowScale = 0.004;
        this.flowForce = 0.25;
        this.flowSpeed = 0.7;
        this.currentPresetName = null;
        this.initParticles();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('particleCanvas');
    const system = new ParticleSystem(canvas);

    const showModePanel = (mode) => {
        document.querySelectorAll('.mode-specific-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById(`panel-${mode}`);
        if (panel) panel.style.display = 'block';
    };
    showModePanel('starfield');

    const countSlider = document.getElementById('particleCount');
    const countValue = document.getElementById('countValue');
    const colorPicker = document.getElementById('particleColor');
    const speedSlider = document.getElementById('particleSpeed');
    const speedValue = document.getElementById('speedValue');
    const sizeSlider = document.getElementById('particleSize');
    const sizeValue = document.getElementById('sizeValue');
    const glowSlider = document.getElementById('glowIntensity');
    const glowValue = document.getElementById('glowValue');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const interactionButtons = document.querySelectorAll('.interaction-btn');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const customColorGroup = document.getElementById('customColorGroup');
    const linkSlider = document.getElementById('linkDistance');
    const linkValue = document.getElementById('linkValue');
    const fadeSlider = document.getElementById('fadeOut');
    const fadeValue = document.getElementById('fadeValue');
    const waveFreqSlider = document.getElementById('waveFrequency');
    const waveFreqValue = document.getElementById('waveFreqValue');
    const waveAmpSlider = document.getElementById('waveAmplitude');
    const waveAmpValue = document.getElementById('waveAmpValue');
    const waveLayersSlider = document.getElementById('waveLayers');
    const waveLayersValue = document.getElementById('waveLayersValue');
    const fractalDepthSlider = document.getElementById('fractalDepth');
    const fractalDepthValue = document.getElementById('fractalDepthValue');
    const fractalAngleSlider = document.getElementById('fractalBranchAngle');
    const fractalAngleValue = document.getElementById('fractalAngleValue');
    const fractalRatioSlider = document.getElementById('fractalLengthRatio');
    const fractalRatioValue = document.getElementById('fractalRatioValue');
    const flowScaleSlider = document.getElementById('flowScale');
    const flowScaleValue = document.getElementById('flowScaleValue');
    const flowForceSlider = document.getElementById('flowForce');
    const flowForceValue = document.getElementById('flowForceValue');
    const flowSpeedSlider = document.getElementById('flowSpeed');
    const flowSpeedValue = document.getElementById('flowSpeedValue');
    const screenshotBtn = document.getElementById('screenshotBtn');
    const resetBtn = document.getElementById('resetBtn');

    const STORAGE_KEY = 'particle-art-presets';

    const defaultPresets = [
        {
            name: '🌌 星空',
            preset: {
                mode: 'starfield',
                colorTheme: 'cool',
                particleColor: '#00ffff',
                particleCount: 500,
                particleSpeed: 0.3,
                particleSize: 2,
                glowIntensity: 15,
                interaction: 'attract',
                linkDistance: 150,
                fadeOut: 0.15,
                waveFrequency: 0.008,
                waveAmplitude: 60,
                waveLayers: 4,
                fractalDepth: 8,
                fractalBranchAngle: 0.5,
                fractalLengthRatio: 0.67,
                flowScale: 0.004,
                flowForce: 0.25,
                flowSpeed: 0.7
            }
        },
        {
            name: '🌊 海洋',
            preset: {
                mode: 'wave',
                colorTheme: 'warm',
                particleColor: '#00ffff',
                particleCount: 200,
                particleSpeed: 1,
                particleSize: 3,
                glowIntensity: 15,
                interaction: 'attract',
                linkDistance: 0,
                fadeOut: 0.12,
                waveFrequency: 0.015,
                waveAmplitude: 80,
                waveLayers: 8,
                fractalDepth: 8,
                fractalBranchAngle: 0.5,
                fractalLengthRatio: 0.67,
                flowScale: 0.004,
                flowForce: 0.25,
                flowSpeed: 0.7
            }
        },
        {
            name: '🌀 漩涡',
            preset: {
                mode: 'flowfield',
                colorTheme: 'neon',
                particleColor: '#00ffff',
                particleCount: 500,
                particleSpeed: 2,
                particleSize: 2,
                glowIntensity: 20,
                interaction: 'attract',
                linkDistance: 0,
                fadeOut: 0.03,
                waveFrequency: 0.008,
                waveAmplitude: 60,
                waveLayers: 4,
                fractalDepth: 8,
                fractalBranchAngle: 0.5,
                fractalLengthRatio: 0.67,
                flowScale: 0.003,
                flowForce: 0.25,
                flowSpeed: 2
            }
        }
    ];

    const initDefaultPresets = () => {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (!existing) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPresets));
        } else {
            const presets = JSON.parse(existing);
            const hasDefaults = defaultPresets.every(dp => 
                presets.some(p => p.name === dp.name)
            );
            if (!hasDefaults) {
                defaultPresets.forEach(dp => {
                    if (!presets.some(p => p.name === dp.name)) {
                        presets.push(dp);
                    }
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
            }
        }
    };

    const getPresets = () => {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    };

    const savePreset = (name, preset) => {
        const presets = getPresets();
        const existingIndex = presets.findIndex(p => p.name === name);
        if (existingIndex >= 0) {
            presets[existingIndex] = { name, preset };
        } else {
            presets.push({ name, preset });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    };

    const deletePreset = (name) => {
        const presets = getPresets().filter(p => p.name !== name);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
        if (system.currentPresetName === name) {
            system.currentPresetName = null;
        }
    };

    const updateSlidersFromSystem = () => {
        countSlider.value = system.particleCount;
        countValue.textContent = system.particleCount;
        speedSlider.value = system.particleSpeed;
        speedValue.textContent = system.particleSpeed.toFixed(1);
        sizeSlider.value = system.particleSize;
        sizeValue.textContent = system.particleSize.toFixed(1);
        glowSlider.value = system.glowIntensity;
        glowValue.textContent = system.glowIntensity;
        colorPicker.value = system.particleColor;
        linkSlider.value = system.linkDistance;
        linkValue.textContent = system.linkDistance;
        fadeSlider.value = system.fadeOut;
        fadeValue.textContent = system.fadeOut.toFixed(2);

        themeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-theme="${system.colorTheme}"]`).classList.add('active');
        customColorGroup.style.display = system.colorTheme === 'custom' ? 'block' : 'none';

        interactionButtons.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-interaction="${system.interaction}"]`).classList.add('active');

        modeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mode="${system.mode}"]`).classList.add('active');
        showModePanel(system.mode);

        if (waveFreqSlider) { waveFreqSlider.value = system.waveFrequency; waveFreqValue.textContent = system.waveFrequency.toFixed(4); }
        if (waveAmpSlider) { waveAmpSlider.value = system.waveAmplitude; waveAmpValue.textContent = system.waveAmplitude; }
        if (waveLayersSlider) { waveLayersSlider.value = system.waveLayers; waveLayersValue.textContent = system.waveLayers; }
        if (fractalDepthSlider) { fractalDepthSlider.value = system.fractalDepth; fractalDepthValue.textContent = system.fractalDepth; }
        if (fractalAngleSlider) { fractalAngleSlider.value = system.fractalBranchAngle; fractalAngleValue.textContent = system.fractalBranchAngle.toFixed(2); }
        if (fractalRatioSlider) { fractalRatioSlider.value = system.fractalLengthRatio; fractalRatioValue.textContent = system.fractalLengthRatio.toFixed(2); }
        if (flowScaleSlider) { flowScaleSlider.value = system.flowScale; flowScaleValue.textContent = system.flowScale.toFixed(4); }
        if (flowForceSlider) { flowForceSlider.value = system.flowForce; flowForceValue.textContent = system.flowForce.toFixed(2); }
        if (flowSpeedSlider) { flowSpeedSlider.value = system.flowSpeed; flowSpeedValue.textContent = system.flowSpeed.toFixed(2); }
    };

    const loadPresetByName = (name) => {
        const presets = getPresets();
        const found = presets.find(p => p.name === name);
        if (found) {
            system.loadPreset(found.preset);
            system.currentPresetName = name;
            updateSlidersFromSystem();
            renderPresetList();
        }
    };

    const renderPresetList = () => {
        const presetList = document.getElementById('presetList');
        const presets = getPresets();
        
        if (presets.length === 0) {
            presetList.innerHTML = '<div class="empty-preset">暂无保存的预设</div>';
            return;
        }

        presetList.innerHTML = presets.map(p => `
            <div class="preset-item ${system.currentPresetName === p.name ? 'active' : ''}" data-name="${p.name}">
                <span class="preset-name">${p.name}</span>
                <button class="preset-delete-btn" data-delete="${p.name}" title="删除预设">×</button>
            </div>
        `).join('');

        presetList.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('preset-delete-btn')) {
                    loadPresetByName(item.dataset.name);
                }
            });
        });

        presetList.querySelectorAll('.preset-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.delete;
                if (confirm(`确定要删除预设 "${name}" 吗？`)) {
                    deletePreset(name);
                    renderPresetList();
                }
            });
        });
    };

    const markAsModified = () => {
        system.currentPresetName = null;
        renderPresetList();
    };

    countSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        countValue.textContent = value;
        system.setParticleCount(value);
        markAsModified();
    });

    colorPicker.addEventListener('input', (e) => {
        system.setColor(e.target.value);
        markAsModified();
    });

    speedSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        speedValue.textContent = value.toFixed(1);
        system.setSpeed(value);
        markAsModified();
    });

    sizeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sizeValue.textContent = value.toFixed(1);
        system.setSize(value);
        markAsModified();
    });

    glowSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        glowValue.textContent = value;
        system.setGlow(value);
        markAsModified();
    });

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            system.setMode(btn.dataset.mode);
            showModePanel(btn.dataset.mode);
            markAsModified();
        });
    });

    interactionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            interactionButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            system.setInteraction(btn.dataset.interaction);
            markAsModified();
        });
    });

    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            system.setColorTheme(theme);
            
            if (theme === 'custom') {
                customColorGroup.style.display = 'block';
            } else {
                customColorGroup.style.display = 'none';
            }
            
            markAsModified();
        });
    });

    linkSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        linkValue.textContent = value;
        system.setLinkDistance(value);
        markAsModified();
    });

    fadeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        fadeValue.textContent = value.toFixed(2);
        system.setFadeOut(value);
        markAsModified();
    });

    if (waveFreqSlider) {
        waveFreqSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            waveFreqValue.textContent = value.toFixed(4);
            system.setWaveFrequency(value);
            markAsModified();
        });
    }

    if (waveAmpSlider) {
        waveAmpSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            waveAmpValue.textContent = value;
            system.setWaveAmplitude(value);
            markAsModified();
        });
    }

    if (waveLayersSlider) {
        waveLayersSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            waveLayersValue.textContent = value;
            system.setWaveLayers(value);
            markAsModified();
        });
    }

    if (fractalDepthSlider) {
        fractalDepthSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            fractalDepthValue.textContent = value;
            system.setFractalDepth(value);
            markAsModified();
        });
    }

    if (fractalAngleSlider) {
        fractalAngleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fractalAngleValue.textContent = value.toFixed(2);
            system.setFractalBranchAngle(value);
            markAsModified();
        });
    }

    if (fractalRatioSlider) {
        fractalRatioSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fractalRatioValue.textContent = value.toFixed(2);
            system.setFractalLengthRatio(value);
            markAsModified();
        });
    }

    if (flowScaleSlider) {
        flowScaleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            flowScaleValue.textContent = value.toFixed(4);
            system.setFlowScale(value);
            markAsModified();
        });
    }

    if (flowForceSlider) {
        flowForceSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            flowForceValue.textContent = value.toFixed(2);
            system.setFlowForce(value);
            markAsModified();
        });
    }

    if (flowSpeedSlider) {
        flowSpeedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            flowSpeedValue.textContent = value.toFixed(2);
            system.setFlowSpeed(value);
            markAsModified();
        });
    }

    screenshotBtn.addEventListener('click', () => {
        system.takeScreenshot();
    });

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
        showModePanel('starfield');

        if (waveFreqSlider) { waveFreqSlider.value = 0.008; waveFreqValue.textContent = '0.0080'; }
        if (waveAmpSlider) { waveAmpSlider.value = 60; waveAmpValue.textContent = '60'; }
        if (waveLayersSlider) { waveLayersSlider.value = 4; waveLayersValue.textContent = '4'; }
        if (fractalDepthSlider) { fractalDepthSlider.value = 8; fractalDepthValue.textContent = '8'; }
        if (fractalAngleSlider) { fractalAngleSlider.value = 0.5; fractalAngleValue.textContent = '0.50'; }
        if (fractalRatioSlider) { fractalRatioSlider.value = 0.67; fractalRatioValue.textContent = '0.67'; }
        if (flowScaleSlider) { flowScaleSlider.value = 0.004; flowScaleValue.textContent = '0.0040'; }
        if (flowForceSlider) { flowForceSlider.value = 0.25; flowForceValue.textContent = '0.25'; }
        if (flowSpeedSlider) { flowSpeedSlider.value = 0.7; flowSpeedValue.textContent = '0.70'; }

        themeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-theme="cool"]').classList.add('active');
        customColorGroup.style.display = 'none';

        linkSlider.value = 0;
        linkValue.textContent = '0';

        fadeSlider.value = 0.15;
        fadeValue.textContent = '0.15';

        system.reset();
        renderPresetList();
    });

    const savePresetBtn = document.getElementById('savePresetBtn');
    const savePresetInput = document.getElementById('savePresetInput');
    const presetNameInput = document.getElementById('presetNameInput');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const cancelSaveBtn = document.getElementById('cancelSaveBtn');
    const randomPresetBtn = document.getElementById('randomPresetBtn');

    savePresetBtn.addEventListener('click', () => {
        savePresetInput.style.display = 'block';
        presetNameInput.value = '';
        presetNameInput.focus();
    });

    cancelSaveBtn.addEventListener('click', () => {
        savePresetInput.style.display = 'none';
        presetNameInput.value = '';
    });

    confirmSaveBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            alert('请输入预设名称');
            presetNameInput.focus();
            return;
        }
        
        const presets = getPresets();
        const existing = presets.find(p => p.name === name);
        if (existing && !confirm(`预设 "${name}" 已存在，是否覆盖？`)) {
            return;
        }

        savePreset(name, system.getCurrentPreset());
        system.currentPresetName = name;
        savePresetInput.style.display = 'none';
        presetNameInput.value = '';
        renderPresetList();
    });

    presetNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmSaveBtn.click();
        }
    });

    randomPresetBtn.addEventListener('click', () => {
        system.randomizeCurrentMode();
        updateSlidersFromSystem();
        renderPresetList();
    });

    initDefaultPresets();
    renderPresetList();
});
