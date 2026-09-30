import * as THREE from "three";
import {
  GUITAR_BODY_DEPTH,
  GUITAR_BODY_LENGTH,
  GUITAR_BODY_PROFILE_X_SCALE,
  GUITAR_NUT_OVERALL_WIDTH,
  GUITAR_NUT_STRING_SPREAD,
  GUITAR_NUT_Z,
  GUITAR_SADDLE_STRING_SPREAD,
  GUITAR_SADDLE_Z,
  GUITAR_SOUND_HOLE_CENTER_Z,
  GUITAR_SOUND_HOLE_RADIUS,
  GUITAR_TWELFTH_FRET_BOARD_WIDTH,
  guitarFretPosition,
  guitarStringXAt,
  GUITAR_VISIBLE_FRET_COUNT,
} from "../../lib/guitarTechnique3d";

const BODY_CENTER_Z = 5.8;
const BOARD_END_Z = guitarFretPosition(GUITAR_VISIBLE_FRET_COUNT) + 0.28;
const WOOD_TEXTURE_SIZE = 48;

function woodTexture(baseHex: number, grainHex: number, grainAlongZ: boolean) {
  const base = new THREE.Color(baseHex);
  const grain = new THREE.Color(grainHex);
  // Use an explicit RGBA buffer. Three.js versions without RGBFormat fall
  // back to RGBA interpretation, which would stride through this 3-byte
  // buffer incorrectly and turn the wood albedo black.
  const data = new Uint8Array(WOOD_TEXTURE_SIZE * WOOD_TEXTURE_SIZE * 4);
  for (let y = 0; y < WOOD_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < WOOD_TEXTURE_SIZE; x += 1) {
      const along = grainAlongZ ? y : x;
      const across = grainAlongZ ? x : y;
      const broad = (Math.sin(along * 0.34 + Math.sin(across * 0.19) * 1.6) + 1) * 0.5;
      const fine = (Math.sin((along + across) * 1.45) + 1) * 0.045;
      const amount = Math.min(0.34, broad * 0.18 + fine);
      const color = base.clone().lerp(grain, amount);
      const offset = (y * WOOD_TEXTURE_SIZE + x) * 4;
      data[offset] = Math.round(color.r * 255);
      data[offset + 1] = Math.round(color.g * 255);
      data[offset + 2] = Math.round(color.b * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, WOOD_TEXTURE_SIZE, WOOD_TEXTURE_SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(grainAlongZ ? 1.4 : 3.2, grainAlongZ ? 5.4 : 2.3);
  texture.needsUpdate = true;
  return texture;
}

function bodyOutline(withHole: boolean) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -4.05);
  shape.bezierCurveTo(-1.34, -4.05, -2.08, -3.74, -2.3, -3.08);
  shape.bezierCurveTo(-2.43, -2.63, -2.16, -2.23, -1.73, -1.71);
  shape.bezierCurveTo(-1.49, -1.42, -1.5, -1.12, -1.83, -0.68);
  shape.bezierCurveTo(-2.3, -0.05, -3.0, 0.4, -3.19, 1.16);
  shape.bezierCurveTo(-3.42, 2.02, -2.96, 2.78, -2.25, 3.34);
  shape.bezierCurveTo(-1.56, 3.9, -0.7, 4.08, 0, 4.08);
  shape.bezierCurveTo(0.7, 4.08, 1.56, 3.9, 2.25, 3.34);
  shape.bezierCurveTo(2.96, 2.78, 3.42, 2.02, 3.19, 1.16);
  shape.bezierCurveTo(3.0, 0.4, 2.3, -0.05, 1.83, -0.68);
  shape.bezierCurveTo(1.5, -1.12, 1.49, -1.42, 1.73, -1.71);
  shape.bezierCurveTo(2.16, -2.23, 2.43, -2.63, 2.3, -3.08);
  shape.bezierCurveTo(2.08, -3.74, 1.34, -4.05, 0, -4.05);
  if (withHole) {
    const xScale = GUITAR_BODY_PROFILE_X_SCALE;
    const zScale = GUITAR_BODY_LENGTH / 8.1;
    const hole = new THREE.Path();
    hole.absellipse(0, (GUITAR_SOUND_HOLE_CENTER_Z - BODY_CENTER_Z) / zScale, GUITAR_SOUND_HOLE_RADIUS / xScale, GUITAR_SOUND_HOLE_RADIUS / zScale, 0, Math.PI * 2, false, 0);
    shape.holes.push(hole);
  }
  return shape;
}

