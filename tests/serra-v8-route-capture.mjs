import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Inspeção isolada: o arquivo V8 original permanece idêntico.
const SOURCE='Serra_do_Eter_World_Evolution_V8.html';
const ROOT='artifacts/inspecao-completa';
const original=fs.readFileSync(SOURCE,'utf8');
const marker="camera(3);boot.style.display='none';requestAnimationFrame(frame);";
if(!original.includes(marker))throw Error('Marcador do jogo não encontrado.');
const hook=[
  'window.__sdeQA={',
  ' routes:routes.map((r,i)=>({id:i,name:r.name,length:r.length})),',
  ' visit(id,meters,mode=3){',
  '   const q=sample(routes[id],meters);',
  '   car.x=q.x;car.z=q.z;car.y=q.h+.38;car.yaw=q.yaw;car.speed=0;',
  '   car.pitch=0;car.roll=0;autopilot=false;ready=false;camera(mode);',
  '   return {x:car.x,z:car.z,y:car.y};',
  ' },',
  ' sector(x,z){',
  '   car.x=cl(x,4,WORLD-4);car.z=cl(z,4,WORLD-4);',
  '   car.y=ground(car.x,car.z)+.38;car.yaw=0;car.speed=0;',
  '   car.pitch=0;car.roll=0;autopilot=false;ready=false;camera(3);',
  '   return {x:car.x,z:car.z,y:car.y,water:water(car.x,car.z)};',
  ' },',
  ' ready(){',
  '   const x=Math.floor(car.x/TILE),z=Math.floor(car.z/TILE);',
  '   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){',
  '     if(x+i<0||z+j<0||x+i>=28||z+j>=28)continue;',
  '     const c=chunks.get(key(x+i,z+j));if(!c||c.lod!==0)return false;',
  '   } return true;',
  ' },',
  ' grades(id){',
  '   const r=routes[id];let max=0,mismatch=0,invalid=0;',
  '   for(let i=0;i<r.pts.length;i++){const a=r.pts[i];const g=ground(a.x,a.z);',
  '     if(!Number.isFinite(g))invalid++;mismatch=Math.max(mismatch,Math.abs(g-a.h));',
  '     if(i){const b=r.pts[i-1];max=Math.max(max,Math.abs(a.h-b.h)/Math.max(.001,Math.hypot(a.x-b.x,a.z-b.z)));}',
  '   }return {name:r.name,length:r.length,maxGradePercent:max*100,mismatch,invalid};',
  ' },',
  ' car(){return {...car,region:region(),chunks:chunks.size};}',
  '};'
].join('\n');
const instrumented=original.replace(marker,hook+'\n'+marker);
await mkdir(ROOT+'/roads',{recursive:true});
await mkdir(ROOT+'/regions',{recursive:true});
const issues=[],shots=[],roads=[];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox','--disable-dev-shm-usage']});
async function shot(page,folder,name,info) {
  await page.waitForFunction(()=>window.__sdeQA.ready(),{timeout:45000});
  await page.waitForTimeout(180);
  const rel=folder+'/'+name+'.jpg';
  const buffer=await page.screenshot({path:ROOT+'/'+rel,type:'jpeg',quality:76,animations:'disabled'});
  const stats=await sharp(buffer).stats();
  const contrast=Math.max(...stats.channels.slice(0,3).map(c=>c.stdev));
  if(contrast<8)issues.push('Imagem quase uniforme: '+rel);
  shots.push({file:rel,contrast:Math.round(contrast),...info});
}
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
let locations=0;
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>issues.push('JavaScript: '+e.message));
  page.on('console',m=>{if(m.type()==='error')issues.push('Console: '+m.text());});
  await page.route('**/Serra_do_Eter_World_Evolution_V8.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:instrumented}));
  await page.goto('http://127.0.0.1:8765/Serra_do_Eter_World_Evolution_V8.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__sdeQA?.routes?.length===8&&document.getElementById('boot')?.style.display==='none',{timeout:60000});
  const webgl=await page.evaluate(()=>{const gl=document.getElementById('world').getContext('webgl');return gl&&!gl.isContextLost()});
  if(!webgl)throw Error('WebGL não inicializou');

  const routeList=await page.evaluate(()=>window.__sdeQA.routes);
  for(const r of routeList){
    const q=await page.evaluate(id=>window.__sdeQA.grades(id),r.id);roads.push(q);
    if(q.invalid||q.mismatch>2||q.maxGradePercent>16)issues.push('Problema de geometria: '+q.name);
    const n=Math.max(6,Math.min(15,Math.ceil(r.length/580)));
    for(let i=0;i<=n;i++){
      const d=r.length*i/n;
      const mode=i===0?0:i===Math.ceil(n/2)?4:3;
      const pos=await page.evaluate(({id,d,mode})=>window.__sdeQA.visit(id,d,mode),{id:r.id,d,mode});
      await shot(page,'roads',String(r.id+1).padStart(2,'0')+'-'+slug(r.name)+'-'+String(i).padStart(2,'0'),{route:r.name,distance:Math.round(d),mode,...pos});
    }
    // Teste real de comando de aceleração em cada rodovia.
    await page.evaluate(id=>window.__sdeQA.visit(id,Math.min(100,window.__sdeQA.routes[id].length/4),0),r.id);
    await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
    const speed=await page.evaluate(()=>window.__sdeQA.car().speed);
    if(!(speed>0))issues.push('Aceleração falhou em '+r.name);
    await page.keyboard.down('s');await page.waitForTimeout(260);await page.keyboard.up('s');
    console.log('RODOVIA',r.name,'distância',Math.round(r.length),'inclinação máxima',q.maxGradePercent.toFixed(1)+'%');
  }
  // Grade espacial: amostragem do mundo além das estradas.
  for(const x of [600,1800,3000,4200,5400,6600])for(const z of [650,1750,2850,3950,5050,5750]){
    const pos=await page.evaluate(({x,z})=>window.__sdeQA.sector(x,z),{x,z});
    if(pos.water)continue;
    locations++;
    await shot(page,'regions','setor-'+String(locations).padStart(2,'0')+'-'+x+'-'+z,{sector:locations,...pos});
  }
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  phone.on('pageerror',e=>issues.push('Mobile: '+e.message));
  await phone.route('**/Serra_do_Eter_World_Evolution_V8.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:instrumented}));
  await phone.goto('http://127.0.0.1:8765/Serra_do_Eter_World_Evolution_V8.html',{waitUntil:'load'});
  await phone.waitForFunction(()=>window.__sdeQA?.ready(),{timeout:60000});
  await phone.screenshot({path:ROOT+'/regions/visual-mobile.jpg',type:'jpeg',quality:78});
  shots.push({file:'regions/visual-mobile.jpg',mobile:true});
  if(!(await phone.locator('.touch').isVisible()))issues.push('Controles touch não visíveis.');
  await phone.close();
}catch(e){issues.push('Falha fatal: '+e.message);console.error(e);}finally{await browser.close();}

const output={routes:roads,shots:shots.length,regions:locations,issues,passed:!issues.length,
  caveat:'Capturas de Chromium WebGL; movimento de inspeção assistido, não direção manual de cada metro. Não comprova ausência total de bugs.'};
await writeFile(ROOT+'/relatorio.json',JSON.stringify(output,null,2),'utf8');
const title='Serra do Éter — Inspeção da V8';
const gallery=shots.map(s=>'<figure><a href="'+s.file+'"><img loading="lazy" src="'+s.file+'"></a><figcaption>'+s.file+' · '+(s.route||'setor')+'</figcaption></figure>').join('\n');
const page='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>body{background:#11271e;color:#edf4e9;font:14px system-ui;margin:25px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}figure{background:#244132;border-radius:8px;margin:0;padding:7px}img{width:100%;display:block}figcaption{font-size:11px;padding:7px}</style><h1>'+title+'</h1><p>'+shots.length+' imagens | '+roads.length+' rotas | '+locations+' setores | '+issues.length+' avisos</p><main>'+gallery+'</main></html>';
await writeFile(ROOT+'/index.html',page,'utf8');
for(let start=0;start<shots.length;start+=20){
  const group=shots.slice(start,start+20),layers=[];
  for(let k=0;k<group.length;k++){
    const x=k%4*320,y=Math.floor(k/4)*212;
    const img=await sharp(ROOT+'/'+group[k].file).resize(320,186,{fit:'cover'}).jpeg({quality:75}).toBuffer();
    const label=group[k].file.slice(-39).replaceAll('&','&amp;').replaceAll('<','&lt;');
    const txt=Buffer.from('<svg width="320" height="26"><rect width="320" height="26" fill="#142e24"/><text x="7" y="18" fill="#f1f3e8" font-family="sans-serif" font-size="11">'+label+'</text></svg>');
    layers.push({input:img,left:x,top:y},{input:txt,left:x,top:y+186});
  }
  await sharp({create:{width:1280,height:Math.ceil(group.length/4)*212,channels:3,background:'#142e24'}})
    .composite(layers).jpeg({quality:83}).toFile(ROOT+'/montagem-'+String(start/20+1).padStart(2,'0')+'.jpg');
}
console.log('RESULTADO',JSON.stringify({images:shots.length,roads:roads.length,regions:locations,passed:!issues.length,issues},null,2));
if(issues.length)process.exitCode=1;
