import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BINANCE_ENDPOINTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com'
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Binance Proxy Route
  app.get("/api/binance/*", async (req, res) => {
    const path = req.params[0];
    if (!path) {
      return res.status(400).json({ error: "Missing Binance API path" });
    }
    const query = req.url.split('?')[1] || '';
    const binancePath = `/${path}${query ? '?' + query : ''}`;
    
    let lastError: any;
    for (const endpoint of BINANCE_ENDPOINTS) {
      try {
        const url = `${endpoint}${binancePath}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Binance error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return res.json(data);
      } catch (error) {
        console.warn(`Proxy fetch failed for ${endpoint}${binancePath}:`, error);
        lastError = error;
      }
    }
    
    res.status(502).json({ 
      error: "Failed to fetch from Binance", 
      details: lastError?.message 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
