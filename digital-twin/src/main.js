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

// 2. Data Loading & Building
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

        // Build Roofs and Ceilings
        buildRoofsAndCeilings(scene);

    } catch (error) {
        console.error("Error building Digital Twin:", error);
    }
}

// 3. Roof & Ceiling Construction
function buildRoofsAndCeilings(scene) {
    const ceilingGroup = new THREE.Group();
    ceilingGroup.visible = true;
    scene.add(ceilingGroup);

    // Generate Troldtekt Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, 512, 512);
    ctx.lineWidth = 1.5;
    for(let i = 0; i < 20000; i++) {
        ctx.beginPath();
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const length = Math.random() * 15 + 5;
        const angle = Math.random() * Math.PI;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.strokeStyle = Math.random() > 0.5 ? '#111111' : '#333333';
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(13, 10); 
    const ceilingMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

    // Flat ceiling (Front Wing)
    const ceilingGeo = new THREE.PlaneGeometry(15.83, 6.02);
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(7.815, 2.27, -2.91); 
    ceiling.rotation.x = Math.PI / 2; 
    ceilingGroup.add(ceiling);

    // Vaulted Ceiling (Back Wing)
    const vaultShape = new THREE.Shape();
    vaultShape.moveTo(0, 0); 
    vaultShape.lineTo(2.905, 0.73); 
    vaultShape.lineTo(5.81, 0); 
    vaultShape.lineTo(5.81, 0.05); 
    vaultShape.lineTo(2.905, 0.78);
    vaultShape.lineTo(0, 0.05);
    vaultShape.lineTo(0, 0);
    const vaultGeo = new THREE.ExtrudeGeometry(vaultShape, { depth: 11.3, bevelEnabled: false });
    const vault = new THREE.Mesh(vaultGeo, ceilingMat);
    vault.position.set(9.42, 2.27, -17.12); 
    ceilingGroup.add(vault);

    // Roof Material
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    // Front Roof
    const roofShapeFront = new THREE.Shape();
    roofShapeFront.moveTo(0, 0); 
    roofShapeFront.lineTo(3.2, 1.2); 
    roofShapeFront.lineTo(6.4, 0); 
    roofShapeFront.lineTo(0, 0);
    const roofGeoFront = new THREE.ExtrudeGeometry(roofShapeFront, { depth: 16.2, bevelEnabled: false });
    const roofFront = new THREE.Mesh(roofGeoFront, roofMat);
    roofFront.rotation.y = Math.PI / 2; 
    roofFront.position.set(-0.2, 2.5, 0.2); 
    ceilingGroup.add(roofFront);

    // Back Roof
    const roofShapeBack = new THREE.Shape();
    roofShapeBack.moveTo(-0.4, 0); 
    roofShapeBack.lineTo(2.905, 1.2); 
    roofShapeBack.lineTo(6.21, 0); 
    roofShapeBack.lineTo(-0.4, 0);
    const roofGeoBack = new THREE.ExtrudeGeometry(roofShapeBack, { depth: 11.7, bevelEnabled: false });
    const roofBack = new THREE.Mesh(roofGeoBack, roofMat);
    roofBack.rotation.y = Math.PI; 
    roofBack.position.set(15.63, 2.5, -5.6); 
    ceilingGroup.add(roofBack);

    // Keyboard Toggle Event
    window.addEventListener('keydown', (event) => {
        if (event.code === 'KeyC') {
            ceilingGroup.visible = !ceilingGroup.visible;
        }
    });
}

// 4. Render Loop
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