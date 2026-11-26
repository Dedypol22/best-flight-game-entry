// Game constants and configuration
export const CONFIG = {
  // Canvas
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,

  // Physics
  GRAVITY: 9.81,
  AIR_DENSITY: 1.225,
  TIME_STEP: 1/60,

  // Aircraft
  AIRCRAFT: {
    MASS: 1200,           // kg
    WING_AREA: 18,        // m²
    WING_SPAN: 11,        // m
    CL_MAX: 1.6,          // max lift coefficient
    CD_0: 0.025,          // zero-lift drag
    CD_ALPHA: 0.04,       // drag due to lift factor
    THRUST_MAX: 4500,     // N at full throttle
    THRUST_IDLE: 400,     // N at idle
    PROP_RPM_MAX: 2400,
    PROP_RPM_IDLE: 600,
    FUEL_CAPACITY: 200,   // liters
    FUEL_BURN_MAX: 0.12,  // L/s at full throttle
    FUEL_BURN_IDLE: 0.015,
    STALL_SPEED: 35,      // m/s (clean)
    STALL_SPEED_FLAPS: 28, // m/s (with flaps)
    MAX_SPEED: 85,        // m/s
    ROLL_RATE_MAX: 1.15,  // rad/s
    PITCH_RATE_MAX: 1.8,  // rad/s
    YAW_STABILITY: 0.3,
    GEAR_DRAG: 0.015,
    FLAP_DRAG: 0.03,
    FLAP_LIFT: 0.25,
  },

  // World
  WORLD: {
    SIZE: 4000,           // meters
    SEA_LEVEL: 0,
    VOLCANO_HEIGHT: 600,
    VOLCANO_RADIUS: 800,
    RUNWAY_LENGTH: 800,
    RUNWAY_WIDTH: 30,
    RUNWAY_X: 1500,
    RUNWAY_Z: -1800,
    RUNWAY_HEADING: 0,    // radians, 0 = north
  },

  // Colors (warm late afternoon)
  COLORS: {
    SKY_TOP: '#2a1a12',
    SKY_HORIZON: '#e8a030',
    SKY_MID: '#c87020',
    SUN_COLOR: '#fff8d0',
    SUN_GLOW: '#ffb840',
    CLOUD_COLOR: '#f0e8d0',
    CLOUD_SHADOW: '#887050',
    SEA_DEEP: '#183848',
    SEA_SHALLOW: '#205870',
    SEA_FOAM: '#c8d8e0',
    VOLCANO_ROCK: '#282018',
    VOLCANO_DARK: '#18100c',
    VOLCANO_GLOW: '#e85020',
    VOLCANO_SMOKE: '#403830',
    GRASS_LIGHT: '#486030',
    GRASS_DARK: '#304020',
    FIELD_1: '#507038',
    FIELD_2: '#405828',
    FIELD_3: '#587840',
    VILLAGE_ROOF: '#803020',
    VILLAGE_WALL: '#c8a888',
    RIVER_WATER: '#285068',
    RIVER_BANK: '#383028',
    RUNWAY_SURFACE: '#4a443c',
    RUNWAY_MARKING: '#f0f0e8',
    WINDSOCK_POLE: '#302820',
    WINDSOCK_FABRIC: '#e84030',
    HANGAR_ROOF: '#383028',
    HANGAR_WALL: '#504840',
    AIRCRAFT_BODY: '#c84028',
    AIRCRAFT_WING: '#a83020',
    AIRCRAFT_TAIL: '#b83824',
    AIRCRAFT_PROP: '#201814',
    AIRCRAFT_PROP_BLUR: '#30241c80',
    AIRCRAFT_GEAR: '#302820',
    AIRCRAFT_LIGHT_RED: '#e82020',
    AIRCRAFT_LIGHT_GREEN: '#20e840',
    AIRCRAFT_LIGHT_WHITE: '#fff0d0',
    RING_COLOR: '#e8a030',
    RING_GLOW: '#ffc840',
    DROP_ZONE: '#20a040',
    CRATE_BODY: '#805020',
    CRATE_MARK: '#e8a030',
    PARTICLE_SMOKE: '#504840',
    PARTICLE_EXHAUST: '#e8a030',
    PARTICLE_SPLASH: '#a8c8d8',
    HUD_TEXT: '#f0e8d0',
    HUD_DIM: '#a89878',
    HUD_ACCENT: '#e8a030',
    HUD_WARN: '#e84030',
    HUD_OK: '#40c060',
    PANEL_BG: '#100c08',
    PANEL_BORDER: '#3a3024',
    PANEL_GREEN: '#40e060',
    PANEL_AMBER: '#e8a030',
    PANEL_RED: '#e83030',
    PANEL_WHITE: '#f0e8d0',
  },

  // Missions
  MISSIONS: [
    {
      id: 0,
      name: 'Ring Run',
      description: 'Fly through 6 target rings in sequence',
      rings: 6,
      drops: 0,
      landing: false,
    },
    {
      id: 1,
      name: 'Cargo Drop',
      description: 'Drop 3 supply crates on marked zones',
      rings: 0,
      drops: 3,
      landing: false,
    },
    {
      id: 2,
      name: 'Island Return',
      description: 'Land on the coastal runway: gear down, low sink, on centerline',
      rings: 0,
      drops: 0,
      landing: true,
    },
  ],

  // Ring positions (x, z, radius, height) — heights sit well clear of the
  // terrain on the ring itself and on the straight line from the previous
  // ring, so a flown route never has to thread a ridge at ring height.
  RINGS: [
    { x: 500, z: -500, radius: 40, height: 230 },
    { x: -300, z: -800, radius: 35, height: 190 },
    { x: -800, z: -200, radius: 35, height: 180 },
    { x: -400, z: 600, radius: 40, height: 250 },
    { x: 600, z: 800, radius: 35, height: 200 },
    { x: 1200, z: 200, radius: 30, height: 150 },
  ],

  // Drop zones (x, z, radius)
  DROP_ZONES: [
    { x: -200, z: 300, radius: 25 },
    { x: 400, z: -400, radius: 30 },
    { x: -600, z: -100, radius: 25 },
  ],

  // Scoring
  SCORING: {
    RING_PASS: 500,
    RING_PERFECT: 1000,   // centered pass
    DROP_HIT: 800,
    DROP_CLOSE: 400,      // within zone but not center
    LANDING_PERFECT: 2000, // on centerline, low sink, gear down, stopped
    LANDING_GOOD: 1200,
    LANDING_ROUGH: 500,
    TIME_BONUS: 10,       // per second remaining
    FUEL_BONUS: 5,        // per percent remaining
    DAMAGE_PENALTY: 20,   // per percent damage
  },

  // Camera
  CAMERA: {
    // Close enough that the aircraft reads clearly in the frame (a
    // distant chase cam shrinks it to a speck half-hidden behind the
    // instrument panel), far enough to see the ring/runway ahead.
    CHASE_DIST: 55,
    CHASE_HEIGHT: 16,
    CHASE_LAG: 0.12,
    COCKPIT_EYE_X: 0,
    COCKPIT_EYE_Y: 1.8,
    COCKPIT_EYE_Z: 0.5,
  },

  // Terrain rendering
  TERRAIN: {
    VIEW_DIST: 2200,
    STRIP_COUNT: 18,
    STRIP_SPACING: 120,
    DETAIL_DIST: 800,
  },

  // Audio
  AUDIO: {
    MASTER_VOLUME: 0.5,
    ENGINE_VOLUME: 0.4,
    WIND_VOLUME: 0.25,
    CHIME_VOLUME: 0.5,
    THUD_VOLUME: 0.6,
  },
};
