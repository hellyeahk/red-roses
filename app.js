        const canvas = document.getElementById('roseCanvas');
        const ctx = canvas.getContext('2d', { alpha: false });

        const bgCanvas = document.createElement('canvas');
        const bgCtx = bgCanvas.getContext('2d', { alpha: false });
        const sprites = {};

        let width = window.innerWidth;
        let height = window.innerHeight;
        let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        let roses = [];
        let fireflies = [];
        let fallingPetals = [];
        let globalTime = 0;
        let lastTimestamp = 0;
        let pointerX = width * 0.5;
        let breeze = 0;
        let breezeVel = 0;

        // ============================================================================
        // MATH & EASING UTILITIES
        // ============================================================================
        function randomRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        function clamp(val, min, max) {
            return Math.min(Math.max(val, min), max);
        }

        function lerp(a, b, t) {
            return a + (b - a) * t;
        }

        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function easeOutQuint(t) {
            return 1 - Math.pow(1 - t, 5);
        }

        // ============================================================================
        // VELVET ROSE CULTIVAR PALETTES (DEEP CRIMSON & RUBY RED ROSES)
        // ============================================================================
        const ROSE_PALETTES = [
            {
                name: 'Deep Velvet Red',
                deepBase: '#290109',
                midPetal: '#8a061e',
                outerPetal: '#cc1033',
                tipHighlight: '#fb7185',
                rimHighlight: 'rgba(254, 205, 211, 0.72)',
                glow: 'crimson'
            },
            {
                name: 'Ruby Scarlet Red',
                deepBase: '#38030e',
                midPetal: '#a10d29',
                outerPetal: '#e11d48',
                tipHighlight: '#fda4af',
                rimHighlight: 'rgba(255, 228, 230, 0.78)',
                glow: 'crimson'
            },
            {
                name: 'Dark Borgogna Red',
                deepBase: '#1d0106',
                midPetal: '#6e0518',
                outerPetal: '#b00c2b',
                tipHighlight: '#f43f5e',
                rimHighlight: 'rgba(253, 164, 175, 0.65)',
                glow: 'crimson'
            }
        ];

        // ============================================================================
        // OFFSCREEN GLOW SPRITES & NOCTURNAL ROSE GARDEN BACKDROP
        // ============================================================================
        function createRadialSprite(size, stops) {
            const off = document.createElement('canvas');
            off.width = size;
            off.height = size;
            const octx = off.getContext('2d');
            const half = size * 0.5;
            const grad = octx.createRadialGradient(half, half, 0, half, half, half);
            stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
            octx.fillStyle = grad;
            octx.fillRect(0, 0, size, size);
            return off;
        }

        function initSprites() {
            sprites.crimson = createRadialSprite(240, [
                [0.0, 'rgba(225, 29, 72, 0.34)'],
                [0.45, 'rgba(159, 18, 57, 0.14)'],
                [1.0, 'rgba(0, 0, 0, 0)']
            ]);
            sprites.firefly = createRadialSprite(44, [
                [0.0, 'rgba(254, 249, 195, 0.96)'],
                [0.32, 'rgba(250, 204, 21, 0.45)'],
                [0.75, 'rgba(132, 204, 22, 0.10)'],
                [1.0, 'rgba(0, 0, 0, 0)']
            ]);
        }

        function rebuildGardenBackdrop() {
            const safeW = Math.max(1, Math.floor(width * dpr));
            const safeH = Math.max(1, Math.floor(height * dpr));
            bgCanvas.width = safeW;
            bgCanvas.height = safeH;
            bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const bgGrad = bgCtx.createRadialGradient(
                width * 0.5, height * 0.36, 30,
                width * 0.5, height * 0.55, Math.max(width, height) * 0.85
            );
            bgGrad.addColorStop(0.0, '#1e0b12');
            bgGrad.addColorStop(0.48, '#11070c');
            bgGrad.addColorStop(1.0, '#060305');
            bgCtx.fillStyle = bgGrad;
            bgCtx.fillRect(0, 0, width, height);

            // Soft romantic twilight bokeh
            bgCtx.save();
            bgCtx.globalCompositeOperation = 'screen';
            const bokehColors = [
                'rgba(225, 29, 72, 0.06)',
                'rgba(251, 113, 133, 0.05)',
                'rgba(253, 224, 71, 0.04)'
            ];
            for (let i = 0; i < 20; i++) {
                const bx = ((i * 179 + 37) % 100) / 100 * width;
                const by = ((i * 127 + 23) % 100) / 100 * height * 0.72;
                const br = 26 + (i % 5) * 20;
                const g = bgCtx.createRadialGradient(bx, by, 0, bx, by, br);
                g.addColorStop(0, bokehColors[i % bokehColors.length]);
                g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                bgCtx.fillStyle = g;
                bgCtx.beginPath();
                bgCtx.arc(bx, by, br, 0, Math.PI * 2);
                bgCtx.fill();
            }
            bgCtx.restore();

            // Rich dark garden soil mound at bottom
            const soilTop = height * 0.82;
            const soilGrad = bgCtx.createLinearGradient(0, soilTop, 0, height);
            soilGrad.addColorStop(0.0, 'rgba(18, 24, 15, 0)');
            soilGrad.addColorStop(0.35, 'rgba(15, 19, 12, 0.88)');
            soilGrad.addColorStop(1.0, '#050705');
            bgCtx.fillStyle = soilGrad;
            bgCtx.fillRect(0, soilTop, width, height - soilTop);
        }

        // ============================================================================
        // ATMOSPHERIC FIREFLIES & FALLING VELVET PETALS
        // ============================================================================
        function initAtmosphere() {
            const count = clamp(Math.floor((width * height) / 38000), 14, 28);
            fireflies = [];
            for (let i = 0; i < count; i++) {
                fireflies.push({
                    x: randomRange(0, width),
                    y: randomRange(0, height * 0.85),
                    vx: randomRange(-8, 8),
                    vy: randomRange(-11, -3),
                    size: randomRange(8, 15),
                    phase: randomRange(0, Math.PI * 2),
                    speed: randomRange(1.4, 2.6)
                });
            }
            fallingPetals = [];
        }

        function spawnRosePetalDrift(x, y, palette) {
            for (let i = 0; i < 10; i++) {
                const ang = randomRange(0, Math.PI * 2);
                const spd = randomRange(22, 75);
                fallingPetals.push({
                    x,
                    y,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - 18,
                    rot: randomRange(0, Math.PI * 2),
                    vRot: randomRange(-2.8, 2.8),
                    size: randomRange(5, 8.5),
                    color: palette.outerPetal,
                    life: 1.0
                });
            }
        }

        function updateAndDrawAtmosphere(context, dt) {
            context.save();
            context.globalCompositeOperation = 'screen';
            for (let i = 0; i < fireflies.length; i++) {
                const f = fireflies[i];
                f.x += (f.vx + breeze * 26) * dt + Math.sin(globalTime * 1.4 + f.phase) * 0.3;
                f.y += f.vy * dt;
                if (f.y < -20) {
                    f.y = height * 0.85;
                    f.x = randomRange(0, width);
                }
                if (f.x < -20) f.x = width + 20;
                if (f.x > width + 20) f.x = -20;

                const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(globalTime * f.speed + f.phase));
                context.globalAlpha = alpha;
                context.drawImage(sprites.firefly, f.x - f.size, f.y - f.size, f.size * 2, f.size * 2);
            }
            context.restore();

            for (let i = fallingPetals.length - 1; i >= 0; i--) {
                const p = fallingPetals[i];
                p.x += (p.vx + breeze * 34) * dt + Math.sin(globalTime * 3 + i) * 0.4;
                p.y += p.vy * dt;
                p.vy += 24 * dt;
                p.rot += p.vRot * dt;
                p.life -= dt * 0.55;

                if (p.life <= 0) {
                    fallingPetals.splice(i, 1);
                    continue;
                }

                context.save();
                context.translate(p.x, p.y);
                context.rotate(p.rot);
                context.globalAlpha = clamp(p.life, 0, 1);
                context.fillStyle = p.color;
                context.beginPath();
                context.moveTo(0, -p.size);
                context.bezierCurveTo(p.size, -p.size * 0.8, p.size * 0.9, p.size * 0.6, 0, p.size);
                context.bezierCurveTo(-p.size * 0.9, p.size * 0.6, -p.size, -p.size * 0.8, 0, -p.size);
                context.fill();
                context.restore();
            }
        }

        // ============================================================================
        // GARDEN ROSE — ANGULAR HYBRID TEA PETALS, LARGE SERRATED LEAVES & THORNS
        // ============================================================================
        class GardenRose {
            constructor(opts) {
                this.baseX = opts.baseX;
                this.baseY = opts.baseY;
                this.stemHeight = opts.stemHeight || 290;
                this.lean = opts.lean || 0;
                this.radius = opts.radius || 64;
                this.palette = opts.palette || ROSE_PALETTES[0];
                this.delay = opts.delay || 0;
                this.age = -this.delay;
                this.bloomDuration = 5.2;
                this.swayPhase = randomRange(0, Math.PI * 2);
                this.curveAmp = opts.curveAmp || randomRange(10, 16);
                this.headTilt = opts.headTilt !== undefined ? opts.headTilt : this.lean * 0.45;
                this.viewPitch = opts.viewPitch || 0.72;
                this.leaves = opts.leaves || [
                    { t: 0.44, dir: -1, scale: 1.08 },
                    { t: 0.68, dir: 1, scale: 0.96 }
                ];
            }

            update(dt) {
                this.age += dt;
            }

            evalStemPoint(t, swayOffset) {
                const sCurve = Math.sin(t * Math.PI * 1.15) * this.curveAmp * Math.sign(this.lean || 1);
                const bend = this.lean * Math.pow(t, 1.32) * this.stemHeight * 0.56 + sCurve + swayOffset * Math.pow(t, 1.6);
                return {
                    x: this.baseX + bend,
                    y: this.baseY - t * this.stemHeight
                };
            }

            drawThorn(context, x, y, dir, scale) {
                context.save();
                context.translate(x, y);
                context.scale(dir * scale, scale);
                context.beginPath();
                context.moveTo(0, -3.5);
                context.quadraticCurveTo(5, -2.5, 9, 1.5);
                context.quadraticCurveTo(3.5, 2.2, 0, 3.5);
                context.closePath();
                context.fillStyle = '#4c1d24';
                context.fill();
                context.restore();
            }

            drawCompoundRoseLeaf(context, x, y, dir, scale) {
                context.save();
                context.translate(x, y);
                context.scale(dir * scale, scale);

                // Thick woody-green petiole stem
                context.strokeStyle = '#365314';
                context.lineWidth = 2.6;
                context.lineCap = 'round';
                context.beginPath();
                context.moveTo(0, 0);
                context.quadraticCurveTo(26, -7, 52, 3);
                context.stroke();

                const drawSerratedLeaflet = (lx, ly, ang, len, wid) => {
                    context.save();
                    context.translate(lx, ly);
                    context.rotate(ang);

                    const teeth = 9;
                    context.beginPath();
                    context.moveTo(0, 0);

                    for (let i = 1; i <= teeth; i++) {
                        const t = i / (teeth + 1);
                        const profile = Math.sin(Math.pow(t, 0.75) * Math.PI);
                        const bx = t * len;
                        const by = -wid * profile;
                        const toothOutX = bx + (len / teeth) * 0.28;
                        const toothOutY = by - 2.3 * profile;
                        context.lineTo(toothOutX, toothOutY);
                        context.lineTo(bx + (len / teeth) * 0.55, by + 0.6);
                    }
                    context.lineTo(len, 0);

                    for (let i = teeth; i >= 1; i--) {
                        const t = i / (teeth + 1);
                        const profile = Math.sin(Math.pow(t, 0.75) * Math.PI);
                        const bx = t * len;
                        const by = wid * profile;
                        const toothOutX = bx + (len / teeth) * 0.28;
                        const toothOutY = by + 2.3 * profile;
                        context.lineTo(toothOutX, toothOutY);
                        context.lineTo(bx - (len / teeth) * 0.25, by - 0.6);
                    }
                    context.closePath();

                    const grad = context.createLinearGradient(0, -wid, len, wid);
                    grad.addColorStop(0.0, '#182c10');
                    grad.addColorStop(0.5, '#2b4c1b');
                    grad.addColorStop(1.0, '#3f6b28');
                    context.fillStyle = grad;
                    context.fill();

                    context.strokeStyle = 'rgba(163, 230, 53, 0.42)';
                    context.lineWidth = 1.0;
                    context.stroke();

                    // Central midrib & lateral veins
                    context.beginPath();
                    context.moveTo(3, 0);
                    context.lineTo(len * 0.90, 0);
                    for (let v = 1; v <= 4; v++) {
                        const vt = v * 0.19;
                        const vx = vt * len;
                        const vw = wid * Math.sin(Math.pow(vt, 0.75) * Math.PI) * 0.72;
                        context.moveTo(vx, 0);
                        context.lineTo(vx + len * 0.11, -vw);
                        context.moveTo(vx, 0);
                        context.lineTo(vx + len * 0.11, vw);
                    }
                    context.strokeStyle = 'rgba(190, 242, 100, 0.34)';
                    context.lineWidth = 0.85;
                    context.stroke();

                    context.restore();
                };

                // Large lush trifoliate rose leaves
                drawSerratedLeaflet(18, -3, -0.82, 34, 15.5);
                drawSerratedLeaflet(22, 2, 0.74, 33, 15.0);
                drawSerratedLeaflet(48, 3, 0.06, 44, 19.0);

                context.restore();
            }

            drawAngularRosePetal(context, w, h, pointSharpness, lipCurl, palette, isInner = false) {
                const tipY = -h * (0.86 + pointSharpness * 0.45);
                const shoulderY = -h * 0.56;

                const tracePetal = () => {
                    context.beginPath();
                    context.moveTo(-w * 0.40, h * 0.46);
                    context.bezierCurveTo(
                        -w * 1.04, h * 0.18,
                        -w * 1.06, -h * 0.34,
                        -w * 0.46, shoulderY
                    );
                    // Soft, natural heart-curved rose petal apex with subtle central point
                    context.bezierCurveTo(
                        -w * 0.24, -h * 0.78,
                        -w * 0.08, tipY,
                        0, tipY
                    );
                    context.bezierCurveTo(
                        w * 0.08, tipY,
                        w * 0.24, -h * 0.78,
                        w * 0.46, shoulderY
                    );
                    context.bezierCurveTo(
                        w * 1.06, -h * 0.34,
                        w * 1.04, h * 0.18,
                        w * 0.40, h * 0.46
                    );
                    context.closePath();
                };

                // 1. Soft dark occlusion shadow underneath each overlapping petal
                context.save();
                context.translate(0, 3.2);
                tracePetal();
                context.fillStyle = 'rgba(14, 0, 4, 0.58)';
                context.fill();
                context.restore();

                // 2. Rich multi-stop velvet crimson-to-ruby gradient for clear layer separation
                tracePetal();
                const pGrad = context.createLinearGradient(0, tipY, 0, h * 0.48);
                pGrad.addColorStop(0.00, isInner ? '#f43f5e' : palette.tipHighlight);
                pGrad.addColorStop(0.14, palette.outerPetal);
                pGrad.addColorStop(0.48, palette.midPetal);
                pGrad.addColorStop(0.82, '#3d020d');
                pGrad.addColorStop(1.00, '#170004');
                context.fillStyle = pGrad;
                context.fill();

                // 3. Full continuous velvet rim highlight around the entire upper edge (no broken half-lines)
                context.beginPath();
                context.moveTo(-w * 0.88, -h * 0.10);
                context.bezierCurveTo(
                    -w * 0.94, -h * 0.36,
                    -w * 0.68, -h * 0.52,
                    -w * 0.46, shoulderY
                );
                context.bezierCurveTo(
                    -w * 0.24, -h * 0.78,
                    -w * 0.08, tipY,
                    0, tipY
                );
                context.bezierCurveTo(
                    w * 0.08, tipY,
                    w * 0.24, -h * 0.78,
                    w * 0.46, shoulderY
                );
                context.bezierCurveTo(
                    w * 0.68, -h * 0.52,
                    w * 0.94, -h * 0.36,
                    w * 0.88, -h * 0.10
                );
                context.strokeStyle = palette.rimHighlight;
                context.lineWidth = Math.max(1.2, lipCurl * 0.95);
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.stroke();

                // 4. Subtle dark outer edge definition so overlapping petals never blend together
                tracePetal();
                context.strokeStyle = 'rgba(20, 1, 5, 0.65)';
                context.lineWidth = 1.0;
                context.stroke();
            }

            drawVelvetRoseHead(context, cx, cy, openAmount, tiltAngle) {
                if (openAmount <= 0.01) return;

                const R = this.radius * lerp(0.26, 1.0, easeOutCubic(openAmount));
                const pulse = 1 + Math.sin(globalTime * 1.8 + this.swayPhase) * 0.014 * openAmount;
                const finalR = R * pulse;

                const glowSprite = sprites[this.palette.glow] || sprites.crimson;
                const glowR = finalR * 2.15;
                context.save();
                context.globalCompositeOperation = 'screen';
                context.globalAlpha = clamp(openAmount * 0.82, 0, 1);
                context.drawImage(glowSprite, cx - glowR, cy - glowR, glowR * 2, glowR * 2);
                context.restore();

                context.save();
                context.translate(cx, cy);
                context.rotate(tiltAngle);

                // Green calyx receptacle & slender pointed reflexed sepals
                const cupBottomY = finalR * 0.44;
                context.beginPath();
                context.ellipse(0, cupBottomY - 2, finalR * 0.22, finalR * 0.13, 0, 0, Math.PI * 2);
                context.fillStyle = '#3f6212';
                context.fill();

                const sepalAngles = [-0.95, -0.35, 0.28, 0.92];
                sepalAngles.forEach((sa, idx) => {
                    context.save();
                    context.translate(Math.sin(sa) * finalR * 0.16, cupBottomY);
                    context.rotate(sa * 0.85);
                    context.beginPath();
                    context.moveTo(-4.5, 0);
                    context.quadraticCurveTo(-2.5, finalR * 0.34, 0, finalR * (0.56 + (idx % 2) * 0.12));
                    context.quadraticCurveTo(2.5, finalR * 0.34, 4.5, 0);
                    context.closePath();
                    const sGrad = context.createLinearGradient(0, 0, 0, finalR * 0.62);
                    sGrad.addColorStop(0, '#4d7c0f');
                    sGrad.addColorStop(1, '#1a2e05');
                    context.fillStyle = sGrad;
                    context.fill();
                    context.restore();
                });

                // Outer reflexed angular petals
                const openSpread = lerp(0.45, 1.0, openAmount);
                const outerTier = [
                    { x: -0.58, y: 0.10, rot: -1.12, w: 0.56, h: 0.58, sharp: 0.16, curl: 1.8 },
                    { x:  0.58, y: 0.08, rot:  1.10, w: 0.56, h: 0.58, sharp: 0.18, curl: 1.8 },
                    { x: -0.32, y: 0.22, rot: -1.48, w: 0.62, h: 0.54, sharp: 0.12, curl: 2.0 },
                    { x:  0.34, y: 0.20, rot:  1.45, w: 0.60, h: 0.54, sharp: 0.14, curl: 2.0 },
                    { x:  0.00, y: 0.25, rot:  3.12, w: 0.64, h: 0.44, sharp: 0.08, curl: 2.2 }
                ];

                outerTier.forEach((p) => {
                    context.save();
                    context.translate(p.x * finalR * openSpread, p.y * finalR);
                    context.rotate(p.rot * lerp(0.55, 1.0, openAmount));
                    this.drawAngularRosePetal(
                        context,
                        p.w * finalR,
                        p.h * finalR,
                        p.sharp,
                        p.curl,
                        this.palette,
                        false
                    );
                    context.restore();
                });

                // Mid cupped velvet tier
                const midTier = [
                    { x: -0.38, y: -0.10, rot: -0.56, w: 0.52, h: 0.58, sharp: 0.18, curl: 2.1 },
                    { x:  0.38, y: -0.12, rot:  0.54, w: 0.52, h: 0.58, sharp: 0.20, curl: 2.1 },
                    { x: -0.12, y: -0.22, rot: -0.14, w: 0.54, h: 0.56, sharp: 0.22, curl: 1.7 },
                    { x:  0.14, y: -0.20, rot:  0.18, w: 0.52, h: 0.56, sharp: 0.18, curl: 1.7 },
                    { x:  0.00, y:  0.08, rot:  0.04, w: 0.62, h: 0.48, sharp: 0.10, curl: 2.4 }
                ];

                midTier.forEach((p) => {
                    context.save();
                    context.translate(p.x * finalR * lerp(0.6, 1.0, openAmount), p.y * finalR);
                    context.rotate(p.rot * lerp(0.65, 1.0, openAmount));
                    this.drawAngularRosePetal(
                        context,
                        p.w * finalR,
                        p.h * finalR,
                        p.sharp,
                        p.curl,
                        this.palette,
                        false
                    );
                    context.restore();
                });

                // High-centered spiraling inner crown
                const crownY = -finalR * 0.16;
                const innerSpirals = [
                    { x: -0.22, y: crownY - 0.04 * finalR, rot: -0.36, w: 0.36, h: 0.42, sharp: 0.20, curl: 1.6 },
                    { x:  0.22, y: crownY - 0.04 * finalR, rot:  0.36, w: 0.36, h: 0.42, sharp: 0.20, curl: 1.6 },
                    { x:  0.00, y: crownY - 0.10 * finalR, rot:  0.05, w: 0.34, h: 0.38, sharp: 0.22, curl: 1.5 },
                    { x: -0.11, y: crownY + 0.02 * finalR, rot: -0.22, w: 0.28, h: 0.32, sharp: 0.16, curl: 1.4 },
                    { x:  0.11, y: crownY + 0.02 * finalR, rot:  0.22, w: 0.28, h: 0.32, sharp: 0.16, curl: 1.4 },
                    { x:  0.00, y: crownY - 0.02 * finalR, rot: -0.08, w: 0.20, h: 0.24, sharp: 0.18, curl: 1.3 }
                ];

                innerSpirals.forEach((sp) => {
                    context.save();
                    context.translate(sp.x * finalR * lerp(0.65, 1.0, openAmount), sp.y);
                    context.rotate(sp.rot);
                    this.drawAngularRosePetal(
                        context,
                        sp.w * finalR,
                        sp.h * finalR,
                        sp.sharp,
                        sp.curl,
                        this.palette,
                        true
                    );
                    context.restore();
                });

                // Velvet center
                context.beginPath();
                context.ellipse(0, crownY - finalR * 0.02, finalR * 0.08, finalR * 0.06, 0.2, 0, Math.PI * 2);
                context.fillStyle = this.palette.deepBase;
                context.fill();

                context.restore();
            }

            drawPlant(context) {
                if (this.age < 0) return;

                const growT = easeOutCubic(clamp(this.age / 1.8, 0, 1));
                const sway = Math.sin(globalTime * 1.45 + this.swayPhase) * 6 + breeze * 22;
                const tip = this.evalStemPoint(growT, sway);
                const ctrl = this.evalStemPoint(growT * 0.5, sway * 0.45);

                context.save();
                context.lineCap = 'round';

                // Main thorny rose stem
                context.beginPath();
                context.moveTo(this.baseX, this.baseY);
                context.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y);
                context.strokeStyle = '#1e3a16';
                context.lineWidth = 4.6;
                context.stroke();

                context.beginPath();
                context.moveTo(this.baseX - 1.0, this.baseY);
                context.quadraticCurveTo(ctrl.x - 1.0, ctrl.y, tip.x - 1.0, tip.y);
                context.strokeStyle = '#4d7c0f';
                context.lineWidth = 1.5;
                context.stroke();

                // Thorns along stem
                [0.24, 0.48, 0.72].forEach((tt, idx) => {
                    if (growT > tt) {
                        const pt = this.evalStemPoint(tt * growT, sway * tt);
                        this.drawThorn(context, pt.x, pt.y, idx % 2 === 0 ? -1 : 1, growT);
                    }
                });

                // Compound serrated rose leaves
                this.leaves.forEach((lf) => {
                    if (growT > lf.t) {
                        const lPos = this.evalStemPoint(lf.t * growT, sway * lf.t);
                        const lScale = lf.scale * easeOutCubic(clamp((growT - lf.t) / 0.35, 0, 1));
                        this.drawCompoundRoseLeaf(context, lPos.x, lPos.y, lf.dir, lScale);
                    }
                });

                context.restore();

                // Cupped velvet rose blossom at stem tip
                const bloomOpen = easeOutQuint(clamp((this.age - 0.12) / this.bloomDuration, 0, 1));
                const dynamicTilt = this.headTilt + sway * 0.004;
                this.drawVelvetRoseHead(context, tip.x, tip.y, bloomOpen, dynamicTilt);
            }
        }

        // ============================================================================
        // SCENE SEEDING & INTERACTION (FOCUSED 5-ROSE CASCADING ARRANGEMENT)
        // ============================================================================
        function seedRoseGarden() {
            roses = [];
            const minDim = Math.min(width, height);
            const scale = clamp(minDim / 680, 0.68, 1.25);
            const cx = width * 0.5;
            const groundY = height * 0.90;

            const bushLayout = [
                {
                    dx: -16 * scale, h: 420 * scale, lean: -0.08, r: 72 * scale, pal: 0, delay: 0.05, tilt: -0.10,
                    leaves: [
                        { t: 0.36, dir: -1, scale: 1.15 },
                        { t: 0.64, dir: 1, scale: 1.05 }
                    ]
                },
                {
                    dx: 24 * scale, h: 335 * scale, lean: 0.24, r: 76 * scale, pal: 1, delay: 0.18, tilt: 0.22,
                    leaves: [
                        { t: 0.42, dir: 1, scale: 1.18 },
                        { t: 0.72, dir: -1, scale: 0.98 }
                    ]
                },
                {
                    dx: -32 * scale, h: 270 * scale, lean: -0.26, r: 74 * scale, pal: 0, delay: 0.28, tilt: -0.20,
                    leaves: [
                        { t: 0.44, dir: -1, scale: 1.20 },
                        { t: 0.70, dir: 1, scale: 1.02 }
                    ]
                },
                {
                    dx: 10 * scale, h: 205 * scale, lean: 0.14, r: 78 * scale, pal: 1, delay: 0.36, tilt: 0.12,
                    leaves: [
                        { t: 0.48, dir: 1, scale: 1.12 }
                    ]
                },
                {
                    dx: -18 * scale, h: 145 * scale, lean: -0.16, r: 68 * scale, pal: 2, delay: 0.45, tilt: -0.14,
                    leaves: [
                        { t: 0.46, dir: -1, scale: 1.08 }
                    ]
                }
            ];

            bushLayout.forEach((item) => {
                roses.push(
                    new GardenRose({
                        baseX: cx + item.dx,
                        baseY: groundY,
                        stemHeight: item.h,
                        lean: item.lean,
                        radius: item.r,
                        palette: ROSE_PALETTES[item.pal],
                        delay: item.delay,
                        headTilt: item.tilt,
                        leaves: item.leaves
                    })
                );
            });
        }

        function spawnRoseAt(x, y) {
            if (roses.length >= 12) {
                roses.shift();
            }
            const minDim = Math.min(width, height);
            const scale = clamp(minDim / 680, 0.68, 1.22);
            const groundY = height * 0.90;
            const targetH = clamp(groundY - y, 120 * scale, height * 0.74);
            const palette = ROSE_PALETTES[Math.floor(Math.random() * ROSE_PALETTES.length)];
            const lean = randomRange(-0.28, 0.28);

            roses.push(
                new GardenRose({
                    baseX: x - lean * targetH * 0.45,
                    baseY: groundY,
                    stemHeight: targetH,
                    lean,
                    radius: randomRange(64, 78) * scale,
                    palette,
                    delay: 0,
                    headTilt: lean * 0.85
                })
            );
            spawnRosePetalDrift(x, y, palette);
        }

        function resizeCanvas() {
            width = Math.max(1, window.innerWidth);
            height = Math.max(1, window.innerHeight);
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);

            canvas.width = Math.max(1, Math.floor(width * dpr));
            canvas.height = Math.max(1, Math.floor(height * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            rebuildGardenBackdrop();
            initAtmosphere();
            seedRoseGarden();
        }

        function animate(timestamp) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
            lastTimestamp = timestamp;
            globalTime += dt;

            const springForce = -13.0 * breeze - 4.0 * breezeVel;
            breezeVel += springForce * dt;
            breeze += breezeVel * dt;

            if (bgCanvas.width > 0 && bgCanvas.height > 0) {
                ctx.drawImage(bgCanvas, 0, 0, width, height);
            }

            for (let i = 0; i < roses.length; i++) {
                roses[i].update(dt);
                roses[i].drawPlant(ctx);
            }

            updateAndDrawAtmosphere(ctx, dt);

            requestAnimationFrame(animate);
        }

        canvas.addEventListener('pointermove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const nx = e.clientX - rect.left;
            const dx = nx - pointerX;
            pointerX = nx;
            breezeVel = clamp(breezeVel + dx * 0.032, -3.2, 3.2);
        });

        canvas.addEventListener('pointerdown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            breezeVel = clamp(breezeVel + (x < width * 0.5 ? -1.3 : 1.3), -3.2, 3.2);
            spawnRoseAt(x, y);
        });

        window.addEventListener('resize', resizeCanvas);

        window.onload = function () {
            initSprites();
            resizeCanvas();
            setTimeout(resizeCanvas, 60);
            requestAnimationFrame(animate);
        };
