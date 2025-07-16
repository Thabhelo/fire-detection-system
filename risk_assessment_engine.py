#!/usr/bin/env python3
"""
Fire Hazard Risk Assessment Engine
This is the "brain" of the system and can be fully developed and tested without hardware, with simulated/mock sensor data
"""

import json
import time
import math
import random
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional
from enum import Enum
import numpy as np
from collections import deque

class RiskLevel(Enum):
    SAFE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class FuelType(Enum):
    PETROL = "petrol"
    DIESEL = "diesel"
    ETHANOL = "ethanol"
    JET_A1 = "jet_a1"

@dataclass
class SensorReading:
    timestamp: float
    gas_lpg_ppm: float
    gas_smoke_ppm: float
    temperature_c: float
    humidity_rh: float
    flame_ir_raw: int
    flame_uv_raw: int
    flame_detected: bool
    wind_speed_mps: float
    wind_direction_deg: int
    barometric_pressure_hpa: float
    data_quality: int  # 0-100%

@dataclass
class RiskAssessment:
    risk_level: RiskLevel
    risk_score: float
    contributing_factors: List[str]
    recommended_actions: List[str]
    confidence: float
    timestamp: float

class FuelProperties:
    """Fuel-specific properties for risk assessment"""
    
    FUEL_DATA = {
        FuelType.PETROL: {
            "flash_point_c": -43,
            "autoignition_c": 280,
            "vapor_density": 3.4,  # relative to air
            "lel_ppm": 14000,      # Lower explosive limit
            "uel_ppm": 76000,      # Upper explosive limit
            "critical_temp_c": 45,  # Above this, vapor pressure increases rapidly
        },
        FuelType.ETHANOL: {
            "flash_point_c": 13,
            "autoignition_c": 365,
            "vapor_density": 1.59,
            "lel_ppm": 33000,
            "uel_ppm": 190000,
            "critical_temp_c": 40,
        },
        FuelType.DIESEL: {
            "flash_point_c": 52,
            "autoignition_c": 210,
            "vapor_density": 4.5,
            "lel_ppm": 6000,
            "uel_ppm": 75000,
            "critical_temp_c": 70,
        },
        FuelType.JET_A1: {
            "flash_point_c": 38,
            "autoignition_c": 210,
            "vapor_density": 4.5,
            "lel_ppm": 6000,
            "uel_ppm": 75000,
            "critical_temp_c": 60,
        }
    }

class TrendAnalyzer:
    """Analyzes trends in sensor data for predictive risk assessment"""
    
    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        self.history = deque(maxlen=window_size)
    
    def add_reading(self, reading: SensorReading):
        self.history.append(reading)
    
    def calculate_trend_factor(self) -> float:
        """Calculate trend factor (1.0 = stable, >1.0 = increasing risk)"""
        if len(self.history) < 5:
            return 1.0
        
        # Calculate rate of change for gas concentration
        recent_gas = [r.gas_lpg_ppm for r in list(self.history)[-5:]]
        older_gas = [r.gas_lpg_ppm for r in list(self.history)[-10:-5]] if len(self.history) >= 10 else recent_gas
        
        recent_avg = np.mean(recent_gas)
        older_avg = np.mean(older_gas)
        
        if older_avg == 0:
            return 1.0
        
        trend_ratio = recent_gas[-1] / older_avg
        
        # Calculate temperature trend
        recent_temps = [r.temperature_c for r in list(self.history)[-5:]]
        temp_slope = np.polyfit(range(len(recent_temps)), recent_temps, 1)[0] if len(recent_temps) > 1 else 0
        
        # Combine gas and temperature trends
        trend_factor = trend_ratio + (temp_slope * 0.1)
        return max(0.5, min(3.0, trend_factor))  # Clamp between 0.5 and 3.0

