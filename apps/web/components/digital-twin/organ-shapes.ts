import * as THREE from "three";
import { taperedTube } from "./body-geometry";

/**
 * Organ geometry.
 *
 * Each organ is shaped, not spherical. A doctor should be able to tell the
 * kidneys from the liver from the stomach by silhouette alone — when every
 * organ is an ellipsoid, colour is carrying information that form should carry,
 * and the scene reads as glowing dots rather than anatomy.
 *
 * Sizes are final: the scene positions these, it does not scale them.
 */

function deform(
  geometry: THREE.BufferGeometry,
  move: (vertex: THREE.Vector3) => void,
): THREE.BufferGeometry {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    move(vertex);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const sphere = (segments = 40) => new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75));

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const group = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  for (const part of parts) {
    const plain = part.toNonIndexed();
    positions.push(...Array.from(plain.attributes.position.array as Float32Array));
    normals.push(...Array.from(plain.attributes.normal.array as Float32Array));
  }
  group.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  group.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return group;
}

/* ------------------------------------------------------------------ thorax */

/** Ventricular mass tapering to the apex, with a cleft between the atria. */
function heart(): THREE.BufferGeometry {
  const geometry = deform(sphere(44), (v) => {
    if (v.y < 0) {
      const taper = 1 - Math.pow(-v.y, 1.6) * 0.72;
      v.x *= taper;
      v.z *= taper;
    }
    if (v.y > 0.5) v.y -= Math.exp(-Math.pow(v.x * 3.4, 2)) * 0.3;
    v.z *= 0.82;
  });
  geometry.scale(0.052, 0.072, 0.05);
  // Aorta and pulmonary trunk rising from the base, so it reads as a heart and
  // not a rounded cone.
  const aorta = taperedTube(
    [[0.004, 0.05, 0.0], [0.006, 0.09, -0.004], [-0.014, 0.112, -0.012]],
    [0.014, 0.012, 0.011],
    14,
    10,
  );
  const pulmonary = taperedTube(
    [[-0.012, 0.045, 0.02], [-0.016, 0.085, 0.022], [-0.03, 0.1, 0.012]],
    [0.012, 0.011, 0.009],
    14,
    10,
  );
  const combined = merge([geometry, aorta, pulmonary]);
  // The apex points down and towards the patient's left.
  combined.rotateZ(0.34);
  return combined;
}

/** Lung: apex narrow, base domed, concave where it wraps the mediastinum. */
function lung(mirror: boolean): THREE.BufferGeometry {
  const side = mirror ? 1 : -1;
  const geometry = deform(sphere(36), (v) => {
    if (v.x * side < 0) v.x *= 1 - Math.exp(-Math.pow(v.y * 1.4, 2)) * 0.45;
    if (v.y > 0) {
      const taper = 1 - Math.pow(v.y, 1.7) * 0.5;
      v.x *= taper;
      v.z *= taper;
    }
    if (v.y < -0.6) v.y = -0.6 + (v.y + 0.6) * 0.6;
    v.z *= 0.78;
    // Oblique fissure: a shallow groove that splits the lung into lobes.
    const groove = Math.exp(-Math.pow((v.y + v.z * 0.6 - 0.05) * 5.5, 2));
    const k = 1 - groove * 0.09;
    v.x *= k;
    v.z *= k;
  });
  geometry.scale(0.056, 0.112, 0.056);
  // Main bronchus entering the hilum on the medial face.
  const towards = -side;
  const bronchus = taperedTube(
    [[towards * 0.03, 0.03, 0], [towards * 0.062, 0.058, 0], [towards * 0.09, 0.085, 0]],
    [0.007, 0.006, 0.005],
    12,
    8,
  );
  return merge([geometry, bronchus]);
}

/* --------------------------------------------------------------- abdominal */

/** Wedge: bulk in the right lobe, thinning towards the midline. */
function liver(): THREE.BufferGeometry {
  const geometry = deform(sphere(36), (v) => {
    const thickness = 0.34 + 0.66 * ((1 - v.x) / 2);
    v.y *= 0.62 * thickness;
    v.z *= 0.72 * thickness;
    if (v.y > 0) v.y *= 0.72;
  });
  geometry.scale(0.088, 0.062, 0.062);
  geometry.rotateZ(-0.12);
  // Gallbladder: a small pear hanging from the inferior surface.
  const gallbladder = sphere(16);
  gallbladder.scale(0.011, 0.02, 0.011);
  gallbladder.translate(-0.012, -0.05, 0.026);
  return merge([geometry, gallbladder]);
}

/** J-shape: fundus high on the patient's left, curving to the pylorus. */
function stomach(): THREE.BufferGeometry {
  return taperedTube(
    [
      [-0.004, 0.044, 0.004],
      [0.024, 0.03, 0.008],
      [0.03, -0.004, 0.004],
      [0.008, -0.03, -0.002],
      [-0.028, -0.026, -0.008],
      [-0.042, -0.006, -0.01],
    ],
    [0.016, 0.03, 0.031, 0.024, 0.014, 0.009],
    32,
    16,
  );
}

/** Head, body and tail, sweeping from the duodenum towards the spleen. */
function pancreas(): THREE.BufferGeometry {
  return taperedTube(
    [
      [-0.042, 0.004, 0.012],
      [-0.012, 0.012, 0.004],
      [0.022, 0.008, -0.006],
      [0.058, -0.006, -0.014],
    ],
    [0.019, 0.016, 0.012, 0.007],
    26,
    14,
  );
}

