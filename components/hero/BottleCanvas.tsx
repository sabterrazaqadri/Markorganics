"use client";

/**
 * The only 3D element on the site. Loaded with next/dynamic (ssr: false) from
 * HeroBottle.tsx, which decides whether to mount it at all.
 */
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, useGLTF } from "@react-three/drei";
import { DoubleSide, PMREMGenerator, type Group } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/models/bottle.glb";
const DRACO_PATH = "/draco/";
const HDR_URL = "/hdr/studio.hdr";
const SPIN_RADIANS_PER_SECOND = 0.35;

function Spin({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.05) * SPIN_RADIANS_PER_SECOND;
  });
  return <group ref={ref}>{children}</group>;
}

function GltfBottle() {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH);
  return <primitive object={scene} />;
}

/**
 * Amber-glass dropper bottle built from primitives, proportioned to match the
 * static render in /hero-bottle.png so the canvas can cross-fade over it.
 *
 * Base sits at y -1.15 and the bulb tops out at y 1.26, so the bottle fills
 * about four fifths of the frame at the camera below. Downloads nothing.
 */
const GLASS = "#4A2409";

function ProceduralBottle() {
  return (
    <group>
      {/* body */}
      <mesh position={[0, -0.525, 0]}>
        <cylinderGeometry args={[0.375, 0.368, 1.25, 64]} />
        <meshStandardMaterial color={GLASS} roughness={0.16} metalness={0.05} />
      </mesh>
      {/* printed label band, slightly proud of the glass to avoid z-fighting */}
      <mesh position={[0, -0.52, 0]}>
        <cylinderGeometry args={[0.38, 0.374, 0.795, 64, 1, true]} />
        <meshStandardMaterial color="#C1841B" roughness={0.78} side={DoubleSide} />
      </mesh>
      {/* shoulder */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.375, 0.2, 64]} />
        <meshStandardMaterial color={GLASS} roughness={0.16} metalness={0.05} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.12, 48]} />
        <meshStandardMaterial color="#381B05" roughness={0.22} metalness={0.05} />
      </mesh>
      {/* polished gold collar */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.252, 0.252, 0.4, 64]} />
        <meshStandardMaterial color="#C9A227" roughness={0.15} metalness={1} />
      </mesh>
      {/* ivory rubber dropper bulb */}
      <mesh position={[0, 1.02, 0]}>
        <capsuleGeometry args={[0.137, 0.206, 8, 32]} />
        <meshStandardMaterial color="#F2EADB" roughness={0.55} metalness={0} />
      </mesh>
    </group>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.85} />
      <directionalLight position={[-4, 2, -2]} intensity={0.3} />
    </>
  );
}

/**
 * Failure fallback for the HDR above, generated on the GPU from three's built-in
 * RoomEnvironment. Metals need an environment map: with lights alone a
 * metalness-1 material renders black, so this keeps the gold collar looking like
 * gold if /hdr/studio.hdr is ever missing. Costs no network request.
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

export default function BottleCanvas({ onReady }: { onReady: () => void }) {
  const [hasModel, setHasModel] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(MODEL_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        if (alive) setHasModel(r.ok && !type.includes("text/html"));
      })
      .catch(() => alive && setHasModel(false));
    return () => {
      alive = false;
    };
  }, []);

  if (hasModel === null) return null;

  const bottle = hasModel ? (
    <Boundary fallback={<ProceduralBottle />}>
      <GltfBottle />
    </Boundary>
  ) : (
    <ProceduralBottle />
  );

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 0.4, 5.2], fov: 32 }}
      shadows={false}
      style={{ background: "transparent" }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        {/*
          Self-hosted studio map, downsampled to 512x256 by scripts/prep-hdr.ts.
          Requested only once this canvas mounts, which never happens under
          768px, under prefers-reduced-motion, or on saveData. It is never
          preloaded and never part of the initial page payload.
        */}
        <Boundary fallback={<StudioEnvironment />}>
          <Environment files={HDR_URL} background={false} />
        </Boundary>
        <Lights />
        <Spin>{bottle}</Spin>
        <ContactShadows position={[0, -1.16, 0]} opacity={0.32} scale={4} blur={2.6} far={2} />
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
