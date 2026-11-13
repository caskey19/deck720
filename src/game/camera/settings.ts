export type CameraSettings = { height: number; distance: number; angle: number; fov: number; speedFov: boolean; sensitivity: number }
export const DEFAULT_CAMERA: CameraSettings = {height:1.3,distance:4.3,angle:0,fov:58,speedFov:true,sensitivity:0.35}
const KEY='deck7.camera'
export function loadCamera(): CameraSettings {
  try { return sanitizeCamera({...DEFAULT_CAMERA,...JSON.parse(localStorage.getItem(KEY)??'{}')}) } catch { return {...DEFAULT_CAMERA} }
}
export function sanitizeCamera(value: CameraSettings): CameraSettings {
  const bound=(n:number,min:number,max:number,fallback:number)=>Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback
  return {height:bound(value.height,0.8,3,1.3),distance:bound(value.distance,2.8,8,4.3),angle:bound(value.angle,-25,25,0),fov:bound(value.fov,45,80,58),speedFov:typeof value.speedFov==='boolean'?value.speedFov:true,sensitivity:bound(value.sensitivity,0.1,1,0.35)}
}
export function saveCamera(value: CameraSettings): void { try {localStorage.setItem(KEY,JSON.stringify(sanitizeCamera(value)))} catch { /* preferences remain active in memory */ } }
/** Wrapped yaw, damped response and a hard rate limit prevent camera snaps. */
export function followYaw(current: number,target: number,dt: number,airborne: boolean): number {
  let delta=target-current
  while(delta>Math.PI)delta-=Math.PI*2
  while(delta< -Math.PI)delta+=Math.PI*2
  const step=delta*(1-Math.exp(-(airborne?1.5:2.2)*dt))
  const limit=(airborne?0.65:0.95)*dt
  return current+Math.max(-limit,Math.min(limit,step))
}
