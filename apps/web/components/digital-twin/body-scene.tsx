"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, Outlines } from "@react-three/drei";
import * as THREE from "three";
import { BodyShell, Ribcage, VascularTree } from "./human-model";
import { organGeometry } from "./organ-shapes";
import {
  organsFor,
  STATE_GLYPH,
  STATE_HEX,
  STATE_HEX_3D,
  STATE_LABEL_KEY,
  organLabelKey,
  systemLabelKey,
  type OrganDef,
  type Sex,
} from "./anatomy";
import type { Projection } from "./organ-labels";
import type { OrganSignal, RiskColor } from "./types";
import { useI18n } from "@/lib/i18n";
import { signalExplanation, useClinicalText } from "@/lib/clinical-text";
import { fieldList } from "@/lib/format";

export type TwinView = "front" | "back" | "left" | "right";

/** Camera work the surrounding chrome can drive from outside the canvas. */
export interface ZoomApi {
  zoomBy: (factor: number) => void;
  reset: () => void;
}

/** Organ present in the model but carrying no signal in this scenario. */
const UNASSESSED_HEX = "#8fa3b3";

/** The stage ground. Near-black with a blue cast, so risk colours keep their hue. */
const STAGE_COLOR = "#060c11";

const CAMERA_PRESETS: Record<TwinView, [number, number, number]> = {
  front: [0, 0.95, 2.45],
  back: [0, 0.95, -2.45],
  left: [-2.45, 0.95, 0.01],
  right: [2.45, 0.95, 0.01],
};

const TARGET = new THREE.Vector3(0, 0.9, 0);

interface OrganState {
  before: RiskColor | null;
  after: RiskColor | null;
  beforeSignal: OrganSignal | null;
  afterSignal: OrganSignal | null;
}

function buildStates(
  organs: OrganDef[],
  beforeSignals: OrganSignal[],
  afterSignals: OrganSignal[],
): Record<string, OrganState> {
  const states: Record<string, OrganState> = {};
  for (const organ of organs) {
    const before = beforeSignals.find((signal) => signal.organ === organ.key) ?? null;
    const after = afterSignals.find((signal) => signal.organ === organ.key) ?? null;
    states[organ.key] = {
      before: before?.color ?? null,
      after: after?.color ?? null,
      beforeSignal: before,
      afterSignal: after,
    };
  }
  return states;
}

function colorFor(state: RiskColor | null): THREE.Color {
  return new THREE.Color(state ? STATE_HEX_3D[state] : UNASSESSED_HEX);
}

