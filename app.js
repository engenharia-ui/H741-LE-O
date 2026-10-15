import * as THREE from 'https://unpkg.com/three@0.181.0/build/three.module.js';
import {OrbitControls} from 'https://unpkg.com/three@0.181.0/examples/jsm/controls/OrbitControls.js';
import {IfcAPI} from 'https://unpkg.com/web-ifc@0.0.77/web-ifc-api.js';
const $=s=>document.querySelector(s); const status=t=>{$('#status').textContent=t};
const scene=new THREE.Scene();scene.background=new THREE.Color(0xf2f3f5);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.01,1e8);camera.up.set(0,1,0);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.localClippingEnabled=true;$('#view').append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x9da9b5,2.1));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(100,120,220);scene.add(sun);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.rotateSpeed=.65;controls.screenSpacePanning=true;controls.minPolarAngle=.03;controls.maxPolarAngle=Math.PI/2-.02;
const root=new THREE.Group();scene.add(root);const meshes=[],materialCache=new Map(),clip=new THREE.Plane(new THREE.Vector3(1,0,0),1e9);
const bounds=new THREE.Box3(),center=new THREE.Vector3(),dim=new THREE.Vector3(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let api,mid,base=10,selected=null,measure=false,cut=false,points=[],measureVisuals=[],cutAxis='x';
function mat(c){let k=[c.x,c.y,c.z,c.w].join('-');if(!materialCache.has(k)){const m=new THREE.MeshPhongMaterial({color:new THREE.Color(c.x,c.y,c.z),side:THREE.DoubleSide,transparent:c.w<1,opacity:c.w});m.clippingPlanes=[clip];materialCache.set(k,m)}return materialCache.get(k)}
function build(p,id,geomCache){let geom=geomCache.get(p.geometryExpressID);if(!geom){const g=api.GetGeometry(mid,p.geometryExpressID);const v=api.GetVertexArray(g.GetVertexData(),g.GetVertexDataSize()),idx=api.GetIndexArray(g.GetIndexData(),g.GetIndexDataSize());const pos=new Float32Array(v.length/2),normal=new Float32Array(v.length/2);for(let i=0,j=0;i<v.length;i+=6,j+=3){pos[j]=v[i];pos[j+1]=v[i+1];pos[j+2]=v[i+2];normal[j]=v[i+3];normal[j+1]=v[i+4];normal[j+2]=v[i+5]};geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(pos,3));geom.setAttribute('normal',new THREE.BufferAttribute(normal,3));geom.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1));geomCache.set(p.geometryExpressID,geom);g.delete?.()};const m=new THREE.Mesh(geom,mat(p.color));m.applyMatrix4(new THREE.Matrix4().fromArray(p.flatTransformation));m.userData.id=id;root.add(m);meshes.push(m);bounds.expandByObject(m)}
function fit(which='iso'){
  if(!meshes.length)return;
  bounds.getCenter(center);bounds.getSize(dim);
  // web-ifc emite geometria Y-up: câmera e controles devem usar Y como vertical.
  camera.up.set(0,1,0);
  base=Math.max(dim.length()*1.55,1);controls.minDistance=Math.max(dim.length()*.01,.01);controls.maxDistance=base*15;
  // A vista superior olha de +Y, com vetor up coerente e sem inversão.
  const v=which==='top'?new THREE.Vector3(0,1,.005)
    :which==='front'?new THREE.Vector3(0,.10,1)
    :which==='right'?new THREE.Vector3(1,.10,0)
    :new THREE.Vector3(.95,.85,1.15);
  camera.position.copy(center).addScaledVector(v.normalize(),base);
  camera.near=Math.max(base/10000,.001);camera.far=base*100;camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  camera.lookAt(center);
  controls.update();
}
function clearMeasure(){points=[];for(const m of measureVisuals){scene.remove(m);m.geometry?.dispose()}measureVisuals=[];$('#distance').textContent='Distância: —'}
function hit(e){let r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(meshes,false)[0]}
function addMeasure(p){if(points.length===2)clearMeasure();points.push(p.clone());const d=new THREE.Mesh(new THREE.SphereGeometry(Math.max(base*.0017,.001),8,8),new THREE.MeshBasicMaterial({color:0xe55b13,depthTest:false}));d.position.copy(p);scene.add(d);measureVisuals.push(d);if(points.length===2){const g=new THREE.BufferGeometry().setFromPoints(points);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xe55b13,depthTest:false}));scene.add(l);measureVisuals.push(l);const n=points[0].distanceTo(points[1]);$('#distance').textContent=`Distância: ${n.toFixed(3)} unidades geométricas do IFC`}}
let down;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;let h=hit(e);if(!h)return;if(measure){addMeasure(h.point);return}if(selected){selected.material=selected.userData.oldMaterial}selected=h.object;selected.userData.oldMaterial=selected.material;selected.material=new THREE.MeshBasicMaterial({color:0xf59a24,side:THREE.DoubleSide,clippingPlanes:[clip]});try{const p=api.GetLine(mid,selected.userData.id,true),v=k=>p[k]?.value??p[k]??'';$('#info').textContent=`Tipo: ${api.GetNameFromTypeCode(p.type)}\nNome: ${v('Name')||'—'}\nDescrição: ${v('Description')||'—'}\nID IFC: ${selected.userData.id}`}catch{$('#info').textContent=`ID IFC: ${selected.userData.id}`}});
function updateCut(){const t=Number($('#slider').value)/100,axis={x:0,y:1,z:2}[cutAxis],low=bounds.min.getComponent(axis),hi=bounds.max.getComponent(axis);clip.normal.set(cutAxis==='x'?1:0,cutAxis==='y'?1:0,cutAxis==='z'?1:0);clip.constant=cut?-low-(hi-low)*t:1e9;}
for(const e of document.querySelectorAll('[data-view]'))e.onclick=()=>fit(e.dataset.view);
$('#btn-cut').onclick=()=>{cut=!cut;$('#btn-cut').classList.toggle('active',cut);updateCut()};$('#slider').oninput=updateCut;$('#axis').onchange=e=>{cutAxis=e.target.value;updateCut()};$('#btn-measure').onclick=()=>{measure=!measure;$('#btn-measure').classList.toggle('active',measure)};$('#clear').onclick=clearMeasure;
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera)}loop();
async function start(){try{status('Baixando IFC compactado…');const r=await fetch('./modelo.ifc.gz');if(!r.ok)throw Error('Arquivo modelo.ifc.gz não encontrado. Faça upload dele na raiz do repositório.');if(!('DecompressionStream' in window))throw Error('Use Chrome ou Edge atualizado para descompactação.');const stream=r.body.pipeThrough(new DecompressionStream('gzip'));let bytes=new Uint8Array(await new Response(stream).arrayBuffer());status('Gerando geometria BIM…');api=new IfcAPI();api.SetWasmPath('https://unpkg.com/web-ifc@0.0.77/');await api.Init();mid=api.OpenModel(bytes,{COORDINATE_TO_ORIGIN:true});bytes=null;const cache=new Map();let count=0;api.StreamAllMeshes(mid,m=>{for(let i=0;i<m.geometries.size();i++)build(m.geometries.get(i),m.expressID,cache);if(++count%1500===0)status(`${count} elementos processados…`)});if(!meshes.length)throw Error('IFC sem geometria utilizável');fit();$('#loading').remove();status(`${meshes.length.toLocaleString('pt-BR')} peças carregadas`)}catch(e){console.error(e);$('#error').textContent=e.message;status('Falha ao abrir modelo')}}start();
