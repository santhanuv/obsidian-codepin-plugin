export class GitRelayMetrics {
  private processorRuns = 0;

  private fetchRequests = 0;
  private fetchFailures = 0;

  private cacheHits = 0;
  private cacheMisses = 0;
  private inflightHits = 0;

  incrFetchRequest() {
    this.fetchRequests++;
  }

  incrFetchFailure() {
    this.fetchFailures++;
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
        fetchFailures: this.fetchFailures,

        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,

        inflightHits: this.inflightHits,

        renderProcessorRuns: this.processorRuns,
      },

      ratios: {
        fetchFailureRate:
          this.fetchRequests === 0
            ? 0
            : this.fetchFailures / this.fetchRequests,

        cacheHitRatio: cacheTotal === 0 ? 0 : this.cacheHits / cacheTotal,

        fetchesPerRender:
          this.processorRuns === 0
            ? 0
            : this.fetchRequests / this.processorRuns,
      },
    };
  }
}
