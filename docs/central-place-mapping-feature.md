# Central Place Mapping Feature - Product Requirements Document

## **1. Executive Summary**

### **Problem Statement**
Currently, the automation settings page shows all regions grouped by `regio_platform`, but users don't understand which specific place is used for job posting scraping. When scraping from platforms like "ZaanseBanen" (which contains 18 postal codes and 5 places), the system scrapes from all places, leading to:
- User confusion about which place is the "source"
- Inefficient scraping (overlapping results)
- Poor user experience

### **Solution**
Implement a `central_place` mapping system that designates one optimal location per `regio_platform` for job posting scraping. This will:
- Provide clarity to users about which place is scraped
- Improve scraping efficiency
- Enhance user experience with a simpler mental model

## **2. Product Overview**

### **Feature Name**
Central Place Mapping for Automation Settings

### **Target Users**
- Primary: Users configuring job posting automation
- Secondary: Administrators managing scraping configurations

### **Success Metrics**
- Reduced user confusion (measured by support tickets)
- Improved scraping efficiency (faster results, fewer duplicates)
- Increased user adoption of automation features

## **3. Functional Requirements**

### **3.1 Database Schema**
- Create `regio_platform_central_places` mapping table
- Ensure 1:1 relationship between `regio_platform` and `central_place`
- Support platform-level metadata (scraping priority, active status)

### **3.2 Settings Page Updates**
- Display central place information for each platform group
- Show which specific place will be scraped when automation is enabled
- Maintain existing toggle functionality
- Add visual indicators for central places

### **3.3 API Enhancements**
- Update `/api/regions/grouped-by-platform` to include central place data
- Create `/api/regio-platforms/central-places` for central place management
- Maintain backward compatibility with existing automation preferences

### **3.4 Scraping Integration**
- Update n8n webhook payloads to include central place information
- Modify scraping logic to focus on central places
- Maintain fallback mechanisms for edge cases

## **4. User Experience Requirements**

### **4.1 Settings Page Display**
```
┌─────────────────────────────────────────────────────────┐
│ ZaanseBanen (5 regions)                                 │
│ 🎯 Central Place: Zaandam                               │
│ [✓] Enable Automation                                   │
│                                                         │
│ 📍 Zaandam (1500 AA) [Central]                         │
│ 📍 Volendam (1131 AA)                                  │
│ 📍 Wormerveer (1521 AA)                                │
│ 📍 Krommenie (1561 AA)                                 │
│ 📍 Assendelft (1566 AA)                                │
└─────────────────────────────────────────────────────────┘
```

### **4.2 User Interactions**
- Users can see which place is the central scraping location
- Toggle automation per platform (not per individual place)
- Visual distinction between central place and other places
- Clear indication of what will be scraped

## **5. Technical Requirements**

### **5.1 Database Migration**
```sql
CREATE TABLE regio_platform_central_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regio_platform VARCHAR NOT NULL UNIQUE,
    central_place VARCHAR NOT NULL,
    central_postcode VARCHAR,
    scraping_priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### **5.2 API Endpoints**
- `GET /api/regio-platforms/central-places` - List all central places
- `PUT /api/regio-platforms/central-places/{platform}` - Update central place
- Enhanced `GET /api/regions/grouped-by-platform` - Include central place data

### **5.3 Frontend Components**
- Updated `AutomationPreferencesSection` with central place display
- Enhanced `PlatformGroup` component with central place indicators
- New `CentralPlaceIndicator` component

## **6. Non-Functional Requirements**

### **6.1 Performance**
- API response time < 200ms for central place queries
- Support for 100+ platforms without performance degradation
- Efficient caching of central place mappings

### **6.2 Security**
- Central place management restricted to admin users
- Audit logging for central place changes
- Input validation and sanitization

### **6.3 Scalability**
- Support for 1000+ regions across 100+ platforms
- Efficient database queries with proper indexing
- Horizontal scaling capability

## **7. Implementation Phases**

### **Phase 1: Database & Backend (Week 1)**
- Create database migration
- Implement API endpoints
- Add central place seeding logic

### **Phase 2: Frontend Updates (Week 2)**
- Update settings page UI
- Implement central place indicators
- Add admin management interface

### **Phase 3: Integration & Testing (Week 3)**
- Update n8n webhook integration
- End-to-end testing
- User acceptance testing

### **Phase 4: Deployment & Monitoring (Week 4)**
- Production deployment
- Performance monitoring
- User feedback collection

## **8. Acceptance Criteria**

### **8.1 Database**
- [ ] `regio_platform_central_places` table created successfully
- [ ] All existing platforms have central places assigned
- [ ] Unique constraint enforced on `regio_platform`
- [ ] Proper indexing for performance

### **8.2 API**
- [ ] `/api/regio-platforms/central-places` returns correct data
- [ ] Enhanced `/api/regions/grouped-by-platform` includes central place info
- [ ] Proper error handling and validation
- [ ] Backward compatibility maintained

### **8.3 Frontend**
- [ ] Settings page displays central place information
- [ ] Visual indicators distinguish central places
- [ ] Toggle functionality works correctly
- [ ] Responsive design maintained

### **8.4 Integration**
- [ ] n8n webhooks receive central place data
- [ ] Scraping logic uses central places
- [ ] Fallback mechanisms work correctly
- [ ] Performance meets requirements

## **9. Risk Assessment**

### **9.1 Technical Risks**
- **Risk**: Central place changes break existing automation
- **Mitigation**: Maintain backward compatibility, gradual migration

### **9.2 User Experience Risks**
- **Risk**: Users confused by new central place concept
- **Mitigation**: Clear UI indicators, user education, gradual rollout

### **9.3 Data Risks**
- **Risk**: Incorrect central place assignments
- **Mitigation**: Validation rules, admin review process

## **10. Success Metrics**

### **10.1 User Engagement**
- 90% of users understand central place concept within 1 week
- 50% reduction in support tickets about "which place is scraped"
- 25% increase in automation feature adoption

### **10.2 Technical Performance**
- API response times < 200ms
- 99.9% uptime for central place endpoints
- Zero data inconsistencies

### **10.3 Business Impact**
- 30% improvement in scraping efficiency
- 20% reduction in duplicate job postings
- Positive user feedback scores > 4.5/5

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Owner**: Product Manager  
**Stakeholders**: Development Team, UX Team, Operations Team 