import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { skyGLSL } from "../beachPreview/createAtmosphere";

const noise3D = `
  float hash3(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float noise3(vec3 p) {
    vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm3(vec3 p) { return noise3(p)*0.53+noise3(p*2.03)*0.27+noise3(p*4.07)*0.13+noise3(p*8.11)*0.07; }
`;

/** Original procedural planet and stars, revealed only during the ending. */
export function createOrbitalBackdrop(scene: Scene, sunriseDirection: Vector3) {
  const root=new TransformNode("endingOrbitBackdrop",scene);
  const sky=MeshBuilder.CreateSphere("endingSky",{diameter:1800,segments:24,sideOrientation:Mesh.BACKSIDE},scene);
  sky.parent=root;
  sky.infiniteDistance=true;
  sky.isPickable=false;
  const skyMaterial=new ShaderMaterial("endingSkyMaterial",scene,{
    vertexSource:`precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 direction;
      void main(){direction=position;gl_Position=worldViewProjection*vec4(position,1.0);}`,
    fragmentSource:`precision highp float; varying vec3 direction; uniform float spaceBlend; uniform vec3 sunrise;
      ${skyGLSL} ${noise3D}
      void main(){
        vec3 ray=normalize(direction),cell=ray*420.0;
        float seed=hash3(floor(cell));
        float star=step(0.994,seed)*(1.0-smoothstep(0.02,0.20,length(fract(cell)-0.5)));
        float bright=step(0.9995,seed)*(1.0-smoothstep(0.04,0.33,length(fract(cell)-0.5)));
        vec3 night=vec3(0.003,0.006,0.018)+vec3(0.68,0.78,1.0)*(star+bright*1.3);
        gl_FragColor=vec4(mix(skyColor(ray,sunrise),night,spaceBlend),1.0);
      }`,
  },{attributes:["position"],uniforms:["worldViewProjection","spaceBlend","sunrise"]});
  skyMaterial.disableDepthWrite=true;
  skyMaterial.setFloat("spaceBlend",0);
  skyMaterial.setVector3("sunrise",sunriseDirection);
  sky.material=skyMaterial;

  const earth=MeshBuilder.CreateSphere("endingEarth",{diameter:1000,segments:64},scene);
  earth.parent=root;
  earth.position.set(0,-160,470);
  earth.rotation.z=0.15;
  earth.isPickable=false;
  const planetVertex=`precision highp float; attribute vec3 position,normal; uniform mat4 world,worldViewProjection;
    varying vec3 direction,worldNormal,worldPosition;
    void main(){direction=normalize(position);worldNormal=normalize(mat3(world)*normal);
      worldPosition=(world*vec4(position,1.0)).xyz;gl_Position=worldViewProjection*vec4(position,1.0);}`;
  const earthMaterial=new ShaderMaterial("endingEarthMaterial",scene,{
    vertexSource:planetVertex,
    fragmentSource:`precision highp float; varying vec3 direction,worldNormal,worldPosition;
      uniform float reveal; uniform vec3 cameraPosition; ${noise3D}
      void main(){
        vec3 n=normalize(worldNormal),p=normalize(direction);
        float terrain=fbm3(p*4.4+vec3(1.1,0.4,2.3));
        float land=smoothstep(0.50,0.54,terrain);
        vec3 continent=mix(vec3(0.08,0.24,0.10),vec3(0.42,0.34,0.18),smoothstep(0.56,0.71,terrain));
        vec3 color=mix(vec3(0.015,0.12,0.31),continent,land);
        color=mix(color,vec3(0.83,0.90,0.94),smoothstep(0.74,0.94,abs(p.y)));
        float clouds=smoothstep(0.54,0.69,fbm3(p*15.0+vec3(3.8,0.0,1.0)));
        color=mix(color,vec3(0.90,0.94,0.98),clouds*0.9);
        vec3 sun=normalize(vec3(-0.4,0.3,-0.85));
        float light=max(dot(n,sun),0.0);
        color*=0.12+light*1.12;
        float rim=pow(1.0-max(dot(n,normalize(cameraPosition-worldPosition)),0.0),3.5);
        color+=vec3(0.06,0.28,0.57)*rim;
        gl_FragColor=vec4(color*reveal,1.0);
      }`,
  },{attributes:["position","normal"],uniforms:["world","worldViewProjection","cameraPosition","reveal"]});
  earthMaterial.setVector3("cameraPosition",Vector3.Zero());
  earthMaterial.setFloat("reveal",0);
  earth.material=earthMaterial;
  const atmosphere=MeshBuilder.CreateSphere("endingEarthAtmosphere",{diameter:1018,segments:48,sideOrientation:Mesh.BACKSIDE},scene);
  atmosphere.parent=root;
  atmosphere.position.copyFrom(earth.position);
  const glow=new ShaderMaterial("endingAtmosphericRim",scene,{
    vertexSource:planetVertex,
    fragmentSource:`precision highp float; varying vec3 worldNormal,worldPosition; uniform vec3 cameraPosition; uniform float reveal;
      void main(){float rim=pow(1.0-abs(dot(normalize(worldNormal),normalize(cameraPosition-worldPosition))),3.0);
        gl_FragColor=vec4(0.12,0.46,1.0,rim*0.55*reveal);}`,
  },{attributes:["position","normal"],uniforms:["world","worldViewProjection","cameraPosition","reveal"],needAlphaBlending:true});
  glow.disableDepthWrite=true;
  glow.setVector3("cameraPosition",Vector3.Zero());
  glow.setFloat("reveal",0);
  atmosphere.material=glow;
  earth.setEnabled(false);
  atmosphere.setEnabled(false);
  root.setEnabled(false);
  return {
    root,
    update(blend:number,time:number) {
      skyMaterial.setFloat("spaceBlend",blend);
      const reveal=Math.max(0,Math.min(1,(blend-0.62)/0.38));
      earth.setEnabled(reveal>0);
      atmosphere.setEnabled(reveal>0);
      earthMaterial.setFloat("reveal",reveal);
      glow.setFloat("reveal",reveal);
      earth.rotation.y=time*0.008;
      if(scene.activeCamera) {
        earthMaterial.setVector3("cameraPosition",scene.activeCamera.globalPosition);
        glow.setVector3("cameraPosition",scene.activeCamera.globalPosition);
      }
    },
  };
}
