import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { endingPlan, type EndingFrame } from "../../game/endingState";
import { course } from "../../movement/course";
import type { PlaceholderTurtle } from "../../turtle/createPlaceholderTurtle";
import { createStarship } from "./createStarship";
import { createOrbitalBackdrop } from "./createOrbitalBackdrop";

export function createSpaceEnding(scene: Scene, turtle: PlaceholderTurtle) {
  const originalCamera=scene.activeCamera;
  const beachMeshes=scene.meshes.slice();
  const sun=scene.getLightByName("sunrise") as DirectionalLight;
  const original={fogMode:scene.fogMode,fogDensity:scene.fogDensity,fogColor:scene.fogColor.clone(),
    shadows:scene.shadowsEnabled,sunDirection:sun.direction.clone(),sunIntensity:sun.intensity};
  const launch=createStarship(scene);
  const backdrop=createOrbitalBackdrop(scene,sun.direction.negate().normalize());
  // The high camera needs a longer horizon than the low-angle racing camera.
  const sea=MeshBuilder.CreateGround("endingOceanHorizon",{width:6000,height:6000,subdivisions:96},scene);
  sea.position.set(0,0.04,3000+course.water.minZ-1.5);
  sea.material=scene.getMaterialByName("previewLivingOcean") ?? scene.getMaterialByName("shallowWaterMaterial");
  sea.isPickable=false;
  sea.setEnabled(false);
  const camera=new FreeCamera("endingCamera",new Vector3(16,13,5),scene);
  camera.minZ=0.05;
  camera.maxZ=4000;
  camera.fov=0.8;
  const overlay=document.createElement("section");
  overlay.className="ending-overlay";
  overlay.hidden=true;
  overlay.setAttribute("aria-live","polite");
  const count=document.createElement("div"),restart=document.createElement("p");
  count.className="ending-countdown";
  restart.className="ending-restart";restart.textContent="R · Race again";
  overlay.append(count,restart);
  scene.getEngine().getRenderingCanvas()?.parentElement?.appendChild(overlay);
  const target=new Vector3(0,5,endingPlan.ship.z-6);
  const boardingTarget=new Vector3(0,2.6,endingPlan.hatch.z-0.05);
  const boardingPosition=new Vector3(5,5.3,endingPlan.rampFoot.z-1.5);
  let active=false;
  let hiddenBeach=false;
  let meshStates:boolean[]=[];
  let time=0;
  let lastPhase:EndingFrame["phase"] | null=null;
  let lastCount=-1;

  function reset():void {
    if(active) {
      for(let i=0;i<beachMeshes.length;i++)beachMeshes[i].setEnabled(meshStates[i]);
      scene.activeCamera=originalCamera;
    }
    active=false;hiddenBeach=false;time=0;lastPhase=null;lastCount=-1;
    launch.root.setEnabled(false);backdrop.root.setEnabled(false);
    sea.setEnabled(false);
    launch.lift.position.y=-endingPlan.submergedDepth;
    launch.ship.position.set(endingPlan.ship.x,endingPlan.ship.y,endingPlan.ship.z);
    launch.ship.rotation.set(0,0,0);
    launch.hatch.position.y=2.3;
    launch.glow.intensity=0;
    for(const flame of launch.flames)flame.setEnabled(false);
    for(const puff of launch.smoke)puff.setEnabled(false);
    for(const ring of launch.ripples)ring.setEnabled(false);
    turtle.root.parent=null;
    turtle.root.rotation.set(0,0,0);
    turtle.visual.setEnabled(true);
    overlay.hidden=true;
    scene.fogMode=original.fogMode;scene.fogDensity=original.fogDensity;scene.fogColor.copyFrom(original.fogColor);
    scene.shadowsEnabled=original.shadows;sun.direction.copyFrom(original.sunDirection);sun.intensity=original.sunIntensity;
  }

  return {
    begin():void {
      if(active)return;
      active=true;
      meshStates=beachMeshes.map(mesh=>mesh.isEnabled());
      launch.root.setEnabled(true);backdrop.root.setEnabled(true);
      sea.setEnabled(true);
      for(const mesh of beachMeshes)if(mesh.infiniteDistance || mesh.name==="previewOcean")mesh.setEnabled(false);
      if(originalCamera)camera.position.copyFrom(originalCamera.globalPosition);
      target.copyFrom(turtle.root.position).addInPlace(new Vector3(0,0.45,0));
      scene.activeCamera=camera;
      overlay.hidden=false;
      const shadows=sun.getShadowGenerator();
      if(shadows instanceof ShadowGenerator)for(const mesh of launch.ship.getChildMeshes()) {
        if(!mesh.name.startsWith("starshipFlame"))shadows.addShadowCaster(mesh,false);
      }
    },
    update(frame:EndingFrame,dt:number):void {
      if(!active)return;
      const safeDt=Number.isFinite(dt)?Math.min(0.05,Math.max(0,dt)):0;
      time+=safeDt;
      launch.lift.position.y=frame.platformOffset;
      launch.ship.position.y=endingPlan.ship.y+frame.altitude;
      launch.ship.rotation.z=frame.phase==="space"?-0.10:frame.phase==="launch"?-0.06*frame.spaceBlend:0;
      if(frame.boarded) {
        if(turtle.root.parent!==launch.ship) {
          turtle.root.parent=launch.ship;
          turtle.root.position.set(0,2,0);
        }
        turtle.visual.setEnabled(false);
      } else {
        turtle.root.position.set(frame.turtle.x,frame.turtle.y,frame.turtle.z);
        turtle.root.rotation.y=frame.heading;
        turtle.visual.setEnabled(frame.phase!=="boarding" || frame.phaseTime<1.25);
      }
      const open=frame.phase==="walking"?Math.min(1,frame.walkProgress*3)
        :frame.phase==="boarding"?1:frame.phase==="countdown"?Math.max(0,1-frame.phaseTime*1.5):0;
      launch.hatch.position.y=2.3+open*1.5;
      const ignition=frame.phase==="countdown"?Math.max(0,(frame.phaseTime-1.6)/1.4):frame.phase==="launch"?1:0;
      for(let i=0;i<launch.flames.length;i++) {
        const flame=launch.flames[i];
        const length=(i?5:8)*ignition*(0.94+Math.sin(time*37+i)*0.06);
        flame.setEnabled(length>0.02);
        flame.scaling.y=length;flame.position.y=0.52-length*0.5;
      }
      launch.glow.intensity=ignition*12;
      for(let i=0;i<launch.ripples.length;i++) {
        const ring=launch.ripples[i];
        ring.setEnabled(frame.phase==="rising");
        const cycle=(frame.phaseTime*0.4+i/3)%1;
        ring.scaling.set(0.75+cycle*0.85,1,0.75+cycle*0.85);
        ring.visibility=(1-cycle)*Math.sin(frame.riseProgress*Math.PI);
      }
      for(let i=0;i<launch.smoke.length;i++) {
        const puff=launch.smoke[i];
        const visible=ignition>0 && frame.altitude<80;
        puff.setEnabled(visible);
        if(!visible)continue;
        const cycle=(time*0.33+i/18)%1,angle=i*2.399963;
        const radius=1+cycle*10;
        puff.position.set(Math.cos(angle)*radius,0.4+cycle*1.5,endingPlan.ship.z+Math.sin(angle)*radius);
        puff.scaling.setAll((0.5+cycle*4)*ignition);
        puff.visibility=(1-cycle)*0.75;
      }
      backdrop.update(frame.spaceBlend,time);
      scene.fogDensity=original.fogDensity*(1-frame.spaceBlend);
      scene.fogColor=Color3.Lerp(original.fogColor,new Color3(0.003,0.006,0.018),frame.spaceBlend);
      sun.direction=Vector3.Lerp(original.sunDirection,new Vector3(0.4,-0.3,0.85),frame.spaceBlend);
      sun.intensity=original.sunIntensity*(1-frame.spaceBlend)+1.4*frame.spaceBlend;
      scene.shadowsEnabled=original.shadows && frame.altitude<30;
      if(frame.spaceBlend>0.55 && !hiddenBeach) {
        for(const mesh of beachMeshes)mesh.setEnabled(false);
        sea.setEnabled(false);
        hiddenBeach=true;
      }

      const shipTarget=launch.ship.position.add(new Vector3(0,7.2,0));
      const aspect=scene.getEngine().getRenderWidth()/scene.getEngine().getRenderHeight();
      const distance=34/Math.min(1,Math.max(0.55,aspect));
      let desiredTarget=shipTarget;
      let desiredPosition=shipTarget.add(new Vector3(19,7,-distance));
      if(frame.phase==="rising") {
        // Frame the surface and the entire emerging rocket, rather than tracking it underwater.
        desiredTarget=new Vector3(0,4.5,endingPlan.ship.z-6);
        desiredPosition=desiredTarget.add(new Vector3(19,9,-distance));
      } else if(frame.phase==="walking") {
        desiredTarget=Vector3.Lerp(new Vector3(frame.turtle.x,frame.turtle.y,frame.turtle.z),shipTarget,0.65);
        desiredPosition=desiredTarget.add(new Vector3(16,8,-distance));
        const close=Math.max(0,(frame.walkProgress-0.75)/0.25);
        desiredTarget=Vector3.Lerp(desiredTarget,boardingTarget,close);
        desiredPosition=Vector3.Lerp(desiredPosition,boardingPosition,close);
      } else if(frame.phase==="boarding") {
        desiredTarget=boardingTarget;
        desiredPosition=boardingPosition;
      } else if(frame.phase==="space") {
        const angle=0.55+Math.sin(frame.phaseTime*0.12)*0.22;
        desiredPosition=shipTarget.add(new Vector3(Math.sin(angle)*distance,8,-Math.cos(angle)*distance));
      }
      const blend=1-Math.exp(-safeDt*2.8);
      if(frame.phase==="launch" || frame.phase==="space") {
        camera.position.copyFrom(desiredPosition);
        target.copyFrom(desiredTarget);
      } else {
        camera.position=Vector3.Lerp(camera.position,desiredPosition,blend);
        target.copyFrom(Vector3.Lerp(target,desiredTarget,blend));
      }
      camera.setTarget(target);
      if(lastPhase!==frame.phase) {
        overlay.dataset.phase=frame.phase;
        lastPhase=frame.phase;
      }
      if(lastCount!==frame.countdown) {
        count.textContent=frame.countdown?String(frame.countdown):"";
        lastCount=frame.countdown;
      }
    },
    reset,
    dispose():void {
      reset();overlay.remove();camera.dispose();launch.glow.dispose();launch.dockLight.dispose();
      sea.material=null;sea.dispose();
      launch.root.dispose(false,true);backdrop.root.dispose(false,true);
    },
  };
}