function Organ({
  organ,
  state,
  mixRef,
  dissectRef,
  siteRegistry,
  showAfter,
  reducedMotion,
  selected,
  onSelect,
}: {
  organ: OrganDef;
  state: OrganState;
  mixRef: MutableRefObject<number>;
  /** 0 at full-body distance, 1 fully dissected. Drives the exploded view. */
  dissectRef: MutableRefObject<number>;
  siteRegistry: MutableRefObject<Record<string, Array<THREE.Group | null>>>;
  showAfter: boolean;
  reducedMotion: boolean;
  selected: boolean;
  onSelect: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const text = useClinicalText();
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  const halos = useRef<THREE.MeshBasicMaterial[]>([]);
  const siteRefs = useRef<Array<THREE.Group | null>>([]);
  const cardRef = useRef<THREE.Group>(null);
  // Published so the label projector can follow the exploded positions.
  siteRegistry.current[organ.key] = siteRefs.current;

  const beforeColor = useMemo(() => colorFor(state.before), [state.before]);
  const afterColor = useMemo(() => colorFor(state.after), [state.after]);
  const scratch = useMemo(() => new THREE.Color(), []);
  const goalScale = useMemo(() => new THREE.Vector3(), []);
  const scratchVector = useMemo(() => new THREE.Vector3(), []);

  /**
   * Where each site travels to when the body opens up. The direction is the
   * site's own offset from the body axis, so an organ moves out along the line
   * it already sits on and the arrangement still reads anatomically — an
   * exploded plate, not a scatter. Paired organs push apart symmetrically
   * because their offsets are already mirrored.
   */
  const explode = useMemo(
    () =>
      organ.sites.map((site) => {
        const [x, y, z] = site.position;
        const radial = new THREE.Vector3(x, 0, z);
        // A site sitting on the axis has no direction of its own; send it
        // forward, out of the torso, rather than leaving it buried.
        if (radial.lengthSq() < 1e-6) radial.set(0, 0, 1);
        radial.normalize();
        // Lift with height so the stack fans open instead of forming a ring.
        return radial.multiplyScalar(0.3).setY((y - 1.05) * 0.22);
      }),
    [organ.sites],
  );

  useFrame(({ clock }) => {
    const mix = mixRef.current;
    scratch.copy(beforeColor).lerp(afterColor, mix);

    const dominant = mix > 0.5 ? state.after : state.before;
    const assessed = dominant !== null;
    const alerting = dominant === "red" || dominant === "yellow";

    // Alerting organs breathe. Under reduced motion nothing breathes: the
    // colour, glyph and label still carry the state on their own.
    const beat =
      alerting && !reducedMotion
        ? 0.5 + 0.35 * Math.sin(clock.elapsedTime * (dominant === "red" ? 4.2 : 2.6))
        : 0.5;

    const emphasis = selected || hovered ? 1.45 : 1;
    const dissect = dissectRef.current;

    // Close up the glow becomes the problem it solved: at full-body distance
    // the emissive bloom is what makes a 2cm organ findable, but against a
    // separated organ filling a third of the frame it is just haze over the
    // surface. Both fall away as the view closes in.
    const intensity = (assessed ? 0.22 + beat * 0.5 : 0.06) * emphasis * (1 - dissect * 0.72);

    for (const material of materials.current) {
      material.color.copy(scratch);
      material.emissive.copy(scratch);
      material.emissiveIntensity = intensity;
      material.opacity = assessed ? 1 : 0.85;
      // A tighter, drier surface holds an edge that reads as a form.
      material.roughness = 0.28 + dissect * 0.3;
    }
    for (const halo of halos.current) {
      halo.color.copy(scratch);
      halo.opacity = (assessed ? 0.05 + beat * 0.08 : 0) * emphasis * (1 - dissect);
    }

    // Each site drifts out along its own line. Lerping rather than assigning
    // means a flick of the wheel opens the body smoothly instead of snapping.
    for (let index = 0; index < siteRefs.current.length; index += 1) {
      const site = siteRefs.current[index];
      const offset = explode[index];
      if (!site || !offset) continue;
      const base = organ.sites[index].position;
      site.position.lerp(
        scratchVector.set(
          base[0] + offset.x * dissect,
          base[1] + offset.y * dissect,
          base[2] + offset.z * dissect,
        ),
        0.18,
      );
      // The hover card rides the first site.
      if (index === 0) cardRef.current?.position.copy(site.position);
    }

    if (groupRef.current) {
      // Only an explicit selection resizes an organ. Hover leaves the geometry
      // still — a body that flinches under the cursor reads as an animation,
      // not as anatomy, and it makes small organs harder to aim at.
      const goal = selected ? 1.14 : 1;
      goalScale.set(goal, goal, goal);
      groupRef.current.scale.lerp(goalScale, 0.15);
    }
  });

  materials.current = [];
  halos.current = [];
  siteRefs.current = [];

  // The card reports the state the viewer is looking at, not a fixed side of
  // the morph — otherwise it can contradict the organ's own colour.
  const hoveredSignal = showAfter
    ? state.afterSignal ?? state.beforeSignal
    : state.beforeSignal ?? state.afterSignal;
  const hoveredState = hoveredSignal?.color ?? null;


  return (
    <group
      ref={groupRef}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selected ? null : organ.key);
      }}
    >
      {organ.sites.map((site, index) => (
        <group
          key={index}
          ref={(node: THREE.Group | null) => {
            siteRefs.current[index] = node;
          }}
          position={site.position}
          rotation={site.rotation ?? [0, 0, 0]}
        >
          <mesh geometry={organGeometry(organ.key, index === 1)} renderOrder={0}>
            <meshPhysicalMaterial
              ref={(material: THREE.MeshPhysicalMaterial | null) => {
                if (material) materials.current.push(material);
              }}
              transparent
              roughness={0.28}
              metalness={0.05}
              clearcoat={0.7}
              clearcoatRoughness={0.22}
              envMapIntensity={0.9}
            />
            {/* A thin pale contour separates neighbouring organs on a dark
                ground; colour alone leaves them merging into one mass. */}
            <Outlines thickness={0.0016} color="#dff3f8" transparent opacity={0.4} />
          </mesh>
          {/* Additive halo so the organ reads through the body shell. */}
          <mesh
            scale={[site.radius[0] * 1.8, site.radius[1] * 1.8, site.radius[2] * 1.8]}
            renderOrder={0}
          >
            <sphereGeometry args={[1, 24, 18]} />
            <meshBasicMaterial
              ref={(material: THREE.MeshBasicMaterial | null) => {
                if (material) halos.current.push(material);
              }}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}

      {/* Tracks the first site, so the card travels with its organ once the
          body opens up rather than staying at the authored coordinate. */}
      {hovered && (
        <group ref={cardRef} position={organ.sites[0].position}>
        <Html
          center
          /* No distanceFactor: the card is chrome, not anatomy, so it keeps one
             legible size instead of swelling to fill the stage as you zoom in. */
          zIndexRange={[30, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="w-[210px] rounded-lg border bg-[#0b141a]/95 p-3 text-left text-[#dce6ec] shadow-lg backdrop-blur"
            style={{
              borderColor: hoveredState ? STATE_HEX_3D[hoveredState] : "rgba(220,234,242,0.28)",
              // Organs high in the body would push the card off the top of the
              // stage, so those flip below the organ instead.
              transform:
                organ.sites[0].position[1] > 1.45 ? "translateY(86px)" : "translateY(-86px)",
            }}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7a8f9c]">
              {t(systemLabelKey(organ.system))}
            </div>
            <div className="mt-0.5 font-display text-[15px] leading-tight text-white">
              {t(organLabelKey(organ.key))}
            </div>

            <div
              className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ color: hoveredState ? STATE_HEX_3D[hoveredState] : "#9db0bc" }}
            >
              <span aria-hidden>{hoveredState ? STATE_GLYPH[hoveredState] : "–"}</span>
              {hoveredState ? t(STATE_LABEL_KEY[hoveredState]) : t("twin.notAssessed")}
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-[#9db0bc]">
              {hoveredSignal
                ? signalExplanation(text, hoveredSignal)
                : t("twin.notAssessedBody")}
            </p>

            {hoveredSignal && hoveredSignal.missingData.length > 0 && (
              <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-state-amber">
                {t("twin.missingPrefix")} {fieldList(hoveredSignal.missingData)}
              </p>
            )}
          </div>
        </Html>
        </group>
      )}
    </group>
  );
}

