# Blocklist Functionaliteit - Project Specificatie

## 🎯 **Project Status Update**

**Laatste Update**: 23 september 2025
**Huidige Fase**: Week 1 - ✅ **VOLTOOID**

### **Week 1 Achievements** ✅
- ✅ **Database**: Volledige Supabase migratie met RLS policies
- ✅ **Backend**: Alle 8 API endpoints geïmplementeerd en werkend
- ✅ **Frontend**: Complete UI met 6 herbruikbare componenten
- ✅ **Integratie**: Sidebar menu, routing, en API hooks
- ✅ **Functionaliteit**: CRUD, import/export, bulk acties, statistieken

### **🚀 Klaar voor Week 2**
- Instant/Pipedrive sync services
- Contact filtering integratie
- Real-time sync orchestration
- Workflow integraties

---

## 📋 Product Requirements Document (PRD)

### **Project Overzicht**
Het Lokale-Banen systeem heeft behoefte aan een blocklist functionaliteit waarmee gebruikers email adressen en domeinen kunnen blokkeren van verdere contactopname. Deze functionaliteit moet real-time synchroniseren met Instantly en Pipedrive om consistente communicatie te waarborgen.

### **Probleem Statement**
- Gebruikers kunnen momenteel geen specifieke email adressen of domeinen uitsluiten van campaigns
- Er is geen centrale plek om "do not contact" lijst te beheren  
- Geblokkeerde contacts kunnen nog steeds in campaigns belanden
- Geen automatische sync met externe platforms (Instantly, Pipedrive)

### **Doelstellingen**
- Centraal beheer van geblokkeerde email adressen en domeinen
- Real-time filtering van contacts bij campaign creation
- Automatische synchronisatie met Instantly suppression lists
- Automatische synchronisatie met Pipedrive "do not contact" status
- Eenvoudige UI voor beheer en monitoring

### **Scope & Requirements**

#### **Functionele Requirements**
1. **Blocklist Management**
   - Toevoegen van email adressen en domeinen aan blocklist
   - Vrije tekst reden voor blokkering
   - Activeren/deactiveren van blocklist entries
   - Zoeken en filteren in blocklist

2. **Contact Filtering**
   - Automatische filtering tijdens contact import/enrichment
   - Real-time validatie bij campaign creation
   - Bulk contact validation tegen blocklist
   - Visual indicators voor geblokkeerde contacts

3. **External Platform Sync**
   - Real-time sync naar Instantly suppression lists
   - Real-time sync naar Pipedrive "do not contact"
   - Error handling en retry mechanismen
   - Sync status tracking en monitoring

4. **User Interface**
   - Dedicated blocklist management pagina
   - Quick block/unblock acties in contact workflows
   - Bulk import/export functionaliteit
   - Dashboard statistieken

#### **Technische Requirements**
- Real-time synchronisatie (geen batch processing)
- Schaalbaarheid voor 1000+ entries
- Performance: <200ms validatie response tijd
- 99.9% sync success rate naar externe platforms
- Mobile-responsive interface

#### **Out of Scope (Fase 1)**
- Automatische detectie van bounces/unsubscribes
- Telefoon/LinkedIn identifiers
- Geavanceerde analytics en reporting
- Rol-gebaseerde toegang controle

### **User Stories**

#### **Epic 1: Blocklist Management**
- Als gebruiker wil ik een email adres aan de blocklist toevoegen met een reden
- Als gebruiker wil ik een domein aan de blocklist toevoegen om alle emails van dat domein te blokkeren
- Als gebruiker wil ik een overzicht zien van alle geblokkeerde entries
- Als gebruiker wil ik een blocklist entry kunnen deactiveren zonder deze te verwijderen

#### **Epic 2: Contact Filtering**
- Als gebruiker wil ik dat nieuwe contacts automatisch gefilterd worden tegen de blocklist
- Als gebruiker wil ik een waarschuwing zien als ik geblokkeerde contacts aan een campaign probeer toe te voegen
- Als gebruiker wil ik in één oogopslag zien welke contacts geblokkeerd zijn

#### **Epic 3: External Platform Sync**
- Als gebruiker wil ik dat geblokkeerde entries automatisch naar Instantly worden gesynchroniseerd
- Als gebruiker wil ik dat geblokkeerde entries automatisch naar Pipedrive worden gesynchroniseerd
- Als gebruiker wil ik de sync status kunnen monitoren

---

## 🏗️ Technische Architectuur

### **Database Schema**
```sql
CREATE TABLE blocklist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'domain')),
  value TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- External platform sync tracking
  instantly_synced BOOLEAN DEFAULT FALSE,
  instantly_synced_at TIMESTAMP WITH TIME ZONE,
  instantly_error TEXT,
  pipedrive_synced BOOLEAN DEFAULT FALSE,
  pipedrive_synced_at TIMESTAMP WITH TIME ZONE,
  pipedrive_error TEXT
);

-- Indexes voor performance
CREATE INDEX idx_blocklist_entries_type_value ON blocklist_entries(type, value);
CREATE INDEX idx_blocklist_entries_active ON blocklist_entries(is_active);
CREATE INDEX idx_blocklist_entries_created_at ON blocklist_entries(created_at);
```

