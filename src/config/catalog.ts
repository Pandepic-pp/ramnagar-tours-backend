// Places we serve, vehicles we run, and the rate card. This is the single source of truth for pricing —
// the client reads it through GET /api/catalog and never carries its own copy.
//
// TODO(client): every number below is a realistic placeholder, not the operator's real rate card.
// Confirm per-km rates, road distances, drive times and toll estimates before launch.
// Road distances are approximate road-km from Ramnagar. To get exact figures later, replace
// `roadKmBetween` in pricing.service.ts with a maps-API lookup; nothing else needs to change.

export const BASE_ID = 'ramnagar';

export type LocationKind = 'base' | 'wildlife' | 'lake' | 'temple' | 'hill' | 'snow' | 'river' | 'city' | 'gateway';
export type Region = 'Ramnagar & Corbett' | 'Kumaon' | 'Garhwal' | 'Gateways';

export interface Location {
  id: string;
  name: string;
  region: Region;
  kind: LocationKind;
  state: 'UT' | 'DL' | 'UP' | 'HR'; // UT = Uttarakhand. Anything else triggers an inter-state permit charge.
  lat: number;
  lng: number;
  roadKm: number;        // approximate road distance from Ramnagar
  driveMin: number;      // typical driving time from Ramnagar, in minutes
  tollFromBase: number;  // estimated tolls, one way from Ramnagar, in rupees
  popular?: boolean;
  blurb: string;
}