function bodyPart(material: THREE.Material | THREE.Material[], depth: number, bevel: number, withHole = false, frontFacingUp = true) {
  const geometry = new THREE.ExtrudeGeometry(bodyOutline(withHole), { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel, curveSegments: 22 });
  geometry.scale(GUITAR_BODY_PROFILE_X_SCALE, GUITAR_BODY_LENGTH / 8.1, 1);
  // ExtrudeGeometry's front cap is +Z. Face the soundboard upward, while the
  // deep mahogany shell keeps its cap below the top so it cannot black out the
  // spruce through overdraw.
  geometry.rotateX(frontFacingUp ? -Math.PI / 2 : Math.PI / 2);
  geometry.translate(0, depth / 2, 0);
  return new THREE.Mesh(geometry, material);
}

/**
 * A single, explicit soundboard skin. ShapeGeometry triangulates the outline
 * and its aperture directly in XY; rotating that plane puts its normal on +Y
 * without relying on an ExtrudeGeometry cap (which can otherwise overlap the
 * shell when the guitar is viewed at a shallow angle).
 */
function makeSoundboardGeometry() {
  const geometry = new THREE.ShapeGeometry(bodyOutline(true), 22);
  // Match the shell's positive X/Y scale and +PI/2 rotation so local +Y
  // follows the same world-Z direction without a negative determinant that
  // can invalidate ShapeGeometry's aperture winding.
  geometry.scale(GUITAR_BODY_PROFILE_X_SCALE, GUITAR_BODY_LENGTH / 8.1, 1);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.495, 0);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let index = 0; index < normals.count; index += 1) normals.setXYZ(index, 0, 1, 0);
  normals.needsUpdate = true;
  return geometry;
}

function makePerimeterBindingGeometry() {
  const rawProfile: readonly [number, number][] = [
    [0, -4.05], [-1.34, -4.05], [-2.08, -3.74], [-2.3, -3.08], [-2.16, -2.23], [-1.73, -1.71], [-1.49, -1.12], [-1.83, -0.68], [-2.3, -0.05], [-3.0, 0.4], [-3.19, 1.16], [-3.42, 2.02], [-2.96, 2.78], [-2.25, 3.34], [-0.7, 4.08], [0, 4.08], [0.7, 4.08], [2.25, 3.34], [2.96, 2.78], [3.42, 2.02], [3.19, 1.16], [3.0, 0.4], [2.3, -0.05], [1.83, -0.68], [1.49, -1.12], [1.73, -1.71], [2.16, -2.23], [2.3, -3.08], [2.08, -3.74], [1.34, -4.05], [0, -4.05]
  ];
  const zScale = GUITAR_BODY_LENGTH / 8.1;
  const points = rawProfile.map(([x, z]) => new THREE.Vector3(x * GUITAR_BODY_PROFILE_X_SCALE, 0.495, BODY_CENTER_Z + z * zScale));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, "centripetal"), 96, 0.034, 6, true);
}

function taperedPrism(material: THREE.Material, startZ: number, endZ: number, startWidth: number, endWidth: number, depth: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-startWidth / 2, startZ); shape.lineTo(startWidth / 2, startZ); shape.lineTo(endWidth / 2, endZ); shape.lineTo(-endWidth / 2, endZ); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 4 });
  geometry.rotateX(Math.PI / 2); geometry.translate(0, depth / 2, 0);
  return new THREE.Mesh(geometry, material);
}

