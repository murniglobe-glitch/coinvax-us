import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

const BINANCE_ENDPOINTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com'
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add JSON Body Parsers with limits suitable for base64 image uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Cloudinary Identity Files Upload Proxy
  app.post("/api/upload", async (req, res) => {
    try {
      const { image, folder } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image/file payload" });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      // Safe fallback if Cloudinary variables are not configured in Railway/Studio yet
      if (!cloudName || !apiKey || !apiSecret) {
        console.warn("Cloudinary is not configured. Falling back to safe simulated upload response.");
        const mockUrl = image.startsWith("data:") 
          ? `https://res.cloudinary.com/demo/image/upload/v1234567890/simulated_${folder || 'uploads'}.jpg`
          : image;
        return res.json({
          secure_url: mockUrl,
          public_id: `simulated_${Date.now()}`,
          simulated: true,
          message: "Uploaded successfully (simulated fallback)"
        });
      }

      // Live upload to cloud
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: folder || "coinvax_verifications",
        resource_type: "auto"
      });

      return res.json({
        secure_url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
        simulated: false
      });
    } catch (error: any) {
      console.error("Cloudinary upload server error:", error);
      res.status(500).json({
        error: "Failed to upload image resources to Cloudinary",
        details: error?.message || error
      });
    }
  });

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
