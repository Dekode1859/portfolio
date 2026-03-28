'use client';

import { useRef, useMemo, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import * as THREE from 'three';
import { useStore } from '@/store';
import { PORTFOLIO_CONFIG } from '@/config';

// ─── Constants ────────────────────────────────────────────────────────────────

// Derive skill node count from config — graph auto-scales with data
const SKILL_NODE_COUNT = PORTFOLIO_CONFIG.projects.reduce(
  (sum, p) => sum + p.techStack.length, 0
);
const TARGET_NODE_COUNT = 300;
const FILLER_COUNT      = TARGET_NODE_COUNT - SKILL_NODE_COUNT;
const NODE_COUNT        = TARGET_NODE_COUNT;

// Sparse constellation radius — nodes spread far enough that labels don't overlap
const CLUSTER_SPREAD = 5.5;
const FILLER_SPREAD  = 15.0;

// Distance threshold for filler↔filler and filler↔cluster connections.
// Same-cluster edges are always forced regardless of distance.
const CONNECT_DIST = 6.0;

const NODE_RADIUS = 0.055;
const NODE_SEG    = 7;
const ROTATE_Y    = 0.04;    // rad/s
const ROTATE_X    = 0.012;   // rad/s

// Camera
const CAM_Z_START  = 22;
const CAM_Z_END    = -4;
const CAM_LERP     = 0.06;

// When a cluster is focused, camera offset from its world-space centroid.
// Pulling left (negative X) keeps the project card visible on the left while
// the subgraph constellation sits on the right half of the screen.
const CAM_OFFSET_X = -7;
const CAM_OFFSET_Z =  18;

// Node scale when its cluster is active
const HIT_SCALE  = 2.2;
const SCALE_LERP = 0.12;
const COLOR_LERP = 0.10;

const CYAN       = new THREE.Color('#00F0FF');
const MAGENTA    = new THREE.Color('#BC00FF');
const NEON_GREEN = new THREE.Color('#39FF14');
const DIM_CYAN   = new THREE.Color('#002233');

// ─── Cluster subgraph centres ─────────────────────────────────────────────────
// Positioned well inside the filler sphere (radius 15) so nearby filler nodes
// form a natural bridge between clusters and the ambient web.

const CLUSTER_CENTERS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(-8,  4, -4),
  2: new THREE.Vector3( 8,  2, -6),
  3: new THREE.Vector3( 0, -6, -2),
};

const GLOBAL_LOOK_AT = new THREE.Vector3(0, 0, 0);

// Module-level skill map derived from config — stable, never re-computed
const PROJECT_SKILLS: Record<number, string[]> = Object.fromEntries(
  PORTFOLIO_CONFIG.projects.map(p => [p.id, p.techStack])
);

// ─── Data types ───────────────────────────────────────────────────────────────

interface NodeDatum {
  position:   THREE.Vector3;
  clusterId:  number;         // 0 = filler, 1-3 = named cluster
  skillLabel: string | null;  // non-null only for skill-anchor nodes
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

// ── Clusters first, then filler ───────────────────────────────────────────────
// Generating clusters first keeps their indices contiguous, so the fully-
// connected intra-cluster edge pass is a simple nested loop with no index gaps.
function generatePositions(projectSkills: Record<number, string[]>): NodeDatum[] {
  const out: NodeDatum[] = [];

  // ── Project subgraphs — tightly packed around each fixed center ────────────
  for (const [idStr, center] of Object.entries(CLUSTER_CENTERS)) {
    const clusterId = Number(idStr);
    const skills    = projectSkills[clusterId] ?? [];
    for (const label of skills) {
      out.push({
        position:   randomInSphere(CLUSTER_SPREAD, center),
        clusterId,
        skillLabel: label,
      });
    }
  }

  // ── Filler — ambient background nodes spread across a large sphere ─────────
  for (let i = 0; i < FILLER_COUNT; i++) {
    out.push({ position: randomInSphere(FILLER_SPREAD), clusterId: 0, skillLabel: null });
  }

  return out;
}

interface EdgeGeometryResult {
  geo:            THREE.BufferGeometry;
  edgeClusterIds: Int32Array;  // one entry per segment — 0 = filler, 1-3 = named cluster
}

function buildEdgeGeometry(nodes: NodeDatum[]): EdgeGeometryResult {
  const N         = nodes.length;
  const dSqThresh = CONNECT_DIST ** 2;
  const verts:      number[] = [];
  const clusterIds: number[] = [];

  // O(1) deduplication: encode pair (lo, hi) as a single integer
  const added = new Set<number>();

  function addEdge(i: number, j: number): void {
    const lo  = i < j ? i : j;
    const hi  = i < j ? j : i;
    const key = lo * N + hi;
    if (added.has(key)) return;
    added.add(key);

    const a  = nodes[lo].position, b = nodes[hi].position;
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z);

    const ci  = nodes[lo].clusterId, cj = nodes[hi].clusterId;
    // Strict routing: a segment only inherits a cluster ID when BOTH endpoints
    // belong to that same named cluster. Any filler-touching edge stays 0 and
    // will never receive a hover glow or active colour.
    const eid = (ci !== 0 && ci === cj) ? ci : 0;
    clusterIds.push(eid);
  }

