# Skybox Viewer (working name)

## Description
This is a viewer of many different kinds of skybox images.
It uses Three.js and raw javascript.


## How to use
Demo at: https://pugsworth.github.io/skybox-viewer/

Drag and drop a skybox image(s) onto the page and it will try to automatically guess what kind and apply it.
If you have 6 images, you can drag all of them in at once to load them.

---

## Supported skybox types
- OpenGL Cubemap (cross shape with T on the left)
- Panorama (equirectangular)
- Six images (up, down, left, right, front, back)
    - It tries to find standardized names within the filenames to guess which image is which. The easiest format is: `<skybox-name>_up.<ext>`, `<skybox-name>_rt.<ext>`, etc.


## Why?
Every time I work with skyboxes in any capacity, I keep running head-first into the same issue of not being able to quickly preview them.
I have scoured the internet for some kind of one-size-fits-all skybox viewer (at least for the types I use) and have come up empty handed.
Am I the first person in the universe to have this problem?

I originally started making it in Godot 4, but very quickly ran into issues with some of the architecture of the engine.
I also decided that it would make more sense to have the tool be a web app so that it could be used by anyone, anywhere, on any device!

---

## TODO
- [ ] Refactor code
- [ ] Add more controls to the GUI.
- [ ] Add the ability to change the rotation of the skybox
- [ ] Drag individual images one at a time and have it automatically apply them to the correct side without overwriting the entire skybox.
- [ ] Implement a history of skyboxes that have been loaded with thumbnails so you can easily switch between them.
- [ ] Add the ability to render out the skybox to any of the supported types.
- [ ] Add the ability to load a couple different meshes with some materials.
- [ ] Look into switching to raw WebGL for better performance and more control.
- [ ] Increase the number of possible filetypes that can be loaded. THREE.js supports more like .tga that I'm not using yet.
- [ ] How does "installing" a SPA work?

---

## Bugs
Currently there's one annoying bug in which the panoramic skyboxes have weird color banding/bit crushing.
As far as I can tell, this is something THREE.js is doing. I've implemented a workaround that uses an inverted sphere to render the panorama.