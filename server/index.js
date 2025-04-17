require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// 🌐 Redirect www to non-www
app.use((req, res, next) => {
  if (req.headers.host === 'www.fixithub.support') {
    return res.redirect(301, 'https://fixithub.support' + req.url);
  }
  next();
});

// 🛠 Twilio setup
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const WHATSAPP_FROM = 'whatsapp:+14155238886';
const WHATSAPP_TO = 'whatsapp:+447718614461';

// 📧 Gmail SMTP (Nodemailer)
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// 📂 Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// 🧱 Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'fixit-secret-key',
  resave: false,
  saveUninitialized: false
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/tmp', express.static('/tmp'));

const repairsFile = path.join(__dirname, 'repairs.json');

// 🔐 Auth middleware
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect('/login');
}

// 🏠 Routes
app.get('/', (req, res) => {
  res.redirect('/repair-form');
});

app.get('/repair-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'repair-form.html'));
});

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
      photo: req.file ? `/uploads/${req.file.filename}` : null,
      quote: null,
      submittedAt: new Date().toISOString(),
    };

    let repairs = [];
    if (fs.existsSync(repairsFile)) {
      const data = fs.readFileSync(repairsFile, 'utf8');
      repairs = data ? JSON.parse(data) : [];
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
    } catch (e) {
      console.error("❌ WhatsApp failed:", e.message);
    }

    try {
      await mailer.sendMail({
        from: `"FixItHub" <${process.env.GMAIL_USER}>`,
        to: process.env.ALERT_EMAIL,
        subject: `New Repair Request from ${name}`,
        text: `Name: ${name}\nDevice: ${device}\nIssue: ${issue}\nContact: ${contact}\nMethod: ${method}\nPhoto: ${newRequest.photo || 'N/A'}`
      });
      console.log("✅ Email alert sent");
    } catch (e) {
      console.error("❌ Email failed:", e.message);
    }

    res.send(`<h2>Thanks ${name}! Your ${device} repair request has been sent.</h2>`);
  } catch (err) {
    console.error("❌ Submission failed:", err);
    res.status(500).send("Something went wrong.");
  }
});

// 🧰 Dashboard
app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/repairs', requireLogin, (req, res) => {
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to load repairs' });
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: 'Corrupted data' });
    }
  });
});

app.post('/repair/:id/quote', requireLogin, (req, res) => {
  const { quote } = req.body;
  const id = parseInt(req.params.id);
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    repairs = repairs.map(r => r.id === id ? { ...r, quote: parseFloat(quote) } : r);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

app.post('/repair/:id/complete', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    repairs = repairs.map(r => r.id === id ? { ...r, status: 'Completed' } : r);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

app.post('/repair/:id/delete', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  fs.readFile(repairsFile, 'utf8', (err, data) => {
    if (err) return res.sendStatus(500);
    let repairs = JSON.parse(data);
    const target = repairs.find(r => r.id === id);

    if (target?.photo && target.photo.startsWith('/uploads/')) {
      const photoPath = path.join(__dirname, target.photo);
      fs.unlink(photoPath, err => {
        if (err) console.warn("⚠️ Image delete failed:", err.message);
      });
    }

    repairs = repairs.filter(r => r.id !== id);
    fs.writeFile(repairsFile, JSON.stringify(repairs, null, 2), () => res.sendStatus(200));
  });
});

// 🔐 Login / Logout
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

// 🚀 Start
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
