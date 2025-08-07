# Daily Scrape Webhook - Test Payloads voor n8n Workflow

## 🎯 Webhook Endpoint
```
POST https://ba.grive-dev.com/webhook/daily-scrape
Content-Type: application/json
```

## 📋 Echte Test Payloads (Gebaseerd op Huidige Configuratie)

### 1. HaagseBanen Platform
```json
{
  "location": "Den Haag"
}
```

### 2. AmsterdamseBanen Platform
```json
{
  "location": "Amsterdam"
}
```

### 3. RotterdamseBanen Platform
```json
{
  "location": "Rotterdam"
}
```

### 4. UtrechtseBanen Platform
```json
{
  "location": "Utrecht"
}
```

### 5. EindhovenseBanen Platform
```json
{
  "location": "Eindhoven"
}
```

### 6. GroningseBanen Platform
```json
{
  "location": "Groningen"
}
```

### 7. LeidseBanen Platform
```json
{
  "location": "Leiden"
}
```

### 8. DelftseBanen Platform
```json
{
  "location": "Delft"
}
```

## 🔧 n8n Workflow Specificaties

### Webhook Trigger Node
- **Method**: POST
- **Path**: `/webhook/daily-scrape`
- **Authentication**: None
- **Response**: 200 OK

### Payload Structuur
```json
{
  "location": "string" // Central place van het platform
}
```

### Headers
```
Content-Type: application/json
User-Agent: Lokale-Banen-DailyScrape/1.0
```

## 📊 Workflow Logica

### 1. Elke Platform = Aparte Call
- Er wordt **één webhook call per platform** gemaakt
- **Niet** alle platforms in één call
- Elke call bevat alleen de `location` van dat specifieke platform

### 2. Timing
- Calls worden elke dag om **04:00 uur** gestuurd
- **100ms delay** tussen elke call
- Maximum **25 platforms** (geen rate limiting issues)

### 3. Error Handling
- Als een call faalt, wordt de volgende nog steeds uitgevoerd
- Geen retry mechanisme in de backend
- Logging van success/failure per platform

## 🧪 Test Scenarios

### Scenario 1: Single Platform
```bash
curl -X POST https://ba.grive-dev.com/webhook/daily-scrape \
  -H "Content-Type: application/json" \
  -d '{"location": "Den Haag"}'
```

### Scenario 2: Multiple Platforms (Simulated)
```bash
# Call 1 - HaagseBanen
curl -X POST https://ba.grive-dev.com/webhook/daily-scrape \
  -H "Content-Type: application/json" \
  -d '{"location": "Den Haag"}'

# Call 2 (100ms later) - AmsterdamseBanen
curl -X POST https://ba.grive-dev.com/webhook/daily-scrape \
  -H "Content-Type: application/json" \
  -d '{"location": "Amsterdam"}'

# Call 3 (100ms later) - RotterdamseBanen
curl -X POST https://ba.grive-dev.com/webhook/daily-scrape \
  -H "Content-Type: application/json" \
  -d '{"location": "Rotterdam"}'

# Call 4 (100ms later) - UtrechtseBanen
curl -X POST https://ba.grive-dev.com/webhook/daily-scrape \
  -H "Content-Type: application/json" \
  -d '{"location": "Utrecht"}'

# Call 5 (100ms later) - EindhovenseBanen
curl -X POST https://ba.grive-dev.com/webhook/daily-scrape \
  -H "Content-Type: application/json" \
  -d '{"location": "Eindhoven"}'
```

## 📝 n8n Workflow Stappen

### 1. Webhook Trigger
```javascript
// Input: { "location": "Amsterdam" }
// Output: Pass through to next node
```

### 2. Extract Location
```javascript
// Extract location from webhook body
const location = $input.first().json.location;
// location = "Amsterdam"
```

### 3. Platform Detection (Optional)
```javascript
// You can determine which platform based on location
// This is optional since each platform gets its own call
const platformMap = {
  "Den Haag": "HaagseBanen",
  "Amsterdam": "AmsterdamseBanen",
  "Rotterdam": "RotterdamseBanen", 
  "Utrecht": "UtrechtseBanen",
  "Eindhoven": "EindhovenseBanen",
  "Groningen": "GroningseBanen",
  "Leiden": "LeidseBanen",
  "Delft": "DelftseBanen"
};
const platform = platformMap[location];
```

### 4. Scraping Logic
```javascript
// Your scraping logic here
// Use the location to scrape job postings
// Example: scrapeJobs(location, platform);
```

## 🚀 Voorbeeld n8n Workflow

```javascript
// Webhook Trigger
{
  "location": "Amsterdam"
}

// Extract Data
const location = $input.first().json.location;

// Scrape Jobs
const jobs = await scrapeJobsForLocation(location);

// Process Results
const results = {
  location: location,
  timestamp: new Date().toISOString(),
  jobsFound: jobs.length,
  jobs: jobs
};

// Return Response
return { success: true, data: results };
```

## ⚠️ Belangrijke Punten

1. **Geen Authenticatie**: Webhook vereist geen API key of token
2. **Eenvoudige Payload**: Alleen `{ "location": "string" }`
3. **Individuele Calls**: Elke platform krijgt zijn eigen webhook call
4. **Geen Rate Limiting**: Maximum 25 platforms, geen problemen
5. **200 Response**: Webhook verwacht een 200 OK response
6. **Error Handling**: Faalt één call, dan gaan de anderen door

## 🔍 Monitoring

### Success Indicators
- 200 OK response van je n8n workflow
- Logging van ontvangen webhook calls
- Verwerking van job scraping per location

### Error Indicators  
- 404/500 responses van je n8n workflow
- Timeout errors (>30 seconden)
- Invalid JSON payload

## 📞 Support

Voor vragen over de webhook implementatie:
- Backend: James (Full Stack Developer)
- Frontend: Sally (UX Expert)
- n8n Workflow: Jouw implementatie

---

**Gemaakt op**: 7 Augustus 2025  
**Versie**: 1.0  
**Status**: Ready for n8n Development 