/** Bean: convex laterally, notched at the medial hilum. */
function kidney(mirror: boolean): THREE.BufferGeometry {
  const medial = mirror ? 1 : -1;
  const geometry = deform(sphere(36), (v) => {
    const waist = Math.exp(-Math.pow(v.y * 2.1, 2));
    if (v.x * medial > 0) v.x *= 1 - waist * 0.62;
    v.x += medial * 0.3 * (v.y * v.y);
    v.z *= 0.86;
  });
  geometry.scale(0.031, 0.05, 0.03);
  return geometry;
}

/**
 * Colon framing a coiled small intestine — the arrangement is what makes the
 * abdomen legible, so the large bowel is swept as a frame and the small bowel
 * as a serpentine inside it.
 */
function intestines(): THREE.BufferGeometry {
  // Ascending → transverse → descending → sigmoid.
  const colon = taperedTube(
    [
      [-0.07, -0.062, 0.004],
      [-0.079, -0.02, 0.008],
      [-0.074, 0.032, 0.006],
      [-0.03, 0.055, 0.008],
      [0.03, 0.052, 0.008],
      [0.075, 0.026, 0.006],
      [0.079, -0.026, 0.004],
      [0.05, -0.062, 0.0],
      [0.012, -0.076, -0.004],
    ],
    [0.016, 0.018, 0.018, 0.017, 0.017, 0.017, 0.016, 0.015, 0.012],
    72,
    14,
  );

  // Small bowel: a flattened serpentine filling the frame.
  const coils: Array<[number, number, number]> = [];
  const turns = 5;
  for (let i = 0; i <= turns * 12; i += 1) {
    const t = i / (turns * 12);
    const angle = t * Math.PI * 2 * turns;
    coils.push([
      Math.sin(angle) * 0.046 * (1 - t * 0.25),
      0.03 - t * 0.09,
      0.018 + Math.cos(angle) * 0.012,
    ]);
  }
  const smallBowel = taperedTube(coils, [0.012, 0.013, 0.012, 0.011], 150, 10);

  return merge([colon, smallBowel]);
}

/* ---------------------------------------------------------------- skeletal */

/** Vertebral column: stacked bodies with a lumbar curve. */
function spine(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 22;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = -0.28 + t * 0.56;
    // Kyphosis through the thorax, lordosis through the lumbar spine.
    const z = Math.sin(t * Math.PI) * -0.014 + (t < 0.35 ? (0.35 - t) * 0.03 : 0);
    const scale = 1 - t * 0.3;
    const body = sphere(14);
    body.scale(0.017 * scale, 0.0095, 0.015 * scale);
    body.translate(0, y, z);
    parts.push(body);
    // Spinous process: the ridge felt down the back.
    const ridge = sphere(8);
    ridge.scale(0.004, 0.008, 0.012);
    ridge.translate(0, y - 0.002, z - 0.02 * scale);
    parts.push(ridge);
  }
  return merge(parts);
}

/* ----------------------------------------------------------------- systems */

/** Mediastinum: the great-vessel corridor, kept slim so the tree reads. */
function mediastinum(): THREE.BufferGeometry {
  const geometry = sphere(24);
  geometry.scale(0.038, 0.115, 0.03);
  return geometry;
}

function vesselTrunk(): THREE.BufferGeometry {
  const geometry = sphere(20);
  geometry.scale(0.012, 0.14, 0.012);
  return geometry;
}

function eye(): THREE.BufferGeometry {
  const geometry = sphere(24);
  geometry.scale(0.011, 0.011, 0.011);
  return geometry;
}

/** Cerebrum with gyri and a longitudinal fissure. */
function brain(): THREE.BufferGeometry {
  const geometry = deform(sphere(56), (v) => {
    const gyri =
      Math.sin(v.x * 13) * Math.sin(v.y * 11) * Math.sin(v.z * 12) * 0.045 +
      Math.sin(v.z * 17 + v.y * 6) * 0.02;
    v.multiplyScalar(1 + gyri);
    v.x *= 1 - Math.exp(-Math.pow(v.x * 7, 2)) * 0.16;
    if (v.y < -0.4) v.y = -0.4 + (v.y + 0.4) * 0.45;
  });
  geometry.scale(0.068, 0.06, 0.072);
  const cerebellum = deform(sphere(28), (v) => {
    v.y *= 0.6;
    v.multiplyScalar(1 + Math.sin(v.x * 26) * 0.03);
  });
  cerebellum.scale(0.04, 0.024, 0.03);
  cerebellum.translate(0, -0.052, -0.04);
  const stem = taperedTube(
    [[0, -0.03, -0.005], [0, -0.06, -0.012], [0, -0.09, -0.016]],
    [0.011, 0.009, 0.007],
    10,
    10,
  );
  return merge([geometry, cerebellum, stem]);
}

const BUILDERS: Record<string, (mirror: boolean) => THREE.BufferGeometry> = {
  heart,
  lungs: lung,
  liver,
  stomach,
  pancreas,
  kidney,
  intestines,
  spine,
  nervous_system: brain,
  eyes: eye,
  cardiovascular_system: mediastinum,
  blood_vessels: vesselTrunk,
};

const cache = new Map<string, THREE.BufferGeometry>();

export function organGeometry(key: string, mirror = false): THREE.BufferGeometry {
  const id = `${key}:${mirror}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const build = BUILDERS[key];
  const geometry = build ? build(mirror) : sphere(24).scale(0.03, 0.03, 0.03);
  cache.set(id, geometry);
  return geometry;
}
