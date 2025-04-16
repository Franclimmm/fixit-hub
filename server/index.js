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

// 🌐 Redirect www to non-www
app.use((req, res, next) => {
  if (req.headers.host === 'www.fixithub.support') {
    return res.redirect(301, 'https://fixithub.support' + req.url);
  }
  next();
});

// 📦 Twilio setup
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const WHATSAPP_FROM = 'whatsapp:+14155238886';
const WHATSAPP_TO = 'whatsapp:+447718614461';

// 📂 Multer config for /tmp
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/tmp'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// 🧱 Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'fixit-secret-key',
  resave: false,
  saveUninitialized: false
}));

// 🔓 Serve static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/tmp', express.static('/tmp')); // ✅ Added to serve uploaded images

// 🛡️ Auth middleware
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect('/login');
}

const repairsFile = path.join(__dirname, 'repairs.json');

// 🏠 Routes
app.get('/', (req, res) => {
  res.redirect('/repair-form');
});

app.get('/repair-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'repair-form.html'));
});

// 📨 Handle repair form submission
app.post('/repair-request', upload.single('photo'), async (req, res) => {
  try {
    const { name, contact, device, issue, method } = req.body;

    const newRequest = {
      id: Date.now(),
      name,
      contact,
      device,
      issue,
      method,
      photo: req.file ? req.file.path : null,
      quote: null,
      submittedAt: new Date().toISOString()
    };

    let repairs = [];
    if (fs.existsSync(repairsFile)) {
      const data = fs.readFileSync(repairsFile, 'utf8');
      if (data) {
        repairs = JSON.parse(data);
      }
    }

    repairs.push(newRequest);
    fs.writeFileSync(repairsFile, JSON.stringify(repairs, null, 2));

    const message = `📬 New Repair Request\nName: ${name}\nDevice: ${device}\nIssue: ${issue}\nContact: ${contact}`;
    try {
      await twilioClient.messages.create({
        from: WHATSAPP_FROM,
        to: WHATSAPP_TO,
        body: message
      });
      console.log("✅ WhatsApp alert sent");
    } catch (twilioError) {
      console.error("❌ WhatsApp alert failed:", twilioError.message);
    }

    res.send(`<h2>Thanks ${name}! Your ${device} repair request has been sent to Franclim.</h2>`);
  } catch (err) {
    console.error("❌ Upload failed:", err);
    res.status(500).send("Something went wrong while uploading your request.");
  }
});

// 🔐 Admin dashboard + API
app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

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

app.post('/repair/:id/complete', requireLogin, (req, res) => {
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    const id = parseInt(req.params.id);
    repairs = repairs.map(r => r.id === id ? { ...r, status: 'Completed' } : r);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

app.post('/repair/:id/delete', requireLogin, (req, res) => {
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    const id = parseInt(req.params.id);
    repairs = repairs.filter(r => r.id !== id);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

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

// 🔐 Login + Logout
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.loggedIn = true;
    res.redirect('/dashboard');
  } else {
    res.send('<h3>Login failed. <a href="/login">Try again</a></h3>');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
