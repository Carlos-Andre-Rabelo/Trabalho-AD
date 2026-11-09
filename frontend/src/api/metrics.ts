import { apiRequest, API_BASE_URL } from './client.js';

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
    targetDurationMinutes?: number | null;
    notes?: string | null;
    owner?: {
      id: string;
      name: string;
      email?: string;
    };
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
      unassignedArrivals?: number;
    };
    queuesMetrics?: Array<{
      queueId: string;
      queueName: string;
      attendantId: string | null;
      attendantCode: string | null;
      attendantName: string | null;
      arrivalsCount: number;
      arrivalsPerMinute: number | null;
      arrivalsPerHour: number | null;
      percentOfTotalArrivals: number;
      deliveriesCount: number;
      estimatedQueueRemainder: number;
      trafficIntensityRho: number | null;
    }>;
    attendantsMetrics: Array<{
      attendantId: string;
      code: string;
      displayName: string;
      queueId?: string | null;
      queueName?: string | null;
      arrivalsCount?: number;
      arrivalsPerMinute?: number | null;
      arrivalsPerHour?: number | null;
      percentOfTotalArrivals?: number;
      estimatedQueueRemainder?: number;
      trafficIntensityRho?: number | null;
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
    const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`;
    return `${base}/collections/${collectionId}/export/raw.csv`;
  },

  getAggregatedCsvUrl(collectionId: string) {
    const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`;
    return `${base}/collections/${collectionId}/export/aggregated.csv`;
  },

  getExcelUrl(collectionId: string) {
    const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`;
    return `${base}/collections/${collectionId}/export/excel`;
  },

  getCompleteCsvUrl(collectionId: string) {
    const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`;
    return `${base}/collections/${collectionId}/export/complete.csv`;
  },
};
