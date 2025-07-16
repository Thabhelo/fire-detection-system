// Simple JavaScript for dashboard functionality
function updateDashboard() {
    // This would normally fetch data from your ESP32
    // For now, simulate some data
    
    const gasValue = Math.floor(Math.random() * 500);
    const tempValue = Math.floor(Math.random() * 20) + 20;
    const flameDetected = Math.random() < 0.1; // 10% chance
    
    // Update display
    document.getElementById('gasValue').textContent = gasValue + ' ppm';
    document.getElementById('tempValue').textContent = tempValue + '°C';
    document.getElementById('flameValue').textContent = flameDetected ? 'FLAME DETECTED!' : 'NO FLAME';
    
    // Determine risk level
    let riskLevel = 'SAFE';
    if (flameDetected || gasValue > 400 || tempValue > 45) {
        riskLevel = 'CRITICAL';
    } else if (gasValue > 200 || tempValue > 35) {
        riskLevel = 'HIGH';
    } else if (gasValue > 100 || tempValue > 30) {
        riskLevel = 'MEDIUM';
    }
    
    document.getElementById('riskLevel').textContent = riskLevel;
    
    // Update colors based on risk
    const riskElement = document.getElementById('riskStatus');
    riskElement.className = 'status-card ' + riskLevel.toLowerCase();
}

function testAlert() {
    alert('🚨 Test Alert Sent!\n\nSMS notifications would be sent to emergency contacts.');
}

function resetSystem() {
    alert('System Reset\n\nAll sensors recalibrated.');
}

// Update every 3 seconds
setInterval(updateDashboard, 3000);
updateDashboard(); // Initial update
