import type { TemperatureBand, TrailNeedsEstimate, TrailNeedsInput } from './types.js';

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

const defaultFluidRate = (temperature: TemperatureBand): { min: number; max: number } => {
  switch (temperature) {
    case 'cold':
      return { min: 0.3, max: 0.5 };
    case 'hot':
      return { min: 0.6, max: 0.9 };
    default:
      return { min: 0.4, max: 0.7 };
  }
};

const DEFAULT_CARBOHYDRATE_RATE = { min: 30, max: 40 } as const;

export function estimateTrailNeeds(input: TrailNeedsInput): TrailNeedsEstimate {
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0)
    throw new Error('La durée prévue doit être un nombre strictement positif.');
  const hours = input.durationMinutes / 60;
  const temperature = input.temperature ?? 'mild';
  const carbsPerServing = input.carbsPerServingGrams ?? 25;
  const availableWater = input.availableWaterLiters ?? 0;
  const reserveWater = input.reserveWaterLiters ?? 0.25;
  if (carbsPerServing <= 0 || availableWater < 0 || reserveWater < 0)
    throw new Error('Les portions et volumes fournis doivent être cohérents et positifs.');

  const carbohydrateGramsPerHour = DEFAULT_CARBOHYDRATE_RATE;
  const defaultRate = defaultFluidRate(temperature);
  const fluidLitersPerHour = input.sweatRateLitersPerHour
    ? {
        min: Math.max(0.2, input.sweatRateLitersPerHour * 0.8),
        max: input.sweatRateLitersPerHour,
      }
    : defaultRate;
  if (input.sweatRateLitersPerHour !== undefined && input.sweatRateLitersPerHour <= 0)
    throw new Error('Le taux de sudation doit être strictement positif.');

  const carbohydrateTotalGrams = {
    min: Math.ceil(carbohydrateGramsPerHour.min * hours),
    max: Math.ceil(carbohydrateGramsPerHour.max * hours),
  };
  const fluidTotalLiters = {
    min: round(fluidLitersPerHour.min * hours),
    max: round(fluidLitersPerHour.max * hours),
  };
  const startingWaterLiters = {
    min: round(Math.max(reserveWater, fluidTotalLiters.min - availableWater + reserveWater)),
    max: round(Math.max(reserveWater, fluidTotalLiters.max - availableWater + reserveWater)),
  };
  const sodiumMilligramsPerHour =
    temperature === 'hot' || input.saltySweater ? { min: 500, max: 900 } : { min: 300, max: 600 };
  const assumptions = [
    `Température considérée : ${temperature}.`,
    input.sweatRateLitersPerHour
      ? 'Hydratation calculée à partir du taux de sudation déclaré.'
      : 'Hydratation fondée sur une fourchette générique à personnaliser à l’entraînement.',
    `${String(round(availableWater))} L d’eau fiable et accessible sont déduits du portage initial.`,
    `Une réserve de ${String(round(reserveWater))} L est ajoutée au portage.`,
  ];
  const warnings = [
    'Estimation indicative : tester la stratégie à l’entraînement et boire selon un plan individualisé sans dépasser ses pertes sudorales.',
    'Ne compter un point d’eau que s’il est ouvert, accessible et potable ; traiter une eau naturelle si nécessaire.',
  ];
  return {
    durationMinutes: input.durationMinutes,
    carbohydrateGramsPerHour,
    carbohydrateTotalGrams,
    servingsToPack: Math.ceil(carbohydrateTotalGrams.max / carbsPerServing),
    fluidLitersPerHour: {
      min: round(fluidLitersPerHour.min),
      max: round(fluidLitersPerHour.max),
    },
    fluidTotalLiters,
    startingWaterLiters,
    sodiumMilligramsPerHour,
    assumptions,
    warnings,
  };
}

export function estimateTrailDuration(
  distanceKm: number | undefined,
  elevationGainM: number | undefined,
  expectedDurationMinutes: number | undefined,
  flatPaceMinutesPerKm: number | undefined,
): { minutes: number; source: 'user' | 'pace-and-km-effort' } {
  if (expectedDurationMinutes !== undefined) {
    if (expectedDurationMinutes <= 0) throw new Error('La durée prévue doit être positive.');
    return { minutes: expectedDurationMinutes, source: 'user' };
  }
  if (!distanceKm)
    throw new Error('La fiche ne fournit pas de distance : indiquez expectedDurationMinutes.');
  const pace = flatPaceMinutesPerKm ?? 6;
  if (pace <= 0) throw new Error('L’allure sur plat doit être positive.');
  const effortDistanceKm = distanceKm + (elevationGainM ?? 0) / 100;
  return { minutes: Math.ceil(effortDistanceKm * pace), source: 'pace-and-km-effort' };
}
