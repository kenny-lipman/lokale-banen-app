# LokaleBanen - Lead Generation & Cold Email Platform

## 🎯 **Wat is LokaleBanen?**

LokaleBanen is een geavanceerd platform voor het automatisch vinden van nieuwe bedrijven (leads) en de beslissers binnen die bedrijven, en het koppelen van deze contacten aan cold email campagnes. Het platform combineert AI-gestuurde job scraping, bedrijfsverrijking en geautomatiseerde email marketing in één geïntegreerde oplossing.

## 🚀 **Hoofddoel van de App**

Het hoofddoel is om uw sales proces volledig te automatiseren door:
1. **Automatisch nieuwe bedrijven te vinden** via job postings
2. **Contactgegevens van beslissers te verzamelen** via Apollo verrijking
3. **Deze contacten direct te koppelen** aan cold email campagnes
4. **Geen dubbele data** - volledige integratie met bestaande CRM

---

## 🔄 **Complete Workflow: Van Job Posting naar Cold Email**

### **Stap 1: Job Scraping (Otis Agent)**
- **Locatie**: `/agents/otis/enhanced`
- **Wat het doet**: Scraped automatisch job postings van Indeed
- **Configuratie**: 
  - Kies locatie (bijv. "Alkmaar", "Leiden")
  - Selecteer job functie (bijv. "Manager", "Directeur")
  - Kies platform (Indeed, LinkedIn, etc.)
- **Resultaat**: Nieuwe bedrijven worden automatisch toegevoegd aan de database

### **Stap 2: Bedrijfsverrijking (Apollo Integration)**
- **Locatie**: `/agents/otis/enrich`
- **Wat het doet**: Verrijkt bedrijfsgegevens met contactinformatie van beslissers
- **Proces**:
  - Selecteer bedrijven die verrijkt moeten worden
  - Apollo API zoekt automatisch naar contacten binnen deze bedrijven
  - Vindt beslissers met email adressen en functietitels
- **Resultaat**: Complete contactgegevens van beslissers

### **Stap 3: Contact Management**
- **Locatie**: `/contacten`
- **Wat het doet**: Beheer alle gevonden contacten
- **Functies**:
  - Filter op bedrijfsgrootte, regio, status
  - Bekijk contactgegevens (naam, email, functie, telefoon)
  - Status tracking (Prospect, Qualified, Disqualified)

### **Stap 4: Cold Email Campagnes**
- **Locatie**: `/contacten` (campagne sectie)
- **Wat het doet**: Koppelt contacten aan Instantly email campagnes
- **Proces**:
  - Selecteer contacten
  - Kies bestaande campagne of maak nieuwe
  - Contacten worden automatisch toegevoegd aan Instantly
- **Resultaat**: Geautomatiseerde cold email campagnes

---

## 📊 **Dashboard Overzicht**

### **Hoofdstatistieken**
- **Vacatures**: Totaal aantal gescrapede job postings
- **Bedrijven**: Aantal unieke bedrijven gevonden
- **Contacten**: Totaal aantal contacten met beslissers
- **Recente Activiteit**: Laatste scraping runs en resultaten

### **Platform Verdeling**
- Overzicht van job postings per platform (Indeed, LinkedIn, etc.)
- Status verdeling van vacatures en bedrijven

---

## 🏢 **Bedrijven Beheer**

### **Locatie**: `/bedrijven` of `/companies`

**Functies:**
- **Overzicht**: Alle gevonden bedrijven met status
- **Filtering**: Op regio, bedrijfsgrootte, status, bron
- **Bulk Acties**: Status updates voor meerdere bedrijven
- **Details**: Klik op bedrijf voor job geschiedenis en contacten

**Bedrijfsstatussen:**
- **Prospect**: Nieuw gevonden bedrijf
- **Qualified**: Bedrijf voldoet aan criteria
- **Disqualified**: Bedrijf voldoet niet aan criteria

---

## 👥 **Contacten Beheer**

### **Locatie**: `/contacten`

**Functies:**
- **Overzicht**: Alle contacten met beslissers
- **Geavanceerde Filtering**:
  - Bedrijfsgrootte (Klein, Middel, Groot)
  - Regio
  - Status (Prospect, Qualified, Disqualified)
  - Bron (Apollo, CRM, etc.)
  - Campagne status

