# Test Scenarios: Contact Qualification Status Workflow

## Overview
This document outlines comprehensive test scenarios for the new campaign qualification status system, including automatic status transitions, UI/UX consistency, and data integrity.

## Prerequisites
Before testing, ensure the following migrations have been applied to the database:
1. `deploy-qualification-status.sql` - Complete deployment script
2. `027_add_in_campaign_qualification_status.sql` - Core qualification status
3. `028_optimize_campaign_qualification_queries.sql` - Performance optimization
4. `029_update_contacts_optimized_view.sql` - View updates

## Test Scenarios

### **Scenario 1: Automatic Status Transition - Add to Campaign**

**Objective**: Verify that adding a qualified contact to a campaign automatically changes their status to 'in_campaign'

**Pre-conditions**:
- Contact exists with `qualification_status = 'qualified'`
- Contact has `campaign_id = null`
- Contact has `campaign_name = null`

**Test Steps**:
1. Navigate to `/agents/otis/enhanced` → CONTACTS tab
2. Select "Qualified" contacts from the tab
3. Select one or more qualified contacts
4. Choose a campaign from the dropdown
5. Click "Add to Campaign"
6. Wait for the operation to complete

**Expected Results**:
- ✅ Contact should appear in "In Campaign" tab
- ✅ Contact should disappear from "Qualified" tab  
- ✅ Contact's `qualification_status` should be 'in_campaign' in database
- ✅ Contact's `campaign_id` should be set to the selected campaign
- ✅ Contact's `qualification_timestamp` should be updated
- ✅ "In Campaign" card count should increase by 1
- ✅ "Qualified" card count should decrease by 1

**SQL Verification**:
```sql
SELECT id, qualification_status, campaign_id, campaign_name, qualification_timestamp 
FROM contacts 
WHERE id = '<contact_id>';
```

---

### **Scenario 2: Automatic Status Transition - Remove from Campaign**

**Objective**: Verify that removing a contact from a campaign reverts their status to 'qualified'

**Pre-conditions**:
- Contact exists with `qualification_status = 'in_campaign'`
- Contact has `campaign_id` set to a valid campaign

**Test Steps**:
1. Manually update contact to remove campaign assignment:
```sql
UPDATE contacts 
SET campaign_id = null, campaign_name = null 
WHERE id = '<contact_id>';
```

**Expected Results**:
- ✅ Contact's `qualification_status` should automatically change to 'qualified'
- ✅ Contact should appear in "Qualified" tab in UI
- ✅ Contact should disappear from "In Campaign" tab
- ✅ Qualification timestamp should be updated

---

### **Scenario 3: OTIS Enhanced Page - Tab Filtering**

**Objective**: Verify that all tabs properly filter contacts by qualification status

**Test Steps**:
1. Navigate to `/agents/otis/enhanced` → CONTACTS tab
2. Click each tab and verify content

**Expected Results**:

**In Campaign Tab**:
- ✅ Shows only contacts with `qualification_status = 'in_campaign'`
- ✅ All displayed contacts have `campaign_id` not null
- ✅ Tab count matches displayed contacts
- ✅ "Add All to Campaign" button is disabled or hidden

**Qualified Tab**:
- ✅ Shows only contacts with `qualification_status = 'qualified'`
- ✅ All displayed contacts have `campaign_id = null`
- ✅ Tab count matches displayed contacts
- ✅ "Add All to Campaign" button is enabled (if campaign selected)

**Review Tab**:
- ✅ Shows only contacts with `qualification_status = 'review'`
- ✅ Tab count matches displayed contacts

**Disqualified Tab**:
- ✅ Shows only contacts with `qualification_status = 'disqualified'`
- ✅ Tab count matches displayed contacts

**Pending Tab**:
- ✅ Shows only contacts with `qualification_status = 'pending'` or null
- ✅ Tab count matches displayed contacts

---

### **Scenario 4: Status Cards Accuracy**

**Objective**: Verify that status cards display accurate counts

**Test Steps**:
1. Note the counts in all 5 status cards
2. Run SQL query to get actual counts
3. Compare results

**SQL Verification**:
```sql
SELECT 
    qualification_status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE campaign_id IS NOT NULL) as with_campaign,
    COUNT(*) FILTER (WHERE campaign_id IS NULL) as without_campaign
FROM contacts 
GROUP BY qualification_status
ORDER BY qualification_status;
```

**Expected Results**:
- ✅ "In Campaigns" card = count of `qualification_status = 'in_campaign'`
- ✅ "Qualified" card = count of `qualification_status = 'qualified'`
- ✅ "Review Needed" card = count of `qualification_status = 'review'`
- ✅ "Disqualified" card = count of `qualification_status = 'disqualified'`
- ✅ "Pending" card = count of `qualification_status = 'pending'` + nulls

---

### **Scenario 5: /contacten Page Consistency**

**Objective**: Verify that the /contacten page displays consistent information with OTIS enhanced

**Test Steps**:
1. Compare status card counts between `/agents/otis/enhanced` and `/contacten`
2. Verify tab functionality in `/contacten`
3. Check visual consistency

**Expected Results**:
- ✅ Status card counts should match between both pages
- ✅ Tab structure should be identical
- ✅ Color schemes should be consistent
- ✅ Icons and typography should match

---

### **Scenario 6: API Response Verification**

**Objective**: Verify that the backend API returns correct qualification status data

**Test Steps**:
1. Make API call: `GET /api/otis/contacts/by-company/[runId]`
2. Examine response structure

**Expected Results**:
- ✅ Response includes `contact_qualification_summary` with all 5 statuses
- ✅ Response includes `in_campaign` count in summary
- ✅ Individual contacts include `qualificationStatus` field
- ✅ Filtering by `?qualification=in_campaign` returns only in_campaign contacts

