import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles, ContactShadows } from '@react-three/drei'
import type { Group, Mesh } from 'three'

/* Design 3.2 — « La boutique vivante » : une échoppe sénégalaise stylisée low-poly
 * (sacs de riz empilés, bidons d'huile, cartons, ampoule chaude) rendue en PBR,
 * lumière chaude de fin d'après-midi, poussière flottante, respiration lente de
 * la caméra + parallaxe au pointeur. 100% procédural (aucun asset externe → CSP OK,
 * poids nul). Chargé en lazy derrière la carte de connexion. */

function Sack({ position, rot = 0, color = '#d8b98a' }: { position: [number, number, number]; rot?: number; color?: string }) {
  return (
    <mesh position={position} rotation={[0, rot, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.05, 0.7, 0.7]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} />
    </mesh>
  )
}

function Drum({ position, color = '#c98a2b' }: { position: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[0.34, 0.34, 1.1, 20]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.75} />
    </mesh>
  )
}

function Carton({ position, rot = 0 }: { position: [number, number, number]; rot?: number }) {
  return (
    <mesh position={position} rotation={[0, rot, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.8, 0.6, 0.8]} />
      <meshStandardMaterial color="#b07d4f" roughness={0.85} />
    </mesh>
  )
}

function Shop() {
  const group = useRef<Group>(null)
  const bulb = useRef<Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (group.current) {
      // Respiration lente + parallaxe douce vers le pointeur (±~4°).
      const targetY = state.pointer.x * 0.28 + Math.sin(t * 0.18) * 0.12
      const targetX = -state.pointer.y * 0.14 + 0.06
      group.current.rotation.y += (targetY - group.current.rotation.y) * 0.05
      group.current.rotation.x += (targetX - group.current.rotation.x) * 0.05
      group.current.position.y = Math.sin(t * 0.5) * 0.04
    }
    if (bulb.current) {
      const m = bulb.current.material as { emissiveIntensity?: number }
      if (m) m.emissiveIntensity = 1.6 + Math.sin(t * 1.6) * 0.25 // scintillement chaud
    }
  })

  return (
    <group ref={group} position={[0, -0.4, 0]}>
      {/* Comptoir */}
      <mesh position={[0, -0.55, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.2, 0.35, 1.8]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.7} />
      </mesh>

      {/* Sacs de riz empilés */}
      <Sack position={[-1.35, 0, 0.1]} rot={0.06} />
      <Sack position={[-1.3, 0.72, 0.05]} rot={-0.05} color="#e6cfa6" />
      <Sack position={[-1.4, 1.44, 0]} rot={0.1} color="#cdaa78" />

      {/* Bidons d'huile */}
      <Drum position={[0.15, 0.05, 0.2]} />
      <Drum position={[0.75, 0.05, -0.15]} color="#b5771f" />

      {/* Cartons */}
      <Carton position={[1.6, -0.05, 0.15]} rot={0.12} />
      <Carton position={[1.62, 0.6, 0.1]} rot={-0.08} />

      {/* Balance stylisée */}
      <Float speed={2} floatIntensity={0.4} rotationIntensity={0.2}>
        <mesh position={[-0.55, 0.15, 0.55]} castShadow>
          <cylinderGeometry args={[0.32, 0.28, 0.12, 24]} />
          <meshStandardMaterial color="#d0d3d8" roughness={0.25} metalness={0.85} />
        </mesh>
      </Float>

      {/* Ampoule chaude suspendue (source du glow) */}
      <mesh ref={bulb} position={[0.4, 2.3, 0.6]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#fff2cc" emissive="#ffcf6b" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[0.4, 2.25, 0.6]} color="#ffcf87" intensity={22} distance={9} decay={2} castShadow />

      {/* Poussière flottant dans la lumière */}
      <Sparkles count={40} scale={[5, 3, 3]} size={2.2} speed={0.28} color="#ffe6ad" opacity={0.5} position={[0, 1, 0.5]} />

      <ContactShadows position={[0, -0.72, 0]} opacity={0.5} scale={9} blur={2.4} far={3} />
    </group>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.6, 6.2], fov: 42 }}
      gl={{ powerPreference: 'low-power', antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Lumière chaude de fin d'après-midi */}
      <color attach="background" args={['#2a1747']} />
      <fog attach="fog" args={['#2a1747', 7, 13]} />
      <ambientLight intensity={0.35} color="#b79cff" />
      <directionalLight position={[4, 6, 4]} intensity={2.1} color="#ffb877" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 2, -2]} intensity={0.5} color="#7c3aed" />
      <Shop />
    </Canvas>
  )
}