function Vasculature({
  states,
  mixRef,
}: {
  states: Record<string, OrganState>;
  mixRef: MutableRefObject<number>;
}) {
  const source = states.blood_vessels ?? states.cardiovascular_system;
  const before = useMemo(() => colorFor(source?.before ?? null), [source?.before]);
  const after = useMemo(() => colorFor(source?.after ?? null), [source?.after]);
  const color = useMemo(() => new THREE.Color(), []);
  const assessed = Boolean(source?.after ?? source?.before);

  useFrame(() => {
    color.copy(before).lerp(after, mixRef.current);
  });

  return <VascularTree color={color} intensity={assessed ? 0.7 : 0.22} />;
}

/**
 * Projects each organ to screen space for the leader-line labels. It writes
 * into a ref rather than React state — this runs every frame, and re-rendering
 * the overlay at 60fps to move a few lines would be wasteful.
 */
function Projector({
  organs,
  groupRef,
  projection,
  sites,
}: {
  organs: OrganDef[];
  groupRef: MutableRefObject<THREE.Group | null>;
  projection: MutableRefObject<Projection>;
  /** Live site groups per organ, so labels track the exploded positions. */
  sites: MutableRefObject<Record<string, Array<THREE.Group | null>>>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    for (const organ of organs) {
      // Paired organs report their midpoint, so one label serves both.
      const live = sites.current[organ.key];
      const usable = live?.filter(Boolean) as THREE.Group[] | undefined;

      if (usable && usable.length === organ.sites.length) {
        // Read where the organ actually is, not where it was authored: the
        // body opens up as the camera closes in, and a label left at the
        // original coordinate would point into empty space.
        point.set(0, 0, 0);
        for (const site of usable) {
          site.getWorldPosition(world);
          point.addScaledVector(world, 1 / usable.length);
        }
      } else {
        point.set(0, 0, 0);
        for (const site of organ.sites) {
          point.x += site.position[0] / organ.sites.length;
          point.y += site.position[1] / organ.sites.length;
          point.z += site.position[2] / organ.sites.length;
        }
        group.localToWorld(point);
      }
      point.project(camera);

      projection.current[organ.key] = {
        x: (point.x * 0.5 + 0.5) * size.width,
        y: (-point.y * 0.5 + 0.5) * size.height,
        visible: point.z < 1,
      };
    }
  });

  return null;
}

