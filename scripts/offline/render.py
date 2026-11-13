"""Optional offline review of source geometry. Approximate PBR, not a gameplay screenshot.
Requires moderngl, Pillow and numpy, plus an EGL/Mesa implementation.
"""
import base64, io, json, sys
from pathlib import Path
import moderngl
import numpy as np
from PIL import Image, ImageDraw

src=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/deck7-scenes')
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/deck7-offline');out.mkdir(parents=True,exist_ok=True)
ctx=moderngl.create_standalone_context(backend='egl')
width,height=1280,720
program=ctx.program(vertex_shader='''#version 330
in vec3 position;in vec3 normal;in vec2 uv;
uniform mat4 vp;uniform mat4 shadow_matrix;
out vec3 world;out vec3 n;out vec2 tex_uv;out vec4 shadow_coord;
void main(){world=position;n=normal;tex_uv=uv;shadow_coord=shadow_matrix*vec4(position,1.);gl_Position=vp*vec4(position,1.);}
''',fragment_shader='''#version 330
in vec3 world;in vec3 n;in vec2 tex_uv;in vec4 shadow_coord;
uniform vec3 color;uniform vec3 sun;uniform vec3 camera;uniform vec3 fog_color;uniform vec3 fill_color;uniform vec3 sun_color;
uniform float fog_near;uniform float fog_far;uniform float sun_power;uniform float metalness;uniform bool has_map;
uniform sampler2D color_map;uniform sampler2D shadow_map;
out vec4 frag;
vec3 srgb(vec3 c){return pow(max(c,vec3(0)),vec3(2.2));}
vec3 aces(vec3 c){return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.,1.);}
void main(){
 vec3 base=color*(has_map?srgb(texture(color_map,tex_uv).rgb):vec3(1.));
 vec3 normal=normalize(n);if(!gl_FrontFacing)normal=-normal;
 vec3 p=shadow_coord.xyz/shadow_coord.w;float shadow=1.;
 if(p.x>0.&&p.x<1.&&p.y>0.&&p.y<1.&&p.z>0.&&p.z<1.){
  float sum=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(shadow_map,p.xy+vec2(x,y)/2048.).r;sum+=p.z-0.001>d?0.:1.;}shadow=sum/9.;
 }
 float diffuse=max(dot(normal,sun),0.);
 vec3 ambient=mix(vec3(0.25,0.23,0.19),fill_color,normal.y*0.5+0.5)*0.8;
 vec3 lit=base*(ambient+sun_color*sun_power*0.32*diffuse*shadow);
 vec3 view=normalize(camera-world),halfway=normalize(sun+view);
 lit+=mix(vec3(0.04),base,metalness)*pow(max(dot(normal,halfway),0.),24.)*shadow*0.25;
 float fog=clamp((length(world-camera)-fog_near)/(fog_far-fog_near),0.,1.);
 lit=mix(lit,fog_color,fog);frag=vec4(pow(aces(lit*1.15),vec3(1./2.2)),1.);
}
''')
depth_program=ctx.program(vertex_shader='''#version 330
in vec3 position;uniform mat4 light_vp;void main(){gl_Position=light_vp*vec4(position,1.);}
''',fragment_shader='''#version 330
void main(){}
''')
sky_program=ctx.program(vertex_shader='''#version 330
in vec2 position;out vec2 uv;void main(){uv=position*0.5+0.5;gl_Position=vec4(position,0.,1.);}
''',fragment_shader='''#version 330
in vec2 uv;out vec4 frag;uniform vec3 top;uniform vec3 horizon;
vec3 aces(vec3 c){return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.,1.);}
void main(){vec3 color=mix(horizon,top,pow(clamp(uv.y*0.9,0.,1.),0.65));frag=vec4(pow(aces(color*1.15),vec3(1./2.2)),1.);}
''')
quad=ctx.vertex_array(sky_program,[(ctx.buffer(np.array([-1,-1,3,-1,-1,3],dtype='f4').tobytes()),'2f','position')])
def linear(hex):return tuple((int(hex[i:i+2],16)/255)**2.2 for i in (1,3,5))
frames=[]
for file in sorted(src.glob('*.json')):
 data=json.loads(file.read_text());look=data['look']
 color_buffer=ctx.texture((width,height),4);depth=ctx.depth_renderbuffer((width,height));framebuffer=ctx.framebuffer([color_buffer],depth)
 shadow=ctx.depth_texture((2048,2048));shadow.compare_func='';shadow.repeat_x=shadow.repeat_y=False;shadow.filter=(moderngl.NEAREST,moderngl.NEAREST)
 shadow_frame=ctx.framebuffer(depth_attachment=shadow)
 gpu=[]
 for mesh in data['meshes']:
  vertices=np.array(mesh['vertices'],dtype='f4').reshape(-1,8);vbo=ctx.buffer(vertices.tobytes())
  main_vao=ctx.vertex_array(program,[(vbo,'3f 3f 2f','position','normal','uv')]);shadow_vao=ctx.vertex_array(depth_program,[(vbo,'3f 20x','position')])
  gpu.append((mesh,main_vao,shadow_vao,vbo))
 shadow_frame.use();ctx.viewport=(0,0,2048,2048);shadow_frame.clear(depth=1);ctx.enable(moderngl.DEPTH_TEST);ctx.disable(moderngl.CULL_FACE)
 depth_program['light_vp'].write(np.array(data['lightVP'],dtype='f4').tobytes())
 for mesh,_,vao,_ in gpu:
  if mesh['cast']:vao.render(moderngl.TRIANGLES)
 framebuffer.use();ctx.viewport=(0,0,width,height);framebuffer.clear(0,0,0,1,depth=1)
 ctx.disable(moderngl.DEPTH_TEST)
 if data.get('sky'):
  sky=data['sky']
  vertex='#version 330\nin vec3 position;uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;\n'+sky['vertex'].replace('varying','out')
  fragment='#version 330\nout vec4 frag;vec3 offlineAces(vec3 c){return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.,1.); }\n'+sky['fragment'].replace('varying','in').replace('gl_FragColor','frag').replace('#include <tonemapping_fragment>','frag.rgb=offlineAces(frag.rgb*1.15);').replace('#include <colorspace_fragment>','frag.rgb=pow(frag.rgb,vec3(1./2.2));')
  actual_sky=ctx.program(vertex_shader=vertex,fragment_shader=fragment)
  actual_sky['projectionMatrix'].write(np.array(sky['projection'],dtype='f4').tobytes());actual_sky['modelViewMatrix'].write(np.array(sky['modelView'],dtype='f4').tobytes());actual_sky['top'].value=sky['top'];actual_sky['horizon'].value=sky['horizon']
  sky_vbo=ctx.buffer(np.array(sky['positions'],dtype='f4').tobytes());sky_vao=ctx.vertex_array(actual_sky,[(sky_vbo,'3f','position')]);ctx.disable(moderngl.CULL_FACE);sky_vao.render(moderngl.TRIANGLES)
  sky_vao.release();sky_vbo.release();actual_sky.release()
 else:
  sky_program['top'].value=linear(look['sky']);sky_program['horizon'].value=linear(look['horizon']);quad.render(moderngl.TRIANGLES)
 ctx.enable(moderngl.DEPTH_TEST)
 for uniform,key in [('vp','vp'),('shadow_matrix','shadowMatrix')]:program[uniform].write(np.array(data[key],dtype='f4').tobytes())
 program['sun'].value=data['sun'];program['camera'].value=data['camera'];program['fog_color'].value=linear(look['fog']);program['fill_color'].value=linear(look['fill']);program['sun_color'].value=linear(look['sun']);program['sun_power'].value=look['power'];program['fog_near'].value=look['near'];program['fog_far'].value=look['far']
 program['color_map'].value=0;program['shadow_map'].value=1;shadow.use(1)
 maps=[]
 for encoded in data['textures']:
  image=Image.open(io.BytesIO(base64.b64decode(encoded))).convert('RGB').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  texture=ctx.texture(image.size,3,image.tobytes());texture.build_mipmaps();texture.repeat_x=texture.repeat_y=True;maps.append(texture)
 white=ctx.texture((1,1),3,b'\xff\xff\xff')
 for mesh,vao,_,_ in gpu:
  material=data['materials'][mesh['material']];program['color'].value=material['color'];program['metalness'].value=material.get('metalness',0);program['has_map'].value=material['map']>=0
  (maps[material['map']] if material['map']>=0 else white).use(0)
  if material['doubleSide']:ctx.disable(moderngl.CULL_FACE)
  else:ctx.enable(moderngl.CULL_FACE)
  vao.render(moderngl.TRIANGLES)
 image=Image.frombytes('RGBA',(width,height),framebuffer.read(components=4)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB')
 draw=ImageDraw.Draw(image);draw.rectangle((0,0,750,36),fill='#172627');draw.text((12,10),data['name']+' | OFFLINE GEOMETRY REVIEW | APPROXIMATE LIGHTING',fill='#f2dfb9')
 image.save(out/(data['name']+'.png'));frames.append(image.resize((640,360)))
 for _,a,b,vbo in gpu:a.release();b.release();vbo.release()
 for texture in maps:texture.release()
 white.release();framebuffer.release();color_buffer.release();depth.release();shadow_frame.release();shadow.release()
 print(file.stem+': rendered offline',flush=True)
sheet=Image.new('RGB',(1280,1080),'#172627')
for i,frame in enumerate(frames):sheet.paste(frame,((i%2)*640,(i//2)*360))
if len(frames)<6:ImageDraw.Draw(sheet).text((660,800),'Actual source meshes and textures\nApproximate offline illumination\nNot a browser gameplay capture',fill='#f2dfb9')
sheet.save(out/'contact-sheet.png')