**Contact Informatie:**
- Naam en email adres
- Functietitel
- Bedrijfsnaam en website
- Telefoonnummer (indien beschikbaar)
- LinkedIn profiel (indien beschikbaar)

---

## 📧 **Cold Email Campagnes**

### **Instantly Integration**

**Bestaande Campagnes:**
- "Alkmaarse Banen klein + middel"
- "Leidse Banen groot"
- "Alkmaarse Banen groot"
- "Leidse Banen klein + middel"

**Hoe contacten toevoegen aan campagnes:**
1. Ga naar `/contacten`
2. Selecteer contacten via checkboxes
3. Kies campagne uit dropdown
4. Klik "Toevoegen aan Campagne"
5. Contacten worden automatisch toegevoegd aan Instantly

**Automatische Validatie:**
- Email adres validatie
- Duplicaat preventie
- Status updates in real-time

---

## 🔧 **Technische Integraties**

### **Apify Webhook Integration**
- Automatische job scraping van Indeed
- Real-time resultaten via webhook
- Batch processing voor grote datasets

### **Apollo API Integration**
- Bedrijfsverrijking met contactgegevens
- Automatische beslisser identificatie
- Email adres validatie

### **Instantly API Integration**
- Directe koppeling met email campagnes
- Real-time lead toevoeging
- Campagne status tracking

### **Supabase Database**
- Centrale data opslag
- Real-time synchronisatie
- Geavanceerde filtering en zoeken

---

## 🎯 **Praktische Gebruiksscenario's**

### **Scenario 1: Nieuwe Regio Ontwikkelen**
1. **Job Scraping**: Start Otis Agent voor nieuwe regio (bijv. "Rotterdam")
2. **Bedrijfsverrijking**: Verrijk gevonden bedrijven met Apollo
3. **Contact Selectie**: Filter contacten op bedrijfsgrootte en functie
4. **Campagne Setup**: Voeg contacten toe aan bestaande of nieuwe campagne

### **Scenario 2: Bestaande CRM Integratie**
- Alle bestaande contacten zijn al geïntegreerd
- Geen dubbele data - alles in één systeem
- Status updates worden gesynchroniseerd

### **Scenario 3: Geavanceerde Targeting**
- Filter op specifieke functietitels (CEO, Manager, etc.)
- Target op bedrijfsgrootte (Klein = 1-10, Middel = 11-50, Groot = 50+)
- Regio-specifieke campagnes

---

## 📈 **Voordelen van het Platform**

### **Tijdsbesparing**
- Automatische lead generatie (geen handmatig zoeken)
- Directe koppeling naar email campagnes
- Geen dubbele data entry

### **Kwaliteit**
- AI-gestuurde beslisser identificatie
- Email validatie en duplicaat preventie
- Status tracking en kwalificatie

### **Schaalbaarheid**
- Batch processing voor grote datasets
- Multi-regio support
- Geavanceerde filtering opties

### **Integratie**
- Volledige CRM integratie
- Real-time synchronisatie
- API-first architectuur

---

## 🚀 **Snelle Start Gids**

### **Dag 1: Eerste Scraping Run**
1. Ga naar `/agents/otis/enhanced`
2. Configureer locatie en job functie
3. Start scraping run
4. Bekijk resultaten in dashboard

### **Dag 2: Bedrijfsverrijking**
1. Ga naar `/agents/otis/enrich`
2. Selecteer bedrijven voor verrijking
3. Start Apollo verrijking
4. Monitor voortgang

### **Dag 3: Contact Management**
1. Ga naar `/contacten`
2. Bekijk verrijkte contacten
3. Filter op gewenste criteria
4. Selecteer contacten voor campagne

### **Dag 4: Email Campagne**
1. Kies bestaande campagne of maak nieuwe
2. Voeg geselecteerde contacten toe
3. Start campagne in Instantly
4. Monitor resultaten

---

## 📞 **Support & Contact**

Voor vragen over het gebruik van het platform:
- **Technische Support**: Via development team
- **Workflow Vragen**: Raadpleeg deze documentatie
- **Feature Requests**: Via project management

---

*Dit platform is ontworpen om uw sales proces volledig te automatiseren, van lead generatie tot cold email campagnes, met behoud van volledige controle en transparantie over het hele proces.* 