### **API Endpoints**
```typescript
// Blocklist CRUD
GET    /api/blocklist           // List all entries (paginated)
POST   /api/blocklist           // Create new entry
PUT    /api/blocklist/[id]      // Update entry
DELETE /api/blocklist/[id]      // Delete entry

// Validation & Utility
POST   /api/blocklist/check     // Bulk check emails/domains
GET    /api/blocklist/stats     // Dashboard statistics
POST   /api/blocklist/import    // Bulk import (CSV)
GET    /api/blocklist/export    // Export to CSV

// Sync Management
POST   /api/blocklist/sync      // Manual sync trigger
GET    /api/blocklist/sync/status // Sync status overview
```

### **Service Architecture**
```typescript
// Core Services
BlocklistService          // CRUD operations
BlocklistValidationService // Email/domain validation
BlocklistSyncOrchestrator  // Coordinate external syncs

// External Platform Services
InstantlyBlocklistService  // Instantly suppression list API
PipedriveBlocklistService  // Pipedrive contact blocking API

// Integration Services
ContactFilteringService    // Integrate with existing contact workflows
CampaignValidationService  // Campaign creation validation
```

---

## ✅ Development Tasks

### **Phase 1: Core Implementation (2-3 weken)**

#### **Backend Development**

**Database & Core Services**
- [x] **blocklist-db-schema**: Create blocklist_entries database table ✅ **COMPLETED**
  - ✅ Database migratie met alle velden en constraints
  - ✅ Indexes voor performance optimization
  - ✅ RLS policies voor security
  - ✅ Unique constraints en triggers voor updated_at
  - ✅ Comments voor documentatie

- [x] **blocklist-api-endpoints**: Build REST API endpoints ✅ **COMPLETED**
  - ✅ GET /api/blocklist (pagination, filtering, sorting)
  - ✅ POST /api/blocklist (validation, duplicate checking)
  - ✅ PUT /api/blocklist/[id] (update with sync trigger)
  - ✅ DELETE /api/blocklist/[id] (delete with sync tracking)
  - ✅ POST /api/blocklist/check (bulk validation endpoint)
  - ✅ GET /api/blocklist/stats (dashboard statistics)
  - ✅ GET /api/blocklist/export (CSV export functionaliteit)
  - ✅ POST /api/blocklist/import (bulk import met validatie)

- [x] **blocklist-validation-service**: Email/domain validation service ✅ **COMPLETED**
  - ✅ Email format validation (regex)
  - ✅ Domain validation en normalisatie
  - ✅ Bulk checking functionaliteit voor performance
  - ✅ Caching layer voor snelle lookups (5 min TTL)
  - ✅ Wildcard domain matching (*.example.com)
  - ✅ TypeScript interfaces en error handling

**External Platform Integration**
- [ ] **instantly-sync-service**: Instantly API integration
  - Research Instantly suppression list API endpoints
  - API client met authentication en rate limiting
  - Create/update/delete sync methods
  - Error handling en response parsing
  - Status tracking en logging

- [ ] **pipedrive-sync-service**: Pipedrive API integration  
  - Research Pipedrive contact blocking capabilities
  - API client met authentication en rate limiting
  - Create/update/delete sync methods
  - Error handling en response parsing
  - Status tracking en logging

- [ ] **blocklist-sync-orchestrator**: Sync coordination service
  - Orchestrate multiple external platform syncs
  - Queue management voor failed syncs (Bull/Agenda)
  - Retry logic met exponential backoff
  - Webhook endpoints voor external callbacks
  - Real-time sync status updates

**Integration & Filtering**
- [ ] **contact-filtering-integration**: Integrate with existing workflows
  - Modify contact import/enrichment pipelines
  - Add blocklist validation to campaign creation
  - Bulk contact processing integration
  - Real-time validation in existing API endpoints
  - Update contact qualification workflows

- [ ] **blocklist-error-handling**: Comprehensive error handling
  - Try/catch wrappers voor alle external API calls
  - Dead letter queue voor permanently failed syncs
  - Error categorization (temporary vs permanent)
  - Monitoring hooks en alerting
  - Recovery procedures documentation

#### **Frontend Development**

**UI Components**
- [x] **blocklist-ui-components**: Reusable components ✅ **COMPLETED**
  - ✅ `BlocklistTable`: Sortable table met search/filter capabilities
  - ✅ `BlocklistForm`: Form component voor create/edit (type dropdown, validation)
  - ✅ `BlocklistModal`: Modal voor quick add/edit acties
  - ✅ `BlocklistStats`: Dashboard widget met key metrics
  - ✅ `BlocklistBulkActions`: Import/export/bulk delete functionality
  - ✅ `BlocklistSyncStatus`: Real-time sync status indicators
  - ✅ Dutch localization en date formatting
  - ✅ TypeScript interfaces en proper error handling

