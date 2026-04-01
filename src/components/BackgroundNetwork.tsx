'use client';

import { useRef, useMemo, useLayoutEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import * as THREE from 'three';
import { useStore } from '@/store';
import { PORTFOLIO_CONFIG, MASTER_SKILLS } from '@/config';

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILL_NODE_COUNT   = PORTFOLIO_CONFIG.projects.reduce(
  (sum, p) => sum + p.techStack.length, 0
);
const MASTER_SKILL_COUNT = MASTER_SKILLS.length;
const TARGET_NODE_COUNT  = 300;
const FILLER_COUNT       = TARGET_NODE_COUNT - SKILL_NODE_COUNT - MASTER_SKILL_COUNT;
const NODE_COUNT         = TARGET_NODE_COUNT;

const CLUSTER_SPREAD    = 5.5;
const FILLER_SPREAD     = 15.0;
const POLYHEDRON_RADIUS = 7.0;
const POLYHEDRON_K      = 3;

const CONNECT_DIST = 6.0;

const NODE_RADIUS = 0.055;
const NODE_SEG    = 7;
const ROTATE_Y    = 0.04;
const ROTATE_X    = 0.012;

// Camera
const CAM_Z_START  = 22;
const CAM_Z_END    = -4;
const CAM_LERP     = 0.06;
const CAM_OFFSET_X = -7;
const CAM_OFFSET_Z =  18;

// Node animation
const HIT_SCALE  = 2.2;
const SCALE_LERP = 0.12;
const COLOR_LERP = 0.10;

// Radial pulse wave — 'System Diagnostic' flood-fill (Cluster 4 only)
const PULSE_SPEED      = 13.0;                    // units per second
const PULSE_MAX_RADIUS = POLYHEDRON_RADIUS * 2.2;  // covers full sphere diameter + margin
const PULSE_HOLD       = 1.5;                      // seconds to hold full-lit state
const PULSE_SNAP_LERP  = 0.4;                      // fast snap for lit edges

const CYAN       = new THREE.Color('#00F0FF');
const MAGENTA    = new THREE.Color('#BC00FF');
const NEON_GREEN = new THREE.Color('#39FF14');
const DIM_CYAN   = new THREE.Color('#002233');
const BLACK      = new THREE.Color('#000000');

// ─── Cluster centres ──────────────────────────────────────────────────────────

const CLUSTER_CENTERS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(-8,   4, -4),
  2: new THREE.Vector3( 8,   2, -6),
  3: new THREE.Vector3( 0,  -6, -2),
  4: new THREE.Vector3( 8, -15, -6),
};

const GLOBAL_LOOK_AT = new THREE.Vector3(0, 0, 0);

const PROJECT_SKILLS: Record<number, string[]> = Object.fromEntries(
  PORTFOLIO_CONFIG.projects.map(p => [p.id, p.techStack])
);

// ─── Data types ───────────────────────────────────────────────────────────────

interface NodeDatum {
  position:   THREE.Vector3;
  clusterId:  number;         // 0 = filler, 1-3 = project, 4 = skills polyhedron
  skillLabel: string | null;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function randomInSphere(radius: number, center?: THREE.Vector3): THREE.Vector3 {
  const r     = Math.cbrt(Math.random()) * radius;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    (center?.x ?? 0) + r * Math.sin(phi) * Math.cos(theta),
    (center?.y ?? 0) + r * Math.sin(phi) * Math.sin(theta),
    (center?.z ?? 0) + r * Math.cos(phi),
  );
}

function fibonacciSphere(
  count: number, radius: number, center: THREE.Vector3,
): THREE.Vector3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const θ = golden * i;
    pts.push(new THREE.Vector3(
      center.x + r * Math.cos(θ) * radius,
      center.y + y * radius,
      center.z + r * Math.sin(θ) * radius,
    ));
  }
  return pts;
}

// ── Node generation ───────────────────────────────────────────────────────────

function generatePositions(projectSkills: Record<number, string[]>): NodeDatum[] {
  const out: NodeDatum[] = [];

  for (const [idStr, center] of Object.entries(CLUSTER_CENTERS)) {
    const clusterId = Number(idStr);
    if (clusterId === 4) continue;
    const skills = projectSkills[clusterId] ?? [];
    for (const label of skills) {
      out.push({ position: randomInSphere(CLUSTER_SPREAD, center), clusterId, skillLabel: label });
    }
  }

  const center4   = CLUSTER_CENTERS[4];
  const polyNodes = fibonacciSphere(MASTER_SKILLS.length, POLYHEDRON_RADIUS, center4);
  for (let i = 0; i < MASTER_SKILLS.length; i++) {
    out.push({ position: polyNodes[i], clusterId: 4, skillLabel: MASTER_SKILLS[i] });
  }

  for (let i = 0; i < FILLER_COUNT; i++) {
    out.push({ position: randomInSphere(FILLER_SPREAD), clusterId: 0, skillLabel: null });
  }

  return out;
}

