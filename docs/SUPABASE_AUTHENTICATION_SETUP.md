# Supabase Authentication Setup Guide

## Overview

This document outlines the complete Supabase authentication setup for the Lokale-Banen application, ensuring secure and coherent authentication across the entire application.

## Architecture

### 1. Centralized Supabase Client (`lib/supabase.ts`)
- **Purpose**: Single source of truth for Supabase client creation
- **Features**: 
  - Environment variable validation
  - Proper auth configuration
  - Error handling for missing credentials

### 2. Supabase Service (`lib/supabase-service.ts`)
- **Purpose**: Centralized service wrapper for all Supabase operations
- **Features**:
  - Lazy client initialization
  - Consistent error handling
  - Service-specific methods

### 3. Authentication Provider (`components/auth-provider.tsx`)
- **Purpose**: React context for authentication state management
- **Features**:
  - Real-time auth state updates
  - Session management
  - Profile data handling
  - Automatic token refresh

## Environment Configuration

### Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wnfhwhvrknvmidmzeclh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZmh3aHZya252bWlkbXplY2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDQ0ODksImV4cCI6MjA2NzAyMDQ4OX0.VEakzHJh2OoXMEDAmz_mLS4J5rNWKHTBNRnI4jrsigs

# Apollo Enrichment Configuration (Optional)
APOLLO_WEBHOOK_URL=https://your-apollo-webhook-url.com/webhook

# Application Configuration
NODE_ENV=development
```

### Security Notes

1. **Anon Key Safety**: The anon key is safe to expose in client-side code as it only has permissions defined by Row Level Security (RLS) policies
2. **Environment Files**: `.env.local` is gitignored and should never be committed to version control
3. **Production**: Use environment variables in your deployment platform (Vercel, etc.)

## Implementation Details

### 1. Client-Side Usage

```typescript
// In React components
import { useAuth } from '@/components/auth-provider'

function MyComponent() {
  const { user, isAuthenticated, loading } = useAuth()
  
  if (loading) return <div>Loading...</div>
  if (!isAuthenticated) return <div>Please log in</div>
  
  return <div>Welcome, {user?.email}</div>
}
```

### 2. Server-Side Usage (API Routes)

```typescript
// In API routes
import { supabaseService } from '@/lib/supabase-service'

export async function GET(req: Request) {
  try {
    const { data, error } = await supabaseService.client
      .from('your_table')
      .select('*')
    
    if (error) throw error
    
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
```

### 3. Direct Client Usage

```typescript
// For direct Supabase operations
import { createClient } from '@/lib/supabase'

const supabase = createClient()
const { data, error } = await supabase.from('table').select('*')
```

## Authentication Flow

### 1. Initial Load
1. AuthProvider initializes
2. Gets current session from Supabase
3. Fetches user profile if authenticated
4. Sets up auth state listener

### 2. Sign In
1. User submits credentials
2. Supabase authenticates user
3. Auth state listener triggers
4. Profile data is fetched
5. UI updates to reflect authenticated state

### 3. Sign Out
1. User clicks logout
2. Local state is cleared immediately
3. Supabase session is terminated
4. Auth state listener triggers
5. UI updates to reflect unauthenticated state

### 4. Token Refresh
1. Supabase automatically refreshes tokens
2. Auth state listener detects refresh
3. Session is updated
4. User remains authenticated seamlessly

## Row Level Security (RLS) Policies

### Important Notes

1. **Client-Side Security**: RLS policies are enforced on the database level
2. **Policy Requirements**: All tables should have appropriate RLS policies
3. **Testing**: Always test with authenticated and unauthenticated users

### Example RLS Policy

```sql
-- Example: Users can only see their own data
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
```

## Error Handling

### Common Authentication Errors

1. **Missing Environment Variables**
   ```typescript
   // Error: Missing Supabase environment variables
   // Solution: Check .env.local file
   ```

2. **Authentication Failed**
   ```typescript
   // Error: Invalid login credentials
   // Solution: Verify user credentials
   ```

3. **Session Expired**
   ```typescript
   // Error: JWT expired
   // Solution: Automatic token refresh should handle this
   ```

### Error Handling Best Practices

1. **Graceful Degradation**: Always handle auth errors gracefully
2. **User Feedback**: Provide clear error messages to users
3. **Logging**: Log authentication errors for debugging
4. **Fallbacks**: Provide fallback UI for unauthenticated states

## Testing Authentication

### 1. Manual Testing

1. **Login Flow**:
   - Navigate to `/login`
   - Enter valid credentials
   - Verify redirect to dashboard
   - Check auth state in React DevTools

2. **Logout Flow**:
   - Click logout button
   - Verify redirect to login
   - Check auth state is cleared

3. **Protected Routes**:
   - Try accessing protected routes without auth
   - Verify redirect to login
   - Test with valid auth

### 2. API Testing

```bash
# Test authentication endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Check `.env.local` file exists
   - Verify variable names are correct
   - Restart development server

2. **Authentication not persisting**
   - Check browser storage settings
   - Verify auth configuration in Supabase client
   - Check for JavaScript errors

3. **API routes failing**
   - Ensure using `supabaseService.client` in API routes
   - Check RLS policies
   - Verify environment variables in production

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   # In development
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   ```

2. **Check Auth State**:
   ```typescript
   // In React DevTools
   const { user, session, isAuthenticated } = useAuth()
   console.log({ user, session, isAuthenticated })
   ```

3. **Check Network Requests**:
   - Open browser DevTools
   - Check Network tab for Supabase requests
   - Verify authentication headers

## Security Best Practices

1. **Never expose service role keys** in client-side code
2. **Use RLS policies** for all database operations
3. **Validate user input** on both client and server
4. **Implement proper error handling** without exposing sensitive information
5. **Use HTTPS** in production
6. **Regular security audits** of authentication flow

## Migration Guide

### From Hardcoded Credentials

If you have hardcoded Supabase credentials in your code:

1. **Remove hardcoded values** from all files
2. **Add environment variables** to `.env.local`
3. **Update API routes** to use `supabaseService.client`
4. **Test all authentication flows**
5. **Deploy with proper environment variables**

### Example Migration

```typescript
// Before (Insecure)
const supabase = createClient(
  'https://wnfhwhvrknvmidmzeclh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
)

// After (Secure)
import { supabaseService } from '@/lib/supabase-service'
const { data, error } = await supabaseService.client.from('table').select('*')
```

## Conclusion

This authentication setup provides:

- ✅ **Secure credential management**
- ✅ **Consistent authentication across the app**
- ✅ **Real-time auth state updates**
- ✅ **Proper error handling**
- ✅ **Type-safe authentication**
- ✅ **Automatic token refresh**

The setup ensures that authentication works coherently across all parts of the application while maintaining security best practices. 