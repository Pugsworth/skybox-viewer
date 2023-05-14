import * as THREE from "three";
import { SliceCubemap } from "./imageslice.js";
import { lerp } from "three/src/math/MathUtils.js";
import { GUI } from "dat.gui";


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
state.gl = state.canvas.getContext("webgl", { alpha: false, antialias: true, colorSpace: "srgb" });

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
        this.fov = 60;
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

        // this.camera.fov = this.fov;
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

let materials = {
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
    let tex = new THREE.Texture(
        image,
        THREE.EquirectangularRefractionMapping,
        THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping,
        THREE.LinearFilter,
        THREE.LinearFilter
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();

    if (!state.panoball) {
        let geo = new THREE.SphereGeometry(500, 60, 40);
        geo.scale(-1, 1, 1);
        let mat = new THREE.MeshBasicMaterial({ map: null });
        state.panoball = new THREE.Mesh(geo, mat);
        scene.add(state.panoball);
    }

    state.panoball.material.map = tex;
    state.panoball.visible = true;

    // let rt = new THREE.WebGLCubeRenderTarget(image.height);
    // rt.fromEquirectangularTexture(state.renderer, tex);
    // scene.background = rt.texture;
    // scene.environment = rt.texture;
}


/**
 * Loads cubemap from six images.
 */
function loadCubemapFaces(scene, images) {
    if (state.panoball) {
        state.panoball.visible = false;
    }

    // The mapping of faces is weird.
    let cubeImages = [
        images.posz, images.negz,
        images.posy, images.negy,
        images.negx, images.posx
    ];

    console.log(cubeImages);

    let loader = new THREE.CubeTextureLoader();
    let cubeTex = loader.load(cubeImages);

    // let cubeTex = new THREE.CubeTexture(
    //     cubeImages,
    //     THREE.CubeReflectionMapping,
    //     THREE.ClampToEdgeWrapping,
    //     THREE.ClampToEdgeWrapping,
    //     THREE.LinearFilter,
    //     THREE.LinearFilter
    // );
    // cubeTex.generateMipmaps = false;
    // cubeTex.colorSpace = THREE.SRGBColorSpace; // REQUIRED!
    // cubeTex.needsUpdate = true; // REQUIRED!
    scene.background = cubeTex;
    scene.environment = cubeTex;
}


/**
 * Loads cubemap from single image.
 */
function loadCubemap(scene, image) {
    if (state.panoball) {
        state.panoball.visible = false;
    }

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
    cubeTex.generateMipmaps = false;
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
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    state.renderer = renderer;

    // scene.add(new THREE.AmbientLight(0x404040));
    scene.add(camera);

    let geo = new THREE.BoxGeometry(100, 100, 100);
    let cube = new THREE.Mesh(geo, materials.shiny);
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

    let gui = new GUI();
    let camgui = gui.addFolder("Camera");
    camgui.add(cameraControls, "fov", 0, 180).onChange(function(value) {
        camera.fov = value;
        camera.updateProjectionMatrix();
    });

    state.gui = gui;



    // Mouse controls.
    document.addEventListener("mousedown", function(event) {
        event.preventDefault();
        cameraControls.mouseDown(event);
    });

    document.addEventListener("mouseup", function(event) {
        event.preventDefault();
        cameraControls.mouseUp(event);
        // event.stopImmediatePropagation();
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
        document.body.style.opacity = 0.5;
    });

    document.addEventListener("dragleave", function(event) {
        dragDropHandler.endDrag(event);
        document.body.style.opacity = 1.0;
    });

    document.addEventListener("dragover", function(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    });

    document.addEventListener("drop", function(event) {
        document.body.style.opacity = 1.0;
        event.preventDefault();
        dragDropHandler.drop(event);

        let files = event.dataTransfer.files;
        console.log(files);

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

                    if ( Math.abs((4/3) - aspect) < 0.1 ) {
                        loadCubemap(scene, img);
                    } else {
                        loadPanorama(scene, img);
                    }
                }
            };
            reader.readAsDataURL(file);
        } else {
            // Attempt to match the faces to the filenames
            let faces = detectCubemapFaces(files);
            if (faces) {
                loadCubemapFaces(scene, faces);
            }
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

let cubemapFaceSearch = [
    { name: "posx", aliases: ["posx", "left", "[-_]lf"] },
    { name: "negx", aliases: ["negx", "right", "[-_]rt"] },
    { name: "posy", aliases: ["posy", "top", "[-_]tp", "up", "[-_]up"] },
    { name: "negy", aliases: ["negy", "bottom", "[-_]bt", "down", "[-_]dn"] },
    { name: "posz", aliases: ["posz", "front", "[-_]ft"] },
    { name: "negz", aliases: ["negz", "back", "[-_]bk"] }
];

function detectCubemapFaces(files) {
    let faces = {
        posx: null,
        negx: null,
        posy: null,
        negy: null,
        posz: null,
        negz: null
    };
    let foundAtLeastOne = false;

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let name = file.name.toLowerCase();
        console.log(name);

        for (let j = 0; j < cubemapFaceSearch.length; j++) {
            let face = cubemapFaceSearch[j];
            let aliases = face.aliases;

            for (let k = 0; k < aliases.length; k++) {
                let alias = aliases[k];
                let regex = new RegExp(alias, "g");
                if (regex.test(name)) {
                    foundAtLeastOne = true;

                    faces[face.name] = URL.createObjectURL(file);
                }
            }
        }
    }

    if (!foundAtLeastOne) {
        return null;
    }

    return faces;
}