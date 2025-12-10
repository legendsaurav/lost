(async ()=>{
  try{
    const deptName='Electronics&Electical Communication Engineering';
    const deptId='dept-electronics-electical-communication-engineering';
    const resp = await fetch('http://localhost:5005/api/mock-data');
    if(!resp.ok) throw new Error('Failed to fetch mock-data: '+resp.status);
    const data = await resp.json();
    const profs = Object.values(data.professors || {});
    const candidates = profs.filter(p=> p.department && /elect/i.test(p.department));
    console.log('Found', candidates.length, 'professors with department mentioning "elect"');
    if(candidates.length===0){ console.log('No candidates to update. Exiting.'); return; }
    for(const p of candidates){
      const payload = { ...p };
      // ensure minimal safe payload
      payload.departmentId = deptId;
      payload.departmentName = deptName;
      payload.branchName = (data.branches && data.branches[p.branch] && data.branches[p.branch].name) ? data.branches[p.branch].name : (p.branch || 'General ECE');
      // remove server-only fields
      delete payload.id; delete payload._id; delete payload.__v;
      const r = await fetch('http://localhost:5005/datas/update',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const text = await r.text();
      console.log('Updated', p.name, '=>', r.status, text.slice(0,200));
    }

    // re-fetch to show changes
    const r2 = await fetch('http://localhost:5005/api/mock-data'); const d2 = await r2.json();
    const updated = Object.values(d2.professors || {}).filter(p=> p.departmentId===deptId || (p.department && /elect/i.test(p.department)) );
    console.log('\nCurrently assigned to', deptId, ':');
    updated.forEach(p=> console.log(p.name,'->',p.branch,'departmentId=',p.departmentId));
  }catch(e){ console.error('Error', e); process.exit(1); }
})();
