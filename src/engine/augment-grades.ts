import snapshot from '../../data/augment-grades.json';
export function augmentGrade(champion:string,name:string){
 const source=(snapshot.champions as Record<string,{url:string;grades:Record<string,string>}>)[champion];
 const clean=name.replace(/\s*\([★☆-]+\)/g,'');
 return {grade:source?.grades[clean],url:source?.url,patch:snapshot.patch};
}
