# Fire Hazard Predictive Detection System
## Low Level Design Document

---

## 1. SYSTEM ARCHITECTURE

### 1.1 High-Level Block Diagram
```
┌───────────────────────────────────────────────────────────────┐
│                    SENSOR ARRAY SUBSYSTEM                     │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Gas Sensors │ Flame Sensor│ Temp/Humid  │ Environmental       │
│ MQ-2/MQ-135 │ IR + UV     │ SHT30       │ Wind/Pressure       │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
              │              │              │              │
              ▼              ▼              ▼              ▼
┌───────────────────────────────────────────────────────────────┐
│               SIGNAL CONDITIONING & ADC                       │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Amplifiers  │ Filters     │ ADC Buffers │ Level Shifters      │
│ Op-Amps     │ Anti-alias  │ Sample&Hold │ 3.3V ↔ 5V           │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                 MAIN PROCESSING UNIT                          │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ ESP32-S3    │ Real-time   │ AI Engine   │ Data Logging        │
│ Dual-Core   │ Analytics   │ TensorFlow  │ SPIFFS/SD Card      │
│ 240MHz      │ Algorithm   │ Lite        │ Ring Buffer         │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  LOCAL I/O  │    │ COMMUNICATION   │    │ POWER MGMT      │
│             │    │                 │    │                 │
│ • OLED      │    │ • 4G LTE        │    │ • Li-Ion 18650  │
│ • Buzzer    │    │ • LoRaWAN       │    │ • Solar MPPT    │
│ • LEDs      │    │ • WiFi/BLE      │    │ • Buck/Boost    │
│ • Buttons   │    │ • RS485         │    │ • Load Switch   │
└─────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 System Specifications
- **Operating Voltage:** 3.3V/5V dual rail
- **Power Consumption:** <2W active, <100mW standby
- **Operating Temperature:** -40°C to +85°C
- **IP Rating:** IP67 (weatherproof enclosure)
- **Communication Range:** 10km (LoRa), Cellular coverage
- **Data Rate:** 1-10 samples/second per sensor
- **Response Time:** <5 seconds for critical alerts

---

## 2. HARDWARE DESIGN

### 2.1 Main Controller Selection: ESP32-S3
**Rationale:** Dual-core ARM Cortex-M4F with integrated WiFi/BLE, sufficient for real-time processing and AI inference.

**Key Features:**
- 240MHz dual-core processor
- 512KB SRAM, 384KB ROM
- Integrated WiFi 802.11b/g/n
- Bluetooth 5.0 LE
- 45 GPIO pins
- 2x 12-bit SAR ADCs (20 channels)
- Hardware security features

### 2.2 Sensor Interface Design

#### 2.2.1 Gas Sensor Array
```
Gas Sensor Configuration:
┌─────────────────────────────────────────┐
│           MQ-2 (LPG/Smoke)              │
├─────────────────────────────────────────┤
│ VCC: 5V (heater), 3.3V (logic)          │
│ Heater Current: 150mA                   │
│ Analog Output: 0-5V → 0-3.3V divider    │
│ Digital Threshold: Adjustable via pot   │
│ Warm-up Time: 20 seconds                │
└─────────────────────────────────────────┘

Circuit Design:
VCC_5V ──[10Ω]──┬── MQ-2_VH (Heater)
                │
              [LED] ──> Heater Status
                
MQ-2_AO ──[R1=10k]──┬── ADC_CH1 (ESP32)
                    │
                [R2=20k]
                    │
                   GND

Where: Voltage Divider = 5V × (20k/(10k+20k)) = 3.33V max
```

#### 2.2.2 Flame Sensor (Dual-Band)
```
Flame Detection Circuit:
┌─────────────────────────────────────────┐
│        IR + UV Flame Sensor             │
├─────────────────────────────────────────┤
│ IR Photodiode: 760-1100nm               │
│ UV Photodiode: 185-260nm                │
│ Response Time: <3ms                     │
│ Detection Range: 1-15 meters            │
└─────────────────────────────────────────┘

IR Channel:
IR_Photodiode ──[TIA_Circuit]── Op-Amp ── ADC_CH2
                     ↓
              [Feedback_100kΩ]

