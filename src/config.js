require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'magnetcreative',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
  geminiApiKey: process.env.GEMINI_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'https://creative.magnetraffic.com',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'),
};
