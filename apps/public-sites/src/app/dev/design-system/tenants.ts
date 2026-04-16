/**
 * Mock tenant theme definitions for the design-system playground.
 *
 * Mirrors real live platform rows for visual QA across the color extremes:
 *   AchterhoekseBanen (green/darkgreen), UtrechtseBanen (red/black),
 *   AssenseBanen (navy/azure), WestlandseBanen (green/purple),
 *   HelmondseBanen (khaki/red), ZeeuwseBanen (slate/red),
 *   AalsmeerseBanen (purple/green).
 *
 * Values are copied from platforms table (Supabase) as of 2026-04-15.
 */

export interface MockTenant {
  id: string
  name: string
  centralPlace: string
  primary: string
  secondary: string | null
  tertiary: string | null
  logoUrl: string | null
}

export const MOCK_TENANTS: MockTenant[] = [
  {
    id: 'achterhoeksebanen',
    name: 'AchterhoekseBanen',
    centralPlace: 'Doetinchem',
    primary: '#7BC142',
    secondary: '#0A6333',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/6c3e7456-bf45-4b3b-a061-513f1b4354c7/logo.svg',
  },
  {
    id: 'utrechtsebanen',
    name: 'UtrechtseBanen',
    centralPlace: 'Utrecht',
    primary: '#CC0000',
    secondary: '#000000',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/1ddeeaa2-5f73-4862-8c81-d10e92126c4a/logo.svg',
  },
  {
    id: 'assensebanen',
    name: 'AssenseBanen',
    centralPlace: 'Assen',
    primary: '#1F3D75',
    secondary: '#1D9ED9',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/cba3bd0e-ee5c-45dc-889b-0df2f36c9bcd/logo.svg',
  },
  {
    id: 'westlandsebanen',
    name: 'WestlandseBanen',
    centralPlace: 'Naaldwijk',
    primary: '#77C14D',
    secondary: '#221D54',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/6c6f5971-065d-4c3d-844a-787d437a32c1/logo.svg',
  },
  {
    id: 'helmondsebanen',
    name: 'HelmondseBanen',
    centralPlace: 'Helmond',
    primary: '#60594A',
    secondary: '#CB2026',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/45408cf3-d382-4b30-b591-6a93e162f96f/logo.svg',
  },
  {
    id: 'zeeuwsebanen',
    name: 'ZeeuwseBanen',
    centralPlace: 'Middelburg',
    primary: '#3D4853',
    secondary: '#9D1C20',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/d77d9647-efcd-46b6-96b3-3a841eae2696/logo.svg',
  },
  {
    id: 'aalsmeersebanen',
    name: 'AalsmeerseBanen',
    centralPlace: 'Aalsmeer',
    primary: '#ACD48C',
    secondary: '#671449',
    tertiary: null,
    logoUrl:
      'https://wnfhwhvrknvmidmzeclh.supabase.co/storage/v1/object/public/platform-assets/fefccc96-4296-4370-a715-ca2cb10c1aa9/logo.svg',
  },
]