UV Channel:
UV_Photodiode ──[TIA_Circuit]── Op-Amp ── ADC_CH3
                     ↓
               [Feedback_1MΩ]

Note: Use dual-channel for false alarm reduction
```

#### 2.2.3 Environmental Sensors
```
SHT30 (Temperature/Humidity):
┌─────────────────────────────────────────┐
│ Interface: I2C (400kHz)                 │
│ Address: 0x44 (default)                 │
│ Accuracy: ±0.3°C, ±2% RH                │
│ Range: -40 to +125°C, 0-100% RH         │
└─────────────────────────────────────────┘

I2C Bus Design:
VCC_3V3 ──[4.7kΩ]──┬── SDA ── GPIO21 (ESP32)
                   │
VCC_3V3 ──[4.7kΩ]──┴── SCL ── GPIO22 (ESP32)

Wind Speed/Direction (Optional):
┌─────────────────────────────────────────┐
│ Anemometer: Pulse output                │
│ Wind Vane: Potentiometer (0-360°)       │
│ Interface: Digital + Analog             │
└─────────────────────────────────────────┘
```

### 2.3 Communication Subsystem

#### 2.3.1 4G LTE Module (SIM7600G)
```
SIM7600G Interface:
┌─────────────────────────────────────────┐
│ Interface: UART (115200 baud)           │
│ Power: 3.8V, 2A peak current            │
│ Protocols: TCP/IP, HTTP, MQTT, FTP      │
│ GPS: Integrated GNSS                    │
└─────────────────────────────────────────┘

Power Control Circuit:
VCC_MAIN ──[P-FET]──┬── SIM7600_VCC
            │       │
       GPIO_PWR ────┘   [C_bulk=1000µF]
                        │
                       GND

UART Connection:
ESP32_TX2 ──────────── SIM7600_RX
ESP32_RX2 ──────────── SIM7600_TX
ESP32_GPIO ──────────── SIM7600_PWR_KEY
ESP32_GPIO ──────────── SIM7600_STATUS
```

#### 2.3.2 LoRaWAN Module (RFM95W)
```
LoRa Configuration:
┌─────────────────────────────────────────┐
│ Frequency: 868MHz (EU) / 915MHz (US)    │
│ Power: +20dBm max                       │
│ Sensitivity: -148dBm                    │
│ Range: 10-15km line of sight            │
└─────────────────────────────────────────┘

SPI Interface:
ESP32_MOSI ─────────── RFM95_MOSI
ESP32_MISO ─────────── RFM95_MISO
ESP32_SCK ──────────── RFM95_SCK
ESP32_CS ───────────── RFM95_NSS
ESP32_GPIO ─────────── RFM95_RESET
ESP32_GPIO ─────────── RFM95_DIO0 (IRQ)
```

### 2.4 Power Management System

#### 2.4.1 Power Architecture
```
Solar Panel (20W) ──[Schottky]── MPPT Controller ──┬── Battery Pack
12V nominal                      (CN3791)          │   (4S Li-Ion)
                                                   │   14.8V, 5Ah
                                                   │
Power Distribution:                                │
┌──────────────────────────────────────────────────┼────┐
│                                                  │    │
├── Buck 5V/2A ──┬── Gas Sensor Heaters            │    │
│   (MP2315)     └── Buzzer/LED Drivers            │    │
│                                                  │    │
├── Buck 3.3V/1A ── ESP32, Sensors, LoRa           │    │
│   (AP2112K)                                      │    │
│                                                  │    │
├── Boost 5V/1A ── SIM7600G (when active)          │    │
│   (MT3608)                                       │    │
│                                                  │    │
└── Load Switches ── Individual module control     │    │
    (TPS22860)                                     │    │
                                                   │    │
