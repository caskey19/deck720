import * as THREE from 'three'
import { Rider } from '../rider/Rider'
import { buildTheYard } from '../park/TheYard'
import { batchPark } from '../park/batch'
import { lightPark,followSun } from '../park/atmosphere'
import { disposeObject } from '../park/dispose'
import type { KitSelection } from '../../storage/persist'

/** Original live skate courtyard, with a dressed rider holding their actual board. */
export class LobbyStage {
  readonly scene=new THREE.Scene()
  readonly camera=new THREE.PerspectiveCamera(32,1,0.1,700)
  private rider=new Rider()
  private width=0
  private height=0
  private rotation=0
  constructor(kit: KitSelection){
    this.scene.add(batchPark(buildTheYard()).group)
    this.rider.applyKit(kit);this.rider.group.position.set(0,0.12,120)
    this.scene.add(this.rider.group)
    const sun=lightPark(this.scene,'the-yard');followSun(sun,this.rider.group.position)
    this.scene.fog=new THREE.Fog('#c1beb0',45,180)
  }
  rotate(delta: number): void {this.rotation+=delta}
  render(renderer: THREE.WebGLRenderer,time: number): void {
    const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight
    if(width!==this.width||height!==this.height){
      this.width=width;this.height=height;this.camera.aspect=width/height
      const mobile=width<760
      this.camera.fov=mobile?38:32
      const x=mobile?0:-0.75
      this.camera.position.set(x,1.18,mobile?125.8:125.4)
      this.camera.lookAt(x,mobile?0.6:0.98,120);this.camera.updateProjectionMatrix()
    }
    this.rider.setLobbyPose(time)
    this.rider.group.rotation.y=this.rotation
    renderer.render(this.scene,this.camera)
  }
  dispose(): void {disposeObject(this.scene)}
}