  // ── Pass 1: force-connect every pair within the same named cluster ─────────
  // This guarantees the subgraph is fully connected (complete graph) regardless
  // of random positions within CLUSTER_SPREAD. With radius 2.0 the edges are
  // always short and clearly visible as a tight constellation.
  for (let i = 0; i < N; i++) {
    if (nodes[i].clusterId === 0) continue;
    for (let j = i + 1; j < N; j++) {
      if (nodes[j].clusterId !== nodes[i].clusterId) continue;
      addEdge(i, j);
    }
  }

  // ── Pass 2: distance-threshold web for filler and bridging edges ───────────
  // Connects filler↔filler and filler↔cluster pairs to weave one unified graph.
  // Cross-cluster direct connections are blocked so subgraphs stay visually
  // distinct and routing remains unambiguous.
  for (let i = 0; i < N; i++) {
    const ci = nodes[i].clusterId;
    for (let j = i + 1; j < N; j++) {
      const cj = nodes[j].clusterId;
      // Already handled in Pass 1 — skip
      if (ci !== 0 && ci === cj) continue;
      // Block direct cross-cluster connections
      if (ci !== 0 && cj !== 0 && ci !== cj) continue;
      if (nodes[i].position.distanceToSquared(nodes[j].position) < dSqThresh) {
        addEdge(i, j);
      }
    }
  }

  // Initialise every vertex to CYAN (lerped at runtime)
  const colData = new Float32Array(clusterIds.length * 6);
  for (let e = 0; e < clusterIds.length; e++) {
    const o = e * 6;
    colData[o]   = CYAN.r; colData[o+1] = CYAN.g; colData[o+2] = CYAN.b;
    colData[o+3] = CYAN.r; colData[o+4] = CYAN.g; colData[o+5] = CYAN.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colData, 3));

  return { geo, edgeClusterIds: new Int32Array(clusterIds) };
}

// ─── Network graph (camera control merged in — needs groupRef) ────────────────

