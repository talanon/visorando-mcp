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