class WeatherImpactCalculator:
    """Calculates weather impact on vapor dispersion and fire risk"""
    
    @staticmethod
    def calculate_dispersion_factor(wind_speed: float, wind_direction: int, 
                                  temperature: float, humidity: float, 
                                  pressure: float) -> float:
        """
        Calculate how weather affects vapor dispersion
        Returns factor: 1.0 = neutral, <1.0 = better dispersion (lower risk), >1.0 = worse dispersion
        """
        # Wind dispersion effect
        if wind_speed < 0.5:  # Very calm conditions
            wind_factor = 1.5  # Vapors accumulate
        elif wind_speed < 2.0:  # Light breeze
            wind_factor = 1.2
        elif wind_speed < 5.0:  # Moderate wind
            wind_factor = 0.8  # Good dispersion
        else:  # Strong wind
            wind_factor = 0.6  # Excellent dispersion
        
        # Temperature inversion effect (high pressure + low wind = poor dispersion)
        if pressure > 1020 and wind_speed < 1.0 and temperature < 10:
            inversion_factor = 1.4
        else:
            inversion_factor = 1.0
        
        # Humidity effect (high humidity can suppress some vapors)
        humidity_factor = 1.0 - (humidity - 50) * 0.002 if humidity > 50 else 1.0
        
        return wind_factor * inversion_factor * humidity_factor

