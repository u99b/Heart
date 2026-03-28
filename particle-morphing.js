// Particle Morphing - 3D Particle Animation
// استخدم Three.js لإنشاء تأثير تحول الجسيمات

class ParticleMorphing {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.textInput = document.getElementById('text-input');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 35;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, precision: 'highp' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.container.appendChild(this.renderer.domElement);

        // Mobile detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.particleCount = this.isMobile ? 20000 : 40000;

        // Particle data
        this.targetPositions = [];
        this.velocities = [];
        this.mouse = new THREE.Vector2(-1000, -1000);

        // Text canvas for rendering text to particles
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = 800;
        this.textCanvas.height = 300;
        this.textCtx = this.textCanvas.getContext('2d');

        this.init();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const posArray = new Float32Array(this.particleCount * 3);
        const colorArray = new Float32Array(this.particleCount * 3);

        for (let i = 0; i < this.particleCount; i++) {
            posArray[i * 3] = (Math.random() - 0.5) * 200;
            posArray[i * 3 + 1] = (Math.random() - 0.5) * 200;
            posArray[i * 3 + 2] = (Math.random() - 0.5) * 200;

            this.velocities.push({ x: 0, y: 0, z: 0 });

            // Pink/Purple/Blue colors
            const r = 0.7 + Math.random() * 0.3;
            const g = 0.1 + Math.random() * 0.15;
            const b = 0.3 + Math.random() * 0.25;

            colorArray[i * 3] = r;
            colorArray[i * 3 + 1] = g;
            colorArray[i * 3 + 2] = b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

        const material = new THREE.PointsMaterial({
            size: this.isMobile ? 0.15 : 0.12,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        // Initialize target positions to heart shape
        this.updateTargets('');
    }

    setupEventListeners() {
        // Mouse movement
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Touch movement
        window.addEventListener('touchmove', (e) => {
            if (e.target.id !== 'text-input') {
                e.preventDefault();
                const touch = e.touches[0];
                this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
            }
        }, { passive: false });

        // Touch end
        window.addEventListener('touchend', () => {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        });

        // Window resize
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
        });

        // Text input
        this.textInput.addEventListener('input', (e) => {
            this.updateTargets(e.target.value);
        });
    }

    getHeartPoint(t, u) {
        const x = 16 * Math.pow(Math.sin(u), 3) * Math.sin(t);
        const y = (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * Math.sin(t);
        const z = 10 * Math.cos(t);
        return new THREE.Vector3(x * 0.75, y * 0.75, z * 0.75);
    }

    sampleText(inputText) {
        if (!inputText || inputText.trim() === '') return null;

        this.textCtx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
        this.textCtx.fillStyle = 'white';

        // Calculate font size based on text length and screen width
        let fontSize = 100;
        if (inputText.length > 15) {
            fontSize = 40;
        } else if (inputText.length > 10) {
            fontSize = 60;
        } else if (inputText.length > 8) {
            fontSize = 75;
        }

        // Reduce size on small screens
        if (window.innerWidth < 480) {
            fontSize = Math.max(30, fontSize * 0.6);
        } else if (window.innerWidth < 768) {
            fontSize = Math.max(40, fontSize * 0.75);
        }

        this.textCtx.font = `900 ${fontSize}px sans-serif`;
        this.textCtx.textAlign = 'center';
        this.textCtx.textBaseline = 'middle';
        this.textCtx.fillText(inputText, this.textCanvas.width / 2, this.textCanvas.height / 2);

        const imageData = this.textCtx.getImageData(0, 0, this.textCanvas.width, this.textCanvas.height).data;
        const points = [];

        // Sample fewer pixels on small screens for better performance
        const sampleStep = window.innerWidth < 480 ? 2 : 1;

        for (let y = 0; y < this.textCanvas.height; y += sampleStep) {
            for (let x = 0; x < this.textCanvas.width; x += sampleStep) {
                const alpha = imageData[(y * this.textCanvas.width + x) * 4 + 3];
                if (alpha > 150) {
                    points.push({
                        x: (x - this.textCanvas.width / 2) * 0.1,
                        y: -(y - this.textCanvas.height / 2) * 0.1,
                        z: (Math.random() - 0.5) * 1.5,
                    });
                }
            }
        }

        return points;
    }

    updateTargets(inputText) {
        const textPoints = this.sampleText(inputText);
        const isTextMode = textPoints !== null && textPoints.length > 0;

        for (let i = 0; i < this.particleCount; i++) {
            if (isTextMode && textPoints) {
                const target = textPoints[i % textPoints.length];
                this.targetPositions[i] = {
                    x: target.x + (Math.random() - 0.5) * 0.1,
                    y: target.y + (Math.random() - 0.5) * 0.1,
                    z: target.z + (Math.random() - 0.5) * 0.1,
                };
            } else {
                const t = Math.acos(Math.random() * 2 - 1);
                const u = Math.random() * Math.PI * 2;
                const p = this.getHeartPoint(t, u);
                this.targetPositions[i] = {
                    x: p.x + (Math.random() - 0.5) * 0.4,
                    y: p.y + (Math.random() - 0.5) * 0.4,
                    z: p.z + (Math.random() - 0.5) * 0.4,
                };
            }
        }
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        const posAttr = this.particles.geometry.attributes.position;

        // Calculate mouse position in 3D space
        const vector = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
        vector.unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const mPos = this.camera.position.clone().add(dir.multiplyScalar(distance));

        // Update particles
        for (let i = 0; i < this.particleCount; i++) {
            let px = posAttr.getX(i);
            let py = posAttr.getY(i);
            let pz = posAttr.getZ(i);

            const target = this.targetPositions[i];

            // Repulsion from mouse
            const dx = px - mPos.x;
            const dy = py - mPos.y;
            const dz = pz - mPos.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(distSq);

            if (dist < 8) {
                const force = (8 - dist) / 8;
                this.velocities[i].x += (dx / dist) * force * 1.8;
                this.velocities[i].y += (dy / dist) * force * 1.8;
                this.velocities[i].z += (dz / dist) * force * 1.8;
            }

            // Attraction to target
            this.velocities[i].x += (target.x - px) * 0.08;
            this.velocities[i].y += (target.y - py) * 0.08;
            this.velocities[i].z += (target.z - pz) * 0.08;

            // Damping
            this.velocities[i].x *= 0.78;
            this.velocities[i].y *= 0.78;
            this.velocities[i].z *= 0.78;

            posAttr.setXYZ(
                i,
                px + this.velocities[i].x,
                py + this.velocities[i].y,
                pz + this.velocities[i].z
            );
        }

        posAttr.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ParticleMorphing();
});
