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

        if (this.mode !== 'trail' && mouseX !== null && mouseY !== null) {
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

        if (this.mode === 'trail') {
            this.life -= 1 / 60;
            this.alpha = Math.max(0, this.life / this.maxLife);
            this.vx *= 0.96;
            this.vy *= 0.96;
            this.x += this.vx * speed;
            this.y += this.vy * speed;
        } else {
            this.updateByMode(mode, canvasWidth, canvasHeight, modeParams || {});

            this.vx *= 0.98;
            this.vy *= 0.98;

            if (mode !== 'wave') {
                this.x += this.vx * speed;
                this.y += this.vy * speed;
            }
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
