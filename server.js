const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory store
const users = {};
// Simple token store (email -> token)
const tokens = {};

function generateToken(email) {
  return Buffer.from(email + '|' + Date.now()).toString('base64');
}

// API: crear usuario
app.post('/users', (req, res) => {
  const u = req.body;
  if (!u || !u.email) return res.status(400).json({ error: 'missing email' });
  users[u.email] = u;
  console.log('Created user', u.email);
  // generate token for new user
  const token = generateToken(u.email);
  tokens[u.email] = token;
  res.status(201).json({ ok: true, created: u.email, token: token });
});

// Auth: login to receive token
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  const user = users[email];
  if (!user || user.password !== password) return res.status(401).json({ error: 'invalid credentials' });
  const token = generateToken(email);
  tokens[email] = token;
  res.json({ ok: true, token: token });
});

// API: actualizar usuario
app.put('/users/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  // verify token
  const auth = (req.headers['authorization'] || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const token = auth.slice(7);
  if (tokens[email] !== token) return res.status(403).json({ error: 'invalid token' });
  const u = req.body;
  if (!users[email]) return res.status(404).json({ error: 'not found' });
  users[email] = Object.assign({}, users[email], u);
  console.log('Updated user', email);
  res.json({ ok: true, updated: email });
});

// Devuelve todos los usuarios (para debug)
app.get('/users', (req, res) => {
  res.json(users);
});

// Servir archivos estáticos (la carpeta del proyecto)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Mock API + static server running on http://localhost:${PORT}`);
});
