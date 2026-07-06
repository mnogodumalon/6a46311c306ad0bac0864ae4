// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Fahrzeugerfassung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kennzeichen?: string;
    fahrzeugbezeichnung?: string;
    fahrer?: string; // applookup -> URL zu 'Fahrerverwaltung' Record
    standort?: GeoLocation; // { lat, long, info }
    status?: LookupValue;
    bemerkung?: string;
  };
}

export interface Fahrerverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    telefon?: string;
    email?: string;
  };
}

export const APP_IDS = {
  FAHRZEUGERFASSUNG: '6a46310ccdac4760b92c73cd',
  FAHRERVERWALTUNG: '6a46310a1479b5de9937276a',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'fahrzeugerfassung': {
    status: [{ key: "im_einsatz", label: "Im Einsatz" }, { key: "in_wartung", label: "In Wartung" }, { key: "verfuegbar", label: "Verfügbar" }, { key: "ausser_betrieb", label: "Außer Betrieb" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'fahrzeugerfassung': {
    'kennzeichen': 'string/text',
    'fahrzeugbezeichnung': 'string/text',
    'fahrer': 'applookup/select',
    'standort': 'geo',
    'status': 'lookup/radio',
    'bemerkung': 'string/textarea',
  },
  'fahrerverwaltung': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateFahrzeugerfassung = StripLookup<Fahrzeugerfassung['fields']>;
export type CreateFahrerverwaltung = StripLookup<Fahrerverwaltung['fields']>;