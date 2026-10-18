import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { PlaceholderTurtle } from "./createPlaceholderTurtle";
import type { FlipperRig } from "./animateTurtle";
import { createHeadRig } from "./headRig";

/** Original hatchling study. Same roots and four flipper rigs as the existing animation. */
export function createDetailedTurtle(scene: Scene): PlaceholderTurtle {
  const root = new TransformNode("turtle", scene);
  const visual = new TransformNode("turtleVisual", scene);
  visual.parent = root;
  const skin = organicMaterial(scene, "skin");
  const shell = organicMaterial(scene, "shell");
  shell.clearCoat.isEnabled = true;
  shell.clearCoat.intensity = 0.23;
  shell.clearCoat.roughness = 0.32;
  const belly = new PBRMaterial("hatchlingBelly", scene);
  belly.albedoColor = new Color3(0.35, 0.32, 0.22);
  belly.metallic = 0;
  belly.roughness = 0.78;
  const eye = new PBRMaterial("hatchlingEyes", scene);
  eye.albedoColor = new Color3(0.008, 0.012, 0.01);
  eye.metallic = 0;
  eye.roughness = 0.1;

  const ellipsoid = (name: string, scale: Vector3, position: Vector3, material: PBRMaterial, segments = 24, parent: TransformNode = visual) => {
    const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments }, scene);
    mesh.scaling.copyFrom(scale);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.parent = parent;
    return mesh;
  };
  ellipsoid("hatchlingBody", new Vector3(1.08,0.3,1.38), new Vector3(0,0.23,0),skin);
  ellipsoid("hatchlingPlastron", new Vector3(0.99,0.13,1.27), new Vector3(0,0.13,0),belly);
  const carapace = ellipsoid("hatchlingScutedShell", new Vector3(1.10,0.50,1.44), new Vector3(0,0.36,-0.04),shell,32);
  const shellPositions = carapace.getVerticesData(VertexBuffer.PositionKind)!;
  const shellUVs: number[] = [];
  for (let i = 0; i < shellPositions.length; i += 3) shellUVs.push(shellPositions[i]+0.5, shellPositions[i+2]+0.5);
  carapace.setVerticesData(VertexBuffer.UVKind,shellUVs);
  const rim = MeshBuilder.CreateTorus("hatchlingShellRim", { diameter: 1.015, thickness: 0.032, tessellation: 40 },scene);
  rim.scaling.set(1.06,1,1.38);
  rim.position.set(0,0.32,-0.04);
  rim.material = skin;
  rim.parent = visual;
  ellipsoid("hatchlingNeck",new Vector3(0.26,0.21,0.44),new Vector3(0,0.23,0.68),skin);
  const headRig = createHeadRig(scene, visual, skin, "hatchling", { baseZ: 0.6, y: 0.24, diameter: 0.25 });
  ellipsoid("hatchlingHead",new Vector3(0.36,0.26,0.48),new Vector3(0,0.26,0.92),skin,24,headRig.head);
  for (const side of [-1,1]) {
    ellipsoid(`hatchlingEye${side}`,new Vector3(0.045,0.048,0.043),new Vector3(side*0.137,0.31,1.055),eye,16,headRig.head);
    ellipsoid(`hatchlingNostril${side}`,new Vector3(0.014,0.01,0.012),new Vector3(side*0.052,0.29,1.147),eye,8,headRig.head);
  }
  const mouth = MeshBuilder.CreateTube("hatchlingMouth", { path: [new Vector3(-0.1,0.205,1.09),new Vector3(0,0.20,1.157),new Vector3(0.1,0.205,1.09)], radius: 0.006, tessellation: 5 },scene);
  mouth.material = eye;
  mouth.parent = headRig.head;
  const tail = MeshBuilder.CreateCylinder("hatchlingTail", { height: 0.28, diameterTop: 0.012, diameterBottom: 0.08, tessellation: 10 },scene);
  tail.rotation.x = -Math.PI/2;
  tail.position.set(0,0.12,-0.78);
  tail.material = skin;
  tail.parent = visual;

  const flippers: FlipperRig[] = [];
  for (const role of ["front", "rear"] as const) {
    for (const side of [-1,1] as const) {
      const front = role === "front";
      const flipper = MeshBuilder.CreateSphere(`hatchling${role}Flipper${side}`, { diameter: 1, segments: 18 },scene);
      const positions = flipper.getVerticesData(VertexBuffer.PositionKind)!;
      for (let i=0;i<positions.length;i+=3) {
        const u = positions[i]+0.5;
        positions[i] = u*(front?0.95:0.53);
        positions[i+1] *= front?0.065:0.055;
        positions[i+2] = positions[i+2]*(front?0.39:0.30)-u*u*(front?0.34:0.20);
      }
      flipper.setVerticesData(VertexBuffer.PositionKind,positions);
      const normals: number[]=[];
      VertexData.ComputeNormals(positions,flipper.getIndices()!,normals);
      flipper.setVerticesData(VertexBuffer.NormalKind,normals);
      flipper.refreshBoundingInfo();
      flipper.scaling.x = side;
      flipper.position.set(side*(front?0.40:0.35),front?0.14:0.12,front?0.31:-0.55);
      flipper.rotation.y = side*(front?0.08:0.24);
      flipper.rotation.z = side*-0.04;
      flipper.material = skin;
      flipper.parent = visual;
      flippers.push({ mesh:flipper,baseY:flipper.rotation.y,baseZ:flipper.rotation.z,side,role });
    }
  }
  return {root,visual,flippers,skin,shell,setHeadReach:headRig.setReach};
}

