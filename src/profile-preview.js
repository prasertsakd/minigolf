import * as THREE from 'three';
import { createGolferRig } from './golfer.js';
import { GolfWorld } from './world.js';

// A static preview uses the actual game rig and renders only when the choice changes.
export class ProfilePreview {
  constructor(canvas, appearance) {
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-2.5,2.5,2.1,-2.1,.1,30);
    this.camera.position.set(4,3.5,-7);this.camera.lookAt(0,1.45,0);
    this.scene.add(new THREE.HemisphereLight(0xfff8e4,0x9bb6ad,2));
    const light=new THREE.DirectionalLight(0xffe3ba,3);light.position.set(-3,6,5);this.scene.add(light);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(1.25,40),new THREE.MeshBasicMaterial({color:0x547851,transparent:true,opacity:.12}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.03;this.scene.add(ground);
    this.observer=new ResizeObserver(()=>this.render());this.observer.observe(canvas.parentElement);
    this.setAppearance(appearance);
  }
  setAppearance(appearance) {
    if(this.golfer){this.scene.remove(this.golfer);this.disposeMeshes(this.golfer);}
    const {group,...rig}=createGolferRig(appearance);
    rig.connectBone=GolfWorld.prototype.connectBone;
    GolfWorld.prototype.poseCharacter.call(rig,0,false,false);
    this.golfer=group;this.scene.add(group);this.render();
  }
  render() {
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(!width||!height)return;
    this.renderer.setSize(width,height,false);const aspect=width/height;
    this.camera.left=-2.1*aspect;this.camera.right=2.1*aspect;this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene,this.camera);
  }
  disposeMeshes(root){root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
  dispose(){this.observer.disconnect();this.disposeMeshes(this.scene);this.renderer.dispose();this.renderer.forceContextLoss();}
}