Battery Monitor (MAX17048) ────────────────────────┴────┘
```

#### 2.4.2 Power Budget Analysis
```
Power Consumption Breakdown:
┌─────────────────────────────────────────┐
│ Component        │ Active │ Standby     │
├─────────────────────────────────────────┤
│ ESP32-S3         │ 240mA  │ 10µA        │
│ Gas Sensors (2x) │ 300mA  │ 0mA (off)   │
│ SHT30           │ 1.5mA  │ 0.6µA        │
│ Flame Sensor    │ 20mA   │ 2mA          │
│ OLED Display    │ 15mA   │ 0mA (off)    │
│ LoRa Module     │ 120mA  │ 1.5µA        │
│ LTE Module      │ 2000mA │ 1mA          │
│ Buzzer/LEDs     │ 100mA  │ 0mA          │
├─────────────────────────────────────────┤
│ Total (worst)   │ 2.8A   │ 15mA         │
│ Typical        │ 400mA  │ 15mA          │
└─────────────────────────────────────────┘

Battery Life Calculation:
- Normal Operation: 5000mAh / 400mA = 12.5 hours
- Standby Mode: 5000mAh / 15mA = 333 hours (14 days)
- Solar Charging: 20W / 14.8V = 1.35A charging current
```

---

## 3. PCB DESIGN GUIDELINES

### 3.1 Layer Stack-up (4-layer PCB)
```
Layer 1: Signal + Components (Top)
Layer 2: Ground Plane
Layer 3: Power Planes (3.3V, 5V)
Layer 4: Signal + Components (Bottom)
```

### 3.2 Design Rules
- **Minimum Track Width:** 0.2mm (8 mil)
- **Minimum Via Size:** 0.2mm drill, 0.45mm pad
- **Minimum Spacing:** 0.15mm (6 mil)
- **Impedance Control:** 50Ω single-ended, 100Ω differential
- **PCB Thickness:** 1.6mm standard

### 3.3 Critical Design Considerations

#### 3.3.1 Analog Section Layout
```
Gas Sensor Placement:
┌────────────────────────────────────────┐
│ • Separate analog and digital grounds  │
│ • Star ground configuration            │
│ • Guard rings around sensitive traces  │
│ • Differential routing for sensors     │
│ • Ferrite beads on power lines         │
└────────────────────────────────────────┘
```

#### 3.3.2 RF Section Layout
```
LoRa Module Placement:
┌─────────────────────────────────────────┐
│ • 50Ω controlled impedance antenna      │
│ • Keep switching circuits away          │
│ • Solid ground plane underneath         │
│ • SMA connector for external antenna    │
│ • π-filter on power supply              │
└─────────────────────────────────────────┘
```

#### 3.3.3 Power Section Layout
```
Power Distribution:
┌─────────────────────────────────────────┐
│ • Wide power traces (minimum 1mm)       │
│ • Multiple vias for current paths       │
│ • Separate analog/digital supplies      │
│ • Bulk capacitors near power entry      │
│ • Decoupling caps at each IC            │
└─────────────────────────────────────────┘
```

---

## 4. SOFTWARE ARCHITECTURE

### 4.1 Real-Time Operating System
```cpp
// FreeRTOS Task Structure
TaskHandle_t sensorTask;
TaskHandle_t commTask;
TaskHandle_t analyticsTask;
TaskHandle_t safetyTask;

// Priority Levels
#define SAFETY_TASK_PRIORITY    (4)  // Highest
#define SENSOR_TASK_PRIORITY    (3)
#define ANALYTICS_TASK_PRIORITY (2)
#define COMM_TASK_PRIORITY      (1)  // Lowest

// Stack Sizes
#define SAFETY_STACK_SIZE       (4096)
#define SENSOR_STACK_SIZE       (8192)
#define ANALYTICS_STACK_SIZE    (16384)
#define COMM_STACK_SIZE         (8192)
```

### 4.2 Sensor Data Pipeline
```cpp
// Sensor Data Structure
typedef struct {
    uint32_t timestamp;
    float gas_lpg_ppm;
    float gas_smoke_ppm;
    float temperature_c;
    float humidity_rh;
    uint16_t flame_ir_raw;
    uint16_t flame_uv_raw;
    bool flame_detected;
    uint8_t wind_speed_mps;
    uint16_t wind_direction_deg;
    uint8_t data_quality;
} sensor_data_t;

// Ring Buffer for Data Storage
#define BUFFER_SIZE 1000
sensor_data_t sensor_buffer[BUFFER_SIZE];
volatile uint16_t buffer_head = 0;
volatile uint16_t buffer_tail = 0;
```

### 4.3 Risk Assessment Algorithm
```cpp
// Risk Level Enumeration
typedef enum {
    RISK_SAFE = 0,
    RISK_LOW = 1,
    RISK_MEDIUM = 2,
    RISK_HIGH = 3,
    RISK_CRITICAL = 4
} risk_level_t;

