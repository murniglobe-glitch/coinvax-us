/**
 * Robust fetch utility with retries and multiple Binance API endpoints
 */

export async function fetchBinance(path: string, retries = 3): Promise<any> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      // Use our local server proxy to avoid CORS issues
      const url = `/api/binance${path}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`Fetch failed for proxy${path} (attempt ${i + 1}):`, error);
      lastError = error;
      
      // Wait before next retry with exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Failed to fetch from Binance proxy');
}
