import { useState, useCallback, useEffect } from 'react'
import { validateInput, type ValidationRule, type ValidationResult, getValidationColorClass, getValidationIcon } from '../utils/inputValidation'

interface UseValidationProps {
  rule: ValidationRule
  delay?: number
  onValidate?: (result: ValidationResult) => void
}

export function useValidation({ rule, delay = 300, onValidate }: UseValidationProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true })
  const [isValidating, setIsValidating] = useState(false)

  const validate = useCallback((value: string) => {
    setIsValidating(true)
    const result = validateInput(value, rule)
    setValidationResult(result)
    setIsValidating(false)
    onValidate?.(result)
    return result
  }, [rule, onValidate])

  const debouncedValidate = useCallback((value: string) => {
    const timeoutId = setTimeout(() => {
      validate(value)
    }, delay)
    return () => clearTimeout(timeoutId)
  }, [validate, delay])

  return {
    validationResult,
    isValidating,
    validate,
    debouncedValidate,
    colorClass: getValidationColorClass(validationResult.isValid),
    icon: getValidationIcon(validationResult.isValid),
    error: validationResult.error
  }
}

interface ValidatedInputProps {
  value: string
  onChange: (value: string) => void
  rule: ValidationRule
  placeholder?: string
  className?: string
  type?: string
  showIcon?: boolean
  showError?: boolean
  delay?: number
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search"
  onFocus?: () => void
  onBlur?: () => void
  maxLength?: number
}

export function ValidatedInput({ 
  value, 
  onChange, 
  rule, 
  placeholder, 
  className = '',
  showIcon = true,
  showError = true,
  delay = 300,
  type = 'text',
  maxLength,
  inputMode,
  onFocus,
  onBlur
}: ValidatedInputProps) {
  const { validationResult, debouncedValidate, colorClass, icon, error } = useValidation({ 
    rule, 
    delay,
    onValidate: (result) => {
      if (!result.isValid && result.error) {
        // Auto-sanitize on validation failure
        const sanitized = value.replace(/[^A-Za-zÁáÉéÍíÓóÚúÑñÜü0-9\s%\/\-°@#$*+,.;:?¿¡!()]/g, '')
        if (sanitized !== value) {
          onChange(sanitized)
        }
      }
    }
  })

  const [inputValue, setInputValue] = useState(value)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    if (isDirty) {
      const cleanup = debouncedValidate(inputValue)
      return cleanup
    }
  }, [inputValue, isDirty, debouncedValidate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value
    if (maxLength && newValue.length > maxLength) return
    
    setInputValue(newValue)
    setIsDirty(true)
    onChange(newValue)
  }

  const showValidation = isDirty && !validationResult.isValid

  return (
    <div className="relative">
      <div className="relative">
        <input
          type={type}
          inputMode={inputMode}
          value={inputValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`${className} ${colorClass} ${showIcon ? 'pr-10' : ''}`}
          aria-invalid={!validationResult.isValid}
          aria-describedby={showError && showValidation ? `${placeholder}-error` : undefined}
        />
        {showIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className={`text-sm ${validationResult.isValid ? 'text-green-500' : 'text-red-500'}`}>
              {icon}
            </span>
          </div>
        )}
      </div>
      {showError && showValidation && error && (
        <p id={`${placeholder}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function ValidatedTextArea({ 
  value, 
  onChange, 
  rule, 
  placeholder, 
  className = '',
  showIcon = true,
  showError = true,
  delay = 500,
  rows = 3,
  maxLength
}: Omit<ValidatedInputProps, 'type'> & { rows?: number, maxLength?: number }) {
  const { validationResult, debouncedValidate, colorClass, icon, error } = useValidation({ rule, delay })

  const [inputValue, setInputValue] = useState(value)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    if (isDirty) {
      const cleanup = debouncedValidate(inputValue)
      return cleanup
    }
  }, [inputValue, isDirty, debouncedValidate])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    if (maxLength && newValue.length > maxLength) return
    
    setInputValue(newValue)
    setIsDirty(true)
    onChange(newValue)
  }

  const showValidation = isDirty && !validationResult.isValid
  const characterCount = inputValue.length

  return (
    <div className="relative">
      <div className="relative">
        <textarea
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          className={`${className} ${colorClass} ${showIcon ? 'pr-10' : ''}`}
          aria-invalid={!validationResult.isValid}
          aria-describedby={showError && showValidation ? `${placeholder}-error` : undefined}
          maxLength={maxLength}
        />
        {showIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className={`text-sm ${validationResult.isValid ? 'text-green-500' : 'text-red-500'}`}>
              {icon}
            </span>
          </div>
        )}
      </div>
      {maxLength && (
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          {showError && showValidation && error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            <span />
          )}
          <span>{characterCount}/{maxLength}</span>
        </div>
      )}
      {(!maxLength || !showValidation) && showError && showValidation && error && (
        <p id={`${placeholder}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}