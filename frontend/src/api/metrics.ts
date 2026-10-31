import { apiRequest } from './client.js';

export interface CollectionMetricsResponse {
  collection: {
    id: string;
    title: string;
    status: string;
    queueMode: string;
    startedAt: string | null;
    endedAt: string | null;
    location: string | null;
    timezone: string;
  };
  metrics: {
    timeMetrics: {
      totalDurationSeconds: number;
      pauseDurationSeconds: number;
      operationalDurationSeconds: number;
      operationalDurationMinutes: number;
      operationalDurationHours: number;
    };
    overallThroughput: {
      totalDeliveries: number;
      deliveriesPerMinute: number | null;
      deliveriesPerHour: number | null;
    };
    arrivalMetrics: {
      totalArrivals: number;
      arrivalsPerMinute: number | null;
      arrivalsPerHour: number | null;
    };
    attendantsMetrics: Array<{
      attendantId: string;
      code: string;
      displayName: string;
      deliveriesCount: number;
      deliveriesPerMinute: number | null;
      deliveriesPerHour: number | null;
      percentOfTotalDeliveries: number;
      serviceTimeSeconds: {
        count: number;
        mean: number | null;
        median: number | null;
        stdDev: number | null;
        min: number | null;
        max: number | null;
        p25: number | null;
        p75: number | null;
        p90: number | null;
        p95: number | null;
      };
      busyDurationSeconds: number;
      utilizationPercent: number | null;
    }>;
    comparison: {
      hasTwoAttendants: boolean;
      disclaimer: string;
      differenceAbsoluteDeliveries?: number;
      differenceRelativePercent?: number;
      fasterAttendantCode?: string;
      throughputComparisonText?: string;
    };
    queueTheory: {
      isApplicable: boolean;
      reasonIfNotApplicable?: string;
      lambdaPerMinute: number | null;
      muPerAttendantPerMinute: number | null;
      totalCapacityPerMinute: number | null;
      trafficIntensityRho: number | null;
      stabilityState: 'STABLE' | 'SATURATED_OR_UNSTABLE' | 'INSUFFICIENT_DATA';
      littlesLaw: {
        averageItemsInSystemL: number | null;
        averageTimeInSystemWMinutes: number | null;
        formula: string;
        notes: string;
      };
    };
    proteinMetrics?: {
      totalMeasurements: number;
      totalGramsMeasured: number;
      averageGramsPerServing: number | null;
      minGrams: number | null;
      maxGrams: number | null;
    };
    sampleIntegrity: {
      isSampleSufficient: boolean;
      limitations: string[];
    };
  };
}

export const metricsApi = {
  async getMetrics(collectionId: string): Promise<CollectionMetricsResponse> {
    const res = await apiRequest<{ success: boolean; data: CollectionMetricsResponse }>(
      `/collections/${collectionId}/metrics`
    );
    return res.data;
  },

  async getTimeline(collectionId: string, bucketMinutes = 5) {
    const res = await apiRequest<{ success: boolean; data: any[] }>(
      `/collections/${collectionId}/timeline?bucket=${bucketMinutes}`
    );
    return res.data;
  },

  async getDashboard() {
    const res = await apiRequest<{ success: boolean; data: any }>('/dashboard');
    return res.data;
  },

  getRawCsvUrl(collectionId: string) {
    return `/api/collections/${collectionId}/export/raw.csv`;
  },

  getAggregatedCsvUrl(collectionId: string) {
    return `/api/collections/${collectionId}/export/aggregated.csv`;
  },
};
