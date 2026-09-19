"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBodyGeometry } from "./body-geometry";
import type { Sex } from "./anatomy";

/* --------------------------------------------------------------------------
   Body shell
   The silhouette is lathed from an anatomical profile rather than assembled
   from primitives, so the torso tapers at the waist and widens at the chest.
   A Fresnel term lights only the grazing edges, which reads as clinical glass
   and keeps the organs inside legible.
   -------------------------------------------------------------------------- */

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uSkin;
  uniform vec3 uEdge;
  uniform vec3 uLight;
  uniform float uOpacity;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 view = normalize(vViewDir);

    // abs(), not clamp(): back faces point away from the camera, and clamping
    // their negative dot product to zero made every one of them fully opaque.
    float facing = abs(dot(normal, view));
    float fresnel = pow(1.0 - facing, 2.0);

    // Wrapped diffuse gives the form its light and shade. Fresnel alone draws
    // an outline around a hollow middle, which reads as a flat cutout.
    vec3 light = normalize(uLight);
    float diffuse = pow(clamp(dot(normal, light) * 0.5 + 0.5, 0.0, 1.0), 1.4);

    vec3 halfway = normalize(light + view);
    float sheen = pow(max(dot(normal, halfway), 0.0), 36.0) * 0.16;

    // Dark ground: the silhouette LIGHTENS at grazing angles, like an X-ray
    // plate. A tight rim (pow 3) keeps the outline crisp instead of a haze.
    float rim = pow(1.0 - facing, 3.0);
    vec3 color = mix(uSkin * (0.7 + diffuse * 0.6), uEdge, clamp(fresnel * 0.5 + rim * 0.9, 0.0, 1.0)) + sheen;

    // The body interior is nearly clear so organs read at full strength; only
    // the rim and a faint skin veil are drawn.
    float alpha = uOpacity * (0.12 + fresnel * 0.28 + rim * 0.6);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

function useShellMaterials() {
  return useMemo(() => {
    const uniforms = {
      uSkin: { value: new THREE.Color("#2a4256") },
      uEdge: { value: new THREE.Color("#8fe3f2") },
      uLight: { value: new THREE.Vector3(0.45, 0.68, 0.9).normalize() },
      uOpacity: { value: 1 },
    };

    const shell = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      // Only fragments at exactly the depth laid down by the prepass survive,
      // so the shell shades the frontmost surface alone. Without this, every
      // overlapping part draws its own silhouette and the body reads as a
      // stack of separate pieces.
      depthTest: true,
      depthFunc: THREE.EqualDepth,
      side: THREE.FrontSide,
    });

    // Depth-only prepass. It must run the *same* vertex shader as the shell:
    // a different one computes gl_Position through different arithmetic, and
    // the depths no longer compare equal, which showed up as banding across
    // the arms and legs where fragments failed the EqualDepth test.
    const prepass = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERTEX,
      fragmentShader: `void main() { gl_FragColor = vec4(0.0); }`,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
      // Opaque materials all draw before any transparent one, which would put
      // this ahead of the organs and depth-reject them. Flagging it transparent
      // puts it in the same pass, where renderOrder decides.
      transparent: true,
    });

    return { shell, prepass };
  }, []);
}

/** The body never intercepts pointer events — the organs inside are the targets. */
const IGNORE_RAYCAST = () => null;

/**
 * `dissect` runs 0 → 1 as the camera closes in. At 1 the skin is gone: close
 * up, a translucent body over separated organs reads as fog rather than as
 * anatomy, so the shell gets out of the way entirely and the organs carry the
 * frame. The depth prepass is switched off with it — left on, it would keep
 * writing a silhouette that nothing draws into.
 */
export function BodyShell({ sex, dissectRef }: { sex: Sex; dissectRef?: MutableRefObject<number> }) {
  const geometry = useMemo(() => getBodyGeometry(sex), [sex]);
  const { shell, prepass } = useShellMaterials();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const dissect = dissectRef?.current ?? 0;
    const opacity = 1 - dissect;
    shell.uniforms.uOpacity.value = opacity;
    if (groupRef.current) groupRef.current.visible = opacity > 0.02;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={prepass} renderOrder={1} raycast={IGNORE_RAYCAST} />
      <mesh geometry={geometry} material={shell} renderOrder={2} raycast={IGNORE_RAYCAST} />
    </group>
  );
}

/* --------------------------------------------------------------------------
   Vascular tree
   Drawn as tubes along the great vessels so the twin reads as anatomy rather
   than as a capsule with dots. It takes the cardiovascular signal colour.
   -------------------------------------------------------------------------- */

