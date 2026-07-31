import { Html, Line, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { fields, type Signal } from './fixtures';
import { useFlightStore } from './store';

const colors = {
  note: '#72e9ff',
  reply: '#a9ffca',
  media: '#ffc96b',
  account: '#c7a7ff',
};

function CameraRig({ fieldId }: { fieldId: string }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0, 13.5), [fieldId]);
  useFrame((_, delta) => {
    camera.position.lerp(target, 1 - Math.exp(-delta * 2.8));
    camera.lookAt(0, 0, -2.8);
  });
  return null;
}

function SignalNode({ signal, focused, onFocus }: {
  signal: Signal;
  focused: boolean;
  onFocus: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = colors[signal.kind];
  useFrame(({ clock }) => {
    if (!group.current) return;
    const scale = (focused ? 1.22 : 1) + Math.sin(clock.elapsedTime * 1.7 + signal.position[0]) * 0.025;
    group.current.scale.setScalar(scale);
    group.current.rotation.y += 0.002;
  });
  const activate = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onFocus();
  };
  return (
    <group ref={group} position={signal.position}>
      <mesh
        onClick={activate}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <icosahedronGeometry args={[focused ? 0.33 : 0.23, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={focused ? 2.8 : 1.25} roughness={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[focused ? 0.62 : 0.42, 0.018, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={focused ? 0.95 : 0.38} />
      </mesh>
      {(focused || hovered) && (
        <Html center position={[0, 0.72, 0]} distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="signal-label">
            <span>{signal.kind}</span>
            <strong>{signal.author}</strong>
            <small>{signal.id}</small>
          </div>
        </Html>
      )}
    </group>
  );
}

function FieldLines({ signals }: { signals: Signal[] }) {
  const byId = useMemo(() => new Map(signals.map((signal) => [signal.id, signal])), [signals]);
  const relationLines = signals.flatMap((signal) => {
    if (!signal.parentId) return [];
    const parent = byId.get(signal.parentId);
    return parent ? [{ key: `${parent.id}-${signal.id}`, from: parent.position, to: signal.position }] : [];
  });
  return (
    <>
      {relationLines.map(({ key, from, to }) => (
        <Line key={key} points={[from, to]} color="#8fffd0" opacity={0.42} transparent lineWidth={1} />
      ))}
      {signals.every(({ parentId }) => !parentId) && signals.slice(1).map((signal) => (
        <Line
          key={`bearing-${signal.id}`}
          points={[[0, 0.5, 0], signal.position]}
          color="#35818a"
          opacity={0.13}
          transparent
          lineWidth={0.7}
          dashed
          dashSize={0.18}
          gapSize={0.34}
        />
      ))}
    </>
  );
}

function Scene() {
  const fieldId = useFlightStore((state) => state.activeFieldId);
  const focusId = useFlightStore((state) => state.focusId);
  const focus = useFlightStore((state) => state.focusSignal);
  const field = fields[fieldId];
  return (
    <>
      <color attach="background" args={['#02070c']} />
      <fog attach="fog" args={['#02070c', 12, 34]} />
      <ambientLight intensity={0.28} />
      <pointLight position={[0, 5, 8]} color="#8ffff0" intensity={14} distance={30} />
      <pointLight position={[-8, -4, 2]} color="#285cff" intensity={8} distance={24} />
      <Stars radius={42} depth={26} count={1800} factor={2.4} saturation={0.35} fade speed={0.22} />
      <gridHelper args={[32, 32, '#173a43', '#0b2029']} position={[0, -4.2, -7]} />
      <FieldLines signals={field.signals} />
      {field.signals.map((signal) => (
        <SignalNode key={`${fieldId}-${signal.id}`} signal={signal} focused={signal.id === focusId} onFocus={() => focus(signal.id)} />
      ))}
      <CameraRig fieldId={fieldId} />
    </>
  );
}

export function Universe() {
  return (
    <div className="universe" aria-label="Spatial field viewport">
      <Canvas camera={{ position: [0, 0, 16], fov: 48 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
        <Scene />
      </Canvas>
      <div className="viewport-reticle" aria-hidden="true"><i /><span /></div>
      <div className="viewport-caption">
        <span>OPTICAL FIELD</span>
        <strong>bounded fixture projection</strong>
      </div>
    </div>
  );
}
