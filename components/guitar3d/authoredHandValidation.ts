/**
 * Renderer facts kept deliberately independent of Three.js so the asset
 * contract can be checked in the fast Node validation script as well as at
 * runtime. A single material does not need geometry groups; an array of
 * materials does.
 */
export type AuthoredMeshDrawableFacts = {
  isSkinnedMesh: boolean;
  hasMaterial: boolean;
  materialCount: number;
  groupCount: number;
  positionCount: number;
  indexCount: number;
};

export function authoredMeshDrawableState(facts: AuthoredMeshDrawableFacts) {
  const hasIndexedTriangles = facts.indexCount > 0 || facts.positionCount > 0;
  const hasUsableMaterial = facts.hasMaterial && facts.materialCount > 0;
  const materialCoverage = facts.materialCount === 1 || facts.groupCount > 0;
  return facts.isSkinnedMesh && hasUsableMaterial && hasIndexedTriangles && materialCoverage;
}

export type AuthoredHandBounds = { min: readonly [number, number, number]; max: readonly [number, number, number] };

function finiteBounds(bounds: AuthoredHandBounds) {
  return [...bounds.min, ...bounds.max].every(Number.isFinite) && bounds.min.every((value, axis) => value <= bounds.max[axis]);
}

function intersects(a: AuthoredHandBounds, b: AuthoredHandBounds) {
  return a.min.every((value, axis) => value <= b.max[axis] && a.max[axis] >= b.min[axis]);
}

/** Pure readiness contract shared by runtime loading and the Node validator. */
export function authoredHandReadyState(input: { drawable: boolean; bounds: AuthoredHandBounds; sceneRegion: AuthoredHandBounds }) {
  return input.drawable && finiteBounds(input.bounds) && finiteBounds(input.sceneRegion) && intersects(input.bounds, input.sceneRegion);
}
