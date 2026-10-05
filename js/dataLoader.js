const dataLoader={
  meta:null,
  norm(v){
    const s=String(v??'').trim().toUpperCase();
    return /^\d+$/.test(s)?s.padStart(6,'0'):s;
  },
  base(){
    return `${location.origin}/MY-HI-AWARD/`;
  },
  async init(){
    try{
      const r=await fetch(`${this.base()}data/meta.json?ts=${Date.now()}`,{cache:'no-store'});
      this.meta=r.ok?await r.json():null;
    }catch(e){
      console.warn('meta load failed',e);
      this.meta=null;
    }
  },
  async get(code){
    code=this.norm(code);
    const prefix=code.slice(0,3);
    const url=`${this.base()}data/planner/${encodeURIComponent(prefix)}/${encodeURIComponent(code)}.json?ts=${Date.now()}`;
    const r=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    if(r.status===404)return null;
    if(!r.ok)throw new Error(`PLANNER_LOAD_FAILED_${r.status}`);
    const rec=await r.json();
    return rec&&this.norm(rec.code)===code?rec:null;
  }
};
