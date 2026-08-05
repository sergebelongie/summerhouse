import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/PointerLockControls.js';
import { FontLoader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/geometries/TextGeometry.js';

// 1. Scene & Camera Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7.5, 1.6, 2.0); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Controls & UI
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');
let fallbackMode = false;

document.body.addEventListener('click', () => {
    if (!controls.isLocked && !fallbackMode) {
        controls.lock();
    }
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    crosshair.style.display = 'block';
    fallbackMode = false;
});

controls.addEventListener('unlock', () => {
    instructions.style.display = 'block';
    crosshair.style.display = 'none';
    fallbackMode = false;
});

controls.addEventListener('error', () => {
    fallbackMode = true;
    instructions.style.display = 'none'; 
    crosshair.style.display = 'block';
});

let isDragging = false;
document.addEventListener('mousedown', () => { if (fallbackMode) isDragging = true; });
document.addEventListener('mouseup', () => isDragging = false);
document.addEventListener('mousemove', (e) => {
    if (fallbackMode && isDragging) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= (e.movementX || 0) * 0.002;
        euler.x -= (e.movementY || 0) * 0.002;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
});

scene.add(controls.getObject());

// Grouping for Toggles
const roomLabelGroup = new THREE.Group();
const wallLabelGroup = new THREE.Group();
const furnitureLabelGroup = new THREE.Group();
const furnishingsGroup = new THREE.Group();
const ceilingGroup = new THREE.Group();
const lightsGroup = new THREE.Group(); // New group for JSON lighting

scene.add(roomLabelGroup);
scene.add(wallLabelGroup);
scene.add(furnitureLabelGroup);
scene.add(furnishingsGroup);
scene.add(ceilingGroup);
scene.add(lightsGroup);

// 2. Data Loading & Building
async function initDigitalTwin() {
    try {
        const [archRes, furnRes, lightRes] = await Promise.all([
            fetch('./data/architecture.json'),
            fetch('./data/furnishings.json').catch(() => null),
            fetch('./data/lighting.json').catch(() => null)
        ]);

        const archData = await archRes.json();
        const furnData = (furnRes && furnRes.ok) ? await furnRes.json() : { items: [] };
        const lightData = (lightRes && lightRes.ok) ? await lightRes.json() : { lights: [] };

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

        // Build Furnishings
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

        // Generate Labels, Roofs, and Lights
        buildLabels(archData.rooms, furnData.items, archData.walls);
        buildRoofsAndCeilings();
        buildLights(lightData.lights);

    } catch (error) {
        console.error("Error building Digital Twin:", error);
    }
}

// 3. Labels, Roof, and Lights Functions
function buildLights(lights) {
    if (!lights || lights.length === 0) {
        // Fallback lighting just in case the JSON fails to load
        const fallbackAmbient = new THREE.AmbientLight(0xffffff, 0.6);
        const fallbackDir = new THREE.DirectionalLight(0xffffff, 0.8);
        fallbackDir.position.set(20, 30, -20);
        lightsGroup.add(fallbackAmbient);
        lightsGroup.add(fallbackDir);
        return;
    }

    lights.forEach(l => {
        const color = parseInt(l.color, 16);
        let lightObj;

        if (l.type === 'ambient') {
            lightObj = new THREE.AmbientLight(color, l.intensity);
        } else if (l.type === 'directional') {
            lightObj = new THREE.DirectionalLight(color, l.intensity);
            lightObj.position.set(l.x, l.y, l.z);
       // ... inside buildLights() ...
    } else if (l.type === 'point') {
        lightObj = new THREE.PointLight(color, l.intensity, l.distance);
        
        // Add the minus sign to l.z right here!
        lightObj.position.set(l.x, l.y, -l.z); 
        
        // Create a tiny visible bulb for point lights to help with placement
        const bulbGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: color });
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        lightObj.add(bulbMesh); 
    }

        if (lightObj) lightsGroup.add(lightObj);
    });
}

function buildLabels(rooms, items, walls) {
    const loader = new FontLoader();
    loader.load('https://unpkg.com/three@0.136.0/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        
        const roomMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        rooms.forEach(room => {
            if (room.name) {
                const textGeo = new TextGeometry(room.name, { font: font, size: 0.3, height: 0.01 });
                textGeo.computeBoundingBox();
                const w = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
                const d = textGeo.boundingBox.max.z - textGeo.boundingBox.min.z;
                const mesh = new THREE.Mesh(textGeo, roomMat);
                mesh.position.set(room.x + room.width/2 - w/2, room.elevation + 0.02, -(room.z + room.depth/2) + d/2);
                mesh.rotation.x = -Math.PI / 2;
                roomLabelGroup.add(mesh);
            }
        });

        const wallTextMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const redLineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });

        walls.forEach((wall, index) => {
            const h = wall.h !== undefined ? wall.h : 2.5;
            const yOffset = wall.yOffset !== undefined ? wall.yOffset : 0;
            
            const centerX = wall.x + wall.w / 2;
            const centerY = (h / 2) + yOffset;
            const centerZ = -(wall.z + wall.d / 2);
            
            const topY = h + yOffset; 
            const labelY = topY + 0.6; 

            const boxGeo = new THREE.BoxGeometry(wall.w, h, wall.d);
            const edges = new THREE.EdgesGeometry(boxGeo);
            const outline = new THREE.LineSegments(edges, redLineMat);
            outline.position.set(centerX, centerY, centerZ);
            wallLabelGroup.add(outline);

            const linePoints = [
                new THREE.Vector3(centerX, topY, centerZ),   
                new THREE.Vector3(centerX, labelY, centerZ)  
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
            const connector = new THREE.Line(lineGeo, redLineMat);
            wallLabelGroup.add(connector);

            const textGeo = new TextGeometry(`W${index}`, { font: font, size: 0.15, height: 0.01 });
            textGeo.computeBoundingBox();
            const w = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
            const mesh = new THREE.Mesh(textGeo, wallTextMat);
            mesh.position.set(centerX - w/2, labelY, centerZ); 
            wallLabelGroup.add(mesh);
        });

        const furnMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        items.forEach(item => {
            if (item.name) {
                const textGeo = new TextGeometry(item.name, { font: font, size: 0.15, height: 0.01 });
                textGeo.computeBoundingBox();
                const w = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
                const mesh = new THREE.Mesh(textGeo, furnMat);
                mesh.position.set(item.x - w/2, item.y + (item.h/2) + 0.1, item.z);
                furnitureLabelGroup.add(mesh);
            }
        });
    });
}

