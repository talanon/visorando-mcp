import { describe, expect, it } from 'vitest';
import { estimateTrailDuration, estimateTrailNeeds } from '../src/planner.js';

describe('estimateTrailNeeds', () => {
  it('calcule glucides, eau disponible et réserve pour un trail long et chaud', () => {
    expect(
      estimateTrailNeeds({
        durationMinutes: 240,
        temperature: 'hot',
        sweatRateLitersPerHour: 0.8,
        availableWaterLiters: 1,
        reserveWaterLiters: 0.25,
        carbsPerServingGrams: 30,
        saltySweater: true,
      }),
    ).toMatchObject({
      carbohydrateGramsPerHour: { min: 30, max: 40 },
      carbohydrateTotalGrams: { min: 120, max: 160 },
      servingsToPack: 6,
      fluidLitersPerHour: { min: 0.64, max: 0.8 },
      fluidTotalLiters: { min: 2.56, max: 3.2 },
      startingWaterLiters: { min: 1.81, max: 2.45 },
      sodiumMilligramsPerHour: { min: 500, max: 900 },
    });
  });

  it('applique la cible de glucides par défaut pendant une sortie courte', () => {
    expect(estimateTrailNeeds({ durationMinutes: 40 })).toMatchObject({
      carbohydrateGramsPerHour: { min: 30, max: 40 },
      carbohydrateTotalGrams: { min: 20, max: 27 },
      servingsToPack: 2,
    });
  });

  it.each([
    [60, 'cold', { min: 0.3, max: 0.5 }],
    [120, 'mild', { min: 0.4, max: 0.7 }],
    [180, 'hot', { min: 0.6, max: 0.9 }],
  ] as const)(
    'adapte l’eau pour %i minutes et %s tout en conservant la cible glucidique',
    (duration, temperature, fluid) => {
      expect(estimateTrailNeeds({ durationMinutes: duration, temperature })).toMatchObject({
        fluidLitersPerHour: fluid,
        carbohydrateGramsPerHour: { min: 30, max: 40 },
      });
    },
  );

  it('rejette les valeurs incohérentes', () => {
    expect(() => estimateTrailNeeds({ durationMinutes: 0 })).toThrow(/durée/iu);
    expect(() => estimateTrailNeeds({ durationMinutes: 60, sweatRateLitersPerHour: -1 })).toThrow(
      /sudation/iu,
    );
    expect(() => estimateTrailNeeds({ durationMinutes: 60, availableWaterLiters: -1 })).toThrow(
      /volumes/iu,
    );
  });
});

describe('estimateTrailDuration', () => {
  it('privilégie la durée personnelle', () => {
    expect(estimateTrailDuration(20, 1000, 150, 6)).toEqual({ minutes: 150, source: 'user' });
  });

  it('utilise le km-effort si la durée manque', () => {
    expect(estimateTrailDuration(20, 1000, undefined, 6)).toEqual({
      minutes: 180,
      source: 'pace-and-km-effort',
    });
  });

  it('applique les valeurs par défaut et rejette les estimations impossibles', () => {
    expect(estimateTrailDuration(10, undefined, undefined, undefined)).toEqual({
      minutes: 60,
      source: 'pace-and-km-effort',
    });
    expect(() => estimateTrailDuration(undefined, 500, undefined, 7)).toThrow(/distance/iu);
    expect(() => estimateTrailDuration(10, 500, -1, 7)).toThrow(/durée/iu);
    expect(() => estimateTrailDuration(10, 500, undefined, -1)).toThrow(/allure/iu);
  });
});