**API Test**:
```bash
curl -X GET "/api/otis/contacts/by-company/[runId]?qualification=in_campaign"
```

---

### **Scenario 7: Database Trigger Functionality**

**Objective**: Verify the database trigger works correctly in all scenarios

**Test Cases**:

**7a. Qualified → In Campaign**:
```sql
-- Setup: Create qualified contact
INSERT INTO contacts (name, email, qualification_status) 
VALUES ('Test Contact', 'test@example.com', 'qualified');

-- Test: Add to campaign
UPDATE contacts 
SET campaign_id = 'test-campaign-123', campaign_name = 'Test Campaign'
WHERE email = 'test@example.com';

-- Verify: Should be 'in_campaign' now
SELECT qualification_status FROM contacts WHERE email = 'test@example.com';
```

**7b. In Campaign → Qualified**:
```sql
-- Test: Remove from campaign  
UPDATE contacts 
SET campaign_id = null, campaign_name = null
WHERE email = 'test@example.com';

-- Verify: Should be 'qualified' now
SELECT qualification_status FROM contacts WHERE email = 'test@example.com';
```

**7c. Other Status → No Change**:
```sql
-- Setup: Contact with 'review' status
UPDATE contacts 
SET qualification_status = 'review'
WHERE email = 'test@example.com';

-- Test: Add to campaign
UPDATE contacts 
SET campaign_id = 'test-campaign-123'
WHERE email = 'test@example.com';

-- Verify: Should remain 'review' (not changed to 'in_campaign')
SELECT qualification_status FROM contacts WHERE email = 'test@example.com';
```

---

### **Scenario 8: Performance Testing**

**Objective**: Verify that the new indexes improve query performance

**Test Steps**:
1. Run performance queries before and after index creation
2. Compare execution times

**Test Queries**:
```sql
-- Large qualification status query
EXPLAIN ANALYZE 
SELECT * FROM contacts 
WHERE qualification_status = 'qualified' 
  AND campaign_id IS NULL 
ORDER BY created_at DESC 
LIMIT 100;

-- Complex filtering query
EXPLAIN ANALYZE
SELECT * FROM contacts 
WHERE qualification_status = 'in_campaign' 
  AND company_id IN (SELECT id FROM companies WHERE qualification_status = 'qualified')
LIMIT 50;
```

**Expected Results**:
- ✅ Queries should use the new indexes (`idx_contacts_qualification_campaign_composite`)
- ✅ Execution time should be significantly reduced
- ✅ No table scans for qualification status queries

---

### **Scenario 9: Edge Case Testing**

**Objective**: Test edge cases and error conditions

**9a. Null Qualification Status**:
- ✅ Contacts with `qualification_status = null` should appear in "Pending" tab
- ✅ Should be counted in "Pending" card

**9b. Invalid Qualification Status**:
- ✅ Database should reject invalid statuses due to CHECK constraint
- ✅ Application should handle gracefully

**9c. Concurrent Updates**:
- ✅ Multiple users adding contacts to campaigns simultaneously
- ✅ Status transitions should be atomic and consistent

**9d. Campaign Removal**:
- ✅ If campaign is deleted, contacts should revert to 'qualified' status
- ✅ UI should update accordingly

---

### **Scenario 10: Data Migration Verification**

**Objective**: Verify that existing data was properly migrated

**Test Steps**:
1. Check that existing contacts with campaigns were set to 'in_campaign'
2. Verify data integrity after migration

**SQL Verification**:
```sql
-- Should return 0 (no qualified contacts with campaigns)
SELECT COUNT(*) 
FROM contacts 
WHERE qualification_status = 'qualified' 
  AND campaign_id IS NOT NULL;

-- Should return count of contacts that were migrated to 'in_campaign'
SELECT COUNT(*) 
FROM contacts 
WHERE qualification_status = 'in_campaign' 
  AND campaign_id IS NOT NULL;
```

---

## Test Checklist Summary

- [ ] **Database migrations applied successfully**
- [ ] **Automatic status transitions (qualified ↔ in_campaign)**
- [ ] **OTIS enhanced tab filtering works correctly**
- [ ] **Status cards show accurate counts**
- [ ] **/contacten page consistency with OTIS**
- [ ] **API responses include new qualification status data**
- [ ] **Database triggers function properly**
- [ ] **Performance improvements from new indexes**
- [ ] **Edge cases handled gracefully**
- [ ] **Data migration completed successfully**

---

## Deployment Checklist

Before deploying to production:

1. [ ] **Backup database**
2. [ ] **Apply migrations in staging environment first**
3. [ ] **Run all test scenarios in staging**
4. [ ] **Verify UI/UX works on mobile devices**
5. [ ] **Check browser compatibility**
6. [ ] **Monitor performance after deployment**
7. [ ] **Have rollback plan ready**

---

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate**: Revert frontend code to previous version
2. **Database**: Run rollback script to remove trigger and revert status values
3. **Verification**: Ensure system returns to previous functionality

**Rollback SQL**:
```sql
-- Remove trigger
DROP TRIGGER IF EXISTS trg_update_qualification_status_on_campaign_change ON contacts;
DROP FUNCTION IF EXISTS update_qualification_status_on_campaign_change();

-- Revert constraint
ALTER TABLE contacts DROP CONSTRAINT contacts_qualification_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_qualification_status_check 
  CHECK (qualification_status IN ('pending', 'qualified', 'disqualified', 'review'));

-- Reset 'in_campaign' contacts to 'qualified'
UPDATE contacts 
SET qualification_status = 'qualified' 
WHERE qualification_status = 'in_campaign';
```