export const locations: Location[] = [
  // ---- Ramnagar & Corbett ----
  { id: 'ramnagar', name: 'Ramnagar', region: 'Ramnagar & Corbett', kind: 'base', state: 'UT', lat: 29.3944, lng: 79.1281, roadKm: 0, driveMin: 0, tollFromBase: 0, blurb: 'Our home base and the gateway to Corbett.' },
  { id: 'ramnagar-station', name: 'Ramnagar Railway Station', region: 'Ramnagar & Corbett', kind: 'gateway', state: 'UT', lat: 29.3964, lng: 79.1290, roadKm: 2, driveMin: 6, tollFromBase: 0, blurb: 'Arrive by the Delhi overnight train and we meet you here.' },
  { id: 'corbett-bijrani', name: 'Jim Corbett, Bijrani Gate', region: 'Ramnagar & Corbett', kind: 'wildlife', state: 'UT', lat: 29.4150, lng: 79.1450, roadKm: 8, driveMin: 20, tollFromBase: 0, popular: true, blurb: 'Jeep safari zone with the best tiger sighting odds near town.' },
  { id: 'garjiya-devi', name: 'Garjiya Devi Temple', region: 'Ramnagar & Corbett', kind: 'temple', state: 'UT', lat: 29.4700, lng: 79.1300, roadKm: 14, driveMin: 30, tollFromBase: 0, blurb: 'A small temple on a rock in the Kosi river.' },
  { id: 'corbett-dhikala', name: 'Jim Corbett, Dhikala', region: 'Ramnagar & Corbett', kind: 'wildlife', state: 'UT', lat: 29.5500, lng: 78.8300, roadKm: 50, driveMin: 100, tollFromBase: 0, blurb: 'The heart of the reserve, with grassland views.' },
  { id: 'kaladhungi', name: 'Kaladhungi', region: 'Ramnagar & Corbett', kind: 'city', state: 'UT', lat: 29.2833, lng: 79.3500, roadKm: 35, driveMin: 60, tollFromBase: 0, blurb: 'Home of the Jim Corbett museum.' },

  // ---- Kumaon ----
  { id: 'nainital', name: 'Nainital', region: 'Kumaon', kind: 'lake', state: 'UT', lat: 29.3919, lng: 79.4542, roadKm: 65, driveMin: 130, tollFromBase: 0, popular: true, blurb: 'The lake town, with boating and Mall Road.' },
  { id: 'bhimtal', name: 'Bhimtal', region: 'Kumaon', kind: 'lake', state: 'UT', lat: 29.3465, lng: 79.5601, roadKm: 80, driveMin: 150, tollFromBase: 0, blurb: 'A calmer lake, a short drive below Nainital.' },
  { id: 'kainchi-dham', name: 'Kainchi Dham', region: 'Kumaon', kind: 'temple', state: 'UT', lat: 29.4414, lng: 79.5108, roadKm: 85, driveMin: 170, tollFromBase: 0, popular: true, blurb: 'A peaceful ashram beside a mountain stream.' },
  { id: 'mukteshwar', name: 'Mukteshwar', region: 'Kumaon', kind: 'hill', state: 'UT', lat: 29.4719, lng: 79.6472, roadKm: 110, driveMin: 210, tollFromBase: 0, blurb: 'Orchards and wide Himalayan views.' },
  { id: 'ranikhet', name: 'Ranikhet', region: 'Kumaon', kind: 'hill', state: 'UT', lat: 29.6434, lng: 79.4322, roadKm: 85, driveMin: 165, tollFromBase: 0, popular: true, blurb: 'A quiet cantonment town among pines.' },
  { id: 'almora', name: 'Almora', region: 'Kumaon', kind: 'hill', state: 'UT', lat: 29.5971, lng: 79.6591, roadKm: 105, driveMin: 210, tollFromBase: 0, popular: true, blurb: 'Old temples, markets and bal mithai.' },
  { id: 'binsar', name: 'Binsar', region: 'Kumaon', kind: 'hill', state: 'UT', lat: 29.7100, lng: 79.7600, roadKm: 135, driveMin: 260, tollFromBase: 0, blurb: 'A wildlife sanctuary with a 300 km Himalayan panorama.' },
  { id: 'jageshwar', name: 'Jageshwar Dham', region: 'Kumaon', kind: 'temple', state: 'UT', lat: 29.6395, lng: 79.8556, roadKm: 140, driveMin: 270, tollFromBase: 0, blurb: 'A cluster of ancient stone temples in a deodar forest.' },
  { id: 'kausani', name: 'Kausani', region: 'Kumaon', kind: 'snow', state: 'UT', lat: 29.8445, lng: 79.6026, roadKm: 155, driveMin: 300, tollFromBase: 0, popular: true, blurb: 'Sunrise over the Trishul and Nanda Devi peaks.' },
  { id: 'bageshwar', name: 'Bageshwar', region: 'Kumaon', kind: 'river', state: 'UT', lat: 29.8379, lng: 79.7714, roadKm: 195, driveMin: 360, tollFromBase: 0, blurb: 'A temple town where two rivers meet.' },
  { id: 'pithoragarh', name: 'Pithoragarh', region: 'Kumaon', kind: 'hill', state: 'UT', lat: 29.5829, lng: 80.2182, roadKm: 230, driveMin: 420, tollFromBase: 0, blurb: 'The valley town on the way to the far east hills.' },
  { id: 'munsiyari', name: 'Munsiyari', region: 'Kumaon', kind: 'snow', state: 'UT', lat: 30.0667, lng: 80.2333, roadKm: 310, driveMin: 600, tollFromBase: 0, blurb: 'Face to face with the Panchachuli peaks.' },

  // ---- Garhwal ----
  { id: 'lansdowne', name: 'Lansdowne', region: 'Garhwal', kind: 'hill', state: 'UT', lat: 29.8374, lng: 78.6800, roadKm: 170, driveMin: 270, tollFromBase: 60, blurb: 'A sleepy cantonment hill town with oak forests.' },
  { id: 'rishikesh', name: 'Rishikesh', region: 'Garhwal', kind: 'river', state: 'UT', lat: 30.0869, lng: 78.2676, roadKm: 215, driveMin: 320, tollFromBase: 150, popular: true, blurb: 'Ganga ghats, rafting and the evening aarti.' },
  { id: 'dehradun', name: 'Dehradun', region: 'Garhwal', kind: 'city', state: 'UT', lat: 30.3165, lng: 78.0322, roadKm: 245, driveMin: 360, tollFromBase: 220, blurb: 'The state capital and a rail and air hub.' },
  { id: 'mussoorie', name: 'Mussoorie', region: 'Garhwal', kind: 'hill', state: 'UT', lat: 30.4598, lng: 78.0664, roadKm: 285, driveMin: 440, tollFromBase: 250, popular: true, blurb: 'The Queen of the Hills, with Kempty Falls close by.' },
  { id: 'kedarnath', name: 'Kedarnath (Gaurikund)', region: 'Garhwal', kind: 'temple', state: 'UT', lat: 30.6531, lng: 79.0299, roadKm: 300, driveMin: 540, tollFromBase: 0, blurb: 'The road-head for the Kedarnath trek.' },
  { id: 'auli', name: 'Auli', region: 'Garhwal', kind: 'snow', state: 'UT', lat: 30.5285, lng: 79.5660, roadKm: 285, driveMin: 570, tollFromBase: 0, blurb: 'Ski slopes in winter, meadows in summer.' },
  { id: 'badrinath', name: 'Badrinath', region: 'Garhwal', kind: 'temple', state: 'UT', lat: 30.7433, lng: 79.4938, roadKm: 310, driveMin: 660, tollFromBase: 0, blurb: 'One of the four Char Dham shrines.' },

  // ---- Gateways ----
  { id: 'haldwani', name: 'Haldwani', region: 'Gateways', kind: 'gateway', state: 'UT', lat: 29.2183, lng: 79.5130, roadKm: 62, driveMin: 90, tollFromBase: 0, blurb: 'The main town at the foot of Kumaon.' },
  { id: 'kathgodam', name: 'Kathgodam Railway Station', region: 'Gateways', kind: 'gateway', state: 'UT', lat: 29.2650, lng: 79.5470, roadKm: 68, driveMin: 100, tollFromBase: 0, blurb: 'The rail-head for Nainital and Kumaon.' },
  { id: 'pantnagar', name: 'Pantnagar Airport', region: 'Gateways', kind: 'gateway', state: 'UT', lat: 29.0330, lng: 79.4730, roadKm: 85, driveMin: 120, tollFromBase: 40, blurb: 'The nearest airport to Ramnagar and Nainital.' },
  { id: 'haridwar', name: 'Haridwar', region: 'Gateways', kind: 'river', state: 'UT', lat: 29.9457, lng: 78.1642, roadKm: 190, driveMin: 270, tollFromBase: 150, blurb: 'The holy city on the Ganga, and a rail hub.' },
  { id: 'dehradun-airport', name: 'Dehradun (Jolly Grant) Airport', region: 'Gateways', kind: 'gateway', state: 'UT', lat: 30.1897, lng: 78.1803, roadKm: 230, driveMin: 330, tollFromBase: 200, blurb: 'The main airport for Garhwal.' },
  { id: 'delhi', name: 'Delhi / NCR', region: 'Gateways', kind: 'city', state: 'DL', lat: 28.6139, lng: 77.2090, roadKm: 250, driveMin: 330, tollFromBase: 420, blurb: 'Door to door from the capital, airport pickups included.' },
];

