// Particle Morphing — script.js

class ParticleMorphing {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.textInput  = document.getElementById('text-input');

        // Settings
        this.settings = {
            particleCount: 25000,
            particleSize:  0.12,
            speed:         0.08,
            mouseForce:    1.8,
            mouseRadius:   8,
            damping:       0.78,
            opacity:       0.85,
            shape:         'heart',
        };

        // Scene
        this.scene    = new THREE.Scene();
        this.camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 35;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, precision: 'highp' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 1);
        this.container.appendChild(this.renderer.domElement);

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (this.isMobile) this.settings.particleCount = 15000;

        this.targetPositions = [];
        this.velocities      = [];
        this.mouse           = new THREE.Vector2(-1000, -1000);

        // Text canvas
        this.textCanvas        = document.createElement('canvas');
        this.textCanvas.width  = 2000;
        this.textCanvas.height = 500;
        this.textCtx           = this.textCanvas.getContext('2d');

        // Color themes
        this.colorThemes = [
            { name:'وردي',    icon:'🌸', fn:(i)=>[1.0, 0.2+Math.random()*0.1, 0.6+Math.random()*0.1] },
            { name:'أزرق',    icon:'💙', fn:(i)=>[0.0, 0.4+Math.random()*0.1, 1.0] },
            { name:'ذهبي',    icon:'✨', fn:(i)=>[1.0, 0.8+Math.random()*0.1, 0.0] },
            { name:'أخضر',    icon:'💚', fn:(i)=>[0.0, 1.0, 0.5+Math.random()*0.1] },
            { name:'قوس قزح', icon:'🌈', fn:(i)=>{ const h=(i/this.settings.particleCount)*360; return this.hslToRgb(h/360,1.0,0.55); } },
            { name:'أبيض',    icon:'🤍', fn:(i)=>[1,1,1] },
            { name:'أحمر',    icon:'❤️', fn:(i)=>[1.0, 0.0, 0.0+Math.random()*0.1] },
            { name:'بنفسجي', icon:'💜', fn:(i)=>[0.6+Math.random()*0.1, 0.0, 1.0] },
        ];
        this.currentTheme = 0;
        this.customColor  = null;

        this.clock = new THREE.Clock();
        this.time  = 0;

        this.init();
        this.buildUI();
        this.setupEventListeners();
        this.animate();
    }

    // ===== HELPERS =====
    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1/6) return p + (q-p)*6*t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q-p)*(2/3-t)*6;
                return p;
            };
            const q = l < 0.5 ? l*(1+s) : l+s-l*s;
            const p = 2*l-q;
            r = hue2rgb(p, q, h+1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h-1/3);
        }
        return [r, g, b];
    }

    hexToRgb(hex) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? [parseInt(r[1],16)/255, parseInt(r[2],16)/255, parseInt(r[3],16)/255] : [1,1,1];
    }

    // ===== SHAPES =====
    getHeartPoint(t, u) {
        const x = 16 * Math.pow(Math.sin(u), 3) * Math.sin(t);
        const y = (13*Math.cos(u) - 5*Math.cos(2*u) - 2*Math.cos(3*u) - Math.cos(4*u)) * Math.sin(t);
        const z = 10 * Math.cos(t);
        return new THREE.Vector3(x*0.75, y*0.75, z*0.75);
    }

    getSpherePoint(i) {
        const phi   = Math.acos(1 - 2*(i/this.settings.particleCount));
        const theta = Math.sqrt(this.settings.particleCount * Math.PI) * phi;
        const r = 14;
        return new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }

    getShapeTarget(i, shape) {
        if (shape === 'sphere') return this.getSpherePoint(i);
        // default: heart
        const t = Math.acos(Math.random()*2-1);
        const u = Math.random()*Math.PI*2;
        return this.getHeartPoint(t, u);
    }

    // ===== INIT =====
    init() {
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }

        const n = this.settings.particleCount;
        const geometry  = new THREE.BufferGeometry();
        const posArray   = new Float32Array(n * 3);
        const colorArray = new Float32Array(n * 3);

        this.velocities      = [];
        this.targetPositions = [];

        for (let i = 0; i < n; i++) {
            posArray[i*3]   = (Math.random()-0.5)*200;
            posArray[i*3+1] = (Math.random()-0.5)*200;
            posArray[i*3+2] = (Math.random()-0.5)*200;
            this.velocities.push({ x:0, y:0, z:0 });
            const [r,g,b] = this.colorThemes[this.currentTheme].fn(i);
            colorArray[i*3]   = r;
            colorArray[i*3+1] = g;
            colorArray[i*3+2] = b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.setAttribute('color',    new THREE.BufferAttribute(colorArray, 3));

        const material = new THREE.PointsMaterial({
            size: this.settings.particleSize,
            vertexColors: true,
            transparent: true,
            opacity: this.settings.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        this.updateTargets(this.textInput.value);
    }

    // ===== COLORS =====
    applyColorTheme() {
        const colorAttr = this.particles.geometry.attributes.color;
        const n = this.settings.particleCount;
        if (this.customColor) {
            const [r,g,b] = this.hexToRgb(this.customColor);
            for (let i = 0; i < n; i++) {
                const v = 0.08;
                colorAttr.setXYZ(i,
                    Math.max(0, Math.min(1, r+(Math.random()-0.5)*v)),
                    Math.max(0, Math.min(1, g+(Math.random()-0.5)*v)),
                    Math.max(0, Math.min(1, b+(Math.random()-0.5)*v))
                );
            }
        } else {
            const theme = this.colorThemes[this.currentTheme];
            for (let i = 0; i < n; i++) {
                const [r,g,b] = theme.fn(i);
                colorAttr.setXYZ(i, r, g, b);
            }
        }
        colorAttr.needsUpdate = true;
    }

    // ===== BUILD UI =====
    buildUI() {
        const colorBtn = document.getElementById('color-buttons');
        colorBtn.innerHTML = '';
        this.colorThemes.forEach((theme, idx) => {
            const btn = document.createElement('button');
            btn.className = `theme-btn ${idx === this.currentTheme ? 'active' : ''}`;
            btn.innerHTML = `<span>${theme.icon}</span><span class="label">${theme.name}</span>`;
            btn.addEventListener('click', () => {
                this.currentTheme = idx;
                this.customColor  = null;
                document.querySelectorAll('#color-buttons .theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('custom-color-picker').value = '#FF69B4';
                this.applyColorTheme();
            });
            colorBtn.appendChild(btn);
        });
    }

    // ===== TEXT SAMPLING =====
    sampleText(inputText) {
        if (!inputText || !inputText.trim()) return null;

        this.textCtx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
        this.textCtx.fillStyle = 'white';

        let fs = 140;
        const len = inputText.length;
        if (len > 40) fs = 35;
        else if (len > 30) fs = 50;
        else if (len > 20) fs = 70;
        else if (len > 15) fs = 90;
        else if (len > 10) fs = 110;

        if (window.innerWidth < 480) fs *= 0.6;
        else if (window.innerWidth < 768) fs *= 0.8;

        this.textCtx.font = `900 ${fs}px 'IBM Plex Sans Arabic', Tahoma, sans-serif`;
        this.textCtx.textAlign    = 'center';
        this.textCtx.textBaseline = 'middle';

        let m = this.textCtx.measureText(inputText);
        while (m.width > this.textCanvas.width * 0.85 && fs > 8) {
            fs -= 3;
            this.textCtx.font = `900 ${fs}px 'IBM Plex Sans Arabic', Tahoma, sans-serif`;
            m = this.textCtx.measureText(inputText);
        }

        this.textCtx.fillText(inputText, this.textCanvas.width/2, this.textCanvas.height/2);

        const imageData = this.textCtx.getImageData(0, 0, this.textCanvas.width, this.textCanvas.height).data;
        const points = [];

        for (let y = 0; y < this.textCanvas.height; y++) {
            for (let x = 0; x < this.textCanvas.width; x++) {
                if (imageData[(y * this.textCanvas.width + x) * 4 + 3] > 100) {
                    points.push({
                        x:  (x - this.textCanvas.width/2)  * 0.06,
                        y: -(y - this.textCanvas.height/2) * 0.06,
                        z:  (Math.random()-0.5) * 1.2,
                    });
                }
            }
        }
        return points;
    }

    // ===== UPDATE TARGETS =====
    updateTargets(inputText) {
        const textPoints = this.sampleText(inputText);
        const isText = textPoints && textPoints.length > 0;
        const n = this.settings.particleCount;

        for (let i = 0; i < n; i++) {
            if (isText) {
                const t = textPoints[i % textPoints.length];
                this.targetPositions[i] = {
                    x: t.x + (Math.random()-0.5)*0.1,
                    y: t.y + (Math.random()-0.5)*0.1,
                    z: t.z + (Math.random()-0.5)*0.1,
                };
            } else {
                const p = this.getShapeTarget(i, this.settings.shape);
                this.targetPositions[i] = {
                    x: p.x + (Math.random()-0.5)*0.4,
                    y: p.y + (Math.random()-0.5)*0.4,
                    z: p.z + (Math.random()-0.5)*0.4,
                };
            }
        }
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Sidebar
        document.getElementById('toggle-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });
        document.getElementById('close-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
        });

        // Custom color
        document.getElementById('custom-color-picker').addEventListener('input', (e) => {
            this.customColor = e.target.value;
            document.querySelectorAll('#color-buttons .theme-btn').forEach(b => b.classList.remove('active'));
            this.applyColorTheme();
        });

        // Particle count
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.particleCount = parseInt(btn.dataset.count);
                this.init();
                this.applyColorTheme();
            });
        });

        // Shape
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.shape = btn.dataset.shape;
                if (!this.textInput.value.trim()) this.updateTargets('');
            });
        });

        // Sliders helper
        const mkSlider = (id, valId, key, fixed) => {
            const el = document.getElementById(id);
            const vl = document.getElementById(valId);
            el.addEventListener('input', () => {
                const v = parseFloat(el.value);
                this.settings[key] = v;
                vl.textContent = v.toFixed(fixed);
                if (key === 'particleSize') this.particles.material.size    = v;
                if (key === 'opacity')      this.particles.material.opacity = v;
            });
        };

        mkSlider('size-slider',    'size-val',   'particleSize', 2);
        mkSlider('speed-slider',   'speed-val',  'speed',        3);
        mkSlider('mouse-slider',   'mouse-val',  'mouseForce',   1);
        mkSlider('radius-slider',  'radius-val', 'mouseRadius',  0);
        mkSlider('damp-slider',    'damp-val',   'damping',      2);
        mkSlider('opacity-slider', 'opacity-val','opacity',      2);

        // Reset
        document.getElementById('reset-btn').addEventListener('click', () => {
            const d = { particleSize:0.12, speed:0.08, mouseForce:1.8, mouseRadius:8, damping:0.78, opacity:0.85 };
            Object.assign(this.settings, d);
            document.getElementById('size-slider').value    = 0.12;  document.getElementById('size-val').textContent    = '0.12';
            document.getElementById('speed-slider').value   = 0.08;  document.getElementById('speed-val').textContent   = '0.08';
            document.getElementById('mouse-slider').value   = 1.8;   document.getElementById('mouse-val').textContent   = '1.8';
            document.getElementById('radius-slider').value  = 8;     document.getElementById('radius-val').textContent  = '8';
            document.getElementById('damp-slider').value    = 0.78;  document.getElementById('damp-val').textContent    = '0.78';
            document.getElementById('opacity-slider').value = 0.85;  document.getElementById('opacity-val').textContent = '0.85';
            this.particles.material.size    = 0.12;
            this.particles.material.opacity = 0.85;
        });

        // Mouse
        window.addEventListener('mousemove', (e) => {
            this.mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('touchmove', (e) => {
            if (e.target.id !== 'text-input') {
                e.preventDefault();
                const t = e.touches[0];
                this.mouse.x =  (t.clientX / window.innerWidth)  * 2 - 1;
                this.mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.updateTargets(this.textInput.value);
        });

        this.textInput.addEventListener('input', (e) => this.updateTargets(e.target.value));
    }

    // ===== ANIMATION LOOP =====
    animate = () => {
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();
        this.time += delta;

        const posAttr   = this.particles.geometry.attributes.position;
        const colorAttr = this.particles.geometry.attributes.color;
        const n         = this.settings.particleCount;

        // Mouse world position
        const vec = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
        vec.unproject(this.camera);
        const dir  = vec.sub(this.camera.position).normalize();
        const dist = -this.camera.position.z / dir.z;
        const mPos = this.camera.position.clone().add(dir.multiplyScalar(dist));

        const isRainbow = !this.customColor && this.currentTheme === 4;

        for (let i = 0; i < n; i++) {
            const px = posAttr.getX(i);
            const py = posAttr.getY(i);
            const pz = posAttr.getZ(i);

            const target = this.targetPositions[i];
            if (!target) continue;

            // Spring to target
            this.velocities[i].x += (target.x - px) * this.settings.speed;
            this.velocities[i].y += (target.y - py) * this.settings.speed;
            this.velocities[i].z += (target.z - pz) * this.settings.speed;

            // Mouse repulsion
            const dx = px - mPos.x;
            const dy = py - mPos.y;
            const dz = pz - mPos.z;
            const d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
            const r  = this.settings.mouseRadius;

            if (d < r && d > 0.001) {
                const force = (r - d) / r;
                this.velocities[i].x += (dx/d) * force * this.settings.mouseForce;
                this.velocities[i].y += (dy/d) * force * this.settings.mouseForce;
                this.velocities[i].z += (dz/d) * force * this.settings.mouseForce;
            }

            // Damping
            this.velocities[i].x *= this.settings.damping;
            this.velocities[i].y *= this.settings.damping;
            this.velocities[i].z *= this.settings.damping;

            posAttr.setXYZ(
                i,
                px + this.velocities[i].x,
                py + this.velocities[i].y,
                pz + this.velocities[i].z
            );

            // Live rainbow update
            if (isRainbow) {
                const hue = ((i/n) + this.time * 0.1) % 1;
                const [r2, g2, b2] = this.hslToRgb(hue, 1.0, 0.55);
                colorAttr.setXYZ(i, r2, g2, b2);
            }
        }

        posAttr.needsUpdate = true;
        if (isRainbow) colorAttr.needsUpdate = true;

        this.renderer.render(this.scene, this.camera);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    new ParticleMorphing();
});
