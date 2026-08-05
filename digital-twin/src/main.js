import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';

// 1. Scene & Camera Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7.5, 18, 2); 
camera.lookAt(7.5, 0, -8.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 30, -20); 
scene.add(dirLight);

// 2. Load Data & Build Models
async function initDigitalTwin() {
    try {
        const [archRes, furnRes] = await Promise.all([
            fetch('./data/architecture.json'),
            fetch('./data/furnishings.json').catch(() => null)
        ]);

        if (!archRes.ok) throw new Error("Could not load architecture.json");
        const archData = await archRes.json();

        const houseGroup = new THREE.Group();

        // Build Rooms
        archData.rooms.forEach(room => {
            const geometry = new THREE.PlaneGeometry(room.width, room.depth);
            const material = new THREE.MeshLambertMaterial({ color: parseInt(room.color, 16) });
            const floor = new THREE.Mesh(geometry, material);
            
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(room.x + room.width / 2, room.elevation, -(room.z + room.depth / 2));
            houseGroup.add(floor);
        });

        // Build Walls
        const WALL_HEIGHT = 2.5;
        archData.walls.forEach(w => {
            const h = w.h !== undefined ? w.h : WALL_HEIGHT;
            const yOffset = w.yOffset !== undefined ? w.yOffset : 0;
            let wallColor = w.isExterior ? 0x333333 : 0xE0E0E0;
            if (w.color !== undefined) wallColor = parseInt(w.color, 16);

            const geometry = new THREE.BoxGeometry(w.w, h, w.d);
            const material = new THREE.MeshLambertMaterial({ color: wallColor });
            const wall = new THREE.Mesh(geometry, material);
            
            wall.position.set(w.x + w.w / 2, (h / 2) + yOffset, -(w.z + w.d / 2));
            houseGroup.add(wall);
        });

        scene.add(houseGroup);

        // Build Furnishings & Openings
        if (furnRes && furnRes.ok) {
            const furnData = await furnRes.json();
            const furnishingsGroup = new THREE.Group();

            furnData.items.forEach(item => {
                const geometry = new THREE.BoxGeometry(item.w, item.h, item.d);
                const matOptions = { color: parseInt(item.color, 16) };
                
                if (item.transparent) {
                    matOptions.transparent = true;
                    matOptions.opacity = item.opacity !== undefined ? item.opacity : 0.5;
                }

                const material = new THREE.MeshLambertMaterial(matOptions);
                const mesh = new THREE.Mesh(geometry, material);

                mesh.position.set(item.x, item.y, item.z);
                if (item.rotationY) mesh.rotation.y = item.rotationY;

                furnishingsGroup.add(mesh);
            });

            scene.add(furnishingsGroup);
        }

    } catch (error) {
        console.error("Error building Digital Twin:", error);
    }
}

// 3. Render Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize
initDigitalTwin();
animate();

// Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});