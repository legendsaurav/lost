(async ()=>{
  try{
    const TARGET_NAME = 'Electronics&Electical Communication Engineering';
    const res = await fetch('http://localhost:5005/api/mock-data');
    if(!res.ok) throw new Error('Failed to fetch mock-data: '+res.status);
    const data = await res.json();
    const branches = data.branches || {};
    const profs = Object.values(data.professors || {});
    const matches = profs.filter(p => p.department === TARGET_NAME || (p.department && p.department.includes('Electr') && p.department.includes('Electic')) );
    if(matches.length===0){
      console.log('No professors found with department "'+TARGET_NAME+'"');
      return;
    }

    // create a safe id from the department name
    const makeId = (name)=> 'dept-' + name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const deptId = makeId(TARGET_NAME);
    const deptName = TARGET_NAME.replace(/&/g,' & ');

    console.log('Found', matches.length, 'professors. Using departmentId=',deptId);

    for(const p of matches){
      const payload = {
        ...p,
        departmentId: deptId,
        departmentName: deptName,
        // ensure branchName is present so server creates branch document if missing
        branchName: (branches[p.branch] && branches[p.branch].name) ? branches[p.branch].name : (p.branch || 'Unknown')
      };

      // Clean up fields the server might not like (_id etc)
      delete payload.id;
      delete payload._id;

      const r = await fetch('http://localhost:5005/datas/update', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const txt = await r.text();
      console.log('Updated', p.name, '=>', r.status, txt.slice(0,200));
    }

    // fetch again to show department branches
    const post = await fetch('http://localhost:5005/api/mock-data');
    const d2 = await post.json();
    const dept = d2.departments.find(x=>x.id===deptId);
    console.log('\nDepartment record:', dept);
    const profsNow = Object.values(d2.professors || {}).filter(pp=>pp.departmentId===deptId || pp.department===TARGET_NAME);
    console.log('Professors now assigned to new department:');
    profsNow.forEach(pp=> console.log(pp.name,'->',pp.branch,'/',pp.departmentId || pp.department));

  }catch(e){
    console.error('Error:',e);
    process.exit(1);
  }
})();