// ─── Edge geometry ────────────────────────────────────────────────────────────

interface EdgeGeometryResult {
  geo:            THREE.BufferGeometry;
  edgeClusterIds: Int32Array;   // per-edge cluster ownership
  edgeNodePairs:  Int32Array;   // flat [lo0, hi0, lo1, hi1, …] — 2 entries per edge
}

function buildEdgeGeometry(nodes: NodeDatum[]): EdgeGeometryResult {
  const N         = nodes.length;
  const dSqThresh = CONNECT_DIST ** 2;
  const verts:      number[] = [];
  const clusterIds: number[] = [];
  const nodePairs:  number[] = [];
  const added = new Set<number>();

  function addEdge(i: number, j: number): void {
    const lo  = i < j ? i : j;
    const hi  = i < j ? j : i;
    const key = lo * N + hi;
    if (added.has(key)) return;
    added.add(key);
    const a = nodes[lo].position, b = nodes[hi].position;
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const ci = nodes[lo].clusterId, cj = nodes[hi].clusterId;
    const eid = (ci !== 0 && ci === cj) ? ci : 0;
    clusterIds.push(eid);
    nodePairs.push(lo, hi);
  }

  // ── Pass 1a: fully connect project clusters (1-3) ─────────────────────────
  for (let i = 0; i < N; i++) {
    const ci = nodes[i].clusterId;
    if (ci === 0 || ci === 4) continue;
    for (let j = i + 1; j < N; j++) {
      if (nodes[j].clusterId !== ci) continue;
      addEdge(i, j);
    }
  }

  // ── Pass 1b: k-nearest-neighbor lattice for Cluster 4 ─────────────────────
  const c4Indices = nodes
    .map((n, i) => (n.clusterId === 4 ? i : -1))
    .filter(i => i >= 0);

  for (const i of c4Indices) {
    const ranked = c4Indices
      .filter(j => j !== i)
      .map(j => ({ j, dSq: nodes[i].position.distanceToSquared(nodes[j].position) }))
      .sort((a, b) => a.dSq - b.dSq);
    for (let k = 0; k < Math.min(POLYHEDRON_K, ranked.length); k++) {
      addEdge(i, ranked[k].j);
    }
  }

  // ── Pass 2: distance-threshold filler web ─────────────────────────────────
  for (let i = 0; i < N; i++) {
    const ci = nodes[i].clusterId;
    for (let j = i + 1; j < N; j++) {
      const cj = nodes[j].clusterId;
      if (ci !== 0 && ci === cj) continue;
      if (ci !== 0 && cj !== 0 && ci !== cj) continue;
      if (nodes[i].position.distanceToSquared(nodes[j].position) < dSqThresh) {
        addEdge(i, j);
      }
    }
  }

  const colData = new Float32Array(clusterIds.length * 6);
  for (let e = 0; e < clusterIds.length; e++) {
    const o = e * 6;
    colData[o]   = DIM_CYAN.r; colData[o+1] = DIM_CYAN.g; colData[o+2] = DIM_CYAN.b;
    colData[o+3] = DIM_CYAN.r; colData[o+4] = DIM_CYAN.g; colData[o+5] = DIM_CYAN.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colData, 3));
  return {
    geo,
    edgeClusterIds: new Int32Array(clusterIds),
    edgeNodePairs:  new Int32Array(nodePairs),
  };
}

// ─── Pulse-aware skill label (Cluster 4 only) ────────────────────────────────
// Each label lives inside the R3F tree and runs its own useFrame to check
// distance from the pulse epicenter. Only re-renders when the lit boolean
// actually flips (twice per cycle), so it's very lightweight with ~20 labels.

interface PulseLabelProps {
  node:  NodeDatum;
  label: string;
  pulse: React.RefObject<{ epicenter: THREE.Vector3; radius: number }>;
}

