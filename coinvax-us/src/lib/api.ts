/**
 * Robust fetch utility with retries and multiple Binance API endpoints
 */

const BINANCE_ENDPOINTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com'
];

export async function fetchBinance(path: string, retries = 3): Promise<any> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    // Try each endpoint in order
    for (const endpoint of BINANCE_ENDPOINTS) {
      try {
        const url = `${endpoint}${path}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.warn(`Fetch failed for ${endpoint}${path} (attempt ${i + 1}):`, error);
        lastError = error;
      }
    }
    
    // Wait before next retry with exponential backoff
    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }

  throw lastError || new Error('Failed to fetch from all Binance endpoints');
}