class RiskAssessmentEngine:
    """Main risk assessment engine"""
    
    def __init__(self, fuel_type: FuelType = FuelType.PETROL):
        self.fuel_type = fuel_type
        self.fuel_props = FuelProperties.FUEL_DATA[fuel_type]
        self.trend_analyzer = TrendAnalyzer()
        self.weather_calculator = WeatherImpactCalculator()
        
        # Configurable thresholds
        self.thresholds = {
            "gas_warning_ppm": self.fuel_props["lel_ppm"] * 0.1,  # 10% of LEL
            "gas_critical_ppm": self.fuel_props["lel_ppm"] * 0.25,  # 25% of LEL
            "temp_warning_c": self.fuel_props["critical_temp_c"],
            "temp_critical_c": self.fuel_props["autoignition_c"] * 0.7,
            "flame_ir_threshold": 512,  # ADC reading threshold
            "flame_uv_threshold": 256,
        }
    
    def assess_risk(self, reading: SensorReading) -> RiskAssessment:
        """Main risk assessment function"""
        self.trend_analyzer.add_reading(reading)
        
        # Initialize risk calculation
        risk_score = 0.0
        contributing_factors = []
        recommended_actions = []
        
        # 1. Immediate flame detection (highest priority)
        if reading.flame_detected or (reading.flame_ir_raw > self.thresholds["flame_ir_threshold"] 
                                     and reading.flame_uv_raw > self.thresholds["flame_uv_threshold"]):
            return RiskAssessment(
                risk_level=RiskLevel.CRITICAL,
                risk_score=1.0,
                contributing_factors=["Direct flame detected"],
                recommended_actions=["IMMEDIATE EVACUATION", "Activate fire suppression", "Emergency shutdown"],
                confidence=0.95,
                timestamp=reading.timestamp
            )
        
        # 2. Gas concentration risk
        gas_risk = self._assess_gas_risk(reading, contributing_factors, recommended_actions)
        risk_score += gas_risk * 0.4  # 40% weight
        
        # 3. Temperature risk
        temp_risk = self._assess_temperature_risk(reading, contributing_factors, recommended_actions)
        risk_score += temp_risk * 0.3  # 30% weight
        
        # 4. Environmental factors
        env_risk = self._assess_environmental_risk(reading, contributing_factors, recommended_actions)
        risk_score += env_risk * 0.2  # 20% weight
        
        # 5. Trend analysis
        trend_factor = self.trend_analyzer.calculate_trend_factor()
        trend_risk = (trend_factor - 1.0) * 0.5  # Convert to 0-1 scale
        risk_score += trend_risk * 0.1  # 10% weight
        
        if trend_factor > 1.2:
            contributing_factors.append(f"Increasing trend detected (factor: {trend_factor:.2f})")
            recommended_actions.append("Monitor closely - conditions deteriorating")
        
        # Apply weather dispersion effects
        dispersion_factor = self.weather_calculator.calculate_dispersion_factor(
            reading.wind_speed_mps, reading.wind_direction_deg,
            reading.temperature_c, reading.humidity_rh, reading.barometric_pressure_hpa
        )
        risk_score *= dispersion_factor
        
        if dispersion_factor > 1.2:
            contributing_factors.append("Poor weather conditions for vapor dispersion")
        elif dispersion_factor < 0.8:
            contributing_factors.append("Good weather conditions aiding vapor dispersion")
        
        # Determine final risk level
        risk_level = self._score_to_level(risk_score)
        confidence = self._calculate_confidence(reading)
        
        return RiskAssessment(
            risk_level=risk_level,
            risk_score=min(1.0, risk_score),
            contributing_factors=contributing_factors,
            recommended_actions=recommended_actions,
            confidence=confidence,
            timestamp=reading.timestamp
        )
    
    def _assess_gas_risk(self, reading: SensorReading, factors: List[str], actions: List[str]) -> float:
        """Assess risk from gas concentrations"""
        gas_concentration = max(reading.gas_lpg_ppm, reading.gas_smoke_ppm)
        
        if gas_concentration > self.thresholds["gas_critical_ppm"]:
            factors.append(f"Critical gas concentration: {gas_concentration:.0f} ppm")
            actions.append("Immediate area evacuation")
            actions.append("Ventilation system activation")
            return 1.0
        elif gas_concentration > self.thresholds["gas_warning_ppm"]:
            factors.append(f"Elevated gas concentration: {gas_concentration:.0f} ppm")
            actions.append("Increase monitoring frequency")
            actions.append("Check for leaks")
            return gas_concentration / self.thresholds["gas_critical_ppm"]
        
        return gas_concentration / self.thresholds["gas_warning_ppm"] * 0.2
    
    def _assess_temperature_risk(self, reading: SensorReading, factors: List[str], actions: List[str]) -> float:
        """Assess risk from temperature"""
        temp = reading.temperature_c
        
        if temp > self.thresholds["temp_critical_c"]:
            factors.append(f"Critical temperature: {temp:.1f}°C")
            actions.append("Emergency cooling procedures")
            return 1.0
        elif temp > self.thresholds["temp_warning_c"]:
            factors.append(f"Elevated temperature: {temp:.1f}°C")
            actions.append("Monitor temperature closely")
            actions.append("Consider cooling measures")
            return (temp - self.thresholds["temp_warning_c"]) / (self.thresholds["temp_critical_c"] - self.thresholds["temp_warning_c"])
        
        return 0.0
    
    def _assess_environmental_risk(self, reading: SensorReading, factors: List[str], actions: List[str]) -> float:
        """Assess environmental risk factors"""
        risk = 0.0
        
        # Low humidity increases static electricity risk
        if reading.humidity_rh < 30:
            factors.append(f"Low humidity ({reading.humidity_rh:.1f}%) increases static risk")
            actions.append("Increase humidity if possible")
            actions.append("Ground all equipment")
            risk += 0.3
        
        # Very low wind allows vapor accumulation
        if reading.wind_speed_mps < 0.5:
            factors.append("Very low wind speed - poor vapor dispersion")
            actions.append("Activate mechanical ventilation")
            risk += 0.4
        
        # High pressure systems can trap vapors
        if reading.barometric_pressure_hpa > 1025:
            factors.append("High pressure system may trap vapors")
            risk += 0.2
        
        return min(1.0, risk)
    
    def _score_to_level(self, score: float) -> RiskLevel:
        """Convert risk score to discrete level"""
        if score < 0.2:
            return RiskLevel.SAFE
        elif score < 0.4:
            return RiskLevel.LOW
        elif score < 0.6:
            return RiskLevel.MEDIUM
        elif score < 0.8:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL
    
    def _calculate_confidence(self, reading: SensorReading) -> float:
        """Calculate confidence in the risk assessment"""
        confidence = reading.data_quality / 100.0
        
        # Reduce confidence if sensors are at extremes
        if reading.gas_lpg_ppm > 50000 or reading.temperature_c > 100:
            confidence *= 0.8
        
        # Reduce confidence if environmental conditions are unusual
        if reading.wind_speed_mps > 20 or reading.humidity_rh > 95:
            confidence *= 0.9
        
        return max(0.5, confidence)

