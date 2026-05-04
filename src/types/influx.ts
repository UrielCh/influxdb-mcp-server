/**
 * InfluxDB API Type Definitions
 */

export interface InfluxOrganization {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InfluxOrganizationsResponse {
  orgs: InfluxOrganization[];
}

export interface InfluxBucket {
  id: string;
  name: string;
  orgID: string;
  description?: string;
  retentionRules: Array<{
    type: string;
    everySeconds: number;
    shardGroupDurationSeconds?: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface InfluxBucketsResponse {
  buckets: InfluxBucket[];
}

export interface InfluxErrorResponse {
  code: string;
  message: string;
}
