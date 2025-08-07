# Central Place Mapping - Development Tasks

## **Project Overview**
Implement a central place mapping system to designate one optimal location per `regio_platform` for job posting scraping. This will improve user experience by providing clarity about which specific place will be scraped when automation is enabled.

## **Backend Development Tasks**

### **Task 1: Create Database Migration**
**Developer**: Backend  
**Estimated Time**: 2 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: None

**Subtasks:**
- [x] Create migration file `022_create_regio_platform_central_places.sql`
- [x] Define table schema with proper constraints
- [x] Add indexes for performance optimization
- [x] Create RLS policies for security
- [x] Add trigger for `updated_at` timestamps

**Acceptance Criteria:**
- [x] Table created successfully in Supabase
- [x] All constraints and indexes applied
- [x] RLS policies working correctly
- [x] Migration can be rolled back if needed

**Implementation Details:**
```sql
-- Migration file: migrations/022_create_regio_platform_central_places.sql
CREATE TABLE IF NOT EXISTS public.regio_platform_central_places (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    regio_platform VARCHAR NOT NULL UNIQUE,
    central_place VARCHAR NOT NULL,
    central_postcode VARCHAR,
    scraping_priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_regio_platform_central_places_platform ON public.regio_platform_central_places(regio_platform);
CREATE INDEX IF NOT EXISTS idx_regio_platform_central_places_active ON public.regio_platform_central_places(is_active);

-- RLS policies
ALTER TABLE public.regio_platform_central_places ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all users" ON public.regio_platform_central_places
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow write access only to service role (for admin operations)
CREATE POLICY "Allow write access to service role" ON public.regio_platform_central_places
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_regio_platform_central_places_updated_at 
    BEFORE UPDATE ON public.regio_platform_central_places 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **Task 2: Seed Central Places Data**
**Developer**: Backend  
**Estimated Time**: 3 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 1

**Subtasks:**
- [x] Analyze existing regions data to identify optimal central places
- [x] Create seeding script with central place assignments
- [x] Validate central place assignments against regions table
- [x] Test seeding script in development environment
- [x] Document central place selection criteria

**Acceptance Criteria:**
- [x] All existing platforms have central places assigned
- [x] Central places exist in the regions table
- [x] Seeding script can be run safely multiple times
- [x] Documentation explains central place selection logic

**Implementation Details:**
```sql
-- Seeding script: migrations/023_seed_central_places.sql
-- Example central place assignments based on analysis
INSERT INTO public.regio_platform_central_places (regio_platform, central_place, central_postcode, scraping_priority) VALUES
('ZaanseBanen', 'Zaandam', '1500 AA', 1),
('AmsterdamBanen', 'Amsterdam', '1000 AA', 1),
('RotterdamBanen', 'Rotterdam', '3000 AA', 1),
-- Add more based on analysis of existing data
ON CONFLICT (regio_platform) DO UPDATE SET
    central_place = EXCLUDED.central_place,
    central_postcode = EXCLUDED.central_postcode,
    updated_at = now();
```

### **Task 3: Create Central Places API Endpoints**
**Developer**: Backend  
**Estimated Time**: 4 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 1, Task 2

**Subtasks:**
- [x] Create `GET /api/regio-platforms/central-places` endpoint
- [x] Create `PUT /api/regio-platforms/central-places/[platform]` endpoint
- [x] Add proper authentication and authorization
- [x] Implement input validation and error handling
- [x] Add caching for performance optimization

**Acceptance Criteria:**
- [x] GET endpoint returns all central places with proper structure
- [x] PUT endpoint allows admin users to update central places
- [x] Proper error handling for invalid requests
- [x] API responses are cached appropriately

**Implementation Details:**
```typescript
// File: app/api/regio-platforms/central-places/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  try {
    const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: centralPlaces, error } = await supabaseService.client
      .from('regio_platform_central_places')
      .select('*')
      .eq('is_active', true)
      .order('regio_platform', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch central places' }, { status: 500 })
    }

    return NextResponse.json({ centralPlaces })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### **Task 4: Update Regions API to Include Central Places**
**Developer**: Backend  
**Estimated Time**: 3 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 3

