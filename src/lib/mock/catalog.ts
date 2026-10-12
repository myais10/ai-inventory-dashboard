// Northstar Industrial Supply — fictional distributor catalog used for demo/mock mode.
// The "profile" only shapes how the mock history is generated; every status shown in
// the app is computed independently by the deterministic engines in /lib.

export type MockProfile =
  | "critical"
  | "reorder"
  | "growing"
  | "spike"
  | "healthy"
  | "seasonal_summer"
  | "seasonal_winter"
  | "excess"
  | "declining"
  | "slow"
  | "dead";

export interface CatalogEntry {
  sku: string;
  name: string;
  category: string;
  brand: string;
  supplier: string; // supplier code
  cost: number;
  weekly: number; // base weekly unit demand
  profile: MockProfile;
  moq: number;
  uom?: string;
  warehouse?: string;
}

export const SUPPLIERS = [
  { code: "SKF", name: "SKF USA Inc.", contact: "Laura Bennett", lead: 14, onTime: 0.62, delay: [3, 8], price: 0.032, country: "US", terms: "Net 60" },
  { code: "TIM", name: "The Timken Company", contact: "Marcus Hale", lead: 21, onTime: 0.88, delay: [1, 5], price: 0.018, country: "US", terms: "Net 45" },
  { code: "PAR", name: "Parker Hannifin", contact: "Dana Ruiz", lead: 10, onTime: 0.91, delay: [1, 4], price: 0.021, country: "US", terms: "Net 45" },
  { code: "DON", name: "Donaldson Company", contact: "Erik Lindqvist", lead: 7, onTime: 0.95, delay: [1, 3], price: 0.012, country: "US", terms: "Net 30" },
  { code: "GAT", name: "Gates Corporation", contact: "Priya Natarajan", lead: 10, onTime: 0.83, delay: [2, 6], price: 0.068, country: "US", terms: "Net 45" },
  { code: "GRU", name: "Grundfos Pumps Corp.", contact: "Henrik Madsen", lead: 28, onTime: 0.64, delay: [5, 16], price: 0.041, country: "DK", terms: "Net 60" },
  { code: "SWA", name: "Swagelok Company", contact: "Tom Okafor", lead: 12, onTime: 0.94, delay: [1, 3], price: 0.015, country: "US", terms: "Net 30" },
  { code: "HON", name: "Honeywell Building Technologies", contact: "Rachel Kim", lead: 14, onTime: 0.79, delay: [2, 8], price: 0.082, country: "US", terms: "Net 45" },
  { code: "EAT", name: "Eaton Electrical", contact: "Victor Alvarez", lead: 18, onTime: 0.76, delay: [3, 10], price: 0.044, country: "US", terms: "Net 45" },
  { code: "SCH", name: "Schneider Electric", contact: "Claire Dubois", lead: 21, onTime: 0.85, delay: [2, 7], price: 0.026, country: "FR", terms: "Net 60" },
  { code: "WUR", name: "Würth Industry North America", contact: "Jake Morrison", lead: 5, onTime: 0.97, delay: [1, 2], price: 0.009, country: "US", terms: "Net 30" },
  { code: "3MS", name: "3M Safety & Industrial", contact: "Angela Brooks", lead: 7, onTime: 0.93, delay: [1, 3], price: 0.035, country: "US", terms: "Net 30" },
  { code: "APO", name: "Apollo Valves (Conbraco)", contact: "Sam Whitfield", lead: 14, onTime: 0.87, delay: [1, 5], price: 0.024, country: "US", terms: "Net 45" },
  { code: "ASC", name: "ASCO Valve (Emerson)", contact: "Nina Petrova", lead: 25, onTime: 0.71, delay: [4, 12], price: 0.053, country: "US", terms: "Net 60" },
] as const;

export const WAREHOUSES = [
  { id: "wh-chi", code: "CHI", name: "Chicago DC", city: "Chicago", state: "IL" },
  { id: "wh-col", code: "COL", name: "Columbus Branch", city: "Columbus", state: "OH" },
  { id: "wh-dal", code: "DAL", name: "Dallas Branch", city: "Dallas", state: "TX" },
] as const;