function organicMaterial(scene: Scene, kind: "shell" | "skin"): PBRMaterial {
  const size = kind === "shell" ? 512 : 256;
  const pixels = new Uint8Array(size*size*3);
  const heights = new Float32Array(size*size);
  const seeds: {x:number;y:number}[]=[];
  if (kind === "shell") {
    for (let i=0;i<5;i++) seeds.push({x:256,y:85+i*85});
    for (const x of [139,373]) for (let i=0;i<4;i++) seeds.push({x,y:120+i*88});
    for (const x of [35,477]) for (let i=0;i<6;i++) seeds.push({x,y:40+i*85});
    for (const y of [5,507]) for (const x of [133,256,379]) seeds.push({x,y});
  }
  for (let y=0;y<size;y++) {
    for (let x=0;x<size;x++) {
      let first=Infinity, second=Infinity, cell=0;
      const compare=(sx:number,sy:number,id:number) => {
        const d=(x-sx)**2+(y-sy)**2;
        if(d<first){second=first;first=d;cell=id;}else if(d<second)second=d;
      };
      if(kind==="shell") seeds.forEach((seed,i)=>compare(seed.x,seed.y,i));
      else {
        const row=Math.floor(y/19),column=Math.floor(x/20);
        for(let j=row-1;j<=row+1;j++)for(let i=column-1;i<=column+1;i++) {
          compare(i*20+(j%2)*10+Math.sin(i*7+j*3)*2,j*19+Math.sin(i*3-j*8)*2,i+j*31);
        }
      }
      const edge=(Math.sqrt(second)-Math.sqrt(first))*0.5;
      const grain=Math.sin(x*12.9898+y*78.233)*43758.5453%1;
      const variation=0.5+0.5*Math.sin(cell*4.71);
      const growth=Math.sin(Math.sqrt(first)*0.65)*Math.sin(Math.sqrt(first)*0.14)*2;
      const seam=Math.max(0,1-edge/(kind==="shell"?2.2:0.9));
      const highlight=Math.exp(-(Math.max(0,edge-2.2)**2)*0.3)*7;
      const value=(kind==="shell"?112+variation*35+growth*1.5:101+variation*24)+grain*3-seam*38+highlight;
      const i=y*size+x;
      pixels.set(kind==="shell"?[value,value*0.89,value*0.58]:[value*0.88,value,value*0.78],i*3);
      heights[i]=1-seam*0.55+growth*0.012+grain*0.035;
    }
  }
  const normals=new Uint8Array(size*size*3);
  const sample=(x:number,y:number)=>heights[((y+size)%size)*size+((x+size)%size)];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const nx=(sample(x-1,y)-sample(x+1,y))*0.8,ny=(sample(x,y-1)-sample(x,y+1))*0.8;
    const length=Math.hypot(nx,ny,1);
    normals.set([128+nx/length*127,128+ny/length*127,128+127/length],(y*size+x)*3);
  }
  const material=new PBRMaterial(`hatchling${kind}Material`,scene);
  material.metallic=0;
  material.roughness=kind==="shell"?0.48:0.76;
  material.albedoTexture=RawTexture.CreateRGBTexture(pixels,size,size,scene,true,false);
  material.albedoTexture.name=`originalHatchling${kind}Color${size}`;
  const bump=RawTexture.CreateRGBTexture(normals,size,size,scene,true,false);
  bump.name=`originalHatchling${kind}Normal${size}`;
  bump.gammaSpace=false;
  bump.level=0.45;
  material.bumpTexture=bump;
  return material;
}
