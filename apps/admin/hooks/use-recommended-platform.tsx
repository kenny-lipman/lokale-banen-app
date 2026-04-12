import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '@/lib/authenticated-fetch';

export interface RecommendedPlatform {
  id: string;
  regio_platform: string;
  central_place: string;
  central_postcode?: string;
  distance_km?: number;
  match_method: 'geocoding' | 'postcode_fallback' | 'extracted_postcode';
}

export interface PlatformRecommendationResult {
  recommended_platform: RecommendedPlatform | null;
  company_location: {
    raw_address: string;
    latitude?: number;
    longitude?: number;
    postal_code?: string;
  };
  fallback_used?: boolean;
}

export interface Contact {
  id: string;
  company_id: string;
  // ... other contact fields
}

export function useRecommendedPlatform(selectedContacts: Contact[]) {
  const [recommendations, setRecommendations] = useState<Map<string, PlatformRecommendationResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = useCallback(async (companyId: string): Promise<PlatformRecommendationResult | null> => {
    try {
      const response = await authFetch(`/api/companies/${companyId}/recommended-platform`);
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendation: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('Error fetching platform recommendation:', err);
      return null;
    }
  }, []);

  const getRecommendationsForContacts = useCallback(async (contacts: Contact[]) => {
    if (contacts.length === 0) {
      setRecommendations(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get unique company IDs
      const uniqueCompanyIds = [...new Set(contacts.map(c => c.company_id))];
      
      // Fetch recommendations for each company
      const promises = uniqueCompanyIds.map(async (companyId) => {
        const recommendation = await fetchRecommendation(companyId);
        return { companyId, recommendation };
      });

      const results = await Promise.all(promises);
      
      // Build recommendations map
      const newRecommendations = new Map<string, PlatformRecommendationResult>();
      results.forEach(({ companyId, recommendation }) => {
        if (recommendation) {
          newRecommendations.set(companyId, recommendation);
        }
      });

      setRecommendations(newRecommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [fetchRecommendation]);

  // Use JSON.stringify for deep comparison to avoid infinite loops with array references
  const contactsKey = JSON.stringify(selectedContacts.map(c => c.id).sort());
  
  useEffect(() => {
    getRecommendationsForContacts(selectedContacts);
  }, [contactsKey, getRecommendationsForContacts]);

  // Calculate aggregated platform recommendation (memoized)
  const aggregatedRecommendation = useMemo(() => {
    if (recommendations.size === 0) {
      return null;
    }

    // Count platforms by regio_platform (counting contacts, not companies)
    const platformCounts = new Map<string, { 
      count: number; 
      platform: RecommendedPlatform; 
      matchMethod: string;
      companies: string[];
    }>();

    // Count contacts per platform instead of companies
    selectedContacts.forEach(contact => {
      const rec = recommendations.get(contact.company_id);
      if (rec?.recommended_platform) {
        const key = rec.recommended_platform.regio_platform;
        if (platformCounts.has(key)) {
          const existing = platformCounts.get(key)!;
          existing.count++; // Count contacts, not companies
          if (!existing.companies.includes(contact.company_id)) {
            existing.companies.push(contact.company_id);
          }
        } else {
          platformCounts.set(key, {
            count: 1, // Start with 1 contact
            platform: rec.recommended_platform,
            matchMethod: rec.recommended_platform.match_method,
            companies: [contact.company_id]
          });
        }
      }
    });

    if (platformCounts.size === 0) {
      return null;
    }

    // Find the platform with the highest count
    const topPlatform = Array.from(platformCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)[0];

    const [platformName, data] = topPlatform;
    const totalContacts = selectedContacts.length;
    const matchingContactsCount = data.count;
    const confidence = Math.round((matchingContactsCount / totalContacts) * 100);

    return {
      platform: platformName,
      confidence,
      contacts: matchingContactsCount,
      platformData: data.platform,
      matchMethod: data.matchMethod,
      companies: data.companies
    };
  }, [recommendations, selectedContacts.length]);

  return {
    recommendations,
    aggregatedRecommendation,
    loading,
    error,
    refetch: () => getRecommendationsForContacts(selectedContacts)
  };
}