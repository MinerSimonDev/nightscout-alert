# 🔔 Nightscout Glucose Alert with Govee Light

A minimal Node.js script that monitors your Nightscout glucose values and triggers a Govee light alert during hypo- or hyperglycemia. Includes customizable cooldowns and night-only mode.

## ✅ Features

- Fetches CGM data from Nightscout
- Triggers Govee light on alarm
- Cooldowns:
  - Hypo: 30 min
  - Hyper: 2.5 hrs
- Active only between 00:00 – 08:00
- Testing mode for manual simulation

---

## ⚙️ Setup

1. **Install dependencies**
   ```bash
   npm install

2. **Create `.env`**

   ```env
   NIGHTSCOUT_API_URL=https://YOUR-NIGHTSCOUT-URL-HERE/api/v1/
   GOVEE_API_KEY=your-govee-api-key
   ```

3. **Start**

   ```bash
   node alert.js
   ```

---

## 🧪 Simulate (Testing mode only)

Set `TESTING = true` in the code, then:

```bash
curl -X POST http://localhost:3000/simulate \
  -H "Content-Type: application/json" \
  -d '{"value": 50}'
```

---

## 💡 Govee Device Info

Use:

```bash
GET /api/govee/devices
```

to find your `device` and `sku`.

---

## License

MIT – use freely, no warranty.
