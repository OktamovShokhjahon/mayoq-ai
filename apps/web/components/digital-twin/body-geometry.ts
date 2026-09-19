import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Sex } from "./anatomy";

/**
 * Body geometry for the digital twin.
 *
 * The body is built from swept tubes whose radius varies along the path, so a
 * limb thickens at the deltoid and thigh and narrows at the wrist and ankle,
 * the way a body does. Constant-radius capsules are what make a figure read as
 * assembled parts rather than as a person.
 *
 * Everything is merged into one geometry: paired with the depth prepass in
 * `BodyShell`, only the frontmost surface shades, so the silhouette is a single
 * continuous outline instead of an outline per part.
 *
 * Model space: feet at y=0, top of head near y=1.75, +z anterior, +x the
 * patient's left.
 */

type Vec3 = [number, number, number];

/**
 * Sweeps a tube along `path`, interpolating the radius through `radii`.
 * The ring centres are recovered by averaging each ring's vertices, which
 * avoids re-deriving the curve's own arc-length sampling.
 */
export function taperedTube(
  path: Vec3[],
  radii: number[],
  tubularSegments = 40,
  radialSegments = 20,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;

  const centre = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const ringSize = radialSegments + 1;

  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    const t = ring / tubularSegments;

    // Piecewise-linear radius along the sweep.
    const span = (radii.length - 1) * t;
    const index = Math.min(Math.floor(span), radii.length - 2);
    const radius = THREE.MathUtils.lerp(radii[index], radii[index + 1], span - index);

    centre.set(0, 0, 0);
    for (let segment = 0; segment < radialSegments; segment += 1) {
      vertex.fromBufferAttribute(position, ring * ringSize + segment);
      centre.add(vertex);
    }
    centre.divideScalar(radialSegments);

    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const i = ring * ringSize + segment;
      vertex.fromBufferAttribute(position, i);
      offset.subVectors(vertex, centre).setLength(radius);
      position.setXYZ(i, centre.x + offset.x, centre.y + offset.y, centre.z + offset.z);
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Ellipsoid used to cap a sweep or to round out a joint. */
function blob(position: Vec3, radius: Vec3, rotation?: Vec3): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 28, 20);
  geometry.scale(radius[0], radius[1], radius[2]);
  if (rotation) geometry.rotateX(rotation[0]), geometry.rotateY(rotation[1]), geometry.rotateZ(rotation[2]);
  geometry.translate(position[0], position[1], position[2]);
  return geometry;
}

/**
 * Torso: lathed from an anatomical profile, then flattened front-to-back.
 * The profile runs pelvis → waist → ribcage → shoulder girdle.
 */
const TORSO_PROFILE: Record<Sex, Array<[number, number]>> = {
  // Broader shoulder girdle, straighter waist.
  male: [
    [0.02, 0.86],
    [0.105, 0.885],
    [0.142, 0.925],
    [0.152, 0.98],
    [0.143, 1.04],
    [0.129, 1.1],
    [0.126, 1.15],
    [0.139, 1.21],
    [0.153, 1.27],
    [0.161, 1.32],
    [0.163, 1.37],
    [0.152, 1.415],
    [0.12, 1.45],
    [0.075, 1.472],
    [0.03, 1.48],
  ],
  // Between the two, used when the profile does not record a sex.
  neutral: [
    [0.02, 0.858],
    [0.109, 0.883],
    [0.149, 0.924],
    [0.157, 0.978],
    [0.145, 1.04],
    [0.124, 1.1],
    [0.12, 1.15],
    [0.134, 1.21],
    [0.147, 1.27],
    [0.154, 1.32],
    [0.154, 1.37],
    [0.144, 1.414],
    [0.114, 1.448],
    [0.072, 1.47],
    [0.029, 1.478],
  ],
  // Wider hips, narrower waist and shoulders.
  female: [
    [0.02, 0.855],
    [0.112, 0.88],
    [0.155, 0.922],
    [0.161, 0.975],
    [0.146, 1.04],
    [0.119, 1.1],
    [0.114, 1.15],
    [0.128, 1.21],
    [0.141, 1.27],
    [0.146, 1.32],
    [0.145, 1.37],
    [0.135, 1.412],
    [0.107, 1.446],
    [0.068, 1.468],
    [0.028, 1.476],
  ],
};

function torso(sex: Sex): THREE.BufferGeometry {
  const profile = TORSO_PROFILE[sex];
  const geometry = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    56,
  );
  geometry.scale(1, 1, 0.66);
  return geometry;
}

/**
 * Head: a sphere tapered below the cheekbones so it reads as a cranium and jaw
 * rather than a ball, and flattened slightly at the back of the skull.
 */
