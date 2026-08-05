import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7.5, 15, 5); // Positioned to look down at the floorplan
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

// 2. Data Loading & Building
async function buildArchitecture() {
    try {
        const response = await fetch('./data/architecture.json');
        if (!response.ok) throw new Error("Could not load architecture.json");
        const data = await response.json();

        const houseGroup = new THREE.Group();

        // Build Rooms
        data.rooms.forEach(room => {
            const geometry = new THREE.PlaneGeometry(room.width, room.depth);
            // Convert hex string from JSON to a number for Three.js
            const material = new THREE.MeshLambertMaterial({ color: parseInt(room.color, 16) });
            const floor = new THREE.Mesh(geometry, material);
            
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(room.x + room.width/2, room.elevation, -(room.z + room.depth/2));
            houseGroup.add(floor);
        });

        // Build Walls
        const WALL_HEIGHT = 2.5;
        data.walls.forEach(w => {
            const h = w.h !== undefined ? w.h : WALL_HEIGHT;
            const yOffset = w.yOffset !== undefined ? w.yOffset : 0;
            const wallColor = w.isExterior ? 0x333333 : 0xE0E0E0; // Assuming basic ext/int colors
            
            const geometry = new THREE.BoxGeometry(w.w, h, w.d);
            const material = new THREE.MeshLambertMaterial({ color: wallColor });
            const wall = new THREE.Mesh(geometry, material);
            
            wall.position.set(w.x + w.w/2, (h/2) + yOffset, -(w.z + w.d/2));
            houseGroup.add(wall);
        });

        scene.add(houseGroup);

    } catch (error) {
        console.error("Error building architecture:", error);
    }
}

// 3. Render Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize
buildArchitecture();
animate();

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