**Subtasks:**
- [x] Modify `/api/regions/grouped-by-platform` endpoint
- [x] Join with central places table to include central place data
- [x] Maintain backward compatibility
- [x] Optimize query performance
- [x] Add proper error handling

**Acceptance Criteria:**
- [x] API response includes central place information for each platform
- [x] Backward compatibility maintained for existing clients
- [x] Query performance remains acceptable
- [x] Proper error handling for missing central places

**Implementation Details:**
```typescript
// Update existing route: app/api/regions/grouped-by-platform/route.ts
// Add central place data to the response structure
const { data: regions, error } = await supabaseService.client
  .from('regions')
  .select(`
    id,
    plaats,
    postcode,
    regio_platform,
    user_automation_preferences!left(automation_enabled),
    regio_platform_central_places!left(central_place, central_postcode)
  `)
  .eq('user_automation_preferences.user_id', user.id)
  .not('regio_platform', 'is', null)
  .order('regio_platform', { ascending: true })
  .order('plaats', { ascending: true })
```

### **Task 5: Update CRON Job Integration**
**Developer**: Backend  
**Estimated Time**: 2 hours  
**Priority**: P1 (Important)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 4

**Subtasks:**
- [x] Modify CRON job to include central place data in webhook payload
- [x] Update n8n webhook structure
- [x] Test webhook payload format
- [x] Document webhook changes

**Acceptance Criteria:**
- [x] CRON job includes central place information in webhook
- [x] n8n can process central place data
- [x] Webhook payload is properly documented
- [x] Fallback mechanisms work if central place is missing

## **Frontend Development Tasks**

### **Task 1: Create Central Place Indicator Component**
**Developer**: Frontend  
**Estimated Time**: 2 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: Backend Task 4

**Subtasks:**
- [x] Create `CentralPlaceIndicator` component
- [x] Implement visual design with 🎯 icon
- [x] Add tooltip explaining central place concept
- [x] Ensure accessibility compliance
- [x] Add responsive design

**Acceptance Criteria:**
- [x] Component displays central place information clearly
- [x] Visual design matches design system
- [x] Accessible to screen readers
- [x] Responsive on all screen sizes

**Implementation Details:**
```typescript
// File: components/CentralPlaceIndicator.tsx
interface CentralPlaceIndicatorProps {
  centralPlace: string
  centralPostcode?: string
  className?: string
}

export const CentralPlaceIndicator: React.FC<CentralPlaceIndicatorProps> = ({
  centralPlace,
  centralPostcode,
  className = ""
}) => {
  return (
    <div className={`flex items-center space-x-2 text-sm text-blue-600 ${className}`}>
      <span role="img" aria-label="Central place" className="text-lg">🎯</span>
      <span className="font-medium">Central Place:</span>
      <span className="font-semibold">{centralPlace}</span>
      {centralPostcode && (
        <span className="text-gray-500">({centralPostcode})</span>
      )}
    </div>
  )
}
```

### **Task 2: Update PlatformGroup Component**
**Developer**: Frontend  
**Estimated Time**: 3 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 1

**Subtasks:**
- [x] Integrate `CentralPlaceIndicator` component
- [x] Update component props to include central place data
- [x] Modify layout to accommodate central place display
- [x] Update accessibility attributes
- [x] Test with various data scenarios

**Acceptance Criteria:**
- [x] Central place information displayed prominently
- [x] Layout remains clean and organized
- [x] Accessibility maintained
- [x] Works with missing central place data

**Implementation Details:**
```typescript
// Update: components/PlatformGroup.tsx
interface PlatformGroupProps {
  platform: string
  regions: Region[]
  centralPlace?: {
    central_place: string
    central_postcode?: string
  }
  onRegionToggle: (regionId: string, enabled: boolean) => void
  expanded?: boolean
  onToggleExpanded?: () => void
  saving?: boolean
}

// Add central place display in the header
<div className="px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border-b border-gray-200">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <div className="flex items-center space-x-3">
        <h3 className="font-semibold text-gray-900">{platform}</h3>
        {centralPlace && (
          <CentralPlaceIndicator
            centralPlace={centralPlace.central_place}
            centralPostcode={centralPlace.central_postcode}
          />
        )}
      </div>
      <p className="text-sm text-gray-600">
        {enabledCount} of {totalCount} regions enabled
      </p>
    </div>
  </div>
</div>
```