const VESSEL_PATHS: Array<Array<[number, number, number]>> = [
  // Aortic arch and descending aorta
  [
    [-0.02, 1.3, 0.03],
    [0.0, 1.37, 0.0],
    [0.025, 1.33, -0.02],
    [0.012, 1.15, -0.03],
    [0.0, 0.95, -0.025],
  ],
  // Carotids
  [
    [-0.018, 1.36, 0.0],
    [-0.03, 1.46, 0.008],
    [-0.032, 1.55, 0.014],
  ],
  [
    [0.018, 1.36, 0.0],
    [0.03, 1.46, 0.008],
    [0.032, 1.55, 0.014],
  ],
  // Vena cava, running beside the aorta into the right atrium
  [
    [-0.024, 0.95, -0.02],
    [-0.026, 1.1, -0.012],
    [-0.02, 1.24, 0.008],
    [-0.008, 1.29, 0.03],
  ],
  // Renal arteries
  [
    [0.006, 1.06, -0.03],
    [0.04, 1.06, -0.04],
    [0.075, 1.06, -0.05],
  ],
  [
    [0.006, 1.06, -0.03],
    [-0.04, 1.06, -0.04],
    [-0.075, 1.06, -0.05],
  ],
  // Pulmonary trunk and arteries
  [
    [0.03, 1.32, 0.05],
    [0.02, 1.36, 0.035],
    [-0.02, 1.37, 0.02],
    [-0.055, 1.35, 0.005],
  ],
  [
    [0.02, 1.36, 0.035],
    [0.05, 1.36, 0.02],
    [0.08, 1.34, 0.005],
  ],
  // Iliac branches
  [
    [0.0, 0.95, -0.025],
    [-0.055, 0.89, -0.01],
    [-0.085, 0.78, 0.0],
  ],
  [
    [0.0, 0.95, -0.025],
    [0.055, 0.89, -0.01],
    [0.085, 0.78, 0.0],
  ],
];

export function VascularTree({ color, intensity }: { color: THREE.Color; intensity: number }) {
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    for (const material of materials.current) {
      material.color.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity = intensity;
    }
  });
  const geometries = useMemo(
    () =>
      VESSEL_PATHS.map((path) => {
        const curve = new THREE.CatmullRomCurve3(
          path.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        );
        return new THREE.TubeGeometry(curve, 40, 0.0075, 10, false);
      }),
    [],
  );

  materials.current = [];

  return (
    <group renderOrder={0}>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial
            ref={(material: THREE.MeshStandardMaterial | null) => {
              if (material) materials.current.push(material);
            }}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------------------
   Skeleton: paired ribs, sternum and clavicles, so the chest cavity has depth
   behind the heart and the torso reads as a body rather than a shell.
   -------------------------------------------------------------------------- */

function ribGeometries(): THREE.BufferGeometry[] {
  const list: THREE.BufferGeometry[] = [];
  // Each rib leaves the spine, bows outward and forward, then sweeps down and
  // in to meet the sternum. Lower ribs sit lower and wider.
  for (let index = 0; index < 8; index += 1) {
    const y = 1.4 - index * 0.036;
    const half = 0.1 + Math.sin((index / 7) * Math.PI * 0.85) * 0.05;
    for (const side of [1, -1]) {
      const path = [
        [side * 0.018, y + 0.012, -0.066],
        [side * half * 0.85, y + 0.006, -0.05],
        [side * half * 1.02, y - 0.008, 0.005],
        [side * half * 0.7, y - 0.026, 0.05],
        [side * 0.026, y - 0.046 - index * 0.002, 0.07],
      ].map(([x, py, z]) => new THREE.Vector3(x, py, z));
      list.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 36, 0.0032, 6, false));
    }
  }
  // Sternum down the midline.
  list.push(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.43, 0.07),
        new THREE.Vector3(0, 1.3, 0.079),
        new THREE.Vector3(0, 1.16, 0.074),
      ]),
      12,
      0.0085,
      8,
      false,
    ),
  );
  // Clavicles.
  for (const side of [1, -1]) {
    list.push(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.012, 1.425, 0.066),
          new THREE.Vector3(side * 0.07, 1.435, 0.06),
          new THREE.Vector3(side * 0.14, 1.42, 0.02),
        ]),
        16,
        0.0042,
        6,
        false,
      ),
    );
  }
  return list;
}

/** Bone reads as pale ivory against the dark stage and the coloured organs. */
export function Ribcage({ dissectRef }: { dissectRef?: MutableRefObject<number> }) {
  const geometries = useMemo(ribGeometries, []);
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  // The cage opens as the view closes in: bones thin out and lift apart, so the
  // heart behind them is read directly rather than through a grille.
  useFrame(() => {
    const dissect = dissectRef?.current ?? 0;
    for (const material of materials.current) material.opacity = 0.62 * (1 - dissect * 0.85);
    if (groupRef.current) groupRef.current.scale.setScalar(1 + dissect * 0.16);
  });

  materials.current = [];

  return (
    <group ref={groupRef} renderOrder={0}>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} raycast={IGNORE_RAYCAST}>
          <meshStandardMaterial
            ref={(material: THREE.MeshStandardMaterial | null) => {
              if (material) materials.current.push(material);
            }}
            color="#e4dccb"
            roughness={0.55}
            metalness={0}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