/** Distance at which the body is whole, and the closest the camera may come. */
export const FULL_BODY_DISTANCE = 2.45;
export const CLOSEST_DISTANCE = 0.85;

/** 0 while the whole body is in frame, easing to 1 once it is fully opened. */
function dissectionFor(distance: number): number {
  const start = 1.95;
  const end = 1.15;
  const t = (start - distance) / (start - end);
  const clamped = Math.min(1, Math.max(0, t));
  // Smoothstep, so the body does not lurch open the instant you touch the wheel.
  return clamped * clamped * (3 - 2 * clamped);
}

/** The slice of OrbitControls this scene drives directly. */
type Orbit = { target: THREE.Vector3; update: () => void };

/** How far the focus point may wander from the body while zooming into a spot. */
const FOCUS_LIMIT = new THREE.Vector3(0.5, 0.7, 0.5);

/**
 * Keeps the point the camera orbits inside the body's own envelope, so zooming
 * towards an edge cannot strand the view on empty background. The camera moves
 * with it, which preserves the framing the viewer just asked for.
 */
function clampFocus(focus: THREE.Vector3, camera: THREE.Camera) {
  const x = THREE.MathUtils.clamp(focus.x, TARGET.x - FOCUS_LIMIT.x, TARGET.x + FOCUS_LIMIT.x);
  const y = THREE.MathUtils.clamp(focus.y, TARGET.y - FOCUS_LIMIT.y, TARGET.y + FOCUS_LIMIT.y);
  const z = THREE.MathUtils.clamp(focus.z, TARGET.z - FOCUS_LIMIT.z, TARGET.z + FOCUS_LIMIT.z);
  camera.position.x += x - focus.x;
  camera.position.y += y - focus.y;
  camera.position.z += z - focus.z;
  focus.set(x, y, z);
}

function CameraRig({
  view,
  controlsRef,
}: {
  view: TwinView;
  controlsRef: MutableRefObject<Orbit | null>;
}) {
  const { camera } = useThree();
  const goal = useMemo(() => new THREE.Vector3(...CAMERA_PRESETS.front), []);
  const settling = useRef(false);

  useEffect(() => {
    // Turning the body must not undo the zoom, so a view change re-aims the
    // camera along the new axis while keeping the distance the viewer chose —
    // and keeps orbiting whatever they zoomed in on.
    const focus = controlsRef.current?.target ?? TARGET;
    const preset = new THREE.Vector3(...CAMERA_PRESETS[view]);
    const distance = camera.position.distanceTo(focus) || FULL_BODY_DISTANCE;
    goal.copy(preset).sub(TARGET).normalize().multiplyScalar(distance).add(focus);
    settling.current = true;
  }, [view, goal, camera, controlsRef]);

  useFrame(() => {
    if (!settling.current) return;
    camera.position.lerp(goal, 0.08);
    if (controlsRef.current) controlsRef.current.update();
    else camera.lookAt(TARGET);
    if (camera.position.distanceTo(goal) < 0.02) settling.current = false;
  });

  return null;
}

/**
 * Wheel zoom that goes where the cursor points. Dollying at a fixed centre
 * slides the organ you were aiming at out of frame exactly as you close in on
 * it; here the point under the cursor stays put, the way a map behaves.
 */
function CursorZoom({
  controlsRef,
  grabbedRef,
}: {
  controlsRef: MutableRefObject<Orbit | null>;
  grabbedRef: MutableRefObject<boolean>;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const element = gl.domElement;
    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane();
    const anchor = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      grabbedRef.current = true;
      const focus = controlsRef.current?.target ?? TARGET;
      const distance = camera.position.distanceTo(focus);
      if (distance < 1e-4) return;

      // deltaMode 1 is line-based (Firefox); normalise it to pixels first.
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      const next = Math.min(
        FULL_BODY_DISTANCE,
        Math.max(CLOSEST_DISTANCE, distance * Math.exp(delta * 0.0012)),
      );
      const scale = next / distance;
      if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-4) return;

      // The anchor is where the cursor points, on the plane the focus sits in.
      const rect = element.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      camera.getWorldDirection(normal);
      plane.setFromNormalAndCoplanarPoint(normal, focus);
      if (!raycaster.ray.intersectPlane(plane, anchor)) anchor.copy(focus);

      // Scaling camera and focus about the anchor pins the anchor on screen.
      // Zooming back out aims at the body centre instead, so you always end up
      // framed on the whole patient again.
      const pivot = scale < 1 ? anchor : TARGET;
      camera.position.sub(pivot).multiplyScalar(scale).add(pivot);

      const target = controlsRef.current?.target;
      if (target) {
        target.sub(pivot).multiplyScalar(scale).add(pivot);
        clampFocus(target, camera);
        controlsRef.current?.update();
      } else {
        camera.lookAt(TARGET);
      }
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [camera, gl, controlsRef, grabbedRef]);

  return null;
}

