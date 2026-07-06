import type { Fahrzeugerfassung } from './app';

export type EnrichedFahrzeugerfassung = Fahrzeugerfassung & {
  fahrerName: string;
};