// Risk Calculation Function
risk_level_t calculate_risk_level(sensor_data_t* data) {
    float risk_score = 0.0;
    
    // Gas concentration risk (weighted)
    risk_score += (data->gas_lpg_ppm / GAS_THRESHOLD_CRITICAL) * 0.4;
    risk_score += (data->gas_smoke_ppm / SMOKE_THRESHOLD_CRITICAL) * 0.3;
    
    // Temperature risk
    if (data->temperature_c > TEMP_THRESHOLD_HIGH) {
        risk_score += ((data->temperature_c - TEMP_THRESHOLD_HIGH) / 50.0) * 0.2;
    }
    
    // Flame detection (immediate critical)
    if (data->flame_detected) {
        return RISK_CRITICAL;
    }
    
    // Wind factor (dispersal effect)
    float wind_factor = 1.0 - (data->wind_speed_mps * 0.05); // Reduce risk with wind
    risk_score *= wind_factor;
    
    // Trend analysis (rate of change)
    float trend_factor = calculate_trend_factor();
    risk_score *= trend_factor;
    
    // Convert to discrete levels
    if (risk_score < 0.2) return RISK_SAFE;
    if (risk_score < 0.4) return RISK_LOW;
    if (risk_score < 0.6) return RISK_MEDIUM;
    if (risk_score < 0.8) return RISK_HIGH;
    return RISK_CRITICAL;
}
```

### 4.4 Communication Protocol
```cpp
// Message Structure
typedef struct {
    uint8_t device_id[8];       // Unique device identifier
    uint32_t timestamp;         // Unix timestamp
    uint8_t message_type;       // Alert, status, data
    uint8_t risk_level;         // Current risk assessment
    sensor_data_t sensor_data;  // Latest sensor readings
    float gps_lat;              // GPS coordinates
    float gps_lon;
    uint8_t battery_level;      // Battery percentage
    uint16_t crc16;             // Message integrity check
} device_message_t;

// JSON Serialization for HTTP/MQTT
void serialize_to_json(device_message_t* msg, char* json_buffer) {
    snprintf(json_buffer, JSON_BUFFER_SIZE,
        "{"
        "\"device_id\":\"%s\","
        "\"timestamp\":%u,"
        "\"risk_level\":%d,"
        "\"gas_lpg\":%.2f,"
        "\"gas_smoke\":%.2f,"
        "\"temperature\":%.1f,"
        "\"humidity\":%.1f,"
        "\"flame_detected\":%s,"
        "\"gps_lat\":%.6f,"
        "\"gps_lon\":%.6f,"
        "\"battery\":%d"
        "}",
        msg->device_id, msg->timestamp, msg->risk_level,
        msg->sensor_data.gas_lpg_ppm, msg->sensor_data.gas_smoke_ppm,
        msg->sensor_data.temperature_c, msg->sensor_data.humidity_rh,
        msg->sensor_data.flame_detected ? "true" : "false",
        msg->gps_lat, msg->gps_lon, msg->battery_level
    );
}
```

---

## 5. SAFETY & PROTECTION CIRCUITS

### 5.1 Intrinsically Safe Design
```
Intrinsic Safety Barriers:
┌─────────────────────────────────────────┐
│ • Zener diode voltage clamps            │
│ • Current limiting resistors            │
│ • Galvanic isolation (optocouplers)     │
│ • Fused power supplies                  │
│ • Approved enclosure (ATEX/IECEx)       │
└─────────────────────────────────────────┘

Example Circuit:
Sensor_Input ──[R_limit=300Ω]──┬──[Zener_3.6V]── ADC_Input
                               │
                           [Zener_3.6V]
                               │
                              GND
```

### 5.2 Environmental Protection
```
Protection Features:
┌─────────────────────────────────────────┐
│ • IP67 rated enclosure                  │
│ • Conformal coating on PCB              │
│ • Desiccant packets inside              │
│ • Pressure relief valve                 │
│ • UV-resistant materials                │
└─────────────────────────────────────────┘

