const express = require('express')
require('dotenv').config()
const fetch = require('node-fetch') // Install with `npm install node-fetch@2`

const app = express()
const port = 3000
const TESTING = false // Toggle to true for simulation mode

const nightscoutUrl = process.env.NIGHTSCOUT_API_URL
const goveeApiKey = process.env.GOVEE_API_KEY

if (!nightscoutUrl) throw new Error('Missing NIGHTSCOUT_API_URL in .env')
if (!goveeApiKey) throw new Error('Missing GOVEE_API_KEY in .env')

app.use(express.json())

let simulatedGlucose = 250

async function fetchAndParse() {
  if (TESTING) {
    const now = new Date().toISOString()
    return [
      {
        timestamp: now,
        timestampMs: Date.now(),
        value: simulatedGlucose,
        trend: 'Flat',
        source: 'Simulated'
      }
    ]
  }

  const response = await fetch(nightscoutUrl)
  const text = await response.text()
  const lines = text.trim().split('\r\n')

  return lines.map((line) => {
    const [date, ms, value, trend, source] = line.split('\t').map(x => x.replace(/^"|"$/g, ''))
    return {
      timestamp: date,
      timestampMs: Number(ms),
      value: Number(value),
      trend,
      source
    }
  })
}

let alarmActive = false
let lastAlarmTime = 0
const LOW_THRESHOLD = 70
const HIGH_THRESHOLD = 180
const COOLDOWN_MS_LOW = 30 * 60 * 1000        // 30 Minuten
const COOLDOWN_MS_HIGH = 2.5 * 60 * 60 * 1000 // 2,5 Stunden

const LAMPE_BETT = {
  device: 'D7:B0:60:74:F4:DB:FB:6A',
  sku: 'H6008'
};

setInterval(async () => {
  try {
    const now = Date.now()
    const currentHour = new Date().getHours()
    console.log("[TIME] Current hour:", currentHour)
    if (currentHour >= 8) return

    const data = await fetchAndParse()
    const latest = data[0]

    const value = latest.value
    const isLow = value < LOW_THRESHOLD
    const isHigh = value > HIGH_THRESHOLD
    const isNormal = !isLow && !isHigh

    console.log(`[LOG] ${latest.timestamp} – ${value} mg/dL – ${latest.trend}`)

    if (isNormal) {
      if (alarmActive) {
        console.log(`[RESET] Value back to normal (${value} mg/dL)`)
      }
      alarmActive = false
      lastAlarmTime = 0
      return
    }

    const reason = isLow ? 'Low' : 'High'
    const cooldown = isLow ? COOLDOWN_MS_LOW : COOLDOWN_MS_HIGH

    if (!alarmActive) {
      alarmActive = true
      lastAlarmTime = now
      triggerAlarm(reason, value, latest.timestamp)
    } else {
      const timeSinceLastAlarm = now - lastAlarmTime
      if (timeSinceLastAlarm >= cooldown) {
        lastAlarmTime = now
        triggerAlarm(reason, value, latest.timestamp)
      } else {
        console.log(`[SKIPPED] ${reason} value (${value} mg/dL), cooldown active (${Math.round(timeSinceLastAlarm / 1000)}s)`)
      }
    }
  } catch (err) {
    console.error('Error during Nightscout check:', err)
  }
}, 10 * 1000)

function triggerAlarm(reason, value, timestamp) {
  console.warn(`[ALARM] ${reason}: ${value} mg/dL at ${timestamp}`)
  turnOnGoveeDevice()
}

async function turnOnGoveeDevice() {
  try {
    const response = await fetch('https://openapi.api.govee.com/router/api/v1/device/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Govee-API-Key': goveeApiKey
      },
      body: JSON.stringify({
        requestId: 'turn-on-lampe-bett',
        payload: {
          device: LAMPE_BETT.device,
          sku: LAMPE_BETT.sku,
          capability: {
            type: 'devices.capabilities.on_off',
            instance: 'powerSwitch',
            value: 1
          }
        }
      })
    });

    const result = await response.json();
    console.log('[GOVEE] Antwort:', result);
  } catch (err) {
    console.error('[GOVEE] Fehler:', err.message);
  }
}

app.post('/simulate', (req, res) => {
  if (!TESTING) return res.status(403).send('Simulation only available in testing mode.')
  const newValue = Number(req.body.value)
  if (isNaN(newValue)) return res.status(400).send('Invalid value')
  simulatedGlucose = newValue
  console.log(`[SIMULATION] Set simulated glucose to ${newValue}`)
  res.send({ success: true, value: simulatedGlucose })
})

app.get('/api/govee/devices', async (req, res) => {
  try {
    const response = await fetch('https://openapi.api.govee.com/router/api/v1/user/devices', {
      method: 'GET',
      headers: {
        'Govee-API-Key': goveeApiKey
      }
    })

    const json = await response.json()
    res.json(json)
  } catch (error) {
    console.error('Error fetching Govee devices:', error)
    res.status(500).json({ error: 'Govee API unreachable' })
  }
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  if (TESTING) {
    console.log('[MODE] Running in TESTING mode – simulated values enabled')
  }
})
