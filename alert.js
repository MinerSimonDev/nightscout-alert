import express from 'express';
import 'dotenv/config';

const app = express();
const port = 3000;
const url = process.env.NIGHTSCOUT_API_URL;

app.use(express.json());

async function fetchAndParse() {
  const response = await fetch(url);
  const text = await response.text();

  const lines = text.trim().split('\r\n');
  return lines.map((line) => {
    const [date, ms, value, trend, source] = line.split('\t').map(x => x.replace(/^"|"$/g, ''));
    return {
      timestamp: date,
      timestampMs: Number(ms),
      value: Number(value),
      trend,
      source
    };
  });
}

let alarmActive = false;
let lastAlarmTime = 0;
const LOW_THRESHOLD = 70;
const HIGH_THRESHOLD = 180;
const COOLDOWN_MS = 10 * 60 * 1000;

setInterval(async () => {
  try {
    const data = await fetchAndParse();
    const latest = data[0];
    const now = Date.now();

    const value = latest.value;
    const isLow = value < LOW_THRESHOLD;
    const isHigh = value > HIGH_THRESHOLD;
    const isNormal = !isLow && !isHigh;

    console.log(`[LOG] ${latest.timestamp} – ${value} mg/dL – ${latest.trend}`);

    if (isNormal) {
      if (alarmActive) {
        console.log(`[RESET] Wert wieder normal (${value} mg/dL)`);
      }
      alarmActive = false;
      lastAlarmTime = 0;
      return;
    }

    if ((isLow || isHigh)) {
      const reason = isLow ? 'Niedrig' : 'Hoch';

      if (!alarmActive) {
        alarmActive = true;
        lastAlarmTime = now;
        triggerAlarm(reason, value, latest.timestamp);
      } else {
        const timeSinceLastAlarm = now - lastAlarmTime;

        if (timeSinceLastAlarm >= COOLDOWN_MS) {
          lastAlarmTime = now;
          triggerAlarm(reason, value, latest.timestamp);
        } else {
          console.log(`[SKIP] ${reason}-Wert (${value} mg/dL), aber Cooldown läuft (${Math.round(timeSinceLastAlarm / 1000)}s)`);
        }
      }
    }
  } catch (err) {
    console.error('Fehler beim automatischen Check:', err);
  }
}, 60 * 1000);

function triggerAlarm(reason, value, timestamp) {
  console.warn(`[ALARM] ${reason}: ${value} mg/dL um ${timestamp}`);

}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