function makeRadiusedBoardGeometry(startZ: number, endZ: number, startWidth: number, endWidth: number) {
  const rows = 36;
  const cols = 8;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const progress = row / rows;
    const z = startZ + (endZ - startZ) * progress;
    const width = startWidth + (endWidth - startWidth) * progress;
    for (let col = 0; col <= cols; col += 1) {
      const across = col / cols * 2 - 1;
      const x = across * width / 2;
      const y = 0.055 + 0.105 * (1 - across * across);
      positions.push(x, y, z);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** One shared tapered edge binding, following both the widening board and its radius. */
function makeTaperedBindingRailGeometry(startZ: number, endZ: number, startWidth: number, endWidth: number) {
  const rows = 36;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const progress = row / rows;
    const z = startZ + (endZ - startZ) * progress;
    const width = startWidth + (endWidth - startWidth) * progress;
    const outerX = width / 2;
    const innerX = Math.max(0, outerX - 0.065);
    const innerAcross = innerX / Math.max(outerX, 0.0001);
    const outerY = 0.055 + 0.02;
    const innerY = 0.055 + 0.105 * (1 - innerAcross * innerAcross) + 0.02;
    positions.push(outerX, outerY, z, innerX, innerY, z, outerX, outerY - 0.045, z, innerX, innerY - 0.045, z);
  }
  for (let row = 0; row < rows; row += 1) {
    const a = row * 4; const b = a + 4;
    indices.push(a, b, a + 1, a + 1, b, b + 1, a + 2, a + 3, b + 2, b + 2, a + 3, b + 3, a, a + 2, b, b, a + 2, b + 2, a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A normalized crowned fret: instances only change x span, preserving one draw and a true board radius. */
function makeCrownedFretGeometry() {
  const columns = 16;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let column = 0; column <= columns; column += 1) {
    const x = column / columns - 0.5;
    const boardRise = 0.105 * (1 - (x * 2) ** 2);
    positions.push(x, 0.055 + boardRise, -0.014, x, 0.055 + boardRise + 0.035, 0, x, 0.055 + boardRise, 0.014, x, 0.055 + boardRise - 0.012, 0);
  }
  for (let column = 0; column < columns; column += 1) {
    const a = column * 4;
    const b = a + 4;
    for (let profile = 0; profile < 3; profile += 1) {
      const c = a + profile + 1;
      const d = b + profile + 1;
      indices.push(a + profile, b + profile, c, c, b + profile, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRing(group: THREE.Group, radius: number, tube: number, material: THREE.Material) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 64), material);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
}

export function createProfessionalAcousticGuitar(renderer: THREE.WebGLRenderer) {
  // A pale spruce top and restrained dark mahogany shell keep the material
  // roles legible under ACES: the top must not read like the back, and the
  // lower shell must not become a bright orange second soundboard.
  const topTexture = woodTexture(0xf1cf9f, 0xc48a55, true);
  const backTexture = woodTexture(0x5d2f25, 0x261614, false);
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  topTexture.anisotropy = anisotropy; backTexture.anisotropy = anisotropy;
  // Keep material albedo neutral: the small shared textures already contain
  // the spruce/mahogany color, so a second dark multiplier would blacken the
  // instrument under ACES tone mapping.
  const topMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: topTexture, roughness: 0.47, clearcoat: 0.2, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const sideMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: backTexture, roughness: 0.4, clearcoat: 0.24, clearcoatRoughness: 0.26, side: THREE.DoubleSide });
  const neckMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: backTexture, roughness: 0.48, clearcoat: 0.18 });
  const fingerboardMaterial = new THREE.MeshStandardMaterial({ color: 0x30231f, roughness: 0.34 });
  const bindingMaterial = new THREE.MeshStandardMaterial({ color: 0xe4c995, roughness: 0.28, metalness: 0.08 });
  const fretMaterial = new THREE.MeshStandardMaterial({ color: 0xc7ced0, metalness: 0.88, roughness: 0.2 });
  const stringMaterial = new THREE.MeshStandardMaterial({ color: 0xdad8d0, metalness: 0.82, roughness: 0.26 });
  const woundMaterial = new THREE.MeshStandardMaterial({ color: 0xa9adb0, metalness: 0.86, roughness: 0.34 });
  const cavityMaterial = new THREE.MeshStandardMaterial({ color: 0x19100d, roughness: 0.94 });
  const group = new THREE.Group();
  group.name = "professional-acoustic-guitar";

  // ExtrudeGeometry uses material index 0 for caps and index 1 for walls.
  // Keep any exposed shell cap in spruce while the deep perimeter remains
  // mahogany, even when the camera sees the shell at a shallow angle.
  const back = bodyPart([topMaterial, sideMaterial], GUITAR_BODY_DEPTH, 0.1, false, false); back.position.set(0, -0.45, BODY_CENTER_Z); group.add(back);
  const top = new THREE.Mesh(makeSoundboardGeometry(), topMaterial); top.position.set(0, 0, BODY_CENTER_Z); group.add(top);
  const purfling = new THREE.Mesh(makePerimeterBindingGeometry(), bindingMaterial); group.add(purfling);

  const neck = taperedPrism(neckMaterial, GUITAR_NUT_Z - 0.26, BOARD_END_Z + 0.45, GUITAR_NUT_OVERALL_WIDTH * 0.92, GUITAR_TWELFTH_FRET_BOARD_WIDTH * 1.08, 0.34); neck.position.y = -0.02; group.add(neck);
  const heel = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 8, 14), neckMaterial); heel.rotation.x = Math.PI / 2; heel.position.set(0, 0.09, guitarFretPosition(15) + 0.28); group.add(heel);
  const board = new THREE.Mesh(makeRadiusedBoardGeometry(GUITAR_NUT_Z - 0.08, BOARD_END_Z, GUITAR_NUT_STRING_SPREAD, GUITAR_TWELFTH_FRET_BOARD_WIDTH), fingerboardMaterial); board.position.y = 0.31; group.add(board);
  const nut = new THREE.Mesh(new THREE.BoxGeometry(GUITAR_NUT_OVERALL_WIDTH, 0.13, 0.075), bindingMaterial); nut.position.set(0, 0.49, GUITAR_NUT_Z); group.add(nut);
  const bindingRailGeometry = makeTaperedBindingRailGeometry(GUITAR_NUT_Z - 0.08, BOARD_END_Z, GUITAR_NUT_STRING_SPREAD, GUITAR_TWELFTH_FRET_BOARD_WIDTH);
  const bindingLeft = new THREE.Mesh(bindingRailGeometry, bindingMaterial); bindingLeft.position.y = 0.31; group.add(bindingLeft);
  const bindingRight = new THREE.Mesh(bindingRailGeometry, bindingMaterial); bindingRight.scale.x = -1; bindingRight.position.y = 0.31; group.add(bindingRight);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(GUITAR_SADDLE_STRING_SPREAD + 0.22, 0.2, 0.34), neckMaterial); bridge.position.set(0, 0.46, 7.1); bridge.rotation.y = 0.018; group.add(bridge);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(GUITAR_SADDLE_STRING_SPREAD, 0.11, 0.07), bindingMaterial); saddle.position.set(0, 0.61, GUITAR_SADDLE_Z); group.add(saddle);

  const fretGeometry = makeCrownedFretGeometry();
  const fretBars = new THREE.InstancedMesh(fretGeometry, fretMaterial, GUITAR_VISIBLE_FRET_COUNT);
  const matrix = new THREE.Matrix4();
  for (let fret = 1; fret <= GUITAR_VISIBLE_FRET_COUNT; fret += 1) {
    const z = guitarFretPosition(fret);
    const width = guitarStringXAt(5, z) - guitarStringXAt(0, z) + 0.045;
    matrix.makeScale(width, 1, 1); matrix.setPosition(0, 0.31, z); fretBars.setMatrixAt(fret - 1, matrix);
  }
  fretBars.instanceMatrix.needsUpdate = true; group.add(fretBars);

  const inlayGeometry = new THREE.CylinderGeometry(0.047, 0.047, 0.026, 16); const inlays = new THREE.InstancedMesh(inlayGeometry, bindingMaterial, 9);
  [3, 5, 7, 9, 15, 17, 19].forEach((fret, index) => { matrix.makeRotationX(Math.PI / 2); matrix.setPosition(0, 0.49, (guitarFretPosition(fret) + guitarFretPosition(fret + 1)) / 2); inlays.setMatrixAt(index, matrix); });
  matrix.makeRotationX(Math.PI / 2); matrix.setPosition(-0.17, 0.49, (guitarFretPosition(12) + guitarFretPosition(13)) / 2); inlays.setMatrixAt(7, matrix); matrix.setPosition(0.17, 0.49, (guitarFretPosition(12) + guitarFretPosition(13)) / 2); inlays.setMatrixAt(8, matrix); inlays.instanceMatrix.needsUpdate = true; group.add(inlays);

  const rosette = new THREE.Group(); rosette.position.set(0, 0.565, GUITAR_SOUND_HOLE_CENTER_Z); group.add(rosette);
  addRing(rosette, 0.85, 0.018, neckMaterial); addRing(rosette, 0.9, 0.03, bindingMaterial); addRing(rosette, 0.96, 0.02, neckMaterial); addRing(rosette, 1.02, 0.028, bindingMaterial); addRing(rosette, 1.08, 0.014, neckMaterial);
  const cavity = new THREE.Mesh(new THREE.CylinderGeometry(GUITAR_SOUND_HOLE_RADIUS * 0.985, GUITAR_SOUND_HOLE_RADIUS * 0.94, 0.42, 64), cavityMaterial); cavity.position.set(0, 0.29, GUITAR_SOUND_HOLE_CENTER_Z); group.add(cavity);
  const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(GUITAR_SOUND_HOLE_RADIUS * 1.015, GUITAR_SOUND_HOLE_RADIUS * 1.015, 0.26, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x3b1a13, roughness: 0.72, side: THREE.DoubleSide })); innerWall.position.set(0, 0.43, GUITAR_SOUND_HOLE_CENTER_Z); group.add(innerWall);

  const stringGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const stringStart = GUITAR_NUT_Z - 0.15;
  for (let string = 0; string < 6; string += 1) {
    const material = string < 3 ? stringMaterial : woundMaterial;
    const wire = new THREE.Mesh(stringGeometry, material);
    const from = new THREE.Vector3(guitarStringXAt(string, stringStart), 0.56, stringStart);
    const to = new THREE.Vector3(guitarStringXAt(string, GUITAR_SADDLE_Z), 0.58, GUITAR_SADDLE_Z);
    const axis = to.clone().sub(from); wire.position.copy(from).add(to).multiplyScalar(0.5); wire.scale.set(0.009 + string * 0.0021, axis.length(), 0.009 + string * 0.0021); wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()); group.add(wire);
  }
  const pinGeometry = new THREE.SphereGeometry(0.075, 10, 8); const pins = new THREE.InstancedMesh(pinGeometry, bindingMaterial, 6);
  for (let string = 0; string < 6; string += 1) { matrix.makeScale(1, 1, 0.58); matrix.setPosition(guitarStringXAt(string, GUITAR_SADDLE_Z), 0.64, 7.13); pins.setMatrixAt(string, matrix); } pins.instanceMatrix.needsUpdate = true; group.add(pins);
  return group;
}