class SensorSimulator:
    """Simulates realistic sensor data for testing"""
    
    def __init__(self, fuel_type: FuelType = FuelType.PETROL):
        self.fuel_type = fuel_type
        self.base_temp = 25.0
        self.base_gas = 50.0
        self.incident_mode = False
        self.incident_start = 0
    
    def generate_reading(self, scenario: str = "normal") -> SensorReading:
        """Generate simulated sensor reading"""
        timestamp = time.time()
        
        if scenario == "normal":
            return self._normal_reading(timestamp)
        elif scenario == "gas_leak":
            return self._gas_leak_scenario(timestamp)
        elif scenario == "temperature_rise":
            return self._temperature_rise_scenario(timestamp)
        elif scenario == "fire_event":
            return self._fire_event_scenario(timestamp)
        else:
            return self._normal_reading(timestamp)
    
    def _normal_reading(self, timestamp: float) -> SensorReading:
        return SensorReading(
            timestamp=timestamp,
            gas_lpg_ppm=random.uniform(10, 100),
            gas_smoke_ppm=random.uniform(5, 50),
            temperature_c=random.uniform(20, 35),
            humidity_rh=random.uniform(40, 70),
            flame_ir_raw=random.randint(100, 200),
            flame_uv_raw=random.randint(50, 150),
            flame_detected=False,
            wind_speed_mps=random.uniform(0.5, 5.0),
            wind_direction_deg=random.randint(0, 359),
            barometric_pressure_hpa=random.uniform(1010, 1025),
            data_quality=random.randint(90, 100)
        )
    
    def _gas_leak_scenario(self, timestamp: float) -> SensorReading:
        # Simulate gradual gas concentration increase
        base_reading = self._normal_reading(timestamp)
        base_reading.gas_lpg_ppm = random.uniform(500, 2000)  # Elevated but not critical
        base_reading.gas_smoke_ppm = random.uniform(100, 300)
        return base_reading
    
    def _temperature_rise_scenario(self, timestamp: float) -> SensorReading:
        base_reading = self._normal_reading(timestamp)
        base_reading.temperature_c = random.uniform(50, 80)  # Hot but not ignition
        base_reading.gas_lpg_ppm = random.uniform(200, 800)
        return base_reading
    
    def _fire_event_scenario(self, timestamp: float) -> SensorReading:
        base_reading = self._normal_reading(timestamp)
        base_reading.flame_detected = True
        base_reading.flame_ir_raw = random.randint(800, 1023)
        base_reading.flame_uv_raw = random.randint(600, 1023)
        base_reading.temperature_c = random.uniform(80, 150)
        base_reading.gas_lpg_ppm = random.uniform(1000, 5000)
        return base_reading

def test_risk_engine():
    """Test the risk assessment engine with various scenarios"""
    
    print("🔥 Fire Risk Assessment Engine Test")
    print("=" * 50)
    
    # Initialize engine for petrol tank
    engine = RiskAssessmentEngine(FuelType.PETROL)
    simulator = SensorSimulator(FuelType.PETROL)
    
    scenarios = ["normal", "gas_leak", "temperature_rise", "fire_event"]
    
    for scenario in scenarios:
        print(f"\n🧪 Testing Scenario: {scenario.upper()}")
        print("-" * 30)
        
        # Generate and assess multiple readings for trend analysis
        for i in range(5):
            reading = simulator.generate_reading(scenario)
            assessment = engine.assess_risk(reading)
            
            print(f"Reading {i+1}:")
            print(f"  Gas: {reading.gas_lpg_ppm:.0f} ppm, Temp: {reading.temperature_c:.1f}°C")
            print(f"  Risk: {assessment.risk_level.name} (Score: {assessment.risk_score:.3f})")
            if assessment.contributing_factors:
                print(f"  Factors: {', '.join(assessment.contributing_factors[:2])}")
            if assessment.recommended_actions:
                print(f"  Actions: {assessment.recommended_actions[0]}")
            print()

if __name__ == "__main__":
    test_risk_engine()