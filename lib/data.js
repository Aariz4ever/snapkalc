export const K=[["cal","Calories","kcal"],["pro","Protein","g"],["carb","Carbs","g"],["fat","Fat","g"],["fib","Fiber","g"],["sug","Sugar","g"],["na","Sodium","mg"],["k","Potassium","mg"],["ca","Calcium","mg"],["fe","Iron","mg"],["mg","Magnesium","mg"],["zn","Zinc","mg"],["va","Vitamin A","mcg"],["vc","Vitamin C","mg"],["vd","Vitamin D","mcg"],["b12","Vitamin B12","mcg"],["chol","Cholesterol","mg"]];
export const MEALS=["Breakfast","Lunch","Snack","Dinner"];
export const LIM={sug:1,na:1,chol:1};
export const COL={cal:"#ffffff",pro:"#4ade80",fib:"#c73e1d",carb:"#b8835a",fat:"#facc15"};
export const colorOf=k=>COL[k]||"#60a5fa";
export const T0={cal:1900,pro:140,carb:200,fat:50,fib:30,sug:50,na:2300,k:3500,ca:1000,fe:18,mg:400,zn:11,va:800,vc:90,vd:15,b12:2.4,chol:300};
export const U0=[["g","metric",1],["ml","metric",1],["teaspoon","metric",5],["tablespoon","metric",15],["cup","metric",240],["piece","piece",1],["slice","slice",1],["serving","serving",1]].map(([u,g,f])=>({u,g,f}));
// Scale a log entry against the food database; mirrors the spreadsheet's unit-conversion logic.
export function calc(S,r){
  const f=S.foods.find(x=>x.n===r.food);
  if(!f||r.qty===""||!(r.qty>=0))return{ok:false};
  let m=1;
  if(r.unit){const a=S.units.find(x=>x.u===r.unit),b=S.units.find(x=>x.u===f.u);
    if(!a||!b||a.g!==b.g)return{ok:false};m=a.f/b.f}
  const sc=r.qty*m/f.a;return{ok:true,v:f.v.map(x=>x*sc),base:f.u};
}
export const dayKey=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);

// Upgrade any saved state (older versions had per-date logs and 16 nutrients) to the single-day shape.
export function migrate(s,FOODS){
  if(!s||!s.foods)return{foods:FOODS,units:U0,targets:{...T0},log:[]};
  const foods=s.foods.map(f=>f.v.length>=K.length?f:{...f,v:[...f.v,...Array(K.length-f.v.length).fill(0)].map((x,i)=>i===16&&f.v.length===16?((FOODS.find(d=>d.n===f.n)||{v:[]}).v[16]||0):x)});
  return{foods,units:s.units||U0,targets:{...T0,...s.targets},log:s.log||(s.days&&s.days[dayKey(new Date())])||[]};
}
