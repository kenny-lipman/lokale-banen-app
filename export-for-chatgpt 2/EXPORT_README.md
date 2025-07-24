# Lokale-Banen Project Export

## Project Overview
**Name**: LokaleBanen Dashboard  
**Description**: Internal dashboard for LokaleBanen AI agents for job vacancy scraping and management  
**Tech Stack**: Next.js 14, TypeScript, Tailwind CSS, Supabase, Instantly API integration  
**Purpose**: Manage job postings, companies, contacts, and email campaigns through AI agents

## Architecture Summary

### Frontend (Next.js 14 App Router)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + shadcn/ui components
- **Authentication**: Supabase Auth with role-based access (admin/member)
- **State Management**: React hooks + custom caching hooks
- **Key Features**: 
  - Job posting management and scraping via "Otis Agent"
  - Company management with status tracking
  - Contact management with campaign integration
  - Instant email campaign management via Instantly API

### Backend
- **Database**: Supabase (PostgreSQL)
- **API Routes**: Next.js API routes (`/api/*`)
- **External APIs**: Instantly.ai for email campaigns
- **Authentication**: Supabase Auth with profiles table

### Database Schema (Key Tables)
- `companies` - Company information with status tracking
- `contacts` - Contact information linked to companies
- `job_postings` - Scraped job postings
- `job_sources` - Sources for job scraping
- `apify_runs` - Tracking for Otis agent scraping runs
- `profiles` - User profiles with roles
- `invitations` - Team invitation system
- `regions` - Geographic regions for filtering

## Key Features Implemented

### 1. Otis Agent (Job Scraping)
- **Location**: `/agents/otis/enhanced`
- **Purpose**: Scrape job postings from Indeed via webhook
- **Features**: Configure location, job function, platform selection
- **Integration**: Apify webhook integration for automated scraping

### 2. Company Management
- **Location**: `/companies` (alias: `/bedrijven`)
- **Features**: 
  - Company listing with filtering (region, size, status, source)
  - Bulk status updates
  - Company details drawer with job history
  - Statistics dashboard

### 3. Contact Management  
- **Location**: `/contacten`
- **Features**:
  - Contact listing with advanced filtering
  - Email campaign integration via Instantly API
  - Bulk add contacts to campaigns
  - Loading states and error handling

### 4. Dashboard
- **Location**: `/dashboard`
- **Features**: 
  - Overview statistics
  - Recent Otis runs
  - Platform distribution charts
  - Connection testing

### 5. Authentication & Team Management
- **Features**:
  - Role-based access (admin/member)
  - Team invitation system via `/invite`
  - Password reset functionality
  - Protected routes

## Current Technical Issues Fixed
1. **Email Validation**: Fixed "Email is required" error in Instantly API integration
2. **Duplicate Contacts**: Prevented duplicate contact processing in campaigns  
3. **List Access**: Updated to correct Instantly list ID for campaign access
4. **Loading States**: Added comprehensive loading states for campaign operations

## Key Components

### UI Components (`/components`)
- `app-sidebar.tsx` - Main navigation sidebar
- `companies-table.tsx` - Company data table with filtering
- `job-postings-table.tsx` - Job postings display
- `apify-runs-table.tsx` - Otis scraping run history
- `instantly-leads-table.tsx` - Instantly campaign leads
- `company-drawer.tsx` - Company detail panel
- `auth-provider.tsx` - Authentication context

### Hooks (`/hooks`)
- `use-companies-cache.tsx` - Company data caching
- `use-contacts-cache.tsx` - Contact data caching  
- `use-dashboard-cache.tsx` - Dashboard statistics
- `use-job-postings-cache.tsx` - Job posting data

### API Routes (`/app/api`)
- `/contacts` - Contact management and Instantly integration
- `/companies` - Company status updates
- `/instantly-campaigns` - Instantly campaign listing
- `/instantly-leads` - Instantly leads management
- `/invite` - Team invitation system
- `/accept-invite` - Invitation acceptance

## Recent Major Changes
1. **Instantly API Integration**: Full integration with lead creation and campaign management
2. **Email Validation**: Comprehensive email validation before API calls
3. **Error Handling**: Detailed error messages and user feedback
4. **Loading States**: Professional loading indicators during operations
5. **Duplicate Prevention**: Deduplication logic for contact processing

## Development Notes
- Uses TypeScript throughout for type safety
- Supabase service layer (`lib/supabase-service.ts`) for database operations
- Rate limiting implemented for sensitive operations
- Comprehensive error handling and user feedback
- Mobile-responsive design with Tailwind CSS

## Environment Requirements
- Node.js project with Next.js 14
- Supabase project for database and authentication
- Instantly.ai API access for email campaigns
- Apify webhook integration for job scraping

## File Structure Summary
```
app/
  ├── (auth pages) login, register, forgot-password, etc.
  ├── agents/otis/ - Job scraping agent interface
  ├── companies/ - Company management
  ├── contacten/ - Contact management  
  ├── dashboard/ - Main dashboard
  ├── api/ - API routes
  └── layout.tsx - Root layout with auth

components/
  ├── ui/ - shadcn/ui components
  ├── (data tables) - Various data display components
  ├── auth-provider.tsx - Authentication
  └── (drawers/modals) - UI overlays

lib/
  ├── supabase.ts - Supabase client config
  ├── supabase-service.ts - Database service layer
  └── utils.ts - Utility functions

hooks/ - Custom React hooks for data fetching
```

This project represents a full-stack dashboard for managing AI-driven job scraping and email campaign operations. 