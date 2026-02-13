import { Market, PriceSnapshot } from '../../types';

export class PolymarketAPI {
  private baseUrl = 'https://gamma-api.polymarket.com';

  async getActiveMarkets(): Promise<Market[]> {
    try {
      const response = await fetch(`${this.baseUrl}/markets?active=true&closed=false&limit=100`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return data.map((item: any): Market => ({
        id: item.conditionId || item.id,
        slug: item.slug,
        question: item.question,
        category: item.category,
        created_at: new Date(item.createdAt),
        resolution_time: item.resolutionTime ? new Date(item.resolutionTime) : undefined,
        resolved: item.resolved || false,
        active: item.active && !item.closed,
      }));
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      return [];
    }
  }

  async getMarketPrices(marketId: string): Promise<PriceSnapshot | null> {
    try {
      const response = await fetch(`${this.baseUrl}/markets/${marketId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      return {
        market_id: marketId,
        yes_price: parseFloat(data.outcomes?.[0]?.price || 0),
        no_price: parseFloat(data.outcomes?.[1]?.price || 0),
        yes_liquidity: parseFloat(data.outcomes?.[0]?.liquidity || 0),
        no_liquidity: parseFloat(data.outcomes?.[1]?.liquidity || 0),
        volume_24h: parseFloat(data.volume24hr || 0),
      };
    } catch (error) {
      console.error(`Failed to fetch prices for ${marketId}:`, error);
      return null;
    }
  }
}
