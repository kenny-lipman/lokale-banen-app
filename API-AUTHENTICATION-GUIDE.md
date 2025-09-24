# 🔐 API Authentication Guide - Lokale Banen

## ⚠️ **KRITIEK PROBLEEM OPGELOST**

**Datum:** 23 september 2025
**Probleem:** API endpoints retourneerden lege data ondanks dat data in database aanwezig was
**Oorzaak:** RLS (Row Level Security) + verkeerde Supabase client gebruikt

---

## 🚨 **NOOIT MEER DOEN:**

```typescript
// ❌ VERKEERD - Browser client in API routes met withAuth()
import { supabaseService } from '@/lib/supabase-service'

export const GET = withAuth(async (req: NextRequest, authResult: AuthResult) => {
  const { data } = await supabaseService.client  // ❌ VERKEERD!
    .from('contacts')
    .select('*')
  // Returns EMPTY because RLS blocks unauthenticated requests
})
```

## ✅ **ALTIJD DOEN:**

```typescript
// ✅ GOED - Authenticated client via authResult
export const GET = withAuth(async (req: NextRequest, authResult: AuthResult) => {
  const { data } = await authResult.supabase  // ✅ GOED!
    .from('contacts')
    .select('*')
  // Returns ACTUAL DATA because authenticated
})
```

---

## 📋 **SIMPELE CHECKLIST VOOR ELKE NIEUWE API ROUTE:**

### 1. **Heeft je tabel RLS enabled?**
```sql
-- Check in Supabase SQL editor:
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'jouw_tabel_naam';
```

### 2. **Gebruik je `withAuth()`?**
```typescript
export const GET = withAuth(handlerFunction)  // ✅
```

### 3. **Gebruik je de juiste client?**
```typescript
// ✅ IN withAuth() handlers:
const { data } = await authResult.supabase.from('table')

// ❌ NOOIT in withAuth() handlers:
const { data } = await supabaseService.client.from('table')
```

---

## 🔧 **CONCRETE TEMPLATES:**

### **Template 1: Eenvoudige GET endpoint**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function handler(req: NextRequest, authResult: AuthResult) {
  try {
    const { data, error } = await authResult.supabase
      .from('jouw_tabel')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const GET = withAuth(handler)
```

### **Template 2: POST met validatie**
```typescript
async function postHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const body = await req.json()

    const { data, error } = await authResult.supabase
      .from('jouw_tabel')
      .insert(body)
      .select()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
```

### **Template 3: Admin-only endpoint**
```typescript
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

async function adminHandler(req: NextRequest, authResult: AuthResult) {
  try {
    // authResult.profile.role is already validated as admin
    const { data, error } = await authResult.supabase
      .from('admin_table')
      .select('*')

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const POST = withAdminAuth(adminHandler)
```

### **Template 4: Public endpoint (geen auth)**
```typescript
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('public_table')
      .select('*')

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## 🎯 **WELKE CLIENT WANNEER?**

| Situatie | Client | Middleware | Voorbeeld |
|----------|---------|------------|-----------|
| **User data API** | `authResult.supabase` | `withAuth()` | Contact CRUD, user settings |
| **Admin-only API** | `authResult.supabase` | `withAdminAuth()` | User invitations, system config |
| **Public API** | `createServiceRoleClient()` | Geen | Health checks, public endpoints |
| **Account creation** | `createServiceRoleClient()` | Geen | Accept invites, signup |
| **Frontend components** | `supabaseService.client` | - | React components |
| **Manual auth needed** | ❌ **Niet doen** | Convert to middleware | Legacy patterns |

---

## 🐛 **DEBUGGING TIPS:**

### Lege data maar je weet dat het er is?
```typescript
// Add debug logging:
console.log('User:', authResult.user?.email)
console.log('Query result:', { data, error, count })

// Check RLS policies:
SELECT * FROM pg_policies WHERE tablename = 'jouw_tabel';
```

### Test authentication:
```bash
# Check if server logs show correct user:
curl -H "Authorization: Bearer YOUR_TOKEN" \
     localhost:3000/api/your-endpoint
```

---

## 📊 **GEFIXTE ENDPOINTS (23 Sept 2025):**

**Eerste ronde fixes:**
1. ✅ `/api/companies/[companyId]/contacts`
2. ✅ `/api/companies/[companyId]/job-postings`
3. ✅ `/api/contacts` ← **Hoofdoorzaak lege contacten pagina**
4. ✅ `/api/otis/contacts`
5. ✅ `/api/settings/automation-preferences`

**Tweede ronde - Systematische cleanup (23 Sept 2025):**
6. ✅ `/api/contacts/qualification` ← **Status wijzigen functie**
7. ✅ `/api/contacts/status` ← **Contact status updates**
8. ✅ `/api/settings/automation-preferences` (PUT handler)
9. ✅ `/api/invite` ← **Admin-only user invitations**
10. ✅ `/api/accept-invite` ← **Service role client (geen auth needed)**
11. ✅ `/api/otis/contacts/add-to-campaign` ← **Campaign assignment**
12. ✅ `/api/geocoding/companies/batch` ← **Batch geocoding operations**

---

## 💡 **GOLDEN RULE:**

> **Als je `withAuth()` gebruikt, gebruik dan ALTIJD `authResult.supabase`**
> **Als je RLS-enabled tabellen gebruikt, gebruik dan ALTIJD authenticated clients**

---

*Voor vragen: check deze guide of vraag Claude Code om hulp*