function head(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 36, 28);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);

    // Below the mid-line, narrow towards the chin.
    if (vertex.y < 0) {
      const taper = 1 - Math.pow(-vertex.y, 1.7) * 0.42;
      vertex.x *= taper;
      vertex.z *= taper;
      vertex.y *= 1.06;
    }
    // Occiput is flatter than the face.
    if (vertex.z < 0) vertex.z *= 0.9;

    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.scale(0.093, 0.118, 0.1);
  geometry.translate(0, 1.645, 0.004);
  return geometry;
}

/** Arm from deltoid to wrist, with a soft elbow and a slight outward hang. */
function arm(side: 1 | -1, sex: Sex): THREE.BufferGeometry[] {
  const narrow = sex === "female" ? 0.93 : 1;
  const x = (value: number) => value * side * narrow;
  const path: Vec3[] = [
    [x(0.135), 1.405, 0],
    [x(0.178), 1.35, -0.004],
    [x(0.198), 1.26, -0.004],
    [x(0.212), 1.17, 0],
    [x(0.224), 1.08, 0.008],
    [x(0.236), 0.99, 0.016],
    [x(0.244), 0.915, 0.022],
  ];
  const radii = [0.062, 0.055, 0.048, 0.042, 0.039, 0.035, 0.03].map(
    (r) => r * (sex === "female" ? 0.9 : 1),
  );

  return [
    taperedTube(path, radii, 44, 18),
    // Deltoid, rounding the shoulder into the torso.
    blob([x(0.142), 1.395, 0], sex === "female" ? [0.054, 0.05, 0.048] : [0.062, 0.058, 0.055]),
    // Hand.
    blob([x(0.249), 0.862, 0.026], [0.03, 0.052, 0.018], [0, 0, x(0.06)]),
  ];
}

/** Leg from hip to ankle, with a thigh, a knee narrowing and a calf. */
function leg(side: 1 | -1, sex: Sex): THREE.BufferGeometry[] {
  const x = (value: number) => value * side * (sex === "female" ? 1.05 : 1);
  const path: Vec3[] = [
    [x(0.072), 0.925, 0],
    [x(0.082), 0.82, 0.002],
    [x(0.086), 0.7, 0.004],
    [x(0.088), 0.58, 0.002],
    [x(0.089), 0.5, -0.004],
    [x(0.09), 0.42, -0.008],
    [x(0.09), 0.3, -0.002],
    [x(0.09), 0.18, 0.004],
    [x(0.09), 0.08, 0.008],
  ];
  const radii = [0.088, 0.083, 0.076, 0.066, 0.058, 0.058, 0.05, 0.04, 0.035].map(
    (r) => r * (sex === "female" ? 0.94 : 1),
  );

  return [
    taperedTube(path, radii, 52, 18),
    // Foot: an angled ellipsoid with a heel, not a box.
    blob([x(0.09), 0.042, 0.048], [0.036, 0.032, 0.088], [-0.12, 0, 0]),
    blob([x(0.09), 0.048, -0.012], [0.034, 0.034, 0.03]),
  ];
}

/** Neck, tapering out of the shoulders and into the jaw. */
function neck(): THREE.BufferGeometry {
  return taperedTube(
    [
      [0, 1.41, -0.004],
      [0, 1.45, -0.004],
      [0, 1.5, -0.002],
      [0, 1.545, 0],
    ],
    [0.072, 0.056, 0.05, 0.052],
    16,
    18,
  );
}

const cached = new Map<Sex, THREE.BufferGeometry>();

/** Built once per sex and shared: the pose is static. */
export function getBodyGeometry(sex: Sex = "male"): THREE.BufferGeometry {
  const hit = cached.get(sex);
  if (hit) return hit;

  const female = sex === "female";

  const parts: THREE.BufferGeometry[] = [
    torso(sex),
    neck(),
    head(),
    ...arm(1, sex),
    ...arm(-1, sex),
    ...leg(1, sex),
    ...leg(-1, sex),
    // Pelvis, filling the gap between the torso lathe and the thighs.
    blob([0, 0.905, 0], female ? [0.155, 0.074, 0.1] : [0.145, 0.075, 0.098]),
    // The chest wall itself, so the silhouette carries the form even when
    // breast tissue is not one of the signalled organs.
    ...(female
      ? [
          blob([-0.062, 1.281, 0.062], [0.052, 0.048, 0.046]),
          blob([0.062, 1.281, 0.062], [0.052, 0.048, 0.046]),
        ]
      : []),
  ];

  // UVs differ across part types and are unused by the shell shader; dropping
  // them lets the merge succeed on a single common attribute set.
  const normalized = parts.map((part) => {
    const plain = part.toNonIndexed();
    plain.deleteAttribute("uv");
    return plain;
  });

  const merged = mergeGeometries(normalized, false) ?? normalized[0];
  cached.set(sex, merged);
  return merged;
}
