/*
 * Fire Detection System - Main Code
 * ESP32 Based Fire Hazard Detection
 *
 * Author: Nqobizitha Moyo
 * Date: $(date +%Y-%m-%d)
 */

#include <WiFi.h>

// Pin definitions
#define GAS_SENSOR_PIN A0
#define FLAME_SENSOR_PIN 2
#define TEMP_SENSOR_PIN 4
#define BUZZER_PIN 5
#define LED_RED_PIN 6
#define LED_YELLOW_PIN 7
#define LED_GREEN_PIN 8

// Thresholds
#define GAS_THRESHOLD 300
#define TEMP_THRESHOLD 35

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(FLAME_SENSOR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_YELLOW_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  
  // Initialize sensors
  // Add sensor initialization code here

  Serial.println("Fire Detection System Started");
}

void loop() {
  // Read sensors
  int gasLevel = analogRead(GAS_SENSOR_PIN);
  int flameDetected = digitalRead(FLAME_SENSOR_PIN);
  float temperature = readTemperature();

  // Check risk level
  String riskLevel = assessRisk(gasLevel, temperature, flameDetected);

  // Update display and alerts
  updateDisplay(riskLevel, gasLevel, temperature);
  checkAlerts(riskLevel);

  delay(2000); // Read every 2 seconds
}

float readTemperature() {
  // Add temperature sensor reading code
  return 25.0; // Placeholder
}

String assessRisk(int gas, float temp, int flame) {
  if (flame == LOW || gas > GAS_THRESHOLD * 2 || temp > TEMP_THRESHOLD + 20) {
    return "CRITICAL";
  } else if (gas > GAS_THRESHOLD || temp > TEMP_THRESHOLD) {
    return "HIGH";
  } else if (gas > GAS_THRESHOLD * 0.5 || temp > TEMP_THRESHOLD - 10) {
    return "MEDIUM";
  } else {
    return "SAFE";
  }
}

void updateDisplay(String risk, int gas, float temp) {
  Serial.print("Risk: "); Serial.print(risk);
  Serial.print(" | Gas: "); Serial.print(gas);
  Serial.print(" | Temp: "); Serial.println(temp);

  // Update LEDs based on risk
  digitalWrite(LED_GREEN_PIN, risk == "SAFE" ? HIGH : LOW);
  digitalWrite(LED_YELLOW_PIN, risk == "MEDIUM" ? HIGH : LOW);
  digitalWrite(LED_RED_PIN, (risk == "HIGH" || risk == "CRITICAL") ? HIGH : LOW);
}

void checkAlerts(String risk) {
  if (risk == "CRITICAL" || risk == "HIGH") {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(500);
    digitalWrite(BUZZER_PIN, LOW);

    // Send SMS/Email alert
    sendAlert(risk);
  }
}

void sendAlert(String risk) {
  // Add SMS/Email sending code here
  Serial.println("ALERT SENT: " + risk + " risk detected!");
}
