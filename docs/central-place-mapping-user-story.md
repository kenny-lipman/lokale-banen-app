# Central Place Mapping - User Story

## **User Story**

**As a** user configuring job posting automation  
**I want to** see which specific place will be scraped for each region platform  
**So that** I understand exactly what area the automation will cover and can make informed decisions about enabling it

## **Acceptance Criteria**

### **Given** I am on the automation settings page
### **When** I view the region platforms
### **Then** I should see:
- [ ] Each platform group displays a "Central Place" indicator
- [ ] The central place is clearly marked with a 🎯 icon
- [ ] I can see which specific place will be scraped when automation is enabled
- [ ] All other places in the platform are listed but not marked as central

### **Given** I am viewing a platform with multiple places
### **When** I enable automation for that platform
### **Then** I should understand:
- [ ] Only the central place will be scraped for job postings
- [ ] The automation will be more efficient and focused
- [ ] I won't get duplicate results from multiple places in the same platform

### **Given** I am an administrator
### **When** I need to manage central places
### **Then** I should be able to:
- [ ] View all current central place assignments
- [ ] Change the central place for any platform
- [ ] See the impact of central place changes on automation

## **User Journey**

### **Scenario 1: First-time User**
1. **User visits settings page** → Sees platform groups with central place indicators
2. **User reads central place information** → Understands which place will be scraped
3. **User enables automation** → Confident about what area will be covered
4. **User receives results** → Sees focused, relevant job postings from central place

### **Scenario 2: Existing User (Migration)**
1. **User visits settings page** → Sees new central place indicators
2. **User notices changes** → Reads explanation of central place concept
3. **User continues using automation** → No disruption to existing functionality
4. **User benefits from improvements** → More efficient scraping, clearer results

### **Scenario 3: Administrator**
1. **Admin accesses central place management** → Views current assignments
2. **Admin identifies suboptimal central place** → Changes to better location
3. **Admin updates configuration** → System uses new central place
4. **Admin monitors results** → Confirms improved scraping efficiency

## **User Interface Requirements**

### **Settings Page Display**
```
┌─────────────────────────────────────────────────────────┐
│ 🏢 ZaanseBanen (5 regions)                              │
│ 🎯 Central Place: Zaandam                               │
│ [✓] Enable Automation                                   │
│                                                         │
│ 📍 Zaandam (1500 AA) [🎯 Central]                      │
│ 📍 Volendam (1131 AA)                                  │
│ 📍 Wormerveer (1521 AA)                                │
│ 📍 Krommenie (1561 AA)                                 │
│ 📍 Assendelft (1566 AA)                                │
└─────────────────────────────────────────────────────────┘
```

### **Visual Indicators**
- **🎯 Icon**: Clearly marks the central place
- **Bold text**: Central place name stands out
- **Color coding**: Central place has distinct styling
- **Tooltip**: Explains what "Central Place" means

### **Information Architecture**
- **Platform level**: Central place shown at platform group level
- **Place level**: Individual places show their relationship to central place
- **Automation level**: Toggle affects entire platform, not individual places

## **Success Metrics**

### **User Understanding**
- 90% of users can correctly identify which place will be scraped
- 80% of users understand the central place concept within 5 minutes
- 70% of users prefer the new interface over the old one

### **User Behavior**
- 50% reduction in support tickets about "which place is scraped"
- 25% increase in automation feature adoption
- 30% improvement in user satisfaction scores

### **Technical Performance**
- No increase in page load times
- Maintained responsiveness on mobile devices
- Seamless migration for existing users

## **Edge Cases**

### **No Central Place Assigned**
- Show warning message: "Central place not configured"
- Disable automation toggle until central place is set
- Provide admin contact information

### **Central Place Changed**
- Notify users of changes via in-app notification
- Show "Last updated" timestamp
- Maintain automation settings unless explicitly changed

### **Multiple Optimal Places**
- Allow admin to set priority order
- Show fallback places in UI
- Explain fallback logic to users

## **Accessibility Requirements**

### **Screen Readers**
- Central place clearly announced
- Relationship between places and central place explained
- Toggle state properly communicated

### **Keyboard Navigation**
- All elements accessible via keyboard
- Clear focus indicators
- Logical tab order

### **Visual Accessibility**
- Sufficient color contrast for central place indicators
- Clear visual hierarchy
- Responsive design for all screen sizes

---

**Story Points**: 8  
**Priority**: High  
**Epic**: Automation Settings Enhancement  
**Sprint**: Q1 2025 