/**
 * Publishes how far in the camera is, as both the raw dissection value the
 * scene animates against and a rounded step the surrounding UI can label.
 */
function ZoomReporter({
  dissectRef,
  onZoomChange,
  controlsRef,
  orbitRef,
  turntableRef,
  grabbedRef,
}: {
  dissectRef: MutableRefObject<number>;
  onZoomChange?: (zoom: number) => void;
  controlsRef: MutableRefObject<ZoomApi | null>;
  orbitRef: MutableRefObject<Orbit | null>;
  turntableRef: MutableRefObject<THREE.Group | null>;
  grabbedRef: MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  const lastReported = useRef(-1);

  useFrame(() => {
    const focus = orbitRef.current?.target ?? TARGET;
    const distance = camera.position.distanceTo(focus);
    dissectRef.current = dissectionFor(distance);

    const zoom = FULL_BODY_DISTANCE / Math.max(distance, 0.0001);
    const rounded = Math.round(zoom * 20) / 20;
    if (rounded !== lastReported.current) {
      lastReported.current = rounded;
      onZoomChange?.(rounded);
    }
  });

  // The zoom buttons live in the surrounding chrome, outside the canvas, so
  // the camera work they need is published here rather than duplicated there.
  useEffect(() => {
    controlsRef.current = {
      zoomBy(factor: number) {
        // The buttons have no cursor to aim at, so they dolly along whatever
        // the wheel last centred on.
        const focus = orbitRef.current?.target ?? TARGET;
        const direction = camera.position.clone().sub(focus);
        const next = Math.min(
          FULL_BODY_DISTANCE,
          Math.max(CLOSEST_DISTANCE, direction.length() / factor),
        );
        camera.position.copy(direction.normalize().multiplyScalar(next).add(focus));
        if (orbitRef.current) orbitRef.current.update();
        else camera.lookAt(focus);
      },
      reset() {
        // Everything the viewer can move goes back at once — distance, the
        // point being orbited and the angle they turned to — so this button is
        // always a way back to the view the twin opened on.
        camera.position.set(...CAMERA_PRESETS.front);
        orbitRef.current?.target.copy(TARGET);
        if (turntableRef.current) turntableRef.current.rotation.y = 0;
        grabbedRef.current = false;
        if (orbitRef.current) orbitRef.current.update();
        else camera.lookAt(TARGET);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [camera, controlsRef, orbitRef, turntableRef, grabbedRef]);

  return null;
}

/**
 * Gentle sway rather than a full turntable: the patient stays front-facing and
 * readable, while the parallax still reads as volume. Full rotation is on the
 * view buttons and on drag, where the doctor asks for it deliberately.
 */
function Turntable({
  enabled,
  grabbedRef,
  groupRef,
  children,
}: {
  enabled: boolean;
  /** True once the viewer has moved the camera themselves. */
  grabbedRef: MutableRefObject<boolean>;
  groupRef: MutableRefObject<THREE.Group | null>;
  children: React.ReactNode;
}) {
  const ref = groupRef;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // The sway writes rotation.y every frame, so it would drift the body back
    // under someone reading a zoomed-in organ. It stops once they take hold,
    // and the default-view button starts it again.
    if (grabbedRef.current) return;
    const goal = enabled ? Math.sin(clock.elapsedTime * 0.26) * 0.2 : 0;
    ref.current.rotation.y += (goal - ref.current.rotation.y) * 0.05;
  });
  return <group ref={ref}>{children}</group>;
}

function Platform() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.34, 0.36, 64]} />
        <meshBasicMaterial color="#3fc4d8" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.52, 0.525, 64]} />
        <meshBasicMaterial color="#5f86ff" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export function BodyScene({
  beforeSignals,
  afterSignals,
  mix,
  view,
  sex,
  autoRotate,
  reducedMotion,
  selectedOrgan,
  onSelectOrgan,
  projection,
  zoomApi,
  onZoomChange,
}: {
  beforeSignals: OrganSignal[];
  afterSignals: OrganSignal[];
  mix: number;
  view: TwinView;
  sex: Sex;
  autoRotate: boolean;
  reducedMotion: boolean;
  selectedOrgan: string | null;
  onSelectOrgan: (key: string | null) => void;
  projection: MutableRefObject<Projection>;
  zoomApi?: MutableRefObject<ZoomApi | null>;
  onZoomChange?: (zoom: number) => void;
}) {
  const organs = useMemo(() => organsFor(sex), [sex]);
  const turntableRef = useRef<THREE.Group | null>(null);
  const dissectRef = useRef(0);
  const siteRegistry = useRef<Record<string, Array<THREE.Group | null>>>({});
  const fallbackZoomApi = useRef<ZoomApi | null>(null);
  const orbitRef = useRef<Orbit | null>(null);
  const grabbedRef = useRef(false);

  const states = useMemo(
    () => buildStates(organs, beforeSignals, afterSignals),
    [organs, beforeSignals, afterSignals],
  );

  // The slider writes here each frame instead of re-rendering the scene graph.
  const mixRef = useRef(mix);
  useEffect(() => {
    mixRef.current = mix;
  }, [mix]);

  return (
    <Canvas
      camera={{ position: CAMERA_PRESETS.front, fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onSelectOrgan(null)}
    >
      <color attach="background" args={[STAGE_COLOR]} />
      <fog attach="fog" args={[STAGE_COLOR, 4.6, 9]} />

      {/* Dark stage, lit like an anatomy plate: a cool key, a warm fill and a
          teal rim from behind that carves the silhouette out of the dark. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 3.5, 2.5]} intensity={1.7} color="#ffffff" />
      <directionalLight position={[-2.5, 1.2, 1.5]} intensity={0.6} color="#ffd9bd" />
      <directionalLight position={[0, 2.2, -3]} intensity={1.4} color="#5fd4e6" />
      {/* Softboxes give the organs' clearcoat something to reflect, with no
          network fetch for an HDRI. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 3, 3]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-4, 1, 1]} scale={[1.5, 5, 1]} color="#ffd9bd" />
        <Lightformer form="rect" intensity={1.6} position={[4, 1, -1]} scale={[1.5, 5, 1]} color="#7fdcec" />
      </Environment>

      <CameraRig view={view} controlsRef={orbitRef} />
      <CursorZoom controlsRef={orbitRef} grabbedRef={grabbedRef} />
      <ZoomReporter
        dissectRef={dissectRef}
        onZoomChange={onZoomChange}
        controlsRef={zoomApi ?? fallbackZoomApi}
        orbitRef={orbitRef}
        turntableRef={turntableRef}
        grabbedRef={grabbedRef}
      />
      <Projector
        organs={organs}
        groupRef={turntableRef}
        projection={projection}
        sites={siteRegistry}
      />

      <Turntable
        enabled={autoRotate && !reducedMotion}
        grabbedRef={grabbedRef}
        groupRef={turntableRef}
      >
        <Ribcage dissectRef={dissectRef} />
        <Vasculature states={states} mixRef={mixRef} />
        {organs.map((organ) => (
          <Organ
            key={organ.key}
            organ={organ}
            state={states[organ.key]}
            mixRef={mixRef}
            dissectRef={dissectRef}
            siteRegistry={siteRegistry}
            showAfter={mix > 0.5}
            reducedMotion={reducedMotion}
            selected={selectedOrgan === organ.key}
            onSelect={onSelectOrgan}
          />
        ))}
        {/* Shell last: it blends additively over the anatomy inside. */}
        <BodyShell sex={sex} dissectRef={dissectRef} />
        <Platform />
      </Turntable>

      <OrbitControls
        ref={orbitRef as never}
        target={TARGET}
        enablePan={false}
        /* Zoom is handled by CursorZoom, which aims at the cursor rather than
           at the fixed centre OrbitControls would dolly towards. */
        enableZoom={false}
        minDistance={CLOSEST_DISTANCE}
        maxDistance={FULL_BODY_DISTANCE}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 1.85}
      />
    </Canvas>
  );
}
