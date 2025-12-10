(async function(){
  try {
    const res = await fetch('http://localhost:5005/api/mock-data');
    const data = await res.json();
    const namesToFind = ['Heeralal','Indranil','Monalisa','Neeraj','Rajiv','Sanjay'];
    const matches = Object.entries(data.professors || {}).filter(([k,v]) => {
      const n = (v && v.name) || '';
      return namesToFind.some(s => n.includes(s));
    }).map(([k,v]) => ({ key:k, name: v.name, email: v.email, department: v.department, branch: v.branch }));
    console.log(JSON.stringify({ count: Object.keys(data.professors || {}).length, matches }, null, 2));
  } catch (e) {
    console.error('Failed to fetch mock-data:', e);
    process.exit(2);
  }
})();