- [x] **blocklist-page**: Dedicated management page ✅ **COMPLETED**
  - ✅ Complete CRUD interface op `/blocklist` route
  - ✅ Advanced search en filtering (by type, status, text search)
  - ✅ Pagination voor large datasets
  - ✅ Bulk selection en actions
  - ✅ Tabbed interface (Entries + Sync Status)
  - ✅ Responsive design voor mobile devices
  - ✅ Export functionaliteit (CSV/JSON)
  - ✅ Import functionaliteit met validatie
  - ✅ Sidebar menu integratie

**Workflow Integration**
- [ ] **contact-filtering-integration**: UI integration
  - "Block Contact" button in contact tables/drawers
  - Blocklist warnings in campaign creation flows
  - Visual indicators (icons/badges) voor blocked contacts
  - Quick block modal met reason input
  - Bulk block actions in contact selection
  - Toast notifications voor sync status

#### **Testing & Documentation**

- [ ] **blocklist-testing**: Comprehensive test suite
  - Unit tests voor alle services (Jest)
  - Integration tests voor API endpoints (Supertest)
  - UI component tests (React Testing Library)
  - E2E tests voor complete workflows (Playwright)
  - Mock external API calls voor testing
  - Performance tests voor bulk operations
  - Load testing voor high concurrency

- [ ] **blocklist-documentation**: Technical documentation
  - API documentation met Swagger/OpenAPI
  - Integration guide voor external platforms
  - User guide met screenshots
  - Troubleshooting guide voor common issues
  - Architecture decisions record (ADR)
  - Deployment en monitoring guides

---

## 🚀 Implementation Strategy

### **Week 1: Foundation** ✅ **COMPLETED**
1. ✅ Database schema en migratie
2. ✅ Core API endpoints met basis CRUD
3. ✅ Blocklist validation service
4. ✅ Complete UI components en management pagina
5. ✅ Import/export functionaliteit
6. ✅ Dashboard statistieken
7. ✅ Sidebar menu integratie

### **Week 2: Integration**  
5. External platform sync services
6. Contact filtering integration
7. Complete UI implementation
8. Real-time sync orchestration

### **Week 3: Polish & Testing**
9. Comprehensive error handling
10. Testing suite implementation
11. Documentation completion
12. Performance optimization

### **Success Metrics**
- Blocklist entries can be created/managed successfully
- Real-time sync to Instantly/Pipedrive >95% success rate
- Contact filtering prevents blocked contacts in campaigns
- UI response time <200ms for all operations
- Zero data inconsistencies between platforms

---

## 🔮 Future Phases

### **Phase 2: Advanced Features (1-2 weken)**
- CSV bulk import/export with validation
- Advanced analytics dashboard
- Sync retry management UI
- Contact history tracking
- Webhook endpoints voor external integrations

### **Phase 3: Automation (1-2 weken)**
- Automatic bounce/unsubscribe detection
- Smart domain pattern detection
- Email template notifications
- Advanced reporting en insights
- API rate limiting en quotas

### **Phase 4: Enterprise Features (optioneel)**
- Role-based access control
- Audit logging
- Multi-tenant support
- Advanced workflow automation
- Machine learning voor spam detection

---

## 📞 Stakeholder Approval

**Product Owner**: [Naam]
**Lead Developer**: [Naam] 
**QA Lead**: [Naam]

**Approved Date**: [Date]
**Target Completion**: [Date + 3 weken]
**Go-Live Date**: [Date + 4 weken]

---

*Dit document wordt bijgewerkt tijdens development. Laatste update: 23 september 2025*

---

## 📁 **Geïmplementeerde Bestanden (Week 1)**

### **Database**
- `supabase/migrations/20250923143111_create_blocklist_entries.sql`

### **Backend API Routes**
- `app/api/blocklist/route.ts` (GET, POST)
- `app/api/blocklist/[id]/route.ts` (GET, PUT, DELETE)
- `app/api/blocklist/check/route.ts` (POST bulk validation)
- `app/api/blocklist/stats/route.ts` (GET dashboard stats)
- `app/api/blocklist/import/route.ts` (POST bulk import)
- `app/api/blocklist/export/route.ts` (GET CSV/JSON export)

### **Frontend Components**
- `components/blocklist/blocklist-table.tsx`
- `components/blocklist/blocklist-form.tsx`
- `components/blocklist/blocklist-modal.tsx`
- `components/blocklist/blocklist-stats.tsx`
- `components/blocklist/blocklist-bulk-actions.tsx`
- `components/blocklist/blocklist-sync-status.tsx`
- `components/blocklist/index.ts` (exports)

### **Hooks & Services**
- `hooks/use-blocklist.ts` (React hook voor API integratie)
- `lib/services/blocklist-validation.service.ts` (Validation service)

### **Pages & Navigation**
- `app/(dashboard)/blocklist/page.tsx` (Main management page)
- `components/Sidebar.tsx` (Updated met blocklist menu item)

**Totaal**: 16 nieuwe bestanden + 1 update = **17 bestanden gewijzigd**
