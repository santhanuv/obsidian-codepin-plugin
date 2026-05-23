export class CodepinMetrics {
  private processorRuns = 0;
  private fetchRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private inflightHits = 0;

  incrFetchRequest() {
    this.fetchRequests++;
  }

  incrCacheHit() {
    this.cacheHits++;
  }

  incrCacheMiss() {
    this.cacheMisses++;
  }

  incrProcessorRuns() {
    this.processorRuns++;
  }

  incrInflightHits() {
    this.inflightHits++;
  }

  snapshot() {
    const cacheTotal = this.cacheHits + this.cacheMisses;

    return {
      counters: {
        fetchRequests: this.fetchRequests,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        inflightHits: this.inflightHits,
        renderProcessorRuns: this.processorRuns,
      },

      ratios: {
        cacheHitRatio: cacheTotal === 0 ? 0 : this.cacheHits / cacheTotal,
      },
    };
  }
}