function PulseLabel({ node, label, pulse }: PulseLabelProps) {
  const [isLit, setIsLit] = useState(false);

  useFrame(() => {
    const p = pulse.current;
    if (!p) return;
    const lit = node.position.distanceTo(p.epicenter) < p.radius;
    if (lit !== isLit) setIsLit(lit);
  });

  const color     = isLit ? '#39FF14' : '#BC00FF';
  const borderCol = isLit ? 'rgba(57, 255, 20, 0.35)' : 'rgba(188, 0, 255, 0.35)';
  const glowCol   = isLit ? '#39FF14' : '#BC00FF';

  return (
    <Html
      transform
      sprite
      center
      position={node.position.toArray() as [number, number, number]}
      distanceFactor={8}
      zIndexRange={[10, 20]}
    >
      <div
        className="label-fade-in font-mono text-[11px] leading-none px-2 py-1 rounded whitespace-nowrap"
        style={{
          color,
          background:    'rgba(0, 0, 0, 0.72)',
          border:        `1px solid ${borderCol}`,
          textShadow:    `0 0 8px ${glowCol}`,
          pointerEvents: 'none',
        }}
      >
        {label}
      </div>
    </Html>
  );
}

// ─── Network graph ────────────────────────────────────────────────────────────

function NetworkGraph({ scrollZ }: { scrollZ: MotionValue<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.InstancedMesh>(null);

  const activeCluster = useStore(s => s.activeCluster);

  const dummy      = useRef(new THREE.Object3D());
  const tempVec    = useRef(new THREE.Vector3());
  const centroid   = useRef(new THREE.Vector3());
  const lookAt     = useRef(new THREE.Vector3(0, 0, 0));
  const scales     = useRef(new Float32Array(NODE_COUNT).fill(1.0));
  const nodeColors = useRef<THREE.Color[]>(
    Array.from({ length: NODE_COUNT }, () => CYAN.clone())
  );

  const nodes = useMemo(() => generatePositions(PROJECT_SKILLS), []);
  const { geo: edgeGeo, edgeClusterIds, edgeNodePairs } = useMemo(
    () => buildEdgeGeometry(nodes), [nodes],
  );

  // ── Cluster 4 node indices (for picking random epicenters) ──────────────────
  const c4NodeIndices = useMemo(
    () => nodes.map((n, i) => (n.clusterId === 4 ? i : -1)).filter(i => i >= 0),
    [nodes],
  );

  // ── Radial pulse state — 'System Diagnostic' flood-fill wave ───────────────
  // A sphere of light expands from a random node, covers the whole polyhedron,
  // holds, then retracts back to origin. On completion, picks a new epicenter.
  const pulse = useRef({
    epicenter: new THREE.Vector3(),
    radius:    0,
    phase:     'expand' as 'expand' | 'hold' | 'retract',
    timer:     0,
    seeded:    false,   // has an epicenter been chosen yet?
  });

  const edgeMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0.0 } },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vColor;
      void main() {
        vPosition = position;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      varying vec3 vColor;
      uniform float uTime;
      void main() {
        float isHovered = step(0.8, vColor.g) * step(vColor.r, 0.5) * step(vColor.b, 0.3);
        float pulse = fract(vPosition.x * 0.5 + vPosition.y * 0.5 - uTime * 1.5);
        pulse = smoothstep(0.8, 1.0, pulse);
        float finalAlpha = mix(0.15, 0.8 + (pulse * 2.0), isHovered);
        vec3  finalColor = vColor * (1.0 + (pulse * 1.5 * isHovered));
        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `,
  }), []);

  const sphereGeo = useMemo(
    () => new THREE.SphereGeometry(NODE_RADIUS, NODE_SEG, NODE_SEG), [],
  );
  const nodeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff' }), [],
  );

  // Cluster 4 starts invisible (scale 0, black)
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const d = dummy.current;
    const sc = scales.current;
    const cols = nodeColors.current;
    nodes.forEach(({ position, clusterId }, i) => {
      const s0 = clusterId === 4 ? 0.0 : 1.0;
      sc[i] = s0;
      d.position.copy(position);
      d.scale.setScalar(s0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      const c0 = clusterId === 4 ? BLACK : CYAN;
      mesh.setColorAt(i, c0);
      cols[i].copy(c0);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes]);

  // ── Per-frame animation ─────────────────────────────────────────────────────
  useFrame(({ camera }, delta) => {
    const mesh  = meshRef.current;
    const group = groupRef.current;
    if (!mesh || !group) return;

    edgeMat.uniforms.uTime.value += delta;
    group.rotation.y += ROTATE_Y * delta;
    group.rotation.x += ROTATE_X * delta;

    const t    = 1 - Math.pow(1 - CAM_LERP, Math.min(delta * 60, 10));
    const d    = dummy.current;
    const tv   = tempVec.current;
    const sc   = scales.current;
    const cols = nodeColors.current;

    const { activeCluster, hoveredProject } = useStore.getState();

    // ── Radial pulse wave (Cluster 4 only) ─────────────────────────────────
    const pl = pulse.current;
    if (activeCluster === 4) {
      // Seed epicenter on first frame
      if (!pl.seeded) {
        const idx = c4NodeIndices[Math.floor(Math.random() * c4NodeIndices.length)];
        pl.epicenter.copy(nodes[idx].position);
        pl.seeded = true;
      }

      if (pl.phase === 'expand') {
        pl.radius += delta * PULSE_SPEED;
        if (pl.radius > PULSE_MAX_RADIUS) {
          pl.phase = 'hold';
          pl.timer = 0;
        }
      } else if (pl.phase === 'hold') {
        pl.timer += delta;
        if (pl.timer > PULSE_HOLD) {
          pl.phase = 'retract';
        }
      } else {
        // retract
        pl.radius -= delta * PULSE_SPEED;
        if (pl.radius < 0) {
          pl.radius = 0;
          pl.phase  = 'expand';
          pl.timer  = 0;
          // Pick a new random epicenter for the next cycle
          const idx = c4NodeIndices[Math.floor(Math.random() * c4NodeIndices.length)];
          pl.epicenter.copy(nodes[idx].position);
        }
      }
    } else {
      // Reset so it starts fresh next time Cluster 4 activates
      pl.radius = 0;
      pl.phase  = 'expand';
      pl.timer  = 0;
      pl.seeded = false;
    }

    // ── Camera ───────────────────────────────────────────────────────────────
    if (activeCluster === null) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, t);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, t);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, scrollZ.get(), t);
      lookAt.current.lerp(GLOBAL_LOOK_AT, t);
    } else {
      const ctr = centroid.current;
      ctr.set(0, 0, 0);
      let count = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        if (nodes[i].clusterId === activeCluster) {
          tv.copy(nodes[i].position).applyEuler(group.rotation);
          ctr.add(tv);
          count++;
        }
      }
      if (count > 0) ctr.divideScalar(count);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, ctr.x + CAM_OFFSET_X, t);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, ctr.y, t);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, ctr.z + CAM_OFFSET_Z, t);
      lookAt.current.lerp(ctr, t);
    }
    camera.lookAt(lookAt.current);

    // ── Node scale / colour ──────────────────────────────────────────────────
    for (let i = 0; i < NODE_COUNT; i++) {
      const { position, clusterId } = nodes[i];
      let targetScale: number;
      let targetColor: THREE.Color;

      if (clusterId === 4) {
        if (activeCluster === 4) {
          targetScale = HIT_SCALE;
          // Pulse wave: nodes inside the radius flash NEON_GREEN, rest stay MAGENTA
          const dist = position.distanceTo(pl.epicenter);
          targetColor = dist < pl.radius ? NEON_GREEN : MAGENTA;
        } else {
          targetScale = 0.0;
          targetColor = BLACK;
        }
      } else if (activeCluster === 4) {
        targetScale = 0.0;
        targetColor = BLACK;
      } else if (activeCluster === null) {
        targetScale = 1.0;
        targetColor = CYAN;
      } else if (clusterId === activeCluster) {
        targetScale = HIT_SCALE;
        targetColor = MAGENTA;
      } else {
        targetScale = 0.5;
        targetColor = DIM_CYAN;
      }

      sc[i] = THREE.MathUtils.lerp(sc[i], targetScale, SCALE_LERP);
      cols[i].lerp(targetColor, COLOR_LERP);

      d.position.copy(position);
      d.scale.setScalar(sc[i]);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, cols[i]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // ── Edge colours ─────────────────────────────────────────────────────────
    const colorAttr = edgeGeo.attributes.color as THREE.BufferAttribute;
    const colArr    = colorAttr.array as Float32Array;
    const edgeCount = edgeClusterIds.length;

    for (let e = 0; e < edgeCount; e++) {
      const eid = edgeClusterIds[e];
      let tr: number, tg: number, tb: number;
      let lf = COLOR_LERP;   // lerp factor — overridden for the active packet edge

      if (activeCluster === 4) {
        if (eid === 4) {
          // Check edge midpoint distance from the pulse epicenter
          const a = edgeNodePairs[e * 2];
          const b = edgeNodePairs[e * 2 + 1];
          const mx = (nodes[a].position.x + nodes[b].position.x) * 0.5;
          const my = (nodes[a].position.y + nodes[b].position.y) * 0.5;
          const mz = (nodes[a].position.z + nodes[b].position.z) * 0.5;
          const dx = mx - pl.epicenter.x;
          const dy = my - pl.epicenter.y;
          const dz = mz - pl.epicenter.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < pl.radius) {
            // Inside the wave — Neon Green flash
            tr = NEON_GREEN.r; tg = NEON_GREEN.g; tb = NEON_GREEN.b;
            lf = PULSE_SNAP_LERP;
          } else {
            // Outside the wave — faint dim baseline (same as filler)
            tr = DIM_CYAN.r; tg = DIM_CYAN.g; tb = DIM_CYAN.b;
          }
        } else {
          // Everything outside Cluster 4 → black (invisible)
          tr = 0; tg = 0; tb = 0;
        }
      } else if (activeCluster === null) {
        tr = DIM_CYAN.r; tg = DIM_CYAN.g; tb = DIM_CYAN.b;
      } else if (eid !== 0 && eid === hoveredProject) {
        tr = NEON_GREEN.r; tg = NEON_GREEN.g; tb = NEON_GREEN.b;
      } else if (eid !== 0 && eid === activeCluster) {
        tr = CYAN.r; tg = CYAN.g; tb = CYAN.b;
      } else {
        tr = DIM_CYAN.r; tg = DIM_CYAN.g; tb = DIM_CYAN.b;
      }

      const o = e * 6;
      colArr[o]   = THREE.MathUtils.lerp(colArr[o],   tr, lf);
      colArr[o+1] = THREE.MathUtils.lerp(colArr[o+1], tg, lf);
      colArr[o+2] = THREE.MathUtils.lerp(colArr[o+2], tb, lf);
      colArr[o+3] = colArr[o];
      colArr[o+4] = colArr[o+1];
      colArr[o+5] = colArr[o+2];
    }

    colorAttr.needsUpdate = true;
  });

  const skillNodes = useMemo(
    () => nodes.filter(n => n.skillLabel !== null),
    [nodes],
  );

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[sphereGeo, nodeMat, NODE_COUNT]} />
      <lineSegments geometry={edgeGeo} material={edgeMat} />

      {(() => {
        if (activeCluster === null) return null;

        const anchorNodes = skillNodes.filter(n => n.clusterId === activeCluster);

        // ── Cluster 4: pulse-aware labels (each has its own useFrame) ────────
        if (activeCluster === 4) {
          return MASTER_SKILLS.map((label, i) => {
            const node = anchorNodes[i];
            if (!node) return null;
            return <PulseLabel key={label} node={node} label={label} pulse={pulse} />;
          });
        }

        // ── Project clusters 1-3: static magenta labels ─────────────────────
        const project = PORTFOLIO_CONFIG.projects.find(p => p.id === activeCluster);
        if (!project) return null;

        return project.techStack.map((label, i) => {
          const node = anchorNodes[i];
          if (!node) return null;
          return (
            <Html
              key={label}
              transform
              sprite
              center
              position={node.position.toArray() as [number, number, number]}
              distanceFactor={8}
              zIndexRange={[10, 20]}
            >
              <div
                className="label-fade-in font-mono text-[11px] leading-none text-magenta px-2 py-1 rounded whitespace-nowrap"
                style={{
                  background:    'rgba(0, 0, 0, 0.72)',
                  border:        '1px solid rgba(188, 0, 255, 0.35)',
                  textShadow:    '0 0 8px #BC00FF',
                  pointerEvents: 'none',
                }}
              >
                {label}
              </div>
            </Html>
          );
        });
      })()}
    </group>
  );
}

// ─── Canvas wrapper ───────────────────────────────────────────────────────────

export default function BackgroundNetwork() {
  const { scrollYProgress } = useScroll();
  const cameraZ = useTransform(scrollYProgress, [0, 1], [CAM_Z_START, CAM_Z_END]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, CAM_Z_START], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#020202']} />
        <NetworkGraph scrollZ={cameraZ} />
        <EffectComposer>
          <Bloom
            intensity={2.5}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.8}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