const B = "Bearings";
const H = "Hydraulics & Filtration";
const P = "Power Transmission";
const PU = "Pumps";
const V = "Valves";
const HV = "HVAC";
const E = "Electrical";
const F = "Fasteners";
const S = "Safety";
const L = "Lubrication";

export const CATALOG: CatalogEntry[] = [
  // Bearings
  { sku: "SKF-6205-2RS", name: "SKF 6205-2RSH Deep Groove Ball Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 40, weekly: 27, profile: "critical", moq: 50 },
  { sku: "SKF-6203-2RS", name: "SKF 6203-2RSH Deep Groove Ball Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 18.5, weekly: 44, profile: "critical", moq: 100 },
  { sku: "SKF-6204-2RS", name: "SKF 6204-2RSH Deep Groove Ball Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 22.4, weekly: 38, profile: "growing", moq: 100 },
  { sku: "SKF-6206-2RS", name: "SKF 6206-2RSH Deep Groove Ball Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 46.2, weekly: 19, profile: "reorder", moq: 50 },
  { sku: "SKF-6207-2Z", name: "SKF 6207-2Z Shielded Ball Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 58.9, weekly: 11, profile: "healthy", moq: 25 },
  { sku: "SKF-6305-2Z", name: "SKF 6305-2Z/C3 Shielded Ball Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 36.75, weekly: 14, profile: "critical", moq: 50, warehouse: "wh-col" },
  { sku: "SKF-22210-E", name: "SKF 22210 E Spherical Roller Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 214, weekly: 3.2, profile: "healthy", moq: 5 },
  { sku: "SKF-YAR-207", name: "SKF YAR 207-2F Insert Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 71.5, weekly: 6, profile: "reorder", moq: 10, warehouse: "wh-dal" },
  { sku: "SKF-NU-208", name: "SKF NU 208 ECP Cylindrical Roller Bearing", category: B, brand: "SKF", supplier: "SKF", cost: 132, weekly: 1.4, profile: "excess", moq: 10 },
  { sku: "TIM-LM11949", name: "Timken LM11949/LM11910 Tapered Roller Set", category: B, brand: "Timken", supplier: "TIM", cost: 16.9, weekly: 24, profile: "reorder", moq: 50 },
  { sku: "TIM-SET403", name: "Timken SET403 Tapered Bearing Set", category: B, brand: "Timken", supplier: "TIM", cost: 44.6, weekly: 9, profile: "growing", moq: 20, warehouse: "wh-dal" },
  { sku: "TIM-30208", name: "Timken 30208 Tapered Roller Bearing", category: B, brand: "Timken", supplier: "TIM", cost: 52.3, weekly: 4, profile: "healthy", moq: 10 },
  { sku: "DOD-UCP205", name: "Dodge UCP205-16 Pillow Block Bearing 1\"", category: B, brand: "Dodge", supplier: "TIM", cost: 38.2, weekly: 12, profile: "healthy", moq: 20 },
  { sku: "DOD-UCF206", name: "Dodge UCF206-20 4-Bolt Flange Bearing 1-1/4\"", category: B, brand: "Dodge", supplier: "TIM", cost: 61.4, weekly: 2.5, profile: "declining", moq: 10, warehouse: "wh-col" },

  // Hydraulics & filtration
  { sku: "DON-P165705", name: "Donaldson P165705 Hydraulic Filter", category: H, brand: "Donaldson", supplier: "DON", cost: 48.6, weekly: 22, profile: "reorder", moq: 12 },
  { sku: "DON-P551551", name: "Donaldson P551551 Fuel Filter Spin-On", category: H, brand: "Donaldson", supplier: "DON", cost: 21.3, weekly: 35, profile: "reorder", moq: 24 },
  { sku: "DON-P181052", name: "Donaldson P181052 Air Filter Primary", category: H, brand: "Donaldson", supplier: "DON", cost: 64.8, weekly: 8, profile: "healthy", moq: 6, warehouse: "wh-dal" },
  { sku: "PAR-925835", name: "Parker 925835 Hydraulic Filter Element 10µ", category: H, brand: "Parker", supplier: "PAR", cost: 57.25, weekly: 16, profile: "spike", moq: 12 },
  { sku: "PAR-937399Q", name: "Parker 937399Q Filter Element 10µ", category: H, brand: "Parker", supplier: "PAR", cost: 73.1, weekly: 6, profile: "healthy", moq: 6 },
  { sku: "PAR-4Z-FIT", name: "Parker 4-4 F5OX-S 1/4\" JIC Adapter", category: H, brand: "Parker", supplier: "PAR", cost: 6.85, weekly: 120, profile: "healthy", moq: 100 },
  { sku: "PAR-451TC-8", name: "Parker 451TC-8 Tough Cover Hydraulic Hose 1/2\" (ft)", category: H, brand: "Parker", supplier: "PAR", cost: 4.9, weekly: 460, profile: "growing", moq: 250, uom: "ft" },
  { sku: "PAR-PV046", name: "Parker PV046 Axial Piston Pump", category: H, brand: "Parker", supplier: "PAR", cost: 3850, weekly: 0.3, profile: "slow", moq: 1 },
  { sku: "HYD-0160D010", name: "HYDAC 0160D010BN4HC Pressure Filter Element", category: H, brand: "HYDAC", supplier: "PAR", cost: 82.4, weekly: 5, profile: "excess", moq: 10 },
  { sku: "PAR-SS-QC8", name: "Parker 60 Series Quick Coupler 1/2\"", category: H, brand: "Parker", supplier: "PAR", cost: 34.6, weekly: 18, profile: "healthy", moq: 20, warehouse: "wh-col" },

  // Power transmission
  { sku: "GAT-A48", name: "Gates A48 Hi-Power II V-Belt", category: P, brand: "Gates", supplier: "GAT", cost: 11.2, weekly: 58, profile: "reorder", moq: 50 },
  { sku: "GAT-B60", name: "Gates B60 Hi-Power II V-Belt", category: P, brand: "Gates", supplier: "GAT", cost: 16.4, weekly: 42, profile: "reorder", moq: 50 },
  { sku: "GAT-3VX500", name: "Gates 3VX500 Super HC Molded Notch V-Belt", category: P, brand: "Gates", supplier: "GAT", cost: 14.9, weekly: 36, profile: "critical", moq: 50, warehouse: "wh-dal" },
  { sku: "GAT-5VX710", name: "Gates 5VX710 Super HC Molded Notch V-Belt", category: P, brand: "Gates", supplier: "GAT", cost: 31.8, weekly: 15, profile: "healthy", moq: 25 },
  { sku: "GAT-AX38", name: "Gates AX38 Tri-Power Cogged V-Belt", category: P, brand: "Gates", supplier: "GAT", cost: 13.6, weekly: 27, profile: "healthy", moq: 50, warehouse: "wh-col" },
  { sku: "GAT-8MGT-1120", name: "Gates 8MGT-1120-30 PowerGrip GT3 Belt", category: P, brand: "Gates", supplier: "GAT", cost: 118, weekly: 2.2, profile: "excess", moq: 5 },
  { sku: "GAT-BX75", name: "Gates BX75 Tri-Power Cogged V-Belt", category: P, brand: "Gates", supplier: "GAT", cost: 21.9, weekly: 12, profile: "declining", moq: 25 },
  { sku: "TSU-RS40-10", name: "Tsubaki RS40 Roller Chain 10 ft", category: P, brand: "Tsubaki", supplier: "TIM", cost: 46.5, weekly: 14, profile: "healthy", moq: 10 },
  { sku: "TSU-RS60-10", name: "Tsubaki RS60 Roller Chain 10 ft", category: P, brand: "Tsubaki", supplier: "TIM", cost: 88.2, weekly: 5, profile: "reorder", moq: 5 },
  { sku: "LOV-L095", name: "Lovejoy L-095 Jaw Coupling Hub 3/4\"", category: P, brand: "Lovejoy", supplier: "TIM", cost: 18.7, weekly: 21, profile: "reorder", moq: 20 },
  { sku: "LOV-L100-SP", name: "Lovejoy L-100 SOX NBR Spider", category: P, brand: "Lovejoy", supplier: "TIM", cost: 9.4, weekly: 30, profile: "healthy", moq: 25 },
  { sku: "MAR-40BS18", name: "Martin 40BS18 1\" Bore Sprocket", category: P, brand: "Martin", supplier: "TIM", cost: 27.3, weekly: 0.4, profile: "dead", moq: 10 },

  // Pumps
  { sku: "GRU-CR3-10", name: "Grundfos CR 3-10 Vertical Multistage Pump", category: PU, brand: "Grundfos", supplier: "GRU", cost: 2140, weekly: 1.6, profile: "critical", moq: 2 },
  { sku: "GRU-UPS15-58", name: "Grundfos UPS15-58FC Circulator Pump", category: PU, brand: "Grundfos", supplier: "GRU", cost: 168, weekly: 14, profile: "seasonal_winter", moq: 6 },
  { sku: "GRU-ALPHA2", name: "Grundfos ALPHA2 15-55 F Circulator", category: PU, brand: "Grundfos", supplier: "GRU", cost: 294, weekly: 5, profile: "seasonal_winter", moq: 4, warehouse: "wh-col" },
  { sku: "GRU-CM5-4", name: "Grundfos CM 5-4 Horizontal Booster Pump", category: PU, brand: "Grundfos", supplier: "GRU", cost: 1185, weekly: 1.1, profile: "reorder", moq: 2 },
  { sku: "GOU-3656-1.5", name: "Goulds 3656 1-1/2x2-6 Centrifugal Pump", category: PU, brand: "Goulds", supplier: "GRU", cost: 1720, weekly: 0.5, profile: "excess", moq: 1 },
  { sku: "MAR-809-BR", name: "March 809-BR Magnetic Drive Pump", category: PU, brand: "March", supplier: "GRU", cost: 312, weekly: 1.8, profile: "healthy", moq: 2 },
  { sku: "LIT-NK-1", name: "Little Giant NK-1 Condensate Removal Pump", category: PU, brand: "Little Giant", supplier: "GRU", cost: 74.5, weekly: 9, profile: "seasonal_summer", moq: 6, warehouse: "wh-dal" },
  { sku: "ZOE-M53", name: "Zoeller M53 Mighty-Mate Sump Pump", category: PU, brand: "Zoeller", supplier: "GRU", cost: 156, weekly: 2.4, profile: "slow", moq: 4 },

  // Valves
  { sku: "SWA-SS-45S8", name: "Swagelok SS-45S8 Stainless Ball Valve 1/2\"", category: V, brand: "Swagelok", supplier: "SWA", cost: 142, weekly: 7, profile: "healthy", moq: 5 },
  { sku: "SWA-SS-8-VCO", name: "Swagelok SS-8-VCO-1 Fitting Body", category: V, brand: "Swagelok", supplier: "SWA", cost: 38.4, weekly: 13, profile: "healthy", moq: 10 },
  { sku: "SWA-SS-400-6", name: "Swagelok SS-400-6 Union Tube Fitting 1/4\"", category: V, brand: "Swagelok", supplier: "SWA", cost: 15.8, weekly: 64, profile: "growing", moq: 50 },
  { sku: "APO-77C-104", name: "Apollo 77C-104 Bronze Ball Valve 1\"", category: V, brand: "Apollo", supplier: "APO", cost: 41.2, weekly: 18, profile: "reorder", moq: 12 },
  { sku: "APO-77C-103", name: "Apollo 77C-103 Bronze Ball Valve 3/4\"", category: V, brand: "Apollo", supplier: "APO", cost: 29.6, weekly: 23, profile: "reorder", moq: 12, warehouse: "wh-col" },
  { sku: "APO-10-500", name: "Apollo 10-500 Safety Relief Valve 3/4\" 125 PSI", category: V, brand: "Apollo", supplier: "APO", cost: 64.5, weekly: 4, profile: "healthy", moq: 6 },
  { sku: "BRY-31H-4", name: "Bray Series 31H Butterfly Valve 4\"", category: V, brand: "Bray", supplier: "APO", cost: 268, weekly: 0.9, profile: "excess", moq: 2 },
  { sku: "WAT-LF25AUB", name: "Watts LF25AUB-Z3 Pressure Reducing Valve 3/4\"", category: V, brand: "Watts", supplier: "APO", cost: 112, weekly: 3.5, profile: "declining", moq: 4 },
  { sku: "ASC-8210G094", name: "ASCO 8210G094 Solenoid Valve 1\" 120VAC", category: V, brand: "ASCO", supplier: "ASC", cost: 186, weekly: 6, profile: "critical", moq: 4 },
  { sku: "ASC-8262H002", name: "ASCO 8262H002 Solenoid Valve 1/4\" 120VAC", category: V, brand: "ASCO", supplier: "ASC", cost: 118, weekly: 7, profile: "healthy", moq: 4, warehouse: "wh-dal" },
  { sku: "ASC-8316G064", name: "ASCO 8316G064 Solenoid Valve 3/4\"", category: V, brand: "ASCO", supplier: "ASC", cost: 214, weekly: 0.5, profile: "dead", moq: 2 },

  // HVAC
  { sku: "HON-TH6220", name: "Honeywell T6 Pro TH6220U2000 Thermostat", category: HV, brand: "Honeywell", supplier: "HON", cost: 64.2, weekly: 26, profile: "seasonal_winter", moq: 12 },
  { sku: "HON-V8043F", name: "Honeywell V8043F1036 Zone Valve 3/4\"", category: HV, brand: "Honeywell", supplier: "HON", cost: 96.8, weekly: 8, profile: "seasonal_winter", moq: 6 },
  { sku: "HON-ML7421", name: "Honeywell ML7421B1023 Valve Actuator", category: HV, brand: "Honeywell", supplier: "HON", cost: 412, weekly: 1.2, profile: "excess", moq: 2 },
  { sku: "BEL-LF24-US", name: "Belimo LF24-US Spring Return Damper Actuator", category: HV, brand: "Belimo", supplier: "HON", cost: 178, weekly: 6, profile: "healthy", moq: 4 },
  { sku: "MAR-12728", name: "Mars 12728 Run Capacitor 45/5 MFD 440V", category: HV, brand: "Mars", supplier: "HON", cost: 11.9, weekly: 70, profile: "seasonal_summer", moq: 50 },
  { sku: "MAR-12795", name: "Mars 12795 Run Capacitor 35/5 MFD 440V", category: HV, brand: "Mars", supplier: "HON", cost: 10.6, weekly: 55, profile: "seasonal_summer", moq: 50, warehouse: "wh-dal" },
  { sku: "MAR-61401", name: "Mars 61401 Contactor 1-Pole 40A 24V", category: HV, brand: "Mars", supplier: "HON", cost: 14.3, weekly: 38, profile: "seasonal_summer", moq: 25 },
  { sku: "FLT-20202-M13", name: "Pleated Air Filter 20x20x2 MERV 13 (12-pk)", category: HV, brand: "Flanders", supplier: "3MS", cost: 58.4, weekly: 31, profile: "healthy", moq: 10, uom: "case" },
  { sku: "FLT-16252-M8", name: "Pleated Air Filter 16x25x2 MERV 8 (12-pk)", category: HV, brand: "Flanders", supplier: "3MS", cost: 39.5, weekly: 22, profile: "reorder", moq: 10, uom: "case" },
  { sku: "FAS-D1092", name: "Fasco D1092 Condenser Fan Motor 1/3 HP", category: HV, brand: "Fasco", supplier: "HON", cost: 126, weekly: 4, profile: "seasonal_summer", moq: 4 },

  // Electrical
  { sku: "EAT-CH120", name: "Eaton CH120 Single-Pole 20A Breaker", category: E, brand: "Eaton", supplier: "EAT", cost: 9.6, weekly: 84, profile: "critical", moq: 100 },
  { sku: "EAT-BR230", name: "Eaton BR230 Double-Pole 30A Breaker", category: E, brand: "Eaton", supplier: "EAT", cost: 14.2, weekly: 46, profile: "reorder", moq: 50 },
  { sku: "EAT-XTCE018", name: "Eaton XTCE018C10A IEC Contactor 18A", category: E, brand: "Eaton", supplier: "EAT", cost: 72.4, weekly: 9, profile: "healthy", moq: 10 },
  { sku: "EAT-DG322", name: "Eaton DG322NRB 60A Safety Switch", category: E, brand: "Eaton", supplier: "EAT", cost: 134, weekly: 3.5, profile: "healthy", moq: 4, warehouse: "wh-col" },
  { sku: "SCH-LC1D18", name: "Schneider TeSys D LC1D18G7 Contactor", category: E, brand: "Schneider Electric", supplier: "SCH", cost: 88.5, weekly: 12, profile: "growing", moq: 10 },
  { sku: "SCH-GV2ME10", name: "Schneider GV2ME10 Motor Circuit Breaker 4-6.3A", category: E, brand: "Schneider Electric", supplier: "SCH", cost: 96.2, weekly: 7, profile: "healthy", moq: 5 },
  { sku: "SCH-ATV320", name: "Schneider Altivar ATV320 VFD 2HP 230V", category: E, brand: "Schneider Electric", supplier: "SCH", cost: 548, weekly: 1.5, profile: "healthy", moq: 2 },
  { sku: "SCH-XB4BA31", name: "Schneider XB4BA31 Pushbutton Green", category: E, brand: "Schneider Electric", supplier: "SCH", cost: 19.8, weekly: 2, profile: "slow", moq: 20 },
  { sku: "AB-700-HK36", name: "Allen-Bradley 700-HK36A1-4 Relay 120VAC", category: E, brand: "Allen-Bradley", supplier: "SCH", cost: 42.6, weekly: 15, profile: "reorder", moq: 10 },
  { sku: "OMR-E3Z-D61", name: "Omron E3Z-D61 Photoelectric Sensor", category: E, brand: "Omron", supplier: "SCH", cost: 68.9, weekly: 8, profile: "spike", moq: 5, warehouse: "wh-dal" },
  { sku: "PHX-UT4", name: "Phoenix Contact UT 4 Terminal Block (50-pk)", category: E, brand: "Phoenix Contact", supplier: "SCH", cost: 54.3, weekly: 11, profile: "healthy", moq: 5, uom: "pack" },
  { sku: "HUB-HBL2321", name: "Hubbell HBL2321 Twist-Lock Plug 20A", category: E, brand: "Hubbell", supplier: "EAT", cost: 21.4, weekly: 13, profile: "reorder", moq: 10 },
  { sku: "SQD-QO130", name: "Square D QO130 Single-Pole 30A Breaker", category: E, brand: "Square D", supplier: "SCH", cost: 12.1, weekly: 1, profile: "dead", moq: 25 },
  { sku: "EAT-9T75", name: "Eaton 9T75 Transformer 75kVA", category: E, brand: "Eaton", supplier: "EAT", cost: 6240, weekly: 0.12, profile: "slow", moq: 1 },

  // Fasteners
  { sku: "FST-HB-1213-2G8", name: "Hex Bolt 1/2-13 x 2\" Grade 8 Zinc-Yellow (50/bx)", category: F, brand: "Würth", supplier: "WUR", cost: 24.8, weekly: 64, profile: "healthy", moq: 20, uom: "box" },
  { sku: "FST-NLN-3816", name: "Nylon Insert Lock Nut 3/8-16 Zinc (100/bx)", category: F, brand: "Würth", supplier: "WUR", cost: 9.4, weekly: 92, profile: "reorder", moq: 25, uom: "box" },
  { sku: "FST-SHCS-M8-25", name: "Socket Head Cap Screw M8x25 Class 12.9 (100/bx)", category: F, brand: "Würth", supplier: "WUR", cost: 18.6, weekly: 48, profile: "reorder", moq: 20, uom: "box" },
  { sku: "FST-FW-12-SAE", name: "SAE Flat Washer 1/2\" Hardened (100/bx)", category: F, brand: "Würth", supplier: "WUR", cost: 11.2, weekly: 75, profile: "healthy", moq: 25, uom: "box" },
  { sku: "FST-WA-12-4", name: "Wedge Anchor 1/2 x 4-1/4\" Zinc (25/bx)", category: F, brand: "Hilti", supplier: "WUR", cost: 32.5, weekly: 26, profile: "growing", moq: 10, uom: "box" },
  { sku: "FST-TH-3816-36", name: "Threaded Rod 3/8-16 x 36\" Zinc", category: F, brand: "Würth", supplier: "WUR", cost: 3.9, weekly: 210, profile: "healthy", moq: 100, warehouse: "wh-col" },
  { sku: "FST-SS-HB-M10", name: "Stainless Hex Bolt M10x40 A4-70 (50/bx)", category: F, brand: "Würth", supplier: "WUR", cost: 46.7, weekly: 3, profile: "excess", moq: 10, uom: "box" },
  { sku: "FST-CS-1420-1", name: "Carriage Bolt 1/4-20 x 1\" Zinc (100/bx)", category: F, brand: "Würth", supplier: "WUR", cost: 8.1, weekly: 2.5, profile: "slow", moq: 25, uom: "box" },

  // Safety
  { sku: "3M-8210", name: "3M 8210 N95 Particulate Respirator (20/bx)", category: S, brand: "3M", supplier: "3MS", cost: 21.6, weekly: 85, profile: "spike", moq: 24, uom: "box" },
  { sku: "3M-6503QL", name: "3M 6503QL Rugged Comfort Half Mask (L)", category: S, brand: "3M", supplier: "3MS", cost: 26.9, weekly: 12, profile: "healthy", moq: 12 },
  { sku: "3M-SF201AF", name: "3M SecureFit SF201AF Safety Glasses (20/bx)", category: S, brand: "3M", supplier: "3MS", cost: 52.8, weekly: 18, profile: "reorder", moq: 10, uom: "box" },
  { sku: "ANS-11-840-9", name: "Ansell HyFlex 11-840 Gloves Size 9 (12 pr)", category: S, brand: "Ansell", supplier: "3MS", cost: 34.2, weekly: 52, profile: "reorder", moq: 24, uom: "dozen" },
  { sku: "HOW-MAX-1", name: "Howard Leight MAX-1 Foam Earplugs (200/bx)", category: S, brand: "Howard Leight", supplier: "3MS", cost: 31.4, weekly: 24, profile: "healthy", moq: 10, uom: "box", warehouse: "wh-dal" },
  { sku: "MSA-VGARD-W", name: "MSA V-Gard Hard Hat Fas-Trac III White", category: S, brand: "MSA", supplier: "3MS", cost: 18.7, weekly: 16, profile: "healthy", moq: 20 },
  { sku: "3M-1860", name: "3M 1860 Health Care N95 Respirator (20/bx)", category: S, brand: "3M", supplier: "3MS", cost: 24.9, weekly: 6, profile: "declining", moq: 24, uom: "box" },
  { sku: "MSA-ALTAIR4X", name: "MSA Altair 4XR Multigas Detector", category: S, brand: "MSA", supplier: "3MS", cost: 845, weekly: 0.3, profile: "excess", moq: 2 },

  // Lubrication
  { sku: "MOB-POLYREX", name: "Mobil Polyrex EM Electric Motor Grease 13.4oz", category: L, brand: "Mobil", supplier: "WUR", cost: 12.4, weekly: 48, profile: "reorder", moq: 40 },
  { sku: "MOB-DTE25-5", name: "Mobil DTE 25 Hydraulic Oil 5 gal", category: L, brand: "Mobil", supplier: "PAR", cost: 96.5, weekly: 14, profile: "healthy", moq: 8, uom: "pail" },
  { sku: "SKF-LGMT2-04", name: "SKF LGMT 2/0.4 General Purpose Grease 420ml", category: L, brand: "SKF", supplier: "SKF", cost: 14.8, weekly: 22, profile: "reorder", moq: 24 },
  { sku: "SKF-TLSD-125", name: "SKF TLSD 125 Single Point Lubricator", category: L, brand: "SKF", supplier: "SKF", cost: 98.4, weekly: 2, profile: "declining", moq: 6 },
  { sku: "LPS-02316", name: "LPS 2 Heavy-Duty Lubricant 11oz", category: L, brand: "LPS", supplier: "WUR", cost: 7.2, weekly: 1, profile: "dead", moq: 24 },
];

// Items customers ask for that Northstar does NOT stock (drives Lost Demand).
export const UNSTOCKED_REQUESTS = [
  { key: "gates-8mgt-1200", item: "Gates 8MGT-1200-30 PowerGrip GT3 Belt", category: P, price: 186, weight: 9, growth: 1.6 },
  { key: "grundfos-magna3-32-100", item: "Grundfos MAGNA3 32-100 F Circulator", category: PU, price: 2380, weight: 5, growth: 1.4 },
  { key: "baldor-em3546t", item: "Baldor EM3546T 2HP Premium Efficiency Motor", category: E, price: 742, weight: 8, growth: 1.3 },
  { key: "belimo-grb24-sr", item: "Belimo GRB24-SR Rotary Damper Actuator", category: HV, price: 398, weight: 7, growth: 1.8 },
  { key: "timken-30210", item: "Timken 30210 Tapered Roller Bearing", category: B, price: 89, weight: 11, growth: 1.1 },
  { key: "skf-6308-2rs", item: "SKF 6308-2RS1/C3 Deep Groove Ball Bearing", category: B, price: 74, weight: 10, growth: 1.5 },
  { key: "danfoss-fc051-2hp", item: "Danfoss VLT Micro Drive FC-051 2HP", category: E, price: 612, weight: 6, growth: 1.7 },
  { key: "parker-hf6-qc", item: "Parker FF-501-8FP Flat Face Coupler 1/2\"", category: H, price: 96, weight: 6, growth: 1.0 },
  { key: "3m-6800", item: "3M 6800 Full Facepiece Respirator (M)", category: S, price: 168, weight: 4, growth: 0.9 },
  { key: "asco-8221g003", item: "ASCO 8221G003 Normally Open Solenoid Valve", category: V, price: 274, weight: 3, growth: 1.0 },
  { key: "honeywell-v5011n", item: "Honeywell V5011N1040 Globe Valve 3/4\"", category: HV, price: 312, weight: 3, growth: 0.7 },
  { key: "lovejoy-l110", item: "Lovejoy L-110 Jaw Coupling Hub 1-1/8\"", category: P, price: 64, weight: 5, growth: 1.2 },
];

export const CUSTOMERS = [
  "Midwest Packaging Co.", "Great Lakes Food Processing", "Lakeshore Plastics", "Prairie Grain Cooperative",
  "Buckeye Metal Fabricators", "Ohio Valley Water Authority", "Lone Star Bottling", "Gulf Coast Chemical",
  "Riverside Hospital Facilities", "Summit Steel Works", "Heartland Mechanical Contractors", "Allied HVAC Services",
  "Tri-County Paper Mill", "Northern Cold Storage", "Patriot Automotive Components", "Keystone Conveyor Systems",
  "Redline Machining", "Badger State Dairy", "Cardinal Facilities Group", "Pioneer Mining Supply",
];
