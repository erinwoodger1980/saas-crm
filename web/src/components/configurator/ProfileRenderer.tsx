/**
 * Profile Renderer Component
 * Renders SVG-extruded joinery profiles with proper materials and shadows
 * Handles both estimated and verified profiles
 */

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import {
  createExtrudedProfileMesh,
  SVGProfileDefinition,
} from '@/lib/scene/svg-profile';
import {
  createProfiledComponentMesh,
  updateComponentPosition,
  findComponentInAssembly,
  raycastAssembly,
  getAssemblyBoundingBox,
  ProfiledComponent,
} from '@/lib/scene/profiled-component';

interface ProfileRendererProps {
  components: ProfiledComponent[];
  onSelect?: (componentId: string | null) => void;
  selectedId?: string | null;
  onTransformEnd?: (componentId: string, position: [number, number, number]) => void;
  enableRaycast?: boolean;
  enableTransformControls?: boolean;
  orbitControlsRef?: React.MutableRefObject<any>;
}

export function ProfileRenderer({
  components,
  onSelect,
  selectedId,
  onTransformEnd,
  enableRaycast = true,
  enableTransformControls = true,
  orbitControlsRef,
}: ProfileRendererProps) {
  const { scene, camera, gl, raycaster, pointer } = useThree();
  const assemblyRef = useRef<THREE.Group | null>(null);
  const transformControlsRef = useRef<any>(null);
  const mouse = useRef(new THREE.Vector2());

  // Create assembly from components
  useEffect(() => {
    // Clean up old assembly
    if (assemblyRef.current) {
      scene.remove(assemblyRef.current);
      assemblyRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
    }

    // Create new assembly
    const assembly = new THREE.Group();
    assembly.userData.isAssembly = true;

    components.forEach((component) => {
      const mesh = createProfiledComponentMesh(component);
      if (mesh) {
        assembly.add(mesh);
      }
    });

    scene.add(assembly);
    assemblyRef.current = assembly;
  }, [components, scene]);

  // Handle raycasting for selection
  useEffect(() => {
    if (!enableRaycast || !assemblyRef.current) return;

    const handleClick = () => {
      raycaster.setFromCamera(pointer, camera);
      const result = raycastAssembly(
        assemblyRef.current!,
        raycaster,
        camera
      );

      if (result) {
        onSelect?.(result.component.userData.componentId);
      } else {
        onSelect?.(null);
      }
    };

    gl.domElement.addEventListener('click', handleClick);

    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [enableRaycast, raycaster, camera, pointer, gl, onSelect]);

  // Handle transform controls
  useEffect(() => {
    if (
      !enableTransformControls ||
      !transformControlsRef.current ||
      !selectedId ||
      !assemblyRef.current
    ) {
      return;
    }

    const selectedComponent = findComponentInAssembly(
      assemblyRef.current,
      selectedId
    );

    if (selectedComponent) {
      transformControlsRef.current.attach(selectedComponent);
      transformControlsRef.current.mode = 'translate';

      // Constrain to Y-axis only (like rails)
      transformControlsRef.current.showX = false;
      transformControlsRef.current.showZ = false;
      transformControlsRef.current.showY = true;

      const handleMouseDown = () => {
        if (orbitControlsRef?.current) {
          orbitControlsRef.current.enabled = false;
        }
      };

      const handleMouseUp = () => {
        if (orbitControlsRef?.current) {
          orbitControlsRef.current.enabled = true;
        }

        const newPos: [number, number, number] = [
          selectedComponent.position.x,
          selectedComponent.position.y,
          selectedComponent.position.z,
        ];

        onTransformEnd?.(selectedId, newPos);
      };

      transformControlsRef.current.addEventListener(
        'mouseDown',
        handleMouseDown
      );
      transformControlsRef.current.addEventListener('mouseUp', handleMouseUp);

      return () => {
        transformControlsRef.current?.removeEventListener(
          'mouseDown',
          handleMouseDown
        );
        transformControlsRef.current?.removeEventListener(
          'mouseUp',
          handleMouseUp
        );
        transformControlsRef.current?.detach();
      };
    }
  }, [
    enableTransformControls,
    selectedId,
    onTransformEnd,
    orbitControlsRef,
  ]);

  // Compute bounding box for camera
  const boundingBox = useMemo(() => {
    if (!assemblyRef.current) {
      return new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(0, 1000, 0),
        new THREE.Vector3(2000, 2000, 100)
      );
    }

    return getAssemblyBoundingBox(assemblyRef.current);
  }, [components]);

  // Expose assembly and bounding box
  useEffect(() => {
    if (assemblyRef.current) {
      (window as any).__profileAssembly = assemblyRef.current;
      (window as any).__profileBoundingBox = boundingBox;
    }
  }, [boundingBox]);

  return (
    <>
      {enableTransformControls && (
        <TransformControls ref={transformControlsRef} />
      )}
    </>
  );
}
