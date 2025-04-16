require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const twilio = require('twilio');

const app = express();
const PORT = 3000;

// Twilio config
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const WHATSAPP_FROM = 'whatsapp:+14155238886'; // Twilio sandbox
const WHATSAPP_TO = 'whatsapp:+447718614461';  // Your WhatsApp

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'fixit-secret-key',
  resave: false,
  saveUninitialized: false
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect('/login');
}

const repairsFile = path.join(__dirname, 'repairs.json');

// Routes

// Home redirects to repair form
app.get('/', (req, res) => {
  res.redirect('/repair-form');
});

// Serve repair form
app.get('/repair-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'repair-form.html'));
});

// Handle repair request
app.post('/repair-request', upload.single('photo'), (req, res) => {
  const { name, contact, device, issue, method } = req.body;

  const newRequest = {
    id: Date.now(),
    name,
    contact,
    device,
    issue,
    method,
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    quote: null,
    submittedAt: new Date().toISOString()
  };

  fs.readFile(repairsFile, 'utf8', (err, data) => {
    let repairs = [];

    if (!err && data) {
      try {
        repairs = JSON.parse(data);
      } catch (e) {
        console.error("Error parsing repairs.json:", e);
      }
    }

    repairs.push(newRequest);

    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), (err) => {
      if (err) {
        console.error("❌ Error writing to file:", err);
        return res.status(500).send("Could not save your request.");
      }

      // WhatsApp alert
      const message = `📬 New Repair Request\nName: ${name}\nDevice: ${device}\nIssue: ${issue}\nContact: ${contact}`;

      twilioClient.messages
        .create({
          from: WHATSAPP_FROM,
          to: WHATSAPP_TO,
          body: message
        })
        .then(() => console.log("✅ WhatsApp alert sent"))
        .catch(err => console.error("❌ WhatsApp alert failed:", err.message));

      res.send(`<h2>Thanks ${name}! Your ${device} repair request has been sent to Franclim.</h2>`);
    });
  });
});

// Dashboard
app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// JSON API for repairs
app.get('/repairs', requireLogin, (req, res) => {
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: "Failed to load repair requests." });

    try {
      const repairs = JSON.parse(data);
      res.json(repairs);
    } catch (e) {
      res.status(500).json({ error: "Error parsing repair data." });
    }
  });
});

// Complete a repair
app.post('/repair/:id/complete', requireLogin, (req, res) => {
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    const id = parseInt(req.params.id);
    repairs = repairs.map(r => r.id === id ? { ...r, status: 'Completed' } : r);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

// Delete a repair
app.post('/repair/:id/delete', requireLogin, (req, res) => {
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    const id = parseInt(req.params.id);
    repairs = repairs.filter(r => r.id !== id);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

// Update a quote
app.post('/repair/:id/quote', requireLogin, (req, res) => {
  const { quote } = req.body;
  const id = parseInt(req.params.id);

  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    repairs = repairs.map(r => r.id === id ? { ...r, quote: parseFloat(quote) } : r);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), err => {
      if (err) return res.sendStatus(500);
      res.sendStatus(200);
    });
  });
});

// Show login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (username === adminUsername && password === adminPassword) {
    req.session.loggedIn = true;
    res.redirect('/dashboard');
  } else {
    res.send('<h3>Login failed. <a href="/login">Try again</a></h3>');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
