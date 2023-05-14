import * as THREE from "three";
import { SliceCubemap } from "./imageslice.js";
import { lerp } from "three/src/math/MathUtils.js";


// Create an object that holds the state of the entire program.
let state = {
    canvas: null,
    gl: null,
    scene: null,
    camera: null,
    renderer: null,
    cameraAnimator: null,
    dragDropHandler: null,
    geometries: {},
    materials: {},
    meshes: {},
};

state.canvas = document.querySelector("canvas");
state.gl = state.canvas.getContext("webgl");

class Vec2
{
    constructor(x = 0.0, y = 0.0)
    {
        this.x = x;
        this.y = y;
    }

    copy(vec) {
        this.x = vec.x;
        this.y = vec.y;
    }

    copyFromEvent(event) {
        this.x = event.clientX;
        this.y = event.clientY;
    }
}


/**
 * Handles drag drop events from the window for files.
 */
class DragDropHandler {
    constructor() {
        this.dragging = false;
        this.start = new Vec2();
        this.end = new Vec2();
    }

    startDrag(event) {
        this.dragging = true;
        this.start.copyFromEvent(event);
    }

    endDrag(event) {
        this.dragging = false;
        this.end.copyFromEvent(event);
    }

    drop(event) {
        this.dragging = false;
    }

    update(event) {
        if (this.dragging) {
            this.end.copyFromEvent(event);
        }
    }
}


class CameraControls {
    constructor(camera) {
        this.camera = camera;
        this.lat = 0;
        this.lon = 0;
        this.velocity = new Vec2();
        this.interacting = false;
        this.lastInteraction = 0;
        this.idleDelay = 5000;
        this.mouseDownLat = 0;
        this.mouseDownLon = 0;
        this.mouseDownPos = new Vec2();

        this.lastMousePos = new Vec2();
        this.currentMousePos = new Vec2();
    }

    mouseDown(event) {
        this.interacting = true;
        this.mouseDownPos.copyFromEvent(event);
        this.currentMousePos.copyFromEvent(event);
        this.lastMousePos.copyFromEvent(event);
        this.mouseDownLat = this.lat;
        this.mouseDownLon = this.lon;
    }

    mouseMove(event) {
        if (!this.interacting) {
            return;
        }

        this.currentMousePos.copyFromEvent(event);

        // this.lon = (this.mouseDownPos.x - event.clientX) * 0.1 + this.mouseDownLon;
        // this.lat = (event.clientY - this.mouseDownPos.y) * 0.1 + this.mouseDownLat;

        this.velocity.x -= ((this.currentMousePos.x - this.lastMousePos.x) / window.innerWidth) * 10.0;
        this.velocity.y += ((this.currentMousePos.y - this.lastMousePos.y) / window.innerHeight) * 10.0;

        // TODO: Implement this
        if (false) {
            this.velocity.y *= -1;
            this.velocity.x *= -1;
        }

        this.lastMousePos.copyFromEvent(event);
    }

    mouseUp(event) {
        this.interacting = false;
        this.lastInteraction = Date.now();
    }

    updateIdle() {
        // Idle rotation
        if (!this.interacting && Date.now() - this.lastInteraction > this.idleDelay) {
            this.velocity.x = lerp(this.velocity.x, 0.1, 0.01);
            this.lat = lerp(this.lat, 0, 0.01);
        }
    }

    update() {
        this.updateIdle();

        this.lat = Math.max(-85, Math.min(85, this.lat));
        let phi = THREE.MathUtils.degToRad(90 - this.lat);
        let theta = THREE.MathUtils.degToRad(this.lon);

        this.camera.target.x = 500 * Math.sin(phi) * Math.cos(theta);
        this.camera.target.y = 500 * Math.cos(phi);
        this.camera.target.z = 500 * Math.sin(phi) * Math.sin(theta);

        this.camera.lookAt(this.camera.target);

        this.lon += this.velocity.x;
        this.lat += this.velocity.y;

        this.velocity.x *= 0.9; // Decay
        this.velocity.y *= 0.9; // Decay
    }
}

/**
 * Handles animation of the camera when not interacting with the scene.
 */
class CameraAnimator {
    constructor(camera) {
        // Amount of time idle to start animating.
        this.camera = camera;
        this.idleTime = 5000;
        this.rotationSpeed = 0.1;
        this.rotation = new Vec2();
        this.lastTime = 0;
        this.idle = false;
        this.lat = 0;
        this.lon = 0;
    }

    update() {
        this.lon += this.rotationSpeed;

        this.lat = Math.max(-85, Math.min(85, this.lat));
        let phi = THREE.MathUtils.degToRad(90 - this.lat);
        let theta = THREE.MathUtils.degToRad(this.lon);

        this.camera.target.x = 500 * Math.sin(phi) * Math.cos(theta);
        this.camera.target.y = 500 * Math.cos(phi);
        this.camera.target.z = 500 * Math.sin(phi) * Math.sin(theta);

        this.camera.lookAt(this.camera.target);
    }
}


