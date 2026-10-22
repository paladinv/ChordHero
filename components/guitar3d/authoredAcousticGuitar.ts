import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { authoredHandReadyState } from "./authoredHandValidation";

/**
 * Lazy loader for the Blender-authored instrument. The exported model is
 * already in the scene's 25.5-inch / 10.5-unit coordinate frame, so no
 * runtime scaling or guessed contact offsets are applied here.
 */
export async function loadAuthoredAcousticGuitar() {
  const gltf = await new GLTFLoader().loadAsync("/models/guitar-technique/acoustic-guitar-authored.glb");
  const root = gltf.scene as THREE.Group;
  root.name = "Blender-authored physical acoustic guitar";
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
        material.roughness = Math.min(0.86, Math.max(0.2, material.roughness));
        material.metalness = Math.min(1, Math.max(0, material.metalness));
      }
    });
  });
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const ready = authoredHandReadyState({
    drawable: root.getObjectByProperty("isMesh", true) !== undefined,
    bounds: { min: [bounds.min.x, bounds.min.y, bounds.min.z], max: [bounds.max.x, bounds.max.y, bounds.max.z] },
    // The authored guitar is expected to occupy the same region as the
    // existing physical scene, including the headstock and lower bout.
    sceneRegion: { min: [-5, -2.5, -6.5], max: [5, 1.5, 8.5] }
  });
  if (!ready) throw new Error("Blender-authored guitar has invalid or out-of-scene bounds");
  return root;
}

