import { Constants } from "@babylonjs/core/Engines/constants";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

/** Shared by the sky and water reflection shader; no downloaded skybox. */
export const skyGLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) { return noise(p)*0.57 + noise(p*2.03)*0.28 + noise(p*4.01)*0.15; }
  vec3 skyColor(vec3 ray, vec3 sun) {
    float up = max(ray.y, 0.0);
    vec3 color = mix(vec3(0.91,0.76,0.57), vec3(0.48,0.66,0.76), smoothstep(0.0,0.34,up));
    color = mix(color, vec3(0.20,0.40,0.60), smoothstep(0.22,0.95,up));
    vec2 cloudUV = ray.xz / (up + 0.18) * 2.3;
    float cloud = smoothstep(0.52,0.78,fbm(cloudUV + vec2(0.7,1.4)));
    cloud *= smoothstep(0.025,0.16,up) * (1.0-smoothstep(0.72,1.0,up));
    color = mix(color, vec3(0.87,0.84,0.75), cloud*0.62);
    float alignment = max(dot(ray,sun),0.0);
    color += vec3(1.0,0.55,0.22) * pow(alignment,34.0)*0.11;
    color += vec3(1.0,0.77,0.42) * pow(alignment,650.0)*0.18;
    color = mix(color, vec3(1.0,0.96,0.80), smoothstep(0.99989,0.99997,alignment));
    return color;
  }
`;

export function createAtmosphere(scene: Scene, sunDirection: Vector3): void {
  const sky = MeshBuilder.CreateSphere("previewDawnSky", { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.infiniteDistance = true;
  sky.isPickable = false;
  const material = new ShaderMaterial("previewAtmosphere", scene, {
    vertexSource: `precision highp float; attribute vec3 position; uniform mat4 worldViewProjection;
      varying vec3 direction;
      void main() { direction=position; gl_Position=worldViewProjection*vec4(position,1.0); }`,
    fragmentSource: `precision highp float; varying vec3 direction; uniform vec3 sunDirection;
      ${skyGLSL}
      void main() { gl_FragColor=vec4(skyColor(normalize(direction),sunDirection),1.0); }`,
  }, { attributes: ["position"], uniforms: ["worldViewProjection", "sunDirection"] });
  material.setVector3("sunDirection", sunDirection);
  material.disableDepthWrite = true;
  sky.material = material;

  // Small original sky cubemap supplies real material reflections, not screen-space effects.
  const size = 64;
  const faces: Uint8Array[] = [];
  for (let face = 0; face < 6; face++) {
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
        const ray = [new Vector3(1,-v,-u), new Vector3(-1,-v,u), new Vector3(u,1,v),
          new Vector3(u,-1,-v), new Vector3(u,-v,1), new Vector3(-u,-v,-1)][face].normalize();
        const t = Math.pow(Math.max(0, ray.y), 0.5);
        const glow = Math.pow(Math.max(0, Vector3.Dot(ray,sunDirection)), 180) * 0.3;
        const color = ray.y < 0 ? [0.28,0.25,0.19] : [0.95-t*0.61+glow, 0.76-t*0.22+glow*0.7, 0.53+t*0.14];
        const i = (y * size + x) * 4;
        pixels.set([...color.map(c => Math.min(255, Math.max(0, c * 255))), 255], i);
      }
    }
    faces.push(pixels);
  }
  const environment = new RawCubeTexture(scene, faces, size, Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  environment.name = "originalDawnReflections64";
  environment.gammaSpace = true;
  scene.environmentTexture = environment;
  scene.environmentIntensity = 0.55;
}
