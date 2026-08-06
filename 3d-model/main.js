import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// --- 1. SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87CEEB'); // A clear sky

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Adjusted the starting camera position to account for the new 10x10 house offset
camera.position.set(12, 1.7, -12); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 2. LAYERS (GROUPS) ---
const layers = {
    architecture: new THREE.Group(),
    fixtures: new THREE.Group(),
    furnishings: new THREE.Group(),
    helpers: new THREE.Group(),
    openings: new THREE.Group() // For doors and windows
};

// To move the origin 10 units left and 10 units back relative to the house,
// we shift the house 10 units right (+X) and 10 units forward (+Z in left-handed, -Z in Three.js).
const houseGroup = new THREE.Group();
houseGroup.position.set(10, 0, -10);
houseGroup.add(layers.architecture, layers.fixtures, layers.furnishings, layers.openings);

// Add the offset house and the fixed helpers to the main scene
scene.add(houseGroup, layers.helpers);

// --- 3. GRID, AXES & LABELS SETUP ---
const gridHelper = new THREE.GridHelper(50, 50, 0xffffff, 0xffffff);
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.15; 
gridHelper.position.set(25, 0.01, -25); 
layers.helpers.add(gridHelper);

const axesHelper = new THREE.AxesHelper(3);
axesHelper.position.set(0, 0.02, 0); 
layers.helpers.add(axesHelper);

// Function to create text labels for the axes
function createTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.5, 1.5, 1.5);
    return sprite;
}

// Attach X, Y, Z labels to the axes helper
const xLabel = createTextSprite('X', '#ff5555');
xLabel.position.set(3.5, 0.2, 0);
axesHelper.add(xLabel);

const yLabel = createTextSprite('Y', '#55ff55');
yLabel.position.set(0, 3.5, 0);
axesHelper.add(yLabel);

const zLabel = createTextSprite('Z', '#5555ff');
zLabel.position.set(0, 0.2, -3.5); // Remember Three.js negative Z is our positive depth
axesHelper.add(zLabel);

// --- 4. DATA PARSING & GEOMETRY GENERATION ---
function createBox(data, group) {
    const geometry = new THREE.BoxGeometry(data.w, data.h, data.d);
    
    geometry.translate(data.w / 2, data.h / 2, -data.d / 2);
    
    const material = new THREE.MeshLambertMaterial({ color: data.color });
    
    // Apply glass transparency if the object is a window
    if (data.type === 'window') {
        material.transparent = true;
        material.opacity = 0.4;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(data.x, data.y, -data.z); 
    group.add(mesh);
}

async function loadHouseData() {
    try {
        const [archRes, fixRes, furnRes, lightRes, openRes] = await Promise.all([
            fetch('/data/architecture.json'),
            fetch('/data/fixtures.json'),
            fetch('/data/furnishings.json'),
            fetch('/data/lighting.json'),
            fetch('/data/openings.json')
        ]);

        const archData = await archRes.json();
        const fixData = await fixRes.json();
        const furnData = await furnRes.json();
        const lightData = await lightRes.json();
        const openData = await openRes.json();

        archData.forEach(item => createBox(item, layers.architecture));
        fixData.forEach(item => createBox(item, layers.fixtures));
        furnData.forEach(item => createBox(item, layers.furnishings));
        openData.forEach(item => createBox(item, layers.openings));

        const ambientLight = new THREE.AmbientLight(lightData.ambient.color, lightData.ambient.intensity);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(lightData.sun.color, lightData.sun.intensity);
        // Sun remains attached to the global scene, unaffected by the house's local offset
        dirLight.position.set(lightData.sun.x, lightData.sun.y, -lightData.sun.z);
        scene.add(dirLight);
    } catch (err) {
        console.error("Error loading JSON blueprints:", err);
    }
}
loadHouseData();

// --- 5. CONTROLS (WASD + Flying) ---
const controls = new PointerLockControls(camera, document.body);

document.addEventListener('click', () => {
    controls.lock();
});

const keys = { w: false, a: false, s: false, d: false, ' ': false, shift: false };

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    
    if (key === '1') layers.architecture.visible = !layers.architecture.visible;
    if (key === '2') layers.fixtures.visible = !layers.fixtures.visible;
    if (key === '3') layers.furnishings.visible = !layers.furnishings.visible;
    if (key === '4') layers.helpers.visible = !layers.helpers.visible;
    if (key === '5') layers.openings.visible = !layers.openings.visible;
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// --- 6. RENDER LOOP ---
const clock = new THREE.Clock();
const walkSpeed = 4.0;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (controls.isLocked) {
        if (keys.w) controls.moveForward(walkSpeed * delta);
        if (keys.s) controls.moveForward(-walkSpeed * delta);
        if (keys.a) controls.moveRight(-walkSpeed * delta);
        if (keys.d) controls.moveRight(walkSpeed * delta);
        
        if (keys[' ']) camera.position.y += walkSpeed * delta;
        if (keys.shift) camera.position.y -= walkSpeed * delta;
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});