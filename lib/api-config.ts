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
      apiKey: process.env.INSTANTLY_API_KEY || '',
      baseUrl: process.env.INSTANTLY_BASE_URL || 'https://api.instantly.ai'
    },
    webhooks: {
      dailyScrapeUrl: process.env.DAILY_SCRAPE_WEBHOOK_URL || '',
      apifySecret: process.env.APIFY_WEBHOOK_SECRET || '',
      n8nSecret: process.env.N8N_WEBHOOK_SECRET || ''
    },
    system: {
      cronSecret: process.env.CRON_SECRET_KEY || ''
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

export function getInstantlyConfigValidated() {
  const config = getInstantlyConfig()
  return {
    apiKey: validateRequiredEnvVar('INSTANTLY_API_KEY', config.apiKey),
    baseUrl: config.baseUrl
  }
}

export function getWebhookConfig() {
  return getApiConfigSingleton().webhooks
}

export function getWebhookConfigValidated() {
  const config = getWebhookConfig()
  return {
    dailyScrapeUrl: validateRequiredEnvVar('DAILY_SCRAPE_WEBHOOK_URL', config.dailyScrapeUrl),
    apifySecret: validateRequiredEnvVar('APIFY_WEBHOOK_SECRET', config.apifySecret),
    n8nSecret: validateRequiredEnvVar('N8N_WEBHOOK_SECRET', config.n8nSecret)
  }
}

export function getSystemConfig() {
  return getApiConfigSingleton().system
}

export function getSystemConfigValidated() {
  const config = getSystemConfig()
  return {
    cronSecret: validateRequiredEnvVar('CRON_SECRET_KEY', config.cronSecret)
  }
}

// Validation function for startup checks
export function validateApiConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Test each configuration separately
  try { getInstantlyConfigValidated() } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown Instantly API error')
  }

  try { getWebhookConfigValidated() } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown Webhook error')
  }

  try { getSystemConfigValidated() } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown System error')
  }

  return { valid: errors.length === 0, errors }
}