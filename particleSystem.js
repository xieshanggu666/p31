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
        this.mouseInteractionRadius = 150;
        this.trailParticles = [];
        this.lastMouseX = null;
        this.lastMouseY = null;
        this.isMouseDown = false;
        this.maxTrailParticles = 1000;

        this.themeColors = {
            cool: ['#00ffff', '#00aaff', '#0066ff', '#66ccff', '#3399ff', '#00ccff'],
            warm: ['#ff6b6b', '#ffa502', '#ff7f50', '#ff4757', '#ff6348', '#ff3838'],
            neon: ['#ff00ff', '#00ffff', '#ffff00', '#ff0080', '#80ff00', '#00ff80']
        };

        this.currentPresetName = null;
        this.dpr = window.devicePixelRatio || 1;

        this.resize();
        this.initParticles();
        this.bindEvents();
        this.animate();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
    }

    initParticles() {
        this.particles = [];
        this.trailParticles = [];
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

            if (this.interaction === 'draw') {
                this.spawnTrailParticle(this.mouseX, this.mouseY);
            }

            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            if (this.interaction === 'draw') {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.spawnTrailParticle(x, y);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseX = null;
            this.mouseY = null;
            this.lastMouseX = null;
            this.lastMouseY = null;
            this.isMouseDown = false;
        });

        window.addEventListener('resize', () => {
            this.resize();
            this.initParticles();
        });
    }

    spawnTrailParticle(x, y) {
        if (this.trailParticles.length >= this.maxTrailParticles) {
            this.trailParticles.shift();
        }

        const life = 2 + Math.random() * 3;
        const particle = new Particle(x, y, {
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            size: Math.random() * this.particleSize * 0.5 + this.particleSize * 0.5,
            color: this.getThemeColor(),
            life: life,
            maxLife: life,
            mode: 'trail',
            glow: this.glowIntensity,
            alpha: 1,
            tailLength: 5
        });
        this.trailParticles.push(particle);
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

        const aliveTrailParticles = [];
        for (let i = 0; i < this.trailParticles.length; i++) {
            const p = this.trailParticles[i];
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
                aliveTrailParticles.push(p);
            }
        }
        this.trailParticles = aliveTrailParticles;

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

        for (const particle of this.trailParticles) {
            particle.glow = this.glowIntensity;
            particle.draw(this.ctx);
        }

        this.drawMouseIndicator();
    }

    drawMouseIndicator() {
        if (this.mouseX === null || this.mouseY === null) return;

        this.ctx.save();
        const radius = this.mouseInteractionRadius;

        if (this.interaction === 'draw') {
            const gradient = this.ctx.createRadialGradient(
                this.mouseX, this.mouseY, 0,
                this.mouseX, this.mouseY, radius
            );
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
            gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (this.interaction === 'attract') {
            const gradient = this.ctx.createRadialGradient(
                this.mouseX, this.mouseY, 0,
                this.mouseX, this.mouseY, radius
            );
            gradient.addColorStop(0, 'rgba(0, 255, 200, 0.2)');
            gradient.addColorStop(0.5, 'rgba(0, 255, 200, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (this.interaction === 'repel') {
            const gradient = this.ctx.createRadialGradient(
                this.mouseX, this.mouseY, 0,
                this.mouseX, this.mouseY, radius
            );
            gradient.addColorStop(0, 'rgba(255, 100, 50, 0.2)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 50, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 50, 100, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
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
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        const offscreenCtx = offscreenCanvas.getContext('2d');
        offscreenCtx.drawImage(this.canvas, 0, 0, width, height);

        const dataURL = offscreenCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `particle-art-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    }

    async recordGif(duration = 3000, frameInterval = 100, onProgress) {
        const totalFrames = Math.floor(duration / frameInterval);
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        const encoder = new GIFEncoder(width, height);
        encoder.setDelay(frameInterval);

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        for (let i = 0; i < totalFrames; i++) {
            offscreenCtx.clearRect(0, 0, width, height);
            offscreenCtx.drawImage(this.canvas, 0, 0, width, height);
            const imageData = offscreenCtx.getImageData(0, 0, width, height);
            encoder.addFrame(imageData);
            if (onProgress) {
                onProgress(i + 1, totalFrames);
            }
            await new Promise(resolve => setTimeout(resolve, frameInterval));
        }

        const dataURL = encoder.getDataURL();
        const link = document.createElement('a');
        link.download = `particle-animation-${Date.now()}.gif`;
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
