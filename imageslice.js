const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// The layout of the tiles in the cubemap image.
// TODO: Figure out what layouts are possible.
const layout = "4x3";

/*
    Layouts:

    4x3 (default)
    Assuming +z is front, -x is right, and +y is up.
    TODO: Make the coordinate system confirgurable? The layout will always be the same with the middle image being front.
    +----+----+----+----+
    |    | +y |    |    |
    +----+----+----+----+
    | +x | +z | -x | -z |
    +----+----+----+----+
    |    | -y |    |    |
    +----+----+----+----+
*/


/**
 * Slices a cubemap image into 6 images.
 * @param {Image} image
 * @returns {Image[]}
 */
export function SliceCubemap(image) {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    // TODO: Layout stuff here!
    const tileWidth = image.width / 4;
    const tileHeight = image.height / 3;

    const faceNames = ["posx", "negx", "posy", "negy", "posz", "negz"];
    const faceCoords = [
        { x: 2, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 3, y: 1 }
    ];

    const images = {};

    for (let i = 0; i < 6; i++) {
        const { x, y } = faceCoords[i];
        const imageData = ctx.getImageData(x * tileWidth, y * tileHeight, tileWidth, tileHeight);

        // images.push({ name: faceNames[i], data: imageData });
        let name = faceNames[i];
        images[name] = imageData;
    }

    return images;
}