export interface HikeSummary {
  title: string;
  url: string;
  activity?: string;
  distanceKm?: number;
}

export interface HikeDetails extends HikeSummary {
  id?: string;
  difficulty?: string;
  durationMinutes?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  highestPointM?: number;
  lowestPointM?: number;
  loop?: boolean;
  country?: string;
  municipality?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
  lastReviewAt?: string;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
}

export interface HikeMatch extends HikeDetails {
  distanceDifferenceKm: number;
}

export type TemperatureBand = 'cold' | 'mild' | 'hot';

export interface TrailNeedsInput {
  durationMinutes: number;
  temperature?: TemperatureBand | undefined;
  sweatRateLitersPerHour?: number | undefined;
  availableWaterLiters?: number | undefined;
  reserveWaterLiters?: number | undefined;
  carbsPerServingGrams?: number | undefined;
  saltySweater?: boolean | undefined;
}

export interface TrailNeedsEstimate {
  durationMinutes: number;
  carbohydrateGramsPerHour: { min: number; max: number };
  carbohydrateTotalGrams: { min: number; max: number };
  servingsToPack: number;
  fluidLitersPerHour: { min: number; max: number };
  fluidTotalLiters: { min: number; max: number };
  startingWaterLiters: { min: number; max: number };
  sodiumMilligramsPerHour: { min: number; max: number };
  assumptions: string[];
  warnings: string[];
}

export type AccessPointKind = 'parking' | 'bus_stop' | 'rail_station' | 'tram_stop';

export interface AccessPoint {
  kind: AccessPointKind;
  name: string;
  latitude: number;
  longitude: number;
  distanceFromStartMeters: number;
  osmUrl: string;
  navigationUrl: string;
}

export interface HikeAccessPlan {
  start: {
    label: string;
    latitude: number;
    longitude: number;
    coordinateText: string;
    navigationUrl: string;
  };
  suggestedParking: {
    name: string;
    latitude: number;
    longitude: number;
    coordinateText: string;
    googleMapsUrl: string;
    verifiedParking: false;
  };
  parkings: AccessPoint[];
  publicTransport: AccessPoint[];
  notes: string[];
}

export interface TrailPhoto {
  url: string;
  caption: string;
  sourceUrl: string;
}

export interface TrailPreparation {
  hike: HikeDetails;
  estimatedDurationMinutes: number;
  durationSource: 'user' | 'pace-and-km-effort';
  needs: TrailNeedsEstimate;
  photos: TrailPhoto[];
  access?: HikeAccessPlan;
}
