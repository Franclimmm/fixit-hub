# fixit-hub

A simple tool to track hardware repairs – built to log PS4 and other console fixes.

## 🔧 Features

- Submit repair requests with device details
- Upload photos (e.g., receipts or device images)
- WhatsApp alerts using Twilio
- Email notifications via Gmail SMTP
- Simple admin dashboard to manage requests
- Quote updates, repair completion, and deletion

## 🧰 Tech Stack

- Node.js + Express
- HTML/CSS (basic frontend)
- Multer for file uploads
- Twilio for WhatsApp alerts
- Nodemailer + Gmail SMTP for email alerts
- JSON file-based storage (no database needed)

## 🚀 How to Run

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Start the server
node index.js

# Visit the app
http://localhost:3000
```

## ⚠️ Environment Variables

Create a `.env` file in the `server/` folder with:

```
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Gmail (App password required)
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_gmail_app_password
ALERT_EMAIL=recipient_email@gmail.com

# Admin login
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
```
💡 To send emails with Gmail, you must generate an App Password:
https://myaccount.google.com/apppasswords

## 🗃 File Structure

- `/client` – frontend files (HTML, CSS, JS)
- `/server` – backend server (Express, file uploads, SMS)
