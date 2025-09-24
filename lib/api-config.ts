/**
 * Centralized API Configuration
 * All external API keys and configurations are managed here
 */

interface ApiConfig {
  instantly: {
    apiKey: string
    baseUrl: string
  }
  webhooks: {
    dailyScrapeUrl: string
    apifySecret: string
    n8nSecret: string
  }
  system: {
    cronSecret: string
  }
}

function validateRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${name} is not set or is empty`)
  }
  return value.trim()
}

function getApiConfig(): ApiConfig {
  return {
    instantly: {
      apiKey: validateRequiredEnvVar('INSTANTLY_API_KEY', process.env.INSTANTLY_API_KEY),
      baseUrl: process.env.INSTANTLY_BASE_URL || 'https://api.instantly.ai'
    },
    webhooks: {
      dailyScrapeUrl: validateRequiredEnvVar('DAILY_SCRAPE_WEBHOOK_URL', process.env.DAILY_SCRAPE_WEBHOOK_URL),
      apifySecret: validateRequiredEnvVar('APIFY_WEBHOOK_SECRET', process.env.APIFY_WEBHOOK_SECRET),
      n8nSecret: validateRequiredEnvVar('N8N_WEBHOOK_SECRET', process.env.N8N_WEBHOOK_SECRET)
    },
    system: {
      cronSecret: validateRequiredEnvVar('CRON_SECRET_KEY', process.env.CRON_SECRET_KEY)
    }
  }
}

// Singleton pattern for configuration
let apiConfigInstance: ApiConfig | null = null

export function getApiConfigSingleton(): ApiConfig {
  if (!apiConfigInstance) {
    apiConfigInstance = getApiConfig()
  }
  return apiConfigInstance
}

// Helper functions for specific APIs
export function getInstantlyConfig() {
  return getApiConfigSingleton().instantly
}

export function getWebhookConfig() {
  return getApiConfigSingleton().webhooks
}

export function getSystemConfig() {
  return getApiConfigSingleton().system
}

// Validation function for startup checks
export function validateApiConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    getApiConfigSingleton()
    return { valid: true, errors: [] }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown configuration error')
    return { valid: false, errors }
  }
}