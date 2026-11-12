const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../database/db');
const client = require('../platform/client');
const autoBehavior = require('../agent/autoBehavior');
const brain = require('../agent/brain');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Render zero-downtime monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: 'Sabu',
    connected: client.isConnected,
    uptime: process.uptime()
  });
});

// API: Get complete dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const dbStatus = db.getStatus();
    const agentStats = autoBehavior.getStats();
    const activities = await db.getRecentActivities(20);
    const lessons = await db.getBusinessLessons(15);
    const usersMet = await db.getUsersMet(15);
    const recentMessages = await db.getRecentMessages(null, 15);

    res.json({
      status: 'success',
      agent: {
        name: 'Sabu (സാബു)',
        role: '10th Student & Business Enthusiast',
        username: client.username,
        platformConnected: client.isConnected,
        onlineUsersCount: client.onlineUserIds.size,
        ...agentStats
      },
      database: dbStatus,
      activities,
      lessons,
      usersMet,
      recentMessages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Trigger proactive professional search manually
app.post('/api/actions/discover', async (req, res) => {
  try {
    await autoBehavior.discoverProfessionals();
    res.json({ success: true, message: 'Discovery scan triggered successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Send manual message as Sabu to World Chat
app.post('/api/actions/send-world', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const sent = client.sendWorldMessage(content);
    if (sent) {
      await db.saveMessage({
        chat_type: 'world',
        sender_id: client.currentUser ? client.currentUser.id : 1,
        sender_username: 'sabu123',
        content
      });
      await db.logActivity('WORLD_CHAT', 'Manual World Message Sent from Dashboard', content);
      return res.json({ success: true });
    } else {
      return res.status(503).json({ error: 'Socket not connected to ProChat platform' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Toggle Agent Active state
app.post('/api/actions/toggle-active', (req, res) => {
  const active = autoBehavior.toggleActive();
  db.logActivity('SYSTEM', `Agent autonomous activity toggled: ${active ? 'ACTIVE' : 'PAUSED'}`);
  res.json({ success: true, isActive: active });
});

// Serve frontend SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
