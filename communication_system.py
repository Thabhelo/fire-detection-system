#!/usr/bin/env python3
"""
Fire Detection System Communication Layer
Handles data transmission, message formatting, and alert distribution
Can be fully developed and tested without hardware, with simulated/mock sensor data
"""

import json
import asyncio
import aiohttp
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import base64

# Import our risk assessment components
from risk_assessment_engine import SensorReading, RiskAssessment, RiskLevel

class MessageType(Enum):
    HEARTBEAT = "heartbeat"
    SENSOR_DATA = "sensor_data"
    ALERT = "alert"
    STATUS_UPDATE = "status"
    SYSTEM_ERROR = "error"

class CommunicationChannel(Enum):
    SMS = "sms"
    EMAIL = "email"
    HTTP_POST = "http"
    MQTT = "mqtt"
    LORA = "lora"
    WEBHOOK = "webhook"

@dataclass
class DeviceMessage:
    device_id: str
    timestamp: float
    message_type: MessageType
    risk_level: RiskLevel
    sensor_data: Optional[SensorReading]
    risk_assessment: Optional[RiskAssessment]
    battery_level: int
    signal_strength: int
    gps_lat: float
    gps_lon: float
    message_id: str
    
    def __post_init__(self):
        if not self.message_id:
            # Generate unique message ID
            content = f"{self.device_id}{self.timestamp}{self.message_type.value}"
            self.message_id = hashlib.md5(content.encode()).hexdigest()[:16]

@dataclass
class AlertContact:
    name: str
    phone: str
    email: str
    role: str
    priority: int  # 1 = highest priority
    channels: List[CommunicationChannel]

@dataclass
class AlertConfig:
    escalation_delay_minutes: int = 5
    max_retries: int = 3
    require_acknowledgment: bool = True
    auto_escalate: bool = True

class MessageFormatter:
    """Formats messages for different communication channels"""
    
    @staticmethod
    def format_sms_alert(message: DeviceMessage) -> str:
        """Format alert message for SMS"""
        risk_level = message.risk_level.name
        location = f"GPS: {message.gps_lat:.4f}, {message.gps_lon:.4f}"
        timestamp = datetime.fromtimestamp(message.timestamp).strftime("%H:%M:%S")
        
        if message.risk_level == RiskLevel.CRITICAL:
            return (f"🚨 CRITICAL FIRE ALERT\n"
                   f"Device: {message.device_id}\n"
                   f"Time: {timestamp}\n"
                   f"Location: {location}\n"
                   f"IMMEDIATE ACTION REQUIRED!")
        elif message.risk_level == RiskLevel.HIGH:
            return (f"⚠️ HIGH FIRE RISK\n"
                   f"Device: {message.device_id}\n"
                   f"Time: {timestamp}\n"
                   f"Location: {location}\n"
                   f"Monitor closely")
        else:
            return (f"ℹ️ Fire Risk Update\n"
                   f"Device: {message.device_id}\n"
                   f"Risk: {risk_level}\n"
                   f"Time: {timestamp}")
    
    @staticmethod
    def format_email_alert(message: DeviceMessage) -> Dict[str, str]:
        """Format alert message for email"""
        risk_level = message.risk_level.name
        timestamp = datetime.fromtimestamp(message.timestamp).strftime("%Y-%m-%d %H:%M:%S")
        
        subject_prefix = "🚨 CRITICAL" if message.risk_level == RiskLevel.CRITICAL else "⚠️ ALERT"
        
        subject = f"{subject_prefix} - Fire Detection System - {message.device_id}"
        
        # Build detailed email body
        body = f"""
Fire Detection System Alert

Device Information:
- Device ID: {message.device_id}
- Timestamp: {timestamp}
- Risk Level: {risk_level}
- Location: {message.gps_lat:.6f}, {message.gps_lon:.6f}
- Battery Level: {message.battery_level}%
- Signal Strength: {message.signal_strength}%

"""
        
        if message.sensor_data:
            body += f"""Sensor Readings:
- Gas Concentration (LPG): {message.sensor_data.gas_lpg_ppm:.1f} ppm
- Gas Concentration (Smoke): {message.sensor_data.gas_smoke_ppm:.1f} ppm
- Temperature: {message.sensor_data.temperature_c:.1f}°C
- Humidity: {message.sensor_data.humidity_rh:.1f}%
- Flame Detected: {'YES' if message.sensor_data.flame_detected else 'NO'}
- Wind Speed: {message.sensor_data.wind_speed_mps:.1f} m/s

"""
        
        if message.risk_assessment:
            body += f"""Risk Assessment:
- Risk Score: {message.risk_assessment.risk_score:.3f}
- Confidence: {message.risk_assessment.confidence:.3f}
- Contributing Factors: {', '.join(message.risk_assessment.contributing_factors)}
- Recommended Actions: {', '.join(message.risk_assessment.recommended_actions)}

"""
        
        body += f"""
Message ID: {message.message_id}

This is an automated message from the Fire Detection System.
Please respond immediately if this is a critical alert.
"""
        
        return {"subject": subject, "body": body}
    
    @staticmethod
    def format_json_payload(message: DeviceMessage) -> str:
        """Format message as JSON for API/webhook transmission"""
        payload = {
            "device_id": message.device_id,
            "timestamp": message.timestamp,
            "message_type": message.message_type.value,
            "risk_level": message.risk_level.value,
            "battery_level": message.battery_level,
            "signal_strength": message.signal_strength,
            "location": {
                "lat": message.gps_lat,
                "lon": message.gps_lon
            },
            "message_id": message.message_id
        }
        
        if message.sensor_data:
            payload["sensor_data"] = {
                "gas_lpg_ppm": message.sensor_data.gas_lpg_ppm,
                "gas_smoke_ppm": message.sensor_data.gas_smoke_ppm,
                "temperature_c": message.sensor_data.temperature_c,
                "humidity_rh": message.sensor_data.humidity_rh,
                "flame_detected": message.sensor_data.flame_detected,
                "wind_speed_mps": message.sensor_data.wind_speed_mps,
                "wind_direction_deg": message.sensor_data.wind_direction_deg,
                "barometric_pressure_hpa": message.sensor_data.barometric_pressure_hpa
            }
        
        if message.risk_assessment:
            payload["risk_assessment"] = {
                "risk_score": message.risk_assessment.risk_score,
                "contributing_factors": message.risk_assessment.contributing_factors,
                "recommended_actions": message.risk_assessment.recommended_actions,
                "confidence": message.risk_assessment.confidence
            }
        
        return json.dumps(payload, indent=2)