export type VehicleId = 'sedan' | 'suv' | 'innova' | 'tempo';

export interface Vehicle {
  id: VehicleId;
  name: string;
  models: string;          // "or similar" examples shown to the customer
  seats: number;           // passenger capacity
  bags: number;
  oneWayPerKm: number;     // one-way drop: the driver returns empty, so the rate is higher
  roundTripPerKm: number;
  minFare: number;         // floor for very short hops
  nightStayPerNight: number; // driver food and lodging on a multi-day round trip
  interstatePermit: number;  // flat permit/entry charge when the trip leaves Uttarakhand
}

export const vehicles: Vehicle[] = [
  { id: 'sedan',  name: 'Sedan',            models: 'Swift Dzire, Etios or similar',   seats: 4,  bags: 2,  oneWayPerKm: 16, roundTripPerKm: 12, minFare: 600,  nightStayPerNight: 300, interstatePermit: 350 },
  { id: 'suv',    name: 'SUV',              models: 'Ertiga, Marazzo or similar',      seats: 6,  bags: 3,  oneWayPerKm: 21, roundTripPerKm: 16, minFare: 900,  nightStayPerNight: 400, interstatePermit: 500 },
  { id: 'innova', name: 'Innova Crysta',    models: 'Toyota Innova Crysta',            seats: 7,  bags: 4,  oneWayPerKm: 25, roundTripPerKm: 19, minFare: 1200, nightStayPerNight: 500, interstatePermit: 600 },
  { id: 'tempo',  name: 'Tempo Traveller',  models: '12-seater with push-back seats',  seats: 12, bags: 8,  oneWayPerKm: 34, roundTripPerKm: 26, minFare: 1800, nightStayPerNight: 700, interstatePermit: 1500 },
];

// Business rules, kept together so they read like a policy document.
export const rules = {
  gstPercent: 5,                 // GST on passenger transport by cab (no input tax credit). Tolls and permits are passed through without GST.
  oneWayMinKm: 80,               // a one-way drop is billed for at least this many km
  localOneWayMinKm: 30,          // ...except short local hops (within localRadiusKm), such as a safari gate transfer
  localRadiusKm: 40,             // a round trip this close is a "local package"
  localMinKmPerDay: 80,
  outstationMinKmPerDay: 250,    // standard outstation minimum
  maxNights: 14,
  nightPickup: { fromHour: 23, toHour: 4, charge: 250 }, // pickups from 11 pm up to (not including) 4 am
  peakSurchargePercent: 10,
  // Inclusive month/day windows, India time. A window may wrap over the new year.
  peakWindows: [
    { label: 'Summer holidays',  from: [4, 15],  to: [6, 30] },
    { label: 'Diwali and festival season', from: [10, 20], to: [11, 10] },
    { label: 'Christmas and New Year',     from: [12, 20], to: [1, 5] },
  ] as { label: string; from: [number, number]; to: [number, number] }[],
  roundOffTo: 10,
  minLeadMinutes: 30,
};
