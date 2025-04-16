# fixit-hub

A simple tool to track hardware repairs – built to log PS4 and other console fixes.

## 🔧 Features
- Submit repair requests with device details
- File upload support (e.g., receipt photos)
- SMS notifications using Twilio

## 🧰 Tech Stack
- Node.js + Express
- HTML/CSS frontend
- Multer for file uploads
- Twilio for SMS
- JSON-based storage

## 🚀 How to Run

```bash
# In server folder
npm install
node index.js

# Visit: http://localhost:3000
```

## ⚠️ Environment Variables

Create a `.env` file in the `server/` folder with:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
```

## 🗃 File Structure

- `/client` – frontend files (HTML, CSS, JS)
- `/server` – backend server (Express, file uploads, SMS)