function buildRoofsAndCeilings() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222222'; ctx.fillRect(0, 0, 512, 512);
    ctx.lineWidth = 1.5;
    for(let i = 0; i < 20000; i++) {
        ctx.beginPath();
        const x = Math.random() * 512, y = Math.random() * 512;
        const length = Math.random() * 15 + 5, angle = Math.random() * Math.PI;
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.strokeStyle = Math.random() > 0.5 ? '#111111' : '#333333'; ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(13, 10); 
    const ceilingMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

    const ceilingGeo = new THREE.PlaneGeometry(15.83, 6.02);
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(7.815, 2.27, -2.91); 
    ceiling.rotation.x = Math.PI / 2; 
    ceilingGroup.add(ceiling);

    const vaultShape = new THREE.Shape();
    vaultShape.moveTo(0, 0); vaultShape.lineTo(2.905, 0.73); vaultShape.lineTo(5.81, 0); 
    vaultShape.lineTo(5.81, 0.05); vaultShape.lineTo(2.905, 0.78); vaultShape.lineTo(0, 0.05); vaultShape.lineTo(0, 0);
    const vaultGeo = new THREE.ExtrudeGeometry(vaultShape, { depth: 11.3, bevelEnabled: false });
    const vault = new THREE.Mesh(vaultGeo, ceilingMat);
    vault.position.set(9.42, 2.27, -17.12); 
    ceilingGroup.add(vault);

    const roofMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const roofShapeFront = new THREE.Shape();
    roofShapeFront.moveTo(0, 0); roofShapeFront.lineTo(3.2, 1.2); roofShapeFront.lineTo(6.4, 0); roofShapeFront.lineTo(0, 0);
    const roofGeoFront = new THREE.ExtrudeGeometry(roofShapeFront, { depth: 16.2, bevelEnabled: false });
    const roofFront = new THREE.Mesh(roofGeoFront, roofMat);
    roofFront.rotation.y = Math.PI / 2; roofFront.position.set(-0.2, 2.5, 0.2); 
    ceilingGroup.add(roofFront);

    const roofShapeBack = new THREE.Shape();
    roofShapeBack.moveTo(-0.4, 0); roofShapeBack.lineTo(2.905, 1.2); roofShapeBack.lineTo(6.21, 0); roofShapeBack.lineTo(-0.4, 0);
    const roofGeoBack = new THREE.ExtrudeGeometry(roofShapeBack, { depth: 11.7, bevelEnabled: false });
    const roofBack = new THREE.Mesh(roofGeoBack, roofMat);
    roofBack.rotation.y = Math.PI; roofBack.position.set(15.63, 2.5, -5.6); 
    ceilingGroup.add(roofBack);
}

// 4. Movement Logic & Keyboard Listeners
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let moveUp = false, moveDown = false;
let isFlying = false;
let lastSpaceTime = 0;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

window.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
        
        case 'Space':
            const now = performance.now();
            if (now - lastSpaceTime < 300) {
                isFlying = !isFlying;
                lastSpaceTime = 0; 
            } else {
                lastSpaceTime = now;
            }
            if (isFlying) moveUp = true;
            break;
            
        case 'ShiftLeft': case 'ShiftRight':
            if (isFlying) moveDown = true;
            break;

        case 'KeyL': 
            roomLabelGroup.visible = !roomLabelGroup.visible; 
            wallLabelGroup.visible = roomLabelGroup.visible; 
            break;
        case 'KeyK': furnitureLabelGroup.visible = !furnitureLabelGroup.visible; break;
        case 'KeyF': furnishingsGroup.visible = !furnishingsGroup.visible; break;
        case 'KeyC': ceilingGroup.visible = !ceilingGroup.visible; break;
        case 'KeyI': lightsGroup.visible = !lightsGroup.visible; break; // Toggle JSON Lights
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
        case 'Space': moveUp = false; break;
        case 'ShiftLeft': case 'ShiftRight': moveDown = false; break;
    }
});

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();

    if (controls.isLocked === true || fallbackMode === true) {
        let delta = (time - prevTime) / 1000;
        if (delta > 0.1) delta = 0.1;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= velocity.y * 10.0 * delta; 

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); 

        const speed = 60.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        if (isFlying) {
            let dirY = Number(moveUp) - Number(moveDown);
            if (moveUp || moveDown) velocity.y += dirY * speed * delta;
            camera.position.y += velocity.y * delta;
        } else {
            if (camera.position.y > 1.6) {
                velocity.y -= 9.8 * 5.0 * delta; 
                camera.position.y += velocity.y * delta;
                if (camera.position.y <= 1.6) {
                    camera.position.y = 1.6;
                    velocity.y = 0;
                }
            } else {
                camera.position.y = 1.6;
                velocity.y = 0;
            }
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
    }

    prevTime = time;
    renderer.render(scene, camera);
}

initDigitalTwin();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});