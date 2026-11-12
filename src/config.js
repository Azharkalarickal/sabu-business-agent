require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  platform: {
    url: process.env.PLATFORM_URL || 'https://open-world-chat-box.onrender.com',
    username: process.env.PLATFORM_USERNAME || 'sabu123',
    password: process.env.PLATFORM_PASSWORD || '123456',
  },
  ai: {
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
  },
  db: {
    host: process.env.DB_HOST || 'darkslategrey-chamois-621012.hostingersite.com',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'u918480384_chatbot',
    password: process.env.DB_PASSWORD || 'New@82818888',
    database: process.env.DB_NAME || 'u918480384_chatbot',
  }
};