let geometries = {
    "pano": new THREE.SphereGeometry(500, 60, 40),
    "cube": new THREE.BoxGeometry(100, 100, 100)
};
geometries.pano.scale(-1, 1, 1);

let materials = {
    "pano": new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load("pano.jpg"),
    }),
    "cube": new THREE.MeshBasicMaterial({
        color: 0x00ff00
    }),
    "shiny": new THREE.MeshStandardMaterial({
        color: 0XAEAEAE,
        roughness: 0.5,
        metalness: 0.5
    })
};


/**
 * Loads panoramic/equirectangular image.
 */
function loadPanorama(scene, image) {
    let tex = new THREE.Texture(image);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    scene.background = tex;
}

/**
 * Loads cubemap from six images.
 */
function loadCubemapFaces() {
    let loader = new THREE.CubeTextureLoader();
    let tex = loader.load("cubemap.png");
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.mapping = THREE.CubeReflectionMapping;
    scene.background = tex
}

/**
 * Loads cubemap from single image.
 */
function loadCubemap(scene, image) {
    let facesImages = SliceCubemap(image);
    let cubeImages = [
        facesImages.posx, facesImages.negx,
        facesImages.posy, facesImages.negy,
        facesImages.posz, facesImages.negz
    ];

    let cubeTex = new THREE.CubeTexture(
        cubeImages,
        THREE.CubeReflectionMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.LinearFilter,
        THREE.LinearFilter
    );
    cubeTex.colorSpace = THREE.SRGBColorSpace; // REQUIRED!
    cubeTex.needsUpdate = true; // REQUIRED!
    scene.background = cubeTex;
}


function init()
{
    let scene = new THREE.Scene();
    state.scene = scene;

    let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.target = new THREE.Vector3(0, 0, 0);
    state.camera = camera;

    let cameraAnimator = new CameraAnimator(camera);
    state.cameraAnimator = cameraAnimator;
    let cameraControls = new CameraControls(camera);
    state.cameraControls = cameraControls;

    let renderer = new THREE.WebGLRenderer({canvas: state.canvas, antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    // renderer.gammaOutput = true;
    // renderer.gammaFactor = 2.2;

    state.renderer = renderer;

    // scene.add(new THREE.AmbientLight(0x404040));
    scene.add(camera);

    let geo = new THREE.BoxGeometry(100, 100, 100);
    let mat = new THREE.MeshBasicMaterial({color: 0x00ff00});
    let cube = new THREE.Mesh(geo, mat);
    scene.add(cube);
    cube.position.set(200, -100, 0);

    camera.lookAt(cube.position);


    // scene.background = new THREE.Color(0xC2EABD);

    let img = new Image();
    // img.src = "cubemap.png";
    img.src = "pano.jpg";
    img.onload = () => {
        loadPanorama(scene, img);
        // loadCubemap(scene, img);
    };


    // Mouse controls.
    document.addEventListener("mousedown", function(event) {
        event.preventDefault();
        cameraControls.mouseDown(event);
    });

    document.addEventListener("mouseup", function(event) {
        event.preventDefault();
        cameraControls.mouseUp(event);
        event.stopImmediatePropagation();
    });

    document.addEventListener("mousemove", function(event) {
        cameraControls.mouseMove(event);
    });

    document.addEventListener("wheel", function(event) {
    });

    document.addEventListener("oncontextmenu", function(event) {
        event.preventDefault();
    });

    // Drag drop
    let dragDropHandler = new DragDropHandler();
    state.dragDropHandler = dragDropHandler;
    document.addEventListener("dragenter", function(event) {
        dragDropHandler.startDrag(event);
    });

    document.addEventListener("dragleave", function(event) {
        dragDropHandler.endDrag(event);
    });

    document.addEventListener("dragover", function(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    });

    document.addEventListener("drop", function(event) {
        console.log(event.dataTransfer);
        event.preventDefault();
        dragDropHandler.drop(event);

        let files = event.dataTransfer.files;

        if (files.length === 0) {
            console.error("No files dropped.");
        }
        else if (files.length === 1) {
            let file = files[0];
            let reader = new FileReader();
            reader.onload = function(event) {
                let data = event.target.result;
                let img = new Image();
                img.src = data;
                img.onload = () => {
                    // TODO: Detect panorama or cubemap.
                    const aspect = img.width / img.height;
                    console.log(`Aspect: ${aspect}`);
                    console.log(`4/3 - aspect: ${4/3 - aspect}`);

                    if ( Math.abs((4/3) - aspect) < 0.1 ) {
                        loadCubemap(scene, img);
                    } else {
                        loadPanorama(scene, img);
                    }
                }
            };
            reader.readAsDataURL(file);
        } else {
            // TODO: This must be a cubemap of 6 images.
        }
    });

    window.addEventListener("resize", function(event) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}


function animate() {
    requestAnimationFrame(animate);
    update();
}

function update() {
    state.cameraAnimator.update();
    state.cameraControls.update();

    state.renderer.render(state.scene, state.camera);
}

init();
animate();








// these are to be filled out later

// The history of images that have been loaded.
let imageHistory = [];

// Generate a small thumbnail image. This is used for the image history.
function CreateThumbnail(image) {
}