### **Task 3: Update RegionToggle Component**
**Developer**: Frontend  
**Estimated Time**: 2 hours  
**Priority**: P1 (Important)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 2

**Subtasks:**
- [x] Add visual indicator for central place regions
- [x] Update component to show central place status
- [x] Modify styling for central place regions
- [x] Update accessibility attributes
- [x] Test with central place data

**Acceptance Criteria:**
- [x] Central place regions are visually distinct
- [x] Clear indication of which region is central
- [x] Accessibility maintained
- [x] Consistent with design system

**Implementation Details:**
```typescript
// Update: components/RegionToggle.tsx
interface RegionToggleProps {
  region: Region & {
    isCentralPlace?: boolean
  }
  onToggle: (regionId: string, enabled: boolean) => void
  saving?: boolean
}

// Add central place indicator
<div className="flex items-center space-x-3 flex-1 min-w-0">
  <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-full flex-shrink-0">
    <MapPin className="h-4 w-4 text-blue-600" />
  </div>
  <div className="flex-1 min-w-0">
    <h4 className="font-medium text-gray-900 truncate">
      {region.plaats}
      {region.isCentralPlace && (
        <span className="ml-2 text-blue-600 text-sm font-medium">[Central]</span>
      )}
    </h4>
    <p className="text-sm text-gray-500 truncate">{region.postcode}</p>
  </div>
</div>
```

### **Task 4: Update AutomationPreferencesSection Component**
**Developer**: Frontend  
**Estimated Time**: 2 hours  
**Priority**: P0 (Critical)  
**Status**: ✅ COMPLETED  
**Dependencies**: Task 2

**Subtasks:**
- [x] Update component to handle central place data
- [x] Modify data fetching to include central places
- [x] Update error handling for missing central places
- [x] Test with various data scenarios
- [x] Update TypeScript interfaces

**Acceptance Criteria:**
- [x] Component works with central place data
- [x] Graceful handling of missing central places
- [x] TypeScript types are correct
- [x] Error states handled properly

### **Task 5: Add Admin Management Interface**
**Developer**: Frontend  
**Estimated Time**: 4 hours  
**Priority**: P2 (Nice to Have)  
**Status**: 🔄 PENDING  
**Dependencies**: Backend Task 3

**Subtasks:**
- [ ] Create admin page for central place management
- [ ] Implement central place editing interface
- [ ] Add validation for central place changes
- [ ] Implement audit logging display
- [ ] Add confirmation dialogs for changes

**Acceptance Criteria:**
- [ ] Admin can view all central place assignments
- [ ] Admin can edit central places with validation
- [ ] Changes are logged and auditable
- [ ] Interface is intuitive and secure

## **Integration Tasks**

### **Task 1: End-to-End Testing**
**Developer**: Full Stack  
**Estimated Time**: 3 hours  
**Priority**: P0 (Critical)  
**Status**: 🔄 PENDING  
**Dependencies**: All Backend and Frontend Tasks

**Subtasks:**
- [ ] Test complete user journey
- [ ] Verify central place data flow
- [ ] Test error scenarios
- [ ] Validate performance
- [ ] Test accessibility

### **Task 2: User Acceptance Testing**
**Developer**: Product Manager  
**Estimated Time**: 2 hours  
**Priority**: P0 (Critical)  
**Status**: 🔄 PENDING  
**Dependencies**: Task 1

**Subtasks:**
- [ ] Test with real users
- [ ] Validate user understanding
- [ ] Collect feedback
- [ ] Document issues
- [ ] Plan improvements

## **Deployment Tasks**

### **Task 1: Production Deployment**
**Developer**: DevOps  
**Estimated Time**: 2 hours  
**Priority**: P0 (Critical)  
**Status**: 🔄 PENDING  
**Dependencies**: All Development Tasks

**Subtasks:**
- [ ] Deploy database migration
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Verify deployment
- [ ] Monitor for issues

---

**Total Estimated Time**: 32 hours  
**Priority Breakdown**: P0 (Critical): 24h, P1 (Important): 6h, P2 (Nice to Have): 2h  
**Timeline**: 4 weeks (1 week per phase) 