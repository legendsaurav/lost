(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/public-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Node Test', email: 'nodetest@example.com', password: 'public123' }),
    });
    const text = await res.text();
    console.log('status', res.status);
    console.log('body', text);
  } catch (err) {
    console.error('fetch error', err);
  }
})();
