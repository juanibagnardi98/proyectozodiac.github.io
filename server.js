const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
// Session middleware for login sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// In-memory store
const users = {};
// Simple token store (email -> token)
const tokens = {};

// Persistence file for users
const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      var raw = fs.readFileSync(USERS_FILE, 'utf8');
      var obj = JSON.parse(raw || '{}');
      Object.keys(obj).forEach(k => { users[k] = obj[k]; });
      console.log('Loaded users from', USERS_FILE);
    }
  } catch (e) { console.warn('Could not load users file', e); }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) { console.warn('Could not save users file', e); }
}

// Load persisted users at startup
loadUsers();

function generateToken(email) {
  return Buffer.from(email + '|' + Date.now()).toString('base64');
}

// API: crear usuario
app.post('/users', (req, res) => {
  const u = req.body;
  if (!u || !u.email) return res.status(400).json({ error: 'missing email' });
  // basic validation
  if (!u.password || typeof u.password !== 'string' || u.password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (users[u.email]) return res.status(409).json({ error: 'user already exists' });

  // hash password before storing
  const hashed = bcrypt.hashSync(u.password, 10);
  const stored = Object.assign({}, u, { password: hashed });
  users[u.email] = stored;
  saveUsers();
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
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  // compare hashed password
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'invalid credentials' });
  const token = generateToken(email);
  tokens[email] = token;
  res.json({ ok: true, token: token });
});

// Session-based login (sets server session)
app.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  const user = users[email];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'invalid credentials' });
  // establish session
  req.session.user = { email: user.email, username: user.username || '' };
  res.json({ ok: true, user: req.session.user });
});

// Perfil protegido por sesión
app.get('/perfil', (req, res) => {
  if (req.session && req.session.user) return res.json({ ok: true, user: req.session.user });
  return res.status(401).json({ error: 'not authenticated' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'failed to destroy session' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
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
// Protegemos la página principal del juego para requerir sesión
app.get('/raceofthezodiac.html', (req, res, next) => {
  if (req.session && req.session.user) {
    return res.sendFile(path.join(__dirname, 'raceofthezodiac.html'));
  }
  // si no hay sesión, redirigir al login
  return res.redirect('/iniciosesion.html');
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Mock API + static server running on http://localhost:${PORT}`);
});