function NetworkGraph({ scrollZ }: { scrollZ: MotionValue<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.InstancedMesh>(null);

  // Reactive subscription — triggers re-render to mount/unmount Html overlays
  const activeCluster = useStore(s => s.activeCluster);

  // Pre-allocated per-frame scratch — never re-created in the render loop
  const dummy      = useRef(new THREE.Object3D());
  const tempVec    = useRef(new THREE.Vector3());
  const centroid   = useRef(new THREE.Vector3());
  const lookAt     = useRef(new THREE.Vector3(0, 0, 0));
  const scales     = useRef(new Float32Array(NODE_COUNT).fill(1.0));
  const nodeColors = useRef<THREE.Color[]>(
    Array.from({ length: NODE_COUNT }, () => CYAN.clone())
  );

  const nodes = useMemo(() => generatePositions(PROJECT_SKILLS), []);
  const { geo: edgeGeo, edgeClusterIds } = useMemo(() => buildEdgeGeometry(nodes), [nodes]);

  const edgeMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
    },
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
        // Detect Neon Green (#39FF14 ≈ rgb(0.22, 1.0, 0.08)).
        // step(vColor.b, 0.3) prevents CYAN (b≈1.0) from being flagged —
        // both share high-g / low-r, but only NEON_GREEN has low-b.
        float isHovered = step(0.8, vColor.g) * step(vColor.r, 0.5) * step(vColor.b, 0.3);

        // Traveling pulse: fract() creates a repeating 0→1 wave across world coords
        float pulse = fract(vPosition.x * 0.5 + vPosition.y * 0.5 - uTime * 1.5);
        pulse = smoothstep(0.8, 1.0, pulse);

        // Hovered lines: bright + pulsing. Filler edges: fixed 15% opacity.
        float finalAlpha = mix(0.15, 0.8 + (pulse * 2.0), isHovered);
        vec3  finalColor = vColor * (1.0 + (pulse * 1.5 * isHovered));

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `,
  }), []);

  const sphereGeo = useMemo(
    () => new THREE.SphereGeometry(NODE_RADIUS, NODE_SEG, NODE_SEG),
    [],
  );
  // White base so instanceColor values render exactly as set
  const nodeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    [],
  );

  // Write initial matrices and colors once after mount
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const d = dummy.current;
    nodes.forEach(({ position }, i) => {
      d.position.copy(position);
      d.scale.setScalar(1.0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, CYAN);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes]);

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

    // One store read per frame
    const { activeCluster, hoveredProject, viewMode } = useStore.getState();

    // ── Camera control ────────────────────────────────────────────────────────
    if (activeCluster === null) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, t);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, t);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, scrollZ.get(), t);
      lookAt.current.lerp(GLOBAL_LOOK_AT, t);
    } else {
      // Compute world-space centroid after rotation so camera tracks the spinning cluster
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

      // Pull the camera left so the project card (left half) and subgraph
      // (right half) both sit in frame without overlapping
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, ctr.x + CAM_OFFSET_X, t);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, ctr.y, t);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, ctr.z + CAM_OFFSET_Z, t);
      lookAt.current.lerp(ctr, t);
    }

    camera.lookAt(lookAt.current);

    // ── Node scale / color ────────────────────────────────────────────────────
    for (let i = 0; i < NODE_COUNT; i++) {
      const { position, clusterId } = nodes[i];

      let targetScale: number;
      let targetColor: THREE.Color;

      if (activeCluster === null) {
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

    // ── Edge vertex colors ─────────────────────────────────────────────────────
    // Priority: hoveredProject (NEON_GREEN) > activeCluster (CYAN) > dim (DIM_CYAN).
    // Filler edges (eid === 0) ALWAYS dim — no light travels on them.
    const colorAttr = edgeGeo.attributes.color as THREE.BufferAttribute;
    const colArr    = colorAttr.array as Float32Array;
    const edgeCount = edgeClusterIds.length;

    for (let e = 0; e < edgeCount; e++) {
      const eid = edgeClusterIds[e];

      let tr: number, tg: number, tb: number;
      if (viewMode === 'matrix') {
        // Matrix mode: every skill-cluster edge glows; filler edges stay dark.
        // No per-project highlighting — the whole interconnected web is lit.
        if (eid !== 0) {
          tr = CYAN.r;     tg = CYAN.g;     tb = CYAN.b;
        } else {
          tr = DIM_CYAN.r; tg = DIM_CYAN.g; tb = DIM_CYAN.b;
        }
      } else if (eid !== 0 && eid === hoveredProject) {
        // Segment belongs to the hovered project → NEON_GREEN + shader pulse
        tr = NEON_GREEN.r; tg = NEON_GREEN.g; tb = NEON_GREEN.b;
      } else if (eid !== 0 && eid === activeCluster) {
        // Segment belongs to the focused cluster → CYAN glow
        tr = CYAN.r;       tg = CYAN.g;       tb = CYAN.b;
      } else if (activeCluster !== null || eid === 0) {
        // Filler edge OR non-active cluster → always dimmed
        tr = DIM_CYAN.r;   tg = DIM_CYAN.g;   tb = DIM_CYAN.b;
      } else {
        // Global idle state — all edges CYAN
        tr = CYAN.r;       tg = CYAN.g;       tb = CYAN.b;
      }

      const o = e * 6;
      colArr[o]   = THREE.MathUtils.lerp(colArr[o],   tr, COLOR_LERP);
      colArr[o+1] = THREE.MathUtils.lerp(colArr[o+1], tg, COLOR_LERP);
      colArr[o+2] = THREE.MathUtils.lerp(colArr[o+2], tb, COLOR_LERP);
      // Both vertices of the segment share the same colour
      colArr[o+3] = colArr[o];
      colArr[o+4] = colArr[o+1];
      colArr[o+5] = colArr[o+2];
    }

    colorAttr.needsUpdate = true;
  });

  // Skill-anchor nodes — one per techStack entry per cluster
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
        const activeProject = PORTFOLIO_CONFIG.projects.find(p => p.id === activeCluster);
        const anchorNodes   = skillNodes.filter(n => n.clusterId === activeCluster);
        return activeProject?.techStack.map((label, i) => {
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
        }) ?? null;
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
