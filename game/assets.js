// Asset loading with a shared cache and a simple progress counter.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = new Map();
let pending = 0, done = 0, total = 0;

export const Assets = {
  onProgress: null,
  _tick(what) { done++; if (this.onProgress) this.onProgress(done, total, what); },
  gltf(url) {
    if (!cache.has(url)) {
      total++; pending++;
      cache.set(url, new Promise((res) => gltfLoader.load(url, (g) => { pending--; this._tick(url.split('/').pop()); res(g); }, undefined, (e) => { console.warn('gltf failed', url, e); pending--; this._tick(url); res(null); })));
    }
    return cache.get(url);
  },
  tex(url, opts = {}) {
    const key = 'tex:' + url;
    if (!cache.has(key)) {
      total++; pending++;
      const t = texLoader.load(url, () => { pending--; this._tick(url.split('/').pop()); }, undefined, () => { pending--; this._tick(url); });
      t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.anisotropy = 8;
      cache.set(key, t);
    }
    return cache.get(key);
  },
  /** Deep clone a loaded glTF scene (skinned meshes included) with shadows on. */
  instance(gltf, { shadow = true, receive = true } = {}) {
    if (!gltf) return new THREE.Group();
    const obj = skClone(gltf.scene);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = receive; if (o.material && o.material.map) o.material.map.anisotropy = 4; } });
    return obj;
  },
  /** Scale an object so its bounding box is `h` tall and its feet sit at y = 0. */
  fitHeight(obj, h) {
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3());
    const s = h / (size.y || 1); obj.scale.multiplyScalar(s);
    const box2 = new THREE.Box3().setFromObject(obj); obj.position.y -= box2.min.y; return s;
  },
  async whenIdle() { while (pending > 0) await new Promise((r) => setTimeout(r, 50)); },
};
