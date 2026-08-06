// Form-flow definitions per service. The router's system prompt derives its
// extraction targets from these field IDs, so whatever renders the WhatsApp
// Flow forms must use the same IDs — they are the contract between free-text
// extraction and form pre-fill.
//
// Labels currently exist in English only; `label` is a per-language record so
// translations can be added the same way as in config.ts.

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'upload'
  | 'location';

export interface FlowField {
  id: string;
  type: FieldType;
  label: Record<string, string>;
}

export interface FlowScreen {
  id: string;
  fields: FlowField[];
}

export interface FlowDef {
  serviceId: string;
  screens: FlowScreen[];
}

function field(id: string, type: FieldType, en: string): FlowField {
  return { id, type, label: { en } };
}

const FLOWS: Record<string, FlowDef> = {
  cargo: {
    serviceId: 'cargo',
    screens: [
      {
        id: 'shipment',
        fields: [
          field('destination_country', 'text', 'Destination country'),
          field('destination_city', 'text', 'Destination city'),
          field('weight_kg', 'number', 'Approximate weight (kg)'),
          field('contents', 'text', 'What is in the package'),
        ],
      },
      {
        id: 'pickup',
        fields: [
          field('pickup_location', 'location', 'Pickup location'),
          field('package_photo', 'upload', 'Photo of the package'),
        ],
      },
    ],
  },
  flight: {
    serviceId: 'flight',
    screens: [
      {
        id: 'trip',
        fields: [
          field('origin_city', 'text', 'Flying from'),
          field('destination_city', 'text', 'Flying to'),
          field('travel_date', 'date', 'Travel date'),
          field('return_date', 'date', 'Return date (if round trip)'),
          field('passengers', 'number', 'Number of passengers'),
        ],
      },
    ],
  },
  visa: {
    serviceId: 'visa',
    screens: [
      {
        id: 'details',
        fields: [
          field('visa_type', 'select', 'Visa type'),
          field('country', 'text', 'Country'),
          field('travel_date', 'date', 'Intended travel date'),
          field('passport_copy', 'upload', 'Passport copy'),
        ],
      },
    ],
  },
  jawazat: {
    serviceId: 'jawazat',
    screens: [
      {
        id: 'details',
        fields: [
          field('service_type', 'select', 'Jawazat service needed'),
          field('iqama_number', 'text', 'Iqama number'),
          field('travel_date', 'date', 'Travel date (for exit/re-entry)'),
          field('iqama_copy', 'upload', 'Iqama copy'),
        ],
      },
    ],
  },
  typing: {
    serviceId: 'typing',
    screens: [
      {
        id: 'details',
        fields: [
          field('document_type', 'text', 'Document or form needed'),
          field('notes', 'text', 'Extra details'),
          field('document_copy', 'upload', 'Copy of the document'),
        ],
      },
    ],
  },
  banking: {
    serviceId: 'banking',
    screens: [
      {
        id: 'details',
        fields: [
          field('bank_name', 'text', 'Bank'),
          field('issue_type', 'select', 'What do you need help with'),
          field('iqama_number', 'text', 'Iqama number'),
        ],
      },
    ],
  },
  medical: {
    serviceId: 'medical',
    screens: [
      {
        id: 'details',
        fields: [
          field('patient_name', 'text', 'Patient name'),
          field('specialty', 'text', 'Doctor or specialty needed'),
          field('hospital_pref', 'text', 'Preferred hospital or clinic'),
          field('preferred_date', 'date', 'Preferred date'),
        ],
      },
    ],
  },
  license: {
    serviceId: 'license',
    screens: [
      {
        id: 'details',
        fields: [
          field('service_type', 'select', 'Licence service needed'),
          field('iqama_number', 'text', 'Iqama number'),
          field('home_licence_copy', 'upload', 'Home-country licence copy'),
        ],
      },
    ],
  },
  attest: {
    serviceId: 'attest',
    screens: [
      {
        id: 'details',
        fields: [
          field('document_type', 'text', 'Document to attest'),
          field('issuing_country', 'text', 'Country that issued it'),
          field('copies', 'number', 'Number of copies'),
          field('document_copy', 'upload', 'Copy of the document'),
        ],
      },
    ],
  },
  company: {
    serviceId: 'company',
    screens: [
      {
        id: 'details',
        fields: [
          field('business_type', 'text', 'Type of business'),
          field('partners_count', 'number', 'Number of partners'),
          field('notes', 'text', 'Extra details'),
        ],
      },
    ],
  },
  home: {
    serviceId: 'home',
    screens: [
      {
        id: 'details',
        fields: [
          field('issue_type', 'select', 'Type of work needed'),
          field('description', 'text', 'Describe the problem'),
          field('area', 'text', 'Neighbourhood / area'),
          field('preferred_time', 'text', 'Preferred time'),
          field('photo', 'upload', 'Photo of the problem'),
          field('home_location', 'location', 'Home location'),
        ],
      },
    ],
  },
  remit: {
    serviceId: 'remit',
    screens: [
      {
        id: 'details',
        fields: [
          field('destination_country', 'text', 'Sending money to (country)'),
          field('amount_sar', 'number', 'Amount (SAR)'),
          field('receive_method', 'select', 'How they receive it'),
        ],
      },
    ],
  },
};

// Always returns a definition — unknown IDs get an empty flow so callers can
// iterate screens without guarding.
export function flowFor(serviceId: string): FlowDef {
  return FLOWS[serviceId] ?? { serviceId, screens: [] };
}
