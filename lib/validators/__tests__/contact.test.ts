import { 
  validateEmail, 
  validateDutchPhone, 
  formatDutchPhone,
  validateContactUpdate 
} from '../contact'

describe('Contact Validators', () => {
  
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@company.nl')).toBe(true)
      expect(validateEmail('user+tag@domain.co.uk')).toBe(true)
    })
    
    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('user @example.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })
  
  describe('validateDutchPhone', () => {
    it('should accept valid Dutch mobile numbers', () => {
      expect(validateDutchPhone('0612345678')).toBe(true)
      expect(validateDutchPhone('06-12345678')).toBe(true)
      expect(validateDutchPhone('06 12 34 56 78')).toBe(true)
      expect(validateDutchPhone('+31612345678')).toBe(true)
      expect(validateDutchPhone('+31 6 12345678')).toBe(true)
      expect(validateDutchPhone('0031612345678')).toBe(true)
    })
    
    it('should accept valid Dutch landline numbers', () => {
      expect(validateDutchPhone('0201234567')).toBe(true)
      expect(validateDutchPhone('020-1234567')).toBe(true)
      expect(validateDutchPhone('020 123 4567')).toBe(true)
      expect(validateDutchPhone('+31201234567')).toBe(true)
      expect(validateDutchPhone('0031201234567')).toBe(true)
    })
    
    it('should reject invalid phone numbers', () => {
      expect(validateDutchPhone('123')).toBe(false)
      expect(validateDutchPhone('061234567')).toBe(false) // Too short
      expect(validateDutchPhone('06123456789')).toBe(false) // Too long
      expect(validateDutchPhone('0012345678')).toBe(false) // Invalid prefix
      expect(validateDutchPhone('+32612345678')).toBe(false) // Wrong country
      expect(validateDutchPhone('')).toBe(false)
    })
  })
  
  describe('formatDutchPhone', () => {
    it('should format mobile numbers correctly', () => {
      expect(formatDutchPhone('0612345678')).toBe('06-12345678')
      expect(formatDutchPhone('+31612345678')).toBe('+31 6 12345678')
    })
    
    it('should format landline numbers correctly', () => {
      expect(formatDutchPhone('0201234567')).toBe('020-1234567')
      expect(formatDutchPhone('+31201234567')).toBe('+31 20 1234567')
    })
    
    it('should handle null and undefined', () => {
      expect(formatDutchPhone(null)).toBe('-')
      expect(formatDutchPhone(undefined)).toBe('-')
      expect(formatDutchPhone('')).toBe('-')
    })
    
    it('should return original for unrecognized formats', () => {
      expect(formatDutchPhone('123')).toBe('123')
      expect(formatDutchPhone('unknown')).toBe('unknown')
    })
  })
  
  describe('validateContactUpdate', () => {
    it('should validate valid contact data', () => {
      const result = validateContactUpdate({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '0612345678'
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject invalid email', () => {
      const result = validateContactUpdate({
        email: 'invalid-email'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid email format')
    })
    
    it('should reject invalid phone', () => {
      const result = validateContactUpdate({
        phone: '123'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid Dutch phone number format')
    })
    
    it('should reject empty required fields', () => {
      const result = validateContactUpdate({
        first_name: '',
        last_name: ''
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('First name cannot be empty')
      expect(result.errors).toContain('Last name cannot be empty')
    })
    
    it('should allow partial updates', () => {
      const result = validateContactUpdate({
        email: 'new@example.com'
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should handle undefined fields', () => {
      const result = validateContactUpdate({})
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})