class CommunicationManager:
    """Manages all communication channels and message routing"""
    
    def __init__(self, config: AlertConfig):
        self.config = config
        self.contacts: List[AlertContact] = []
        self.message_queue = asyncio.Queue()
        self.sent_messages: Dict[str, datetime] = {}
        self.acknowledgments: Dict[str, bool] = {}
        self.logger = logging.getLogger(__name__)
        
        # Communication channel handlers
        self.channel_handlers = {
            CommunicationChannel.HTTP_POST: self._send_http_post,
            CommunicationChannel.SMS: self._send_sms,
            CommunicationChannel.EMAIL: self._send_email,
            CommunicationChannel.WEBHOOK: self._send_webhook,
            CommunicationChannel.MQTT: self._send_mqtt,
        }
    
    def add_contact(self, contact: AlertContact):
        """Add emergency contact"""
        self.contacts.append(contact)
        self.contacts.sort(key=lambda x: x.priority)
    
    async def send_message(self, message: DeviceMessage):
        """Send message through appropriate channels based on risk level"""
        self.logger.info(f"Processing message {message.message_id} with risk level {message.risk_level.name}")
        
        # Determine which contacts to notify based on risk level
        contacts_to_notify = self._get_contacts_for_risk_level(message.risk_level)
        
        # Send to each contact via their preferred channels
        for contact in contacts_to_notify:
            for channel in contact.channels:
                try:
                    await self._send_via_channel(message, contact, channel)
                except Exception as e:
                    self.logger.error(f"Failed to send via {channel.value} to {contact.name}: {e}")
        
        # Store message for potential escalation
        self.sent_messages[message.message_id] = datetime.now(timezone.utc)
        
        # Start escalation timer for critical messages
        if message.risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH] and self.config.auto_escalate:
            asyncio.create_task(self._start_escalation_timer(message))
    
    def _get_contacts_for_risk_level(self, risk_level: RiskLevel) -> List[AlertContact]:
        """Determine which contacts to notify based on risk level"""
        if risk_level == RiskLevel.CRITICAL:
            return self.contacts  # Notify everyone
        elif risk_level == RiskLevel.HIGH:
            return [c for c in self.contacts if c.priority <= 2]  # Top 2 priority levels
        elif risk_level == RiskLevel.MEDIUM:
            return [c for c in self.contacts if c.priority == 1]  # Only highest priority
        else:
            return []  # No immediate notification for low/safe
    
    async def _send_via_channel(self, message: DeviceMessage, contact: AlertContact, channel: CommunicationChannel):
        """Send message via specific communication channel"""
        handler = self.channel_handlers.get(channel)
        if handler:
            await handler(message, contact)
        else:
            self.logger.warning(f"No handler for channel: {channel.value}")
    
    async def _send_http_post(self, message: DeviceMessage, contact: AlertContact):
        """Send message via HTTP POST to API endpoint"""
        url = "https://api.example.com/fire-alerts"  # Replace with actual endpoint
        payload = MessageFormatter.format_json_payload(message)
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=payload, headers={"Content-Type": "application/json"}) as response:
                if response.status == 200:
                    self.logger.info(f"HTTP POST sent successfully to {url}")
                else:
                    self.logger.error(f"HTTP POST failed: {response.status}")
    
    async def _send_sms(self, message: DeviceMessage, contact: AlertContact):
        """Send SMS alert (placeholder - integrate with SMS service)"""
        sms_text = MessageFormatter.format_sms_alert(message)
        
        # Placeholder for SMS service integration (Twilio, AWS SNS, etc.)
        self.logger.info(f"SMS Alert sent to {contact.phone}: {sms_text[:50]}...")
        
        # In real implementation, use SMS service API:
        # await sms_service.send(phone=contact.phone, message=sms_text)
    
    async def _send_email(self, message: DeviceMessage, contact: AlertContact):
        """Send email alert (placeholder - integrate with email service)"""
        email_content = MessageFormatter.format_email_alert(message)
        
        # Placeholder for email service integration (SendGrid, AWS SES, etc.)
        self.logger.info(f"Email sent to {contact.email}: {email_content['subject']}")
        
        # In real implementation, use email service API:
        # await email_service.send(to=contact.email, subject=email_content['subject'], body=email_content['body'])
    
    async def _send_webhook(self, message: DeviceMessage, contact: AlertContact):
        """Send webhook notification"""
        webhook_url = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"  # Replace with actual webhook
        payload = {
            "text": f"Fire Alert: {message.risk_level.name}",
            "attachments": [
                {
                    "color": "danger" if message.risk_level == RiskLevel.CRITICAL else "warning",
                    "fields": [
                        {"title": "Device", "value": message.device_id, "short": True},
                        {"title": "Risk Level", "value": message.risk_level.name, "short": True},
                        {"title": "Location", "value": f"{message.gps_lat:.4f}, {message.gps_lon:.4f}", "short": True},
                        {"title": "Time", "value": datetime.fromtimestamp(message.timestamp).strftime("%H:%M:%S"), "short": True}
                    ]
                }
            ]
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as response:
                if response.status == 200:
                    self.logger.info("Webhook sent successfully")
                else:
                    self.logger.error(f"Webhook failed: {response.status}")
    
    async def _send_mqtt(self, message: DeviceMessage, contact: AlertContact):
        """Send MQTT message (placeholder)"""
        topic = f"fire-detection/{message.device_id}/alerts"
        payload = MessageFormatter.format_json_payload(message)
        
        # Placeholder for MQTT client integration
        self.logger.info(f"MQTT message published to {topic}")
        
        # In real implementation:
        # await mqtt_client.publish(topic, payload)
    
    async def _start_escalation_timer(self, message: DeviceMessage):
        """Start escalation timer for unacknowledged messages"""
        await asyncio.sleep(self.config.escalation_delay_minutes * 60)
        
        # Check if message was acknowledged
        if not self.acknowledgments.get(message.message_id, False):
            self.logger.warning(f"Message {message.message_id} not acknowledged - escalating")
            
            # Escalate to all contacts
            escalated_message = message
            escalated_message.message_type = MessageType.ALERT
            
            for contact in self.contacts:
                for channel in contact.channels:
                    try:
                        await self._send_via_channel(escalated_message, contact, channel)
                    except Exception as e:
                        self.logger.error(f"Escalation failed for {contact.name}: {e}")
    
    def acknowledge_message(self, message_id: str, contact_name: str):
        """Record message acknowledgment"""
        self.acknowledgments[message_id] = True
        self.logger.info(f"Message {message_id} acknowledged by {contact_name}")

class DataLogger:
    """Logs all messages and sensor data for analysis"""
    
    def __init__(self, log_file: str = "fire_detection.log"):
        self.log_file = log_file
        self.setup_logging()
    
    def setup_logging(self):
        """Configure logging system"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler()
            ]
        )
    
    def log_message(self, message: DeviceMessage):
        """Log message to file and database"""
        log_entry = {
            "timestamp": message.timestamp,
            "device_id": message.device_id,
            "message_type": message.message_type.value,
            "risk_level": message.risk_level.value,
            "message_id": message.message_id
        }
        
        if message.sensor_data:
            log_entry["sensor_data"] = asdict(message.sensor_data)
        
        if message.risk_assessment:
            log_entry["risk_assessment"] = asdict(message.risk_assessment)
        
        # Log to file
        logging.getLogger("data_logger").info(json.dumps(log_entry))
        
        # In production, also log to database
        # await database.insert_log_entry(log_entry)

# Demo/Test Functions
async def demo_communication_system():
    """Demonstrate the communication system"""
    print("🌐 Communication System Demo")
    print("=" * 40)
    
    # Setup configuration
    config = AlertConfig(
        escalation_delay_minutes=1,  # 1 minute for demo
        max_retries=3,
        require_acknowledgment=True,
        auto_escalate=True
    )
    
    # Setup communication manager
    comm_manager = CommunicationManager(config)
    
    # Add emergency contacts
    contacts = [
        AlertContact("Fire Chief", "+1234567890", "chief@fire.dept", "Fire Department", 1, 
                    [CommunicationChannel.SMS, CommunicationChannel.EMAIL]),
        AlertContact("Safety Manager", "+1234567891", "safety@company.com", "Safety", 1, 
                    [CommunicationChannel.EMAIL, CommunicationChannel.WEBHOOK]),
        AlertContact("Maintenance", "+1234567892", "maint@company.com", "Maintenance", 2, 
                    [CommunicationChannel.SMS]),
    ]
    
    for contact in contacts:
        comm_manager.add_contact(contact)
    
    # Create test messages
    from risk_assessment_engine import SensorSimulator, RiskAssessmentEngine, FuelType
    
    simulator = SensorSimulator(FuelType.PETROL)
    risk_engine = RiskAssessmentEngine(FuelType.PETROL)
    
    # Test different scenarios
    scenarios = [
        ("normal", "Normal operation"),
        ("gas_leak", "Gas leak detected"),
        ("fire_event", "Fire event critical")
    ]
    
    for scenario, description in scenarios:
        print(f"\n📡 Testing: {description}")
        print("-" * 30)
        
        # Generate sensor reading and risk assessment
        sensor_reading = simulator.generate_reading(scenario)
        risk_assessment = risk_engine.assess_risk(sensor_reading)
        
        # Create device message
        device_message = DeviceMessage(
            device_id="TANK_A_001",
            timestamp=sensor_reading.timestamp,
            message_type=MessageType.ALERT if risk_assessment.risk_level != RiskLevel.SAFE else MessageType.SENSOR_DATA,
            risk_level=risk_assessment.risk_level,
            sensor_data=sensor_reading,
            risk_assessment=risk_assessment,
            battery_level=85,
            signal_strength=78,
            gps_lat=-17.8216,  # Harare coordinates
            gps_lon=31.0492,
            message_id=""
        )
        
        # Send message
        await comm_manager.send_message(device_message)
        
        # Show formatted outputs
        print("SMS Format:")
        print(MessageFormatter.format_sms_alert(device_message))
        print("\nJSON Format:")
        print(MessageFormatter.format_json_payload(device_message)[:200] + "...")
        
        await asyncio.sleep(1)  # Brief delay between tests

if __name__ == "__main__":
    asyncio.run(demo_communication_system())