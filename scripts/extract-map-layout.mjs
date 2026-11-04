import fs from 'node:fs';
const geometry=JSON.parse(fs.readFileSync('data/raw/map12-geometry.json','utf8'));
const structures=geometry['{1a6acaf2}'].items, navigation=geometry['{ae4b7fbc}'].items;
const point=(collection,id)=>{
 const t=collection[id]?.transform?.[3];
 if(!t||!Number.isFinite(t[0])||!Number.isFinite(t[2]))throw new Error('Missing map locator '+id);
 return {sourceId:id,x:t[0],z:t[2]};
};
const records={
 blue:['{aae895bb}','{f015915d}','{581e2793}','{052f87a6}','{6bab1cf3}','{6c362bb8}','{1751c4b1}','{f2e5e481}'],
 red:['{cc789acd}','{9117fe96}','{120cec6c}','{6874be90}','{8c015182}','{f028c8b0}','{b543eeb7}','{ab661f31}'],
};
const names=['outer','inner','inhibitor','nexusA','nexusB','nexus','barracks','spawn'];
const data={patch:'16.21',source:'https://raw.communitydragon.org/16.21/game/data/maps/mapgeometry/map12/base.materials.bin.json',
 bounds:{min:geometry['Maps/MapGeometry/Map12/Base'].boundsMin,max:geometry['Maps/MapGeometry/Map12/Base'].boundsMax},
 teams:Object.fromEntries(Object.entries(records).map(([team,ids])=>[team,Object.fromEntries(ids.map((id,i)=>[names[i],point(i===7?navigation:structures,id)]))]))};
fs.writeFileSync('data/howling-abyss-layout.json',JSON.stringify(data,null,2)+'\n');
console.log('Extracted 12 structures, 2 barracks and 2 spawn points from Map12.');
