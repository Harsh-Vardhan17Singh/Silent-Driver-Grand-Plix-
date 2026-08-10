/**
 * THE SILENT CO-DRIVER — TELEMETRY & TACTICAL COCKPIT ENGINE
 * High-performance real-time telemetry rendering, canvas oscilloscopes, and AI advisory stream.
 */

document.addEventListener('DOMContentLoaded', () => {
  // State variables
  let isSimRunning = true;
  let currentMode = 'race'; // 'race' | 'quali' | 'rain'
  let brakeBias = 56.5;
  let engMapIndex = 2;
  const engMaps = ['STRAT 1 (ECO)', 'STRAT 2 (RACE)', 'STRAT 3 (OVERTAKE)', 'STRAT 4 (HOTLAP)'];
  let diffEntry = 62;

  // Real-time telemetry simulation values
  const telemetry = {
    speed: 284,
    rpm: 11400,
    maxRpm: 13500,
    gear: 5,
    suggestedGear: 5,
    throttle: 95,
    brake: 0,
    steer: -8.4,
    latG: 3.4,
    longG: -0.8,
    ersSoc: 78.4,
    fuelKg: 38.6,
    delta: -0.342,
    lap: 18,
    drsOpen: true,
    tires: {
      fl: { temp: 102, psi: 22.4, wear: 88 },
      fr: { temp: 106, psi: 22.8, wear: 84 },
      rl: { temp: 114, psi: 21.9, wear: 79 },
      rr: { temp: 108, psi: 22.1, wear: 82 }
    }
  };

  // Telemetry buffer for oscilloscope canvas
  const traceHistoryLength = 120;
  const speedHistory = new Array(traceHistoryLength).fill(280);
  const throttleHistory = new Array(traceHistoryLength).fill(90);
  const brakeHistory = new Array(traceHistoryLength).fill(0);
  const steerHistory = new Array(traceHistoryLength).fill(0);

  // Initialize Segmented LED Bars for ERS & Fuel
  initSegmentedBars();

  // Canvas Setup
  const tachCanvas = document.getElementById('tachometer-canvas');
  const tachCtx = tachCanvas.getContext('2d');

  const chartCanvas = document.getElementById('telemetry-chart-canvas');
  const chartCtx = chartCanvas.getContext('2d');
  resizeCanvas(chartCanvas);

  const gRadarCanvas = document.getElementById('g-radar-canvas');
  const gRadarCtx = gRadarCanvas.getContext('2d');

  const waveCanvas = document.getElementById('waveform-canvas');
  const waveCtx = waveCanvas.getContext('2d');

  window.addEventListener('resize', () => {
    resizeCanvas(chartCanvas);
  });

  function resizeCanvas(canvas) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
  }

  // --- Initialize Segmented LED Bars ---
  function initSegmentedBars() {
    const ersContainer = document.getElementById('seg-bars-ers');
    const fuelContainer = document.getElementById('seg-bars-fuel');
    if (!ersContainer || !fuelContainer) return;

    ersContainer.innerHTML = '';
    fuelContainer.innerHTML = '';

    for (let i = 0; i < 16; i++) {
      const blockE = document.createElement('div');
      blockE.className = 'seg-block';
      ersContainer.appendChild(blockE);

      const blockF = document.createElement('div');
      blockF.className = 'seg-block';
      fuelContainer.appendChild(blockF);
    }
    updateSegmentedBars();
  }

  function updateSegmentedBars() {
    const ersBlocks = document.querySelectorAll('#seg-bars-ers .seg-block');
    const fuelBlocks = document.querySelectorAll('#seg-bars-fuel .seg-block');

    const activeErsCount = Math.round((telemetry.ersSoc / 100) * 16);
    ersBlocks.forEach((block, idx) => {
      if (idx < activeErsCount) {
        block.className = 'seg-block active-cyan';
      } else {
        block.className = 'seg-block';
      }
    });

    const activeFuelCount = Math.round((telemetry.fuelKg / 50) * 16);
    fuelBlocks.forEach((block, idx) => {
      if (idx < activeFuelCount) {
        block.className = 'seg-block active-amber';
      } else {
        block.className = 'seg-block';
      }
    });
  }

  // --- Tachometer Arc Rendering ---
  function drawTachometer() {
    const w = tachCanvas.width;
    const h = tachCanvas.height;
    tachCtx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h - 15;
    const radius = Math.min(w * 0.42, 110);
    const startAngle = Math.PI * 0.85;
    const endAngle = Math.PI * 2.15;
    const totalAngle = endAngle - startAngle;

    // Background track
    tachCtx.beginPath();
    tachCtx.arc(centerX, centerY, radius, startAngle, endAngle);
    tachCtx.lineWidth = 10;
    tachCtx.strokeStyle = '#201f1f';
    tachCtx.lineCap = 'butt';
    tachCtx.stroke();

    // Redline sector background
    const redlinePct = 0.82;
    tachCtx.beginPath();
    tachCtx.arc(centerX, centerY, radius, startAngle + totalAngle * redlinePct, endAngle);
    tachCtx.lineWidth = 10;
    tachCtx.strokeStyle = 'rgba(225, 6, 0, 0.25)';
    tachCtx.stroke();

    // Active RPM Arc with Gradient
    const currentFraction = Math.min(Math.max(telemetry.rpm / telemetry.maxRpm, 0), 1);
    const currentEndAngle = startAngle + totalAngle * currentFraction;

    const grad = tachCtx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
    grad.addColorStop(0, '#41f03e');
    grad.addColorStop(0.6, '#ffba20');
    grad.addColorStop(0.85, '#e10600');
    grad.addColorStop(1, '#ff3333');

    tachCtx.beginPath();
    tachCtx.arc(centerX, centerY, radius, startAngle, currentEndAngle);
    tachCtx.lineWidth = 10;
    tachCtx.strokeStyle = grad;
    tachCtx.shadowColor = currentFraction > 0.85 ? '#e10600' : '#41f03e';
    tachCtx.shadowBlur = currentFraction > 0.85 ? 12 : 6;
    tachCtx.stroke();
    tachCtx.shadowBlur = 0; // reset

    // Tick marks
    const ticks = 14;
    for (let i = 0; i <= ticks; i++) {
      const angle = startAngle + (totalAngle * (i / ticks));
      const tickInner = radius - 12;
      const tickOuter = radius - 4;
      const x1 = centerX + Math.cos(angle) * tickInner;
      const y1 = centerY + Math.sin(angle) * tickInner;
      const x2 = centerX + Math.cos(angle) * tickOuter;
      const y2 = centerY + Math.sin(angle) * tickOuter;

      tachCtx.beginPath();
      tachCtx.moveTo(x1, y1);
      tachCtx.lineTo(x2, y2);
      tachCtx.lineWidth = i % 2 === 0 ? 2 : 1;
      tachCtx.strokeStyle = i >= ticks * redlinePct ? '#e10600' : '#555';
      tachCtx.stroke();
    }
  }

  // --- LED Shift Lights Bar ---
  function updateShiftLights() {
    const leds = document.querySelectorAll('.shift-led');
    const fraction = telemetry.rpm / telemetry.maxRpm;
    const totalLeds = leds.length;
    const litCount = Math.floor(fraction * totalLeds);

    leds.forEach((led, idx) => {
      if (idx < litCount) {
        led.classList.add('on');
      } else {
        led.classList.remove('on');
      }
    });
  }

  // --- Real-time Oscilloscope Telemetry Trace Canvas ---
  function drawTelemetryChart() {
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    const dpr = window.devicePixelRatio || 1;
    chartCtx.clearRect(0, 0, w, h);

    // Subtle horizontal grid lines
    chartCtx.strokeStyle = '#181818';
    chartCtx.lineWidth = 1 * dpr;
    const gridRows = 5;
    for (let i = 1; i < gridRows; i++) {
      const y = (h / gridRows) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(w, y);
      chartCtx.stroke();
    }

    // Grid vertical ticks
    const gridCols = 8;
    for (let j = 1; j < gridCols; j++) {
      const x = (w / gridCols) * j;
      chartCtx.beginPath();
      chartCtx.moveTo(x, 0);
      chartCtx.lineTo(x, h);
      chartCtx.stroke();
    }

    // Function to draw continuous curve
    function drawChannel(data, color, minVal, maxVal, lineWidth = 2, glow = true) {
      chartCtx.beginPath();
      const stepX = w / (data.length - 1);

      for (let i = 0; i < data.length; i++) {
        const norm = (data[i] - minVal) / (maxVal - minVal);
        const y = h - norm * (h * 0.9) - h * 0.05;
        const x = i * stepX;
        if (i === 0) {
          chartCtx.moveTo(x, y);
        } else {
          chartCtx.lineTo(x, y);
        }
      }

      chartCtx.strokeStyle = color;
      chartCtx.lineWidth = lineWidth * dpr;
      if (glow) {
        chartCtx.shadowColor = color;
        chartCtx.shadowBlur = 6 * dpr;
      }
      chartCtx.stroke();
      chartCtx.shadowBlur = 0;
    }

    // Draw traces
    drawChannel(speedHistory, '#38bdf8', 0, 340, 2.2);     // Speed (Cyan)
    drawChannel(throttleHistory, '#41f03e', 0, 100, 1.8);   // Throttle (Green)
    drawChannel(brakeHistory, '#e10600', 0, 100, 1.8);      // Brake (Red)
    drawChannel(steerHistory, '#c084fc', -50, 50, 1.4);     // Steer Angle (Purple)
  }

  // --- G-Force 2D Radar Canvas ---
  function drawGRadar() {
    const w = gRadarCanvas.width;
    const h = gRadarCanvas.height;
    gRadarCtx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = w * 0.44;

    // Rings
    [0.33, 0.66, 1.0].forEach((rFrac) => {
      gRadarCtx.beginPath();
      gRadarCtx.arc(cx, cy, maxRadius * rFrac, 0, Math.PI * 2);
      gRadarCtx.strokeStyle = '#222';
      gRadarCtx.lineWidth = 1;
      gRadarCtx.stroke();
    });

    // Crosshairs
    gRadarCtx.beginPath();
    gRadarCtx.moveTo(cx, cy - maxRadius);
    gRadarCtx.lineTo(cx, cy + maxRadius);
    gRadarCtx.moveTo(cx - maxRadius, cy);
    gRadarCtx.lineTo(cx + maxRadius, cy);
    gRadarCtx.strokeStyle = '#252525';
    gRadarCtx.lineWidth = 1;
    gRadarCtx.stroke();

    // Scale mapping (max 5G)
    const maxG = 5.0;
    const posX = cx + (telemetry.latG / maxG) * maxRadius;
    const posY = cy - (telemetry.longG / maxG) * maxRadius;

    // Draw trailing vector
    gRadarCtx.beginPath();
    gRadarCtx.moveTo(cx, cy);
    gRadarCtx.lineTo(posX, posY);
    gRadarCtx.strokeStyle = 'rgba(65, 240, 62, 0.4)';
    gRadarCtx.lineWidth = 2;
    gRadarCtx.stroke();

    // Draw G-Force target point
    gRadarCtx.beginPath();
    gRadarCtx.arc(posX, posY, 5, 0, Math.PI * 2);
    gRadarCtx.fillStyle = '#ffb4a8';
    gRadarCtx.shadowColor = '#e10600';
    gRadarCtx.shadowBlur = 8;
    gRadarCtx.fill();
    gRadarCtx.shadowBlur = 0;
  }

  // --- AI Co-Driver Audio Waveform Canvas ---
  let wavePhase = 0;
  function drawAudioWaveform() {
    const w = waveCanvas.width;
    const h = waveCanvas.height;
    waveCtx.clearRect(0, 0, w, h);

    const cx = h / 2;
    waveCtx.beginPath();
    waveCtx.moveTo(0, cx);

    const points = 80;
    for (let i = 0; i <= points; i++) {
      const x = (w / points) * i;
      const amp = isSimRunning ? Math.sin(i * 0.2 + wavePhase) * Math.cos(i * 0.1 - wavePhase * 0.5) * (h * 0.35) : 0;
      waveCtx.lineTo(x, cx + amp);
    }

    waveCtx.strokeStyle = '#41f03e';
    waveCtx.lineWidth = 1.5;
    waveCtx.shadowColor = '#41f03e';
    waveCtx.shadowBlur = 6;
    waveCtx.stroke();
    waveCtx.shadowBlur = 0;

    wavePhase += 0.08;
  }

  // --- Tactical Co-Driver Advisory Messages Stream ---
  const tacticalMessages = [
    { type: 'high', tag: 'AERO // DRS', msg: 'DRS detection zone in 250m. Car behind +0.8s gap.' },
    { type: 'green', tag: 'DELTA // S2', msg: 'Apex speed +3 km/h through Pouhon. Optimal line held.' },
    { type: 'amber', tag: 'BRAKES // FL', msg: 'Front left brake disc peaked 645°C. Increase brake cooling duct margin.' },
    { type: 'green', tag: 'STRAT // PLAN A', msg: 'Pit window opens in 2 laps (L19). Gap to pit exit traffic: +24.8s.' },
    { type: 'high', tag: 'ENGINE // MAP', msg: 'Overtake deployment available for Kemmel straight. Push Mode 3.' },
    { type: 'amber', tag: 'TIRE // REAR', msg: 'Rear left surface temp 114°C. Manage throttle slip on Turn 14 exit.' }
  ];

  function addTacticalMessage(tag, msg, priority = 'green') {
    const feed = document.getElementById('tactical-feed');
    if (!feed) return;

    const entry = document.createElement('div');
    entry.className = `log-entry priority-${priority}`;

    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 100))}`;

    entry.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-tag">${tag}</span>
      <span class="log-msg">${msg}</span>
    `;

    feed.prepend(entry);

    // Keep max 15 entries
    while (feed.children.length > 15) {
      feed.removeChild(feed.lastChild);
    }
  }

  // Initial seed messages
  tacticalMessages.forEach(item => {
    addTacticalMessage(item.tag, item.msg, item.type);
  });

  // Dynamic simulation loop step
  let simTick = 0;
  function updatePhysicsSimulation() {
    if (!isSimRunning) return;
    simTick++;

    // Oscillating realistic cornering & straight behavior
    const phase = simTick * 0.04;
    const isCornering = Math.sin(phase) > 0.2;

    if (isCornering) {
      telemetry.speed = Math.max(140, telemetry.speed - 3.2);
      telemetry.rpm = Math.max(8200, telemetry.rpm - 140);
      telemetry.throttle = 35 + Math.sin(phase * 2) * 20;
      telemetry.brake = Math.max(0, 70 * Math.sin(phase));
      telemetry.gear = 3;
      telemetry.latG = (Math.sin(phase * 1.5) * 3.8);
      telemetry.longG = -1.8;
      telemetry.steer = Math.sin(phase * 1.5) * 28;
    } else {
      telemetry.speed = Math.min(312, telemetry.speed + 2.4);
      telemetry.rpm = Math.min(13100, telemetry.rpm + 110);
      telemetry.throttle = 100;
      telemetry.brake = 0;
      telemetry.gear = telemetry.speed > 260 ? 6 : (telemetry.speed > 220 ? 5 : 4);
      telemetry.latG = Math.sin(phase) * 0.6;
      telemetry.longG = 1.2;
      telemetry.steer = Math.sin(phase) * 4;
    }

    telemetry.suggestedGear = telemetry.gear;
    telemetry.ersSoc = Math.max(15, (telemetry.ersSoc - 0.012 + (telemetry.brake > 0 ? 0.08 : 0)));
    telemetry.fuelKg = Math.max(2, telemetry.fuelKg - 0.003);

    // Delta micro-fluctuation
    telemetry.delta = -0.342 + Math.sin(phase * 0.5) * 0.12;

    // Shift oscilloscope arrays
    speedHistory.shift();
    speedHistory.push(telemetry.speed);

    throttleHistory.shift();
    throttleHistory.push(telemetry.throttle);

    brakeHistory.shift();
    brakeHistory.push(telemetry.brake);

    steerHistory.shift();
    steerHistory.push(telemetry.steer);

    // Update DOM UI elements
    updateUIElements();

    // Periodic AI tactical comms injection
    if (simTick % 160 === 0) {
      const randomMsg = tacticalMessages[Math.floor(Math.random() * tacticalMessages.length)];
      addTacticalMessage(randomMsg.tag, randomMsg.msg, randomMsg.type);
    }
  }

  function updateUIElements() {
    // Speed, gear, RPM
    document.getElementById('val-speed').textContent = Math.round(telemetry.speed);
    document.getElementById('val-gear').textContent = telemetry.gear;
    document.getElementById('val-suggested-gear').textContent = `OPT: ${telemetry.suggestedGear}`;
    document.getElementById('val-rpm').textContent = Math.round(telemetry.rpm).toLocaleString();

    // Pedal fills
    document.getElementById('val-throttle-pct').textContent = `${Math.round(telemetry.throttle)}%`;
    document.getElementById('fill-throttle').style.width = `${telemetry.throttle}%`;

    document.getElementById('val-brake-pct').textContent = `${Math.round(telemetry.brake)}%`;
    document.getElementById('fill-brake').style.width = `${telemetry.brake}%`;

    // Metrics
    document.getElementById('val-lat-g').textContent = `${telemetry.latG >= 0 ? '+' : ''}${telemetry.latG.toFixed(2)} G`;
    document.getElementById('val-long-g').textContent = `${telemetry.longG >= 0 ? '+' : ''}${telemetry.longG.toFixed(2)} G`;
    document.getElementById('val-steer-ang').textContent = `${telemetry.steer.toFixed(1)}°`;

    const gTotal = Math.sqrt(telemetry.latG * telemetry.latG + telemetry.longG * telemetry.longG);
    document.getElementById('g-total-val').textContent = `${gTotal.toFixed(1)}G`;

    // Delta
    const deltaEl = document.getElementById('val-delta');
    const signEl = document.getElementById('delta-sign');
    const deltaVal = Math.abs(telemetry.delta).toFixed(3);
    deltaEl.textContent = deltaVal;
    if (telemetry.delta < 0) {
      signEl.textContent = '-';
      signEl.className = 'delta-sign text-green';
      deltaEl.className = 'delta-val text-green';
    } else {
      signEl.textContent = '+';
      signEl.className = 'delta-sign text-red';
      deltaEl.className = 'delta-val text-red';
    }

    // ERS & Fuel
    document.getElementById('val-soc-pct').textContent = `${telemetry.ersSoc.toFixed(1)}%`;
    document.getElementById('val-fuel-kg').textContent = `${telemetry.fuelKg.toFixed(1)} KG`;
    updateSegmentedBars();
  }

  // --- Main Animation Frame Loop (60 FPS) ---
  function renderLoop() {
    updatePhysicsSimulation();
    drawTachometer();
    updateShiftLights();
    drawTelemetryChart();
    drawGRadar();
    drawAudioWaveform();
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);

  // --- Event Listeners & Interactive Handlers ---

  // Simulation Stream Toggle Button
  const btnToggleSim = document.getElementById('btn-toggle-sim');
  btnToggleSim.addEventListener('click', () => {
    isSimRunning = !isSimRunning;
    const btnIcon = btnToggleSim.querySelector('.btn-icon');
    const btnText = btnToggleSim.querySelector('.btn-text');
    if (isSimRunning) {
      btnIcon.textContent = '⏸';
      btnText.textContent = 'STREAM';
      addTacticalMessage('SYSTEM // LINK', 'Telemetry telemetry stream RESUMED.', 'green');
    } else {
      btnIcon.textContent = '▶';
      btnText.textContent = 'PAUSED';
      addTacticalMessage('SYSTEM // LINK', 'Telemetry telemetry stream PAUSED by engineer.', 'amber');
    }
  });

  // Session Mode Switching
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.getAttribute('data-mode');

      if (currentMode === 'quali') {
        document.getElementById('val-session').textContent = 'QUALIFYING Q3 // HOTLAP';
        document.getElementById('val-session').className = 'meta-val text-purple';
        addTacticalMessage('TACTICAL // MODE', 'Switched to QUALIFYING profile. Max deployment enabled.', 'high');
      } else if (currentMode === 'rain') {
        document.getElementById('val-session').textContent = 'WET / SAFETY CAR DELTA';
        document.getElementById('val-session').className = 'meta-val text-cyan';
        addTacticalMessage('WEATHER // SC', 'Track status: WET // SC Delta delta delta active.', 'amber');
      } else {
        document.getElementById('val-session').textContent = 'RACE STINT 2/4';
        document.getElementById('val-session').className = 'meta-val text-amber';
        addTacticalMessage('TACTICAL // MODE', 'Switched to standard RACE STINT strategy.', 'green');
      }
    });
  });

  // Brake Bias Adjusters
  document.getElementById('btn-bb-inc').addEventListener('click', () => {
    brakeBias = Math.min(62.0, brakeBias + 0.5);
    document.getElementById('val-bb').textContent = `${brakeBias.toFixed(1)}%`;
    addTacticalMessage('CHASSIS // BB', `Brake bias forward shifted to ${brakeBias.toFixed(1)}%`, 'amber');
  });

  document.getElementById('btn-bb-dec').addEventListener('click', () => {
    brakeBias = Math.max(50.0, brakeBias - 0.5);
    document.getElementById('val-bb').textContent = `${brakeBias.toFixed(1)}%`;
    addTacticalMessage('CHASSIS // BB', `Brake bias rearward shifted to ${brakeBias.toFixed(1)}%`, 'amber');
  });

  // Engine Map Adjusters
  document.getElementById('btn-map-inc').addEventListener('click', () => {
    engMapIndex = (engMapIndex + 1) % engMaps.length;
    document.getElementById('val-eng-map').textContent = engMaps[engMapIndex].split(' ')[0] + ' ' + engMaps[engMapIndex].split(' ')[1];
    addTacticalMessage('POWERTRAIN // MAP', `Engine Map changed to ${engMaps[engMapIndex]}`, 'high');
  });

  document.getElementById('btn-map-dec').addEventListener('click', () => {
    engMapIndex = (engMapIndex - 1 + engMaps.length) % engMaps.length;
    document.getElementById('val-eng-map').textContent = engMaps[engMapIndex].split(' ')[0] + ' ' + engMaps[engMapIndex].split(' ')[1];
    addTacticalMessage('POWERTRAIN // MAP', `Engine Map changed to ${engMaps[engMapIndex]}`, 'high');
  });

  // Diff Entry Adjusters
  document.getElementById('btn-diff-inc').addEventListener('click', () => {
    diffEntry = Math.min(85, diffEntry + 2);
    document.getElementById('val-diff').textContent = `${diffEntry}%`;
  });

  document.getElementById('btn-diff-dec').addEventListener('click', () => {
    diffEntry = Math.max(40, diffEntry - 2);
    document.getElementById('val-diff').textContent = `${diffEntry}%`;
  });

  // Driver Radio Prompt Query Buttons
  const radioPrompts = document.querySelectorAll('.radio-prompt-btn');
  radioPrompts.forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      handleRadioQuery(query);
    });
  });

  function handleRadioQuery(query) {
    switch (query) {
      case 'GAP_AHEAD':
        addTacticalMessage('CO-DRIVER // RADIO', 'Leader P1 is +4.18s ahead. You are catching by 0.22s per lap in Sector 2.', 'green');
        break;
      case 'TIRE_STATUS':
        addTacticalMessage('CO-DRIVER // RADIO', 'Front tires 104°C optimal. Rear left running slightly hot (114°C). 82% life remaining.', 'amber');
        break;
      case 'PIT_WINDOW':
        addTacticalMessage('CO-DRIVER // RADIO', 'Stay out. Pit window is Lap 19-22. Free air ahead for 4 clean laps.', 'high');
        break;
      case 'WEATHER_RADAR':
        addTacticalMessage('CO-DRIVER // RADIO', 'Light drizzle approaching Sector 3 in 6 minutes. Intensity low, slicks remain fastest.', 'amber');
        break;
    }
  }
});
