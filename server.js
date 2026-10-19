// server.js - Express Server with Leads API, Supabase, Email & CRM
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const db = require('./db');
const { sendLeadNotificationEmail } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload configuration for images (Desktop & Mobile CRM updates)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Serverless hosts only allow writing to /tmp (files there are temporary)
    const uploadPath = process.env.VERCEL
      ? path.join('/tmp', 'uploads')
      : path.join(__dirname, 'public', 'assets', 'images', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'custom-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------
// LEAD MANAGEMENT API
// ---------------------------------------------

// Capture new lead from website
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, project_type, message, source } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required fields.' });
    }

    const lead = await db.createLead({
      name,
      email,
      phone,
      project_type: project_type || 'Residential',
      message,
      source: source || 'Website Consultation Form'
    });

    // Send the email notification. On serverless hosts the function stops once the
    // response is sent, so wait for the email there; locally it can run in the background.
    const emailJob = sendLeadNotificationEmail(lead).catch(err => {
      console.error('Email sending error:', err);
    });
    if (process.env.VERCEL) await emailJob;

    res.status(201).json({
      success: true,
      message: 'Thank you. Your inquiry has been received. Our concierge team will contact you shortly.',
      lead
    });
  } catch (err) {
    console.error('Error creating lead:', err);
    res.status(500).json({ error: 'Failed to process inquiry. Please try again.' });
  }
});

// Get leads with filters
app.get('/api/leads', async (req, res) => {
  try {
    const { status, project_type, search } = req.query;
    const leads = await db.getLeads({ status, project_type, search });
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: 'Failed to fetch leads.' });
  }
});

// Update lead status or notes
app.patch('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const updated = await db.updateLead(id, { status, notes });
    if (!updated) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead.' });
  }
});

// Delete lead
app.delete('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteLead(id);
    res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead.' });
  }
});

// Export leads as CSV
app.get('/api/leads/export', async (req, res) => {
  try {
    const leads = await db.getLeads();
    let csv = 'ID,Name,Email,Phone,Project Type,Status,Source,Date,Message\n';
    leads.forEach(l => {
      const cleanMsg = (l.message || '').replace(/"/g, '""').replace(/\n/g, ' ');
      csv += `"${l.id}","${l.name}","${l.email}","${l.phone || ''}","${l.project_type}","${l.status}","${l.source}","${l.created_at}","${cleanMsg}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="furniqos_leads.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).send('Failed to export CSV');
  }
});

// ---------------------------------------------
// CRM / CONTENT MANAGEMENT API
// ---------------------------------------------

// Get dynamic site content
app.get('/api/content', (req, res) => {
  try {
    const content = db.getContent();
    res.json({ success: true, content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load content.' });
  }
});

// Update dynamic site content
app.post('/api/content', (req, res) => {
  try {
    const updated = db.updateContent(req.body);
    res.json({ success: true, message: 'Content updated successfully!', content: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update content.' });
  }
});

// Upload image for Desktop or Mobile view
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded.' });
    }
    const publicUrl = '/assets/images/uploads/' + req.file.filename;
    res.json({ success: true, url: publicUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// Admin Route
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

// Blog posts: /blog/<slug> -> public/blog-<slug>.html
app.get('/blog/:slug', (req, res, next) => {
  const slug = String(req.params.slug).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) return next();
  const file = path.join(__dirname, 'public', `blog-${slug}.html`);
  if (!fs.existsSync(file)) return res.redirect('/blog');
  res.sendFile(file);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server when run directly (npm start). On Vercel the exported app is used instead.
module.exports = app;

if (require.main === module) app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`✨ FURNIQOS Luxury Website Server Running!`);
  console.log(`🌐 Website URL:  http://localhost:${PORT}`);
  console.log(`📊 Admin CRM:    http://localhost:${PORT}/admin`);
  console.log(`======================================================\n`);
});
