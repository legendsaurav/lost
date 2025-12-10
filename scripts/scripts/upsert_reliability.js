(async () => {
  const payloads = [
    {
      email: 'heeralal@iitkgp.ac.in',
      name: 'Heeralal Gargama',
      branch: 'branch-rams-safety',
      branchName: 'RAMS and Safety',
      position: 'Assistant Professor',
      degree: 'PhD in Reliability Eng., IIT KGP',
      department: 'Subir Chowdhury School of Q and R',
      departmentId: 'dept-subir-chowdhury',
      departmentName: 'Subir Chowdhury School of Quality and Reliability',
      description: 'Focuses on RAMS, automotive safety, system reliability',
      photo: 'https://i.pravatar.cc/150?u=heeralal@iitkgp.ac.in',
      projects: ['UAV reliability','fault diagnosis'],
      research: ['UAV reliability','fault diagnosis in motors','functional safety'],
      companies: ['Siemens Mobility','General Electric','Honeywell','ABB','Bosch'],
      websites: ['https://www.iitkgp.ac.in/department/RE/faculty/re-heeralalgargama']
    },
    {
      email: 'indranil.hazra@iitkgp.ac.in',
      name: 'Indranil Hazra',
      branch: 'branch-risk-assessment',
      branchName: 'Risk Assessment',
      position: 'Assistant Professor',
      degree: 'PhD Civil Eng., Univ. of Waterloo',
      department: 'Subir Chowdhury School of Q and R',
      departmentId: 'dept-subir-chowdhury',
      departmentName: 'Subir Chowdhury School of Quality and Reliability',
      description: 'Focuses on risk assessment and Bayesian prognostics',
      photo: 'https://i.pravatar.cc/150?u=indranil.hazra@iitkgp.ac.in',
      projects: ['Resilient maintenance systems'],
      research: ['Autonomous system prognostics','data fusion','causal modeling'],
      companies: ['GE Aviation','Rolls-Royce','NASA','Lockheed Martin','Northrop Grumman'],
      websites: ['https://www.iitkgp.ac.in/department/RE/faculty/re-ihazra']
    },
    {
      email: 'monalisa@iitkgp.ac.in',
      name: 'Monalisa Sarma',
      branch: 'branch-sw-reliability',
      branchName: 'Software Reliability',
      position: 'Associate Professor',
      degree: 'PhD CSE, IIT KGP',
      department: 'Subir Chowdhury School of Q and R',
      departmentId: 'dept-subir-chowdhury',
      departmentName: 'Subir Chowdhury School of Quality and Reliability',
      description: 'Focuses on software reliability and cloud computing',
      photo: 'https://i.pravatar.cc/150?u=monalisa@iitkgp.ac.in',
      projects: ['Hands-free man-machine interaction'],
      research: ['HCI','emotion recognition','big data analytics'],
      companies: ['Microsoft','Google','Amazon Web Services','IBM','Oracle'],
      websites: ['https://www.iitkgp.ac.in/department/RE/faculty/re-monalisa']
    },
    {
      email: 'neerajgoyal@iitkgp.ac.in',
      name: 'Neeraj Kumar Goyal',
      branch: 'branch-network-sw-reliability',
      branchName: 'Network and SW Reliability',
      position: 'Associate Professor',
      degree: 'PhD Reliability Eng., IIT KGP',
      department: 'Subir Chowdhury School of Q and R',
      departmentId: 'dept-subir-chowdhury',
      departmentName: 'Subir Chowdhury School of Quality and Reliability',
      description: 'Focuses on network and software reliability',
      photo: 'https://i.pravatar.cc/150?u=neerajgoyal@iitkgp.ac.in',
      projects: ['AI battery swapping stations'],
      research: ['Communication network reliability','AI battery optimization'],
      companies: ['Qualcomm','Cisco','Nokia','Ericsson','Intel'],
      websites: ['https://iitkgp.academia.edu/NKGoyal']
    },
    {
      email: 'rajivrai@iitkgp.ac.in',
      name: 'Rajiv Nandan Rai',
      branch: 'branch-repairable-systems',
      branchName: 'Repairable Systems',
      position: 'Associate Professor',
      degree: 'PhD Reliability Eng., IIT KGP',
      department: 'Subir Chowdhury School of Q and R',
      departmentId: 'dept-subir-chowdhury',
      departmentName: 'Subir Chowdhury School of Quality and Reliability',
      description: 'Focuses on repairable systems and health monitoring',
      photo: 'https://i.pravatar.cc/150?u=rajivrai@iitkgp.ac.in',
      projects: ['Maintenance engineering'],
      research: ['Maintenance engineering','prognostic health monitoring'],
      companies: ['General Motors','Ford','Caterpillar','John Deere','Hitachi'],
      websites: ['https://www.iitkgp.ac.in/department/RE/faculty/re-rnrai']
    },
    {
      email: 'sanjaykc@iitkgp.ac.in',
      name: 'Sanjay Kumar Chaturvedi',
      branch: 'branch-network-aerospace',
      branchName: 'Network Aerospace',
      position: 'Professor',
      degree: 'PhD Reliability Eng., IIT KGP',
      department: 'Subir Chowdhury School of Q and R',
      departmentId: 'dept-subir-chowdhury',
      departmentName: 'Subir Chowdhury School of Quality and Reliability',
      description: 'Focuses on network reliability and aerospace systems',
      photo: 'https://i.pravatar.cc/150?u=sanjaykc@iitkgp.ac.in',
      projects: ['UAV reliability projects'],
      research: ['Predictive maintenance','UAV reliability','repairable systems'],
      companies: ['Boeing','Airbus','Raytheon','Thales','Safran'],
      websites: ['https://www.iitkgp.ac.in/assets/bio_sketch/MDMxMDY=.pdf']
    }
  ];

  for (const p of payloads) {
    try {
      const res = await fetch('http://localhost:5005/datas/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const text = await res.text();
      console.log('POST', p.email, '=>', res.status, text.slice(0,200));
    } catch (e) {
      console.error('Failed', p.email, e);
    }
  }
})();
