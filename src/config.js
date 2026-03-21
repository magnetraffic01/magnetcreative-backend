require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  actuarialDbUrl: process.env.ACTUARIAL_DATABASE_URL,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'https://creative.magnetraffic.com',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'),
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
  n8nApiKey: process.env.N8N_API_KEY,
};