ESD Protection:
All I/O pins ──[TVS_Diode]── Protected_Input
                    │
                   GND
```

### 5.3 Fail-Safe Mechanisms
```cpp
// Watchdog Implementation
void setup_watchdog() {
    // Hardware watchdog (2 seconds timeout)
    esp_task_wdt_init(2, true);
    esp_task_wdt_add(NULL);
    
    // Software watchdog for critical tasks
    setup_software_watchdog();
}

// Sensor Health Monitoring
bool check_sensor_health() {
    // Check for stuck readings
    if (sensor_variance_too_low()) return false;
    
    // Check for out-of-range values
    if (readings_out_of_range()) return false;
    
    // Check communication integrity
    if (i2c_errors > MAX_I2C_ERRORS) return false;
    
    return true;
}
```

---

## 6. MANUFACTURING & TESTING

### 6.1 Assembly Process
1. **SMT Assembly:** Automated pick-and-place for 95% of components
2. **Through-hole:** Manual assembly for connectors and large components
3. **Conformal Coating:** Selective coating for protection
4. **Enclosure Assembly:** IP67 sealing with gaskets
5. **Final Testing:** Automated test fixture

### 6.2 Test Procedures
```
Manufacturing Tests:
┌─────────────────────────────────────────┐
│ 1. In-Circuit Test (ICT)                │
│ 2. Boundary Scan Test                   │
│ 3. Power-on Self Test (POST)            │
│ 4. Sensor Calibration                   │
│ 5. Communication Test                   │
│ 6. Environmental Chamber Test           │
│ 7. IP67 Pressure Test                   │
└─────────────────────────────────────────┘
```

### 6.3 Calibration Process
```cpp
// Factory Calibration Procedure
void factory_calibration() {
    // Gas sensor baseline in clean air
    calibrate_gas_sensors_baseline();
    
    // Temperature sensor offset correction
    calibrate_temperature_offset();
    
    // Flame sensor sensitivity adjustment
    calibrate_flame_threshold();
    
    // Store calibration data in EEPROM
    store_calibration_data();
}
```

---

## 7. COST ANALYSIS

### 7.1 Bill of Materials (Estimated)
```
Component Costs (USD, 100 unit quantities):
┌─────────────────────────────────────────┐
│ ESP32-S3 Module      │ $8.50            │
│ Gas Sensors (2x)     │ $15.00           │
│ Flame Sensor         │ $12.00           │
│ SHT30 Sensor         │ $4.50            │
│ SIM7600G Module      │ $35.00           │
│ LoRa Module          │ $8.00            │
│ Power Management     │ $25.00           │
│ PCB (4-layer)        │ $15.00           │
│ Enclosure & Hardware │ $30.00           │
│ Assembly & Test      │ $20.00           │
├─────────────────────────────────────────┤
│ Total per unit       │ $173.00          │
└─────────────────────────────────────────┘
```

### 7.2 Development Timeline
```
Phase 1: Proof of Concept (6 weeks)
├── Hardware prototype
├── Basic firmware
└── Laboratory testing

Phase 2: Engineering Validation (8 weeks)
├── PCB design & layout
├── Full firmware implementation
├── Environmental testing
└── Safety certification prep

Phase 3: Manufacturing Setup (4 weeks)
├── Manufacturing documentation
├── Test fixture development
├── Supplier qualification
└── Pilot production run

Total Development Time: 18 weeks
```

---

## 8. REGULATORY COMPLIANCE

### 8.1 Required Certifications
```
Safety Standards:
┌─────────────────────────────────────────┐
│ • IECEx/ATEX (Explosive Atmospheres)    │
│ • UL 2089 (Health/Wellness Devices)     │
│ • IEC 61010 (Safety Requirements)       │
│ • IP67 (Ingress Protection)             │
└─────────────────────────────────────────┘

RF/EMC Standards:
┌─────────────────────────────────────────┐
│ • FCC Part 15 (Unlicensed RF)           │
│ • EN 301 489 (EMC for Radio)            │
│ • EN 300 220 (Short Range Devices)      │
│ • CE Marking (European Conformity)      │
└─────────────────────────────────────────┘
``` 