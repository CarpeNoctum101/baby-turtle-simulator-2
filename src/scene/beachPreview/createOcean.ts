import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { skyGLSL } from "./createAtmosphere";

/** One opaque water surface: animated wave normals, sky reflection, sun glitter and shore foam. */
export function createOcean(scene: Scene, sunDirection: Vector3): void {
  const ocean = MeshBuilder.CreateGround("previewOcean", { width: 600, height: 600, subdivisions: 96 }, scene);
  ocean.position.set(0, 0.04, 312.5);
  ocean.isPickable = false;
  const material = new ShaderMaterial("previewLivingOcean", scene, {
    vertexSource: `precision highp float;
      attribute vec3 position; uniform mat4 world, worldViewProjection; uniform float time;
      varying vec3 worldPosition;
      void main() {
        vec3 p=position;
        vec3 w=(world*vec4(p,1.0)).xyz;
        p.y += (sin(w.z*0.48-time*0.8)*0.045 + sin(w.x*0.29+w.z*0.22-time*0.6)*0.035)*smoothstep(17.0,30.0,w.z);
        worldPosition=(world*vec4(p,1.0)).xyz;
        gl_Position=worldViewProjection*vec4(p,1.0);
      }`,
    fragmentSource: `precision highp float;
      varying vec3 worldPosition;
      uniform float time; uniform vec3 cameraPosition, sunDirection;
      ${skyGLSL}
      void main() {
        vec2 p=worldPosition.xz;
        float shore=14.0+sin(p.x*0.18)*0.22+sin(p.x*0.51)*0.08;
        float depth=p.y-shore;
        if (depth<0.0) discard;
        float fine=fbm(p*2.1+vec2(time*0.12,-time*0.16));
        float warp=noise(p*0.35+time*0.035)*2.0;
        vec3 n=normalize(vec3(
          cos(p.x*2.7+p.y*1.9+time*0.9+warp)*0.04 + cos(p.x*0.56-time*0.6+warp)*0.065,
          1.0,
          sin(p.y*2.1-time*1.25+p.x*0.4+warp)*0.055 + cos(p.y*0.48-time*0.8+warp)*0.07));
        vec3 view=normalize(cameraPosition-worldPosition);
        float fresnel=0.025+0.975*pow(1.0-max(dot(n,view),0.0),5.0);
        vec3 shallow=mix(vec3(0.32,0.48,0.39),vec3(0.05,0.36,0.38),smoothstep(0.0,8.0,depth));
        vec3 body=mix(shallow,vec3(0.025,0.19,0.27),smoothstep(5.0,42.0,depth));
        vec3 color=mix(body,skyColor(reflect(-view,n),sunDirection),fresnel*0.88);
        float spec=pow(max(dot(reflect(-sunDirection,n),view),0.0),240.0);
        color += vec3(1.0,0.84,0.55)*spec*(0.55+fine*0.9);
        float runup=0.30+sin(time*0.65+p.x*0.05)*0.22;
        float wash=1.0-smoothstep(runup,runup+0.65,depth);
        float wave=sin(depth*2.0-time*1.35+sin(p.x*0.21)*0.5);
        float breaker=smoothstep(0.85,0.99,wave)*(1.0-smoothstep(2.0,11.0,depth));
        float foam=max(wash,breaker)*smoothstep(0.30,0.70,fine);
        color=mix(color,vec3(0.87,0.88,0.80),foam*0.85);
        float haze=1.0-exp(-length(cameraPosition-worldPosition)*0.0022);
        color=mix(color,vec3(0.79,0.77,0.66),haze);
        gl_FragColor=vec4(color,1.0);
      }`,
  }, { attributes: ["position"], uniforms: ["world", "worldViewProjection", "time", "cameraPosition", "sunDirection"] });
  material.setVector3("sunDirection", sunDirection);
  material.setFloat("time", 0);
  material.setVector3("cameraPosition", Vector3.Zero());
  ocean.material = material;
  let time = 0;
  scene.onBeforeRenderObservable.add(() => {
    time += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    material.setFloat("time", time);
    if (scene.activeCamera) material.setVector3("cameraPosition", scene.activeCamera.globalPosition);
  });
}
