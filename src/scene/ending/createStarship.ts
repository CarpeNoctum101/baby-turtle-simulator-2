import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { endingPlan } from "../../game/endingState";

/** Original stylized Starship artwork, including a fictional turtle boarding hatch. */
export function createStarship(scene: Scene) {
  const root = new TransformNode("endingLaunchSet", scene);
  const shipZ = endingPlan.ship.z;
  const rampZ = endingPlan.rampFoot.z;
  const hatchZ = endingPlan.hatch.z;
  // One lift carries the rocket, launch pad and connected boarding bridge out of the sea.
  const lift = new TransformNode("starshipSeaLift", scene);
  lift.parent = root;
  lift.position.y = -endingPlan.submergedDepth;
  const ship = new TransformNode("endingStarship", scene);
  ship.parent = lift;
  ship.position.set(endingPlan.ship.x, endingPlan.ship.y, endingPlan.ship.z);
  const steel = material("starshipStainlessSteel", new Color3(0.59, 0.65, 0.70));
  steel.specularColor = new Color3(0.95, 0.98, 1);
  steel.specularPower = 96;
  steel.emissiveColor = new Color3(0.035, 0.045, 0.055);
  const dark = material("starshipHeatShield", new Color3(0.045, 0.055, 0.065));
  dark.specularColor = new Color3(0.12, 0.14, 0.16);
  const deck = material("starshipDockSteel", new Color3(0.16, 0.21, 0.25));
  const white = material("starshipDockMarkings", new Color3(0.86, 0.89, 0.88));
  const amber = material("starshipSafetyRails", new Color3(0.95, 0.60, 0.13));

  const hull = MeshBuilder.CreateCylinder("starshipHull", { height: 10.2, diameter: 2.7, tessellation: 48 }, scene);
  hull.position.y = 6.4;
  attach(hull, ship, steel);
  const profile = [new Vector3(1.35,0,0), new Vector3(1.30,0.8,0), new Vector3(1.05,1.9,0), new Vector3(0.58,2.9,0), new Vector3(0.01,3.7,0)];
  const nose = MeshBuilder.CreateLathe("starshipOgiveNose", { shape: profile, tessellation: 48, cap: Mesh.CAP_END }, scene);
  nose.position.y = 11.5;
  attach(nose, ship, steel);
  const shieldPaths = [1.3,11.5].map(y => Array.from({ length: 25 }, (_, i) => {
    const angle = -Math.PI/4 + i/24*Math.PI;
    return new Vector3(Math.cos(angle)*1.36,y,Math.sin(angle)*1.36);
  }));
  attach(MeshBuilder.CreateRibbon("starshipBlackHeatShield", { pathArray: shieldPaths, sideOrientation: Mesh.DOUBLESIDE }, scene), ship, dark);
  const noseShield = profile.map(point => Array.from({ length: 25 }, (_, i) => {
    const angle = -Math.PI/4+i/24*Math.PI;
    return new Vector3(Math.cos(angle)*(point.x+0.008),point.y+11.5,Math.sin(angle)*(point.x+0.008));
  }));
  attach(MeshBuilder.CreateRibbon("starshipNoseHeatShield", { pathArray: noseShield, sideOrientation: Mesh.DOUBLESIDE }, scene), ship, dark);

  const rings: Mesh[] = [];
  for (let y=1.55;y<11.5;y+=0.68) {
    const path = Array.from({ length: 41 }, (_, i) => new Vector3(Math.cos(i/40*Math.PI*2)*1.356,y,Math.sin(i/40*Math.PI*2)*1.356));
    rings.push(MeshBuilder.CreateTube("weldRing", { path, radius: 0.012, tessellation: 3 }, scene));
  }
  const welds = Mesh.MergeMeshes(rings,true,false);
  if (welds) { welds.name="starshipWeldRings"; attach(welds,ship,steel); }
  for (const side of [-1,1]) {
    const lower = fin(`starshipAftFlap${side}`, [[0,0],[1.65,0.2],[1.95,2.0],[0,3.4]]);
    lower.position.set(side*1.18,1.2,0);
    lower.scaling.x=side;
    attach(lower,ship,steel);
    const upper = fin(`starshipForwardFlap${side}`, [[0,0],[0.85,0.3],[1.1,1.8],[0,1.2]]);
    upper.position.set(side*1.1,10.4,0);
    upper.scaling.x=side;
    attach(upper,ship,dark);
  }
  for (let i=0;i<6;i++) {
    const angle=i*Math.PI/3;
    const nozzle=MeshBuilder.CreateCylinder(`starshipEngine${i}`, { height: 0.8, diameterTop: 0.34, diameterBottom: 0.56, tessellation: 16 },scene);
    nozzle.position.set(Math.cos(angle)*0.7,0.95,Math.sin(angle)*0.7);
    attach(nozzle,ship,dark);
  }
  const hatchBack=MeshBuilder.CreateBox("starshipHatchInterior", { width:1.2,height:1.45,depth:0.06 },scene);
  hatchBack.position.set(0,2.3,-1.37);
  attach(hatchBack,ship,dark);
  const hatch=MeshBuilder.CreateBox("starshipSlidingHatch", { width:1.22,height:1.47,depth:0.06 },scene);
  hatch.position.set(0,2.3,-1.43);
  attach(hatch,ship,steel);
  for (const side of [-1,1]) {
    const frame=MeshBuilder.CreateBox(`starshipHatchFrame${side}`, { width:0.08,height:1.6,depth:0.1 },scene);
    frame.position.set(side*0.66,2.3,-1.44);
    attach(frame,ship,amber);
  }
  addWordmark();

  const pad=MeshBuilder.CreateCylinder("starshipOceanLaunchPad", { diameter:12,height:1.2,tessellation:64 },scene);
  pad.position.set(0,endingPlan.deckY-0.6,shipZ);
  attach(pad,lift,deck);
  const padCircle=MeshBuilder.CreateTube("starshipPadCircle", { path:Array.from({length:65},(_,i)=>new Vector3(Math.cos(i/64*Math.PI*2)*5.1,endingPlan.deckY+0.015,shipZ+Math.sin(i/64*Math.PI*2)*5.1)),radius:0.06,tessellation:4 },scene);
  attach(padCircle,lift,white);
  const walkwayEdges=[-1,1].map(side=>[
    new Vector3(side*endingPlan.arrivalHalfWidth,endingPlan.deckY,endingPlan.arrivalZ-1),
    new Vector3(side*endingPlan.arrivalHalfWidth,endingPlan.deckY,endingPlan.arrivalZ),
    new Vector3(side*3,endingPlan.deckY,endingPlan.entry.z),new Vector3(side*1.8,endingPlan.deckY,rampZ),
  ]);
  const walkway=MeshBuilder.CreateRibbon("starshipArrivalWalkway", { pathArray:walkwayEdges,
    sideOrientation:Mesh.DOUBLESIDE },scene);
  attach(walkway,lift,deck);
  for(const edge of walkwayEdges) {
    const side=MeshBuilder.CreateRibbon("starshipBridgeSide", {pathArray:[edge,edge.map(p=>p.add(new Vector3(0,-0.35,0)))],
      sideOrientation:Mesh.DOUBLESIDE},scene);
    attach(side,lift,deck);
    const stripe=MeshBuilder.CreateTube("starshipBridgeSafetyStripe",{path:edge.map(p=>p.add(new Vector3(0,0.015,0))),
      radius:0.045,tessellation:4},scene);
    attach(stripe,lift,amber);
  }
  // Submerged support legs make the rising platform read as a solid structure.
  const supports:Mesh[]=[];
  for(const x of [-3.5,3.5])for(const z of [shipZ-3,shipZ+3]) {
    const support=MeshBuilder.CreateCylinder("starshipLiftSupport",{height:7,diameter:0.65,tessellation:12},scene);
    support.position.set(x,-4.2,z);
    supports.push(support);
  }
  const legs=Mesh.MergeMeshes(supports,true,false);
  if(legs)attach(legs,lift,steel);
  const ramp=MeshBuilder.CreateRibbon("starshipBoardingRamp", { pathArray:[-1.13,1.13].map(x=>[
    new Vector3(x,endingPlan.deckY,rampZ),new Vector3(x,endingPlan.hatch.y+0.04,hatchZ),
  ]),sideOrientation:Mesh.DOUBLESIDE },scene);
  attach(ramp,lift,deck);
  const railMeshes: Mesh[]=[];
  for (const side of [-1,1]) {
    const start=new Vector3(side*1.13,endingPlan.deckY+0.81,rampZ),end=new Vector3(side*1.13,endingPlan.hatch.y+0.85,hatchZ);
    railMeshes.push(MeshBuilder.CreateTube("rampRail",{path:[start,end],radius:0.035,tessellation:6},scene));
    for(let i=0;i<=5;i++) {
      const p=Vector3.Lerp(start,end,i/5);
      const post=MeshBuilder.CreateCylinder("rampRailPost",{height:0.8,diameter:0.05,tessellation:6},scene);
      post.position.copyFrom(p.add(new Vector3(0,-0.4,0)));
      railMeshes.push(post);
    }
  }
  const rails=Mesh.MergeMeshes(railMeshes,true,false);
  if(rails)attach(rails,lift,amber);

  const foam=material("starshipEmergenceFoam",new Color3(0.73,0.88,0.9));
  foam.emissiveColor=new Color3(0.15,0.22,0.24);
  foam.alpha=0.55;
  const ripples=Array.from({length:3},(_,i)=>{
    const ring=MeshBuilder.CreateTorus(`starshipSeaRipple${i}`,{diameter:12,thickness:0.07,tessellation:64},scene);
    ring.position.set(0,0.12+i*0.015,shipZ);
    attach(ring,root,foam);
    ring.setEnabled(false);
    return ring;
  });

  const flameOuter=material("starshipBlueExhaust",new Color3(0.2,0.45,1));
  flameOuter.emissiveColor=new Color3(0.15,0.4,1);
  flameOuter.alpha=0.65;
  const flameCore=material("starshipExhaustCore",Color3.White());
  flameCore.emissiveColor=new Color3(1,0.86,0.55);
  const flames=[flameOuter,flameCore].map((mat,i)=>{
    const flame=MeshBuilder.CreateCylinder(`starshipFlame${i}`,{height:1,diameterTop:i?0.9:1.9,diameterBottom:0.01,tessellation:24},scene);
    attach(flame,ship,mat);
    flame.setEnabled(false);
    return flame;
  });
  const smokeMaterial=material("starshipLaunchVapor",new Color3(0.78,0.81,0.82));
  smokeMaterial.alpha=0.25;
  const smoke=Array.from({length:18},(_,i)=>{
    const puff=MeshBuilder.CreateSphere(`starshipVapor${i}`,{diameter:1,segments:8},scene);
    attach(puff,root,smokeMaterial);
    puff.setEnabled(false);
    return puff;
  });
  const glow=new PointLight("starshipEngineGlow",new Vector3(0,0.5,0),scene);
  glow.parent=ship;
  glow.diffuse=new Color3(0.4,0.62,1);
  glow.range=16;
  glow.intensity=0;
  const dockLight=new PointLight("starshipDockFloodlight",new Vector3(-5,9,rampZ),scene);
  dockLight.parent=lift;
  dockLight.diffuse=new Color3(0.70,0.85,1);
  dockLight.intensity=1.15;
  dockLight.range=35;
  root.setEnabled(false);
  return {root,lift,ship,hatch,flames,smoke,ripples,glow,dockLight};

  function material(name:string,color:Color3):StandardMaterial {
    const mat=new StandardMaterial(name,scene);
    mat.diffuseColor=color;
    mat.specularColor=new Color3(0.22,0.25,0.28);
    return mat;
  }
  function attach(mesh:Mesh,parent:TransformNode,mat:StandardMaterial):void {
    mesh.parent=parent;
    mesh.material=mat;
    mesh.isPickable=false;
  }
  function fin(name:string,points:number[][]):Mesh {
    const mesh=new Mesh(name,scene);
    const positions:number[]=[],indices:number[]=[];
    for(const z of [-0.07,0.07])for(const [x,y]of points)positions.push(x,y,z);
    indices.push(0,2,1,0,3,2,4,5,6,4,6,7);
    for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(i,j,j+4,i,j+4,i+4);}
    const data=new VertexData(),normals:number[]=[];
    VertexData.ComputeNormals(positions,indices,normals);
    data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);
    return mesh;
  }
  function addWordmark():void {
    const texture=new DynamicTexture("originalStarshipWordmark",{width:256,height:512},scene,true);
    const ctx=texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0,0,256,512);
    ctx.save();ctx.translate(128,256);ctx.rotate(-Math.PI/2);
    ctx.fillStyle="#1a2730";ctx.font="bold 58px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("SPACEX",0,0);ctx.font="22px sans-serif";ctx.fillText("STARSHIP",0,53);ctx.restore();
    texture.hasAlpha=true;texture.update();
    const mat=material("starshipWordmarkMaterial",Color3.White());
    mat.diffuseTexture=texture;mat.useAlphaFromDiffuseTexture=true;mat.backFaceCulling=false;
    const label=MeshBuilder.CreatePlane("starshipWordmark",{width:1.15,height:2.6},scene);
    label.position.set(0,7.6,-1.365);
    attach(label,ship,mat);
  }
}
