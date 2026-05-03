import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Proxy the Gemini API calls securely
  app.post('/api/gemini', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
         res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable." });
         return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;
      
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      
      res.json(response);
    } catch (error: any) {
      console.error("Gemini API Error:", error.message || error);
      res.status(500).json({ error: error.message || "Failed to call Gemini API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // In Express v4, we can directly use vite.middlewares. In Express v5, the types might be slightly different.
    app.use(vite.middlewares as express.RequestHandler);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
