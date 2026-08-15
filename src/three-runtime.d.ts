declare module 'three' {
  export const LinearFilter: number;

  export class CanvasTexture {
    constructor(canvas: HTMLCanvasElement);
    minFilter: number;
  }

  export class SpriteMaterial {
    constructor(options?: {
      depthTest?: boolean;
      depthWrite?: boolean;
      sizeAttenuation?: boolean;
      transparent?: boolean;
    });
    map?: CanvasTexture;
    needsUpdate: boolean;
  }

  export class Sprite {
    constructor(material?: SpriteMaterial);
    position: { set: (x: number, y: number, z: number) => void };
    renderOrder: number;
    scale: { set: (x: number, y: number, z: number) => void };
    userData: Record<string, unknown>;
    visible: boolean;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
  }

  export class BufferGeometry {
    setFromPoints(points: Vector3[]): this;
    dispose(): void;
  }

  export class LineBasicMaterial {
    constructor(options?: { color?: string; opacity?: number; transparent?: boolean });
    dispose(): void;
  }

  export class LineLoop {
    constructor(geometry: BufferGeometry, material: LineBasicMaterial);
  }

  export class Group {
    add(object: LineLoop): void;
    children: Array<{ geometry?: { dispose?: () => void }; material?: { dispose?: () => void } }>;
    name: string;
  }
}
