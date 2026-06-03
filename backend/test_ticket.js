require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { id: 11, email: '1022@stb.tn', role: 'agent' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const body = JSON.stringify({
  type: 'conge',
  date_debut: '2026-06-10',
  date_fin: '2026-06-12',
  motif: 'Test ticket creation'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/demandes/my-requests',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('SUCCESS! Ticket created with id:', parsed.id);
    } catch(e) {
      console.log('Not JSON');
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();