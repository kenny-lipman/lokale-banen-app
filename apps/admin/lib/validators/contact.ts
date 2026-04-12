export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validateDutchPhone = (phone: string): boolean => {
  // Remove spaces, dashes and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Dutch phone patterns:
  // 06XXXXXXXX (mobile)
  // 0XXXXXXXXX (landline)
  // +316XXXXXXXX (international mobile)
  // +31XXXXXXXXX (international landline)
  // 00316XXXXXXXX (international format)
  
  const patterns = [
    /^06\d{8}$/,                    // Dutch mobile
    /^0[1-9]\d{8}$/,                // Dutch landline
    /^\+316\d{8}$/,                 // International Dutch mobile
    /^\+31[1-9]\d{8}$/,             // International Dutch landline
    /^00316\d{8}$/,                 // Alternative international mobile
    /^0031[1-9]\d{8}$/              // Alternative international landline
  ]
  
  return patterns.some(pattern => pattern.test(cleaned))
}

export const formatDutchPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-'
  
  // Remove all non-digits except +
  const cleaned = phone.replace(/[^\d\+]/g, '')
  
  // Format based on pattern
  if (cleaned.startsWith('+31')) {
    const number = cleaned.substring(3)
    if (number.startsWith('6') && number.length === 9) {
      // Mobile: +31 6 12345678
      return `+31 ${number.substring(0, 1)} ${number.substring(1, 5)}${number.substring(5)}`
    } else if (number.length === 9) {
      // Landline: +31 20 1234567
      return `+31 ${number.substring(0, 2)} ${number.substring(2, 5)}${number.substring(5)}`
    }
  } else if (cleaned.startsWith('06') && cleaned.length === 10) {
    // Mobile: 06-12345678
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 6)}${cleaned.substring(6)}`
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Landline: 020-1234567
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}${cleaned.substring(6)}`
  }
  
  // Return original if no pattern matches
  return phone
}

export const validateContactUpdate = (data: any): { 
  valid: boolean
  errors: string[] 
} => {
  const errors: string[] = []
  
  // Email validation (if provided)
  if (data.email && !validateEmail(data.email)) {
    errors.push('Invalid email format')
  }
  
  // Phone validation (if provided)
  if (data.phone && !validateDutchPhone(data.phone)) {
    errors.push('Invalid Dutch phone number format')
  }
  
  // Required fields check
  if (data.first_name !== undefined && data.first_name === '') {
    errors.push('First name cannot be empty')
  }
  
  if (data.last_name !== undefined && data.last_name === '') {
    errors.push('Last name cannot be empty')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}