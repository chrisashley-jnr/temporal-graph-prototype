import React, { useRef, useState, useEffect } from 'react';
import { motion, type Variants } from 'motion/react';

export type OtpStatus = 'idle' | 'success' | 'error';

export interface OtpInputProps {
  length?: number;
  size?: 'sm' | 'md' | 'lg';
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onComplete?: (code: string) => void;
  type?: 'numbers' | 'letters' | 'both';
  status?: OtpStatus;
  mask?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Rare UI OTP Input Component
 * Inspired by rareui.com/components
 * Features animated gliding caret ring, popping character animations, and error shake.
 */
export function OtpInput({
  length = 6,
  size = 'md',
  value: controlledValue,
  defaultValue = '',
  onChange,
  onComplete,
  type = 'numbers',
  status = 'idle',
  mask = false,
  disabled = false,
  autoFocus = true,
  className = ''
}: OtpInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isControlled = controlledValue !== undefined;
  const rawCode = isControlled ? controlledValue : internalValue;
  const digits = Array.from({ length }, (_, i) => rawCode[i] || '');

  // Keep inputRefs array length matching `length`
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const isValidChar = (char: string) => {
    if (type === 'numbers') return /^[0-9]$/.test(char);
    if (type === 'letters') return /^[a-zA-Z]$/.test(char);
    return /^[a-zA-Z0-9]$/.test(char);
  };

  const updateCode = (newCode: string) => {
    const trimmed = newCode.slice(0, length);
    if (!isControlled) {
      setInternalValue(trimmed);
    }
    onChange?.(trimmed);

    if (trimmed.length === length) {
      onComplete?.(trimmed);
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (disabled) return;

    // Handle single character typed or replace
    const lastChar = inputValue.slice(-1);
    if (!lastChar || !isValidChar(lastChar)) {
      if (inputValue === '') {
        // Clear slot
        const newCode = rawCode.slice(0, index) + ' ' + rawCode.slice(index + 1);
        updateCode(newCode.trimEnd());
      }
      return;
    }

    const codeArray = rawCode.split('');
    while (codeArray.length < length) codeArray.push('');
    codeArray[index] = lastChar;
    const newCode = codeArray.join('').trimEnd();

    updateCode(newCode);

    // Advance focus
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Empty slot backspace -> move back and clear previous
        e.preventDefault();
        const codeArray = rawCode.split('');
        codeArray[index - 1] = '';
        updateCode(codeArray.join('').trimEnd());
        inputRefs.current[index - 1]?.focus();
        setFocusedIndex(index - 1);
      } else if (digits[index]) {
        // Clear current
        e.preventDefault();
        const codeArray = rawCode.split('');
        codeArray[index] = '';
        updateCode(codeArray.join('').trimEnd());
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    const pasted = e.clipboardData.getData('text/plain').trim();
    const filtered = pasted.split('').filter(isValidChar).slice(0, length).join('');

    if (filtered) {
      updateCode(filtered);
      const nextIndex = Math.min(filtered.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      setFocusedIndex(nextIndex);
    }
  };

  // Shake animation variant for error
  const containerVariants: Variants = {
    idle: { x: 0 },
    success: { scale: [1, 1.02, 1], transition: { duration: 0.3 } },
    error: {
      x: [-6, 6, -4, 4, -2, 2, 0],
      transition: { duration: 0.35, ease: 'easeInOut' }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      animate={status}
      className={`rare-otp-container rare-otp-${size} ${status} ${className}`}
    >
      <div className="rare-otp-slots">
        {digits.map((digit, i) => {
          const isFocused = focusedIndex === i;
          const isFilled = Boolean(digit);

          return (
            <div
              key={i}
              className={`rare-otp-slot ${isFocused ? 'active' : ''} ${isFilled ? 'filled' : ''} ${status}`}
              onClick={() => {
                if (!disabled) {
                  inputRefs.current[i]?.focus();
                  setFocusedIndex(i);
                }
              }}
            >
              <input
                ref={el => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode={type === 'numbers' ? 'numeric' : 'text'}
                pattern={type === 'numbers' ? '[0-9]*' : undefined}
                maxLength={2}
                value={digit}
                onChange={e => handleChange(i, e)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(null)}
                disabled={disabled}
                className="rare-otp-native-input"
                aria-label={`Digit ${i + 1} of ${length}`}
              />

              {/* Character pop animation */}
              <motion.span
                key={digit ? `${digit}-${i}` : `empty-${i}`}
                initial={{ scale: 0.6, opacity: 0, y: 4 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                className="rare-otp-char"
              >
                {mask && digit ? '•' : digit}
              </motion.span>

              {/* Gliding caret ring indicator (Rare UI signature) */}
              {isFocused && (
                <motion.div
                  layoutId="rare-otp-caret"
                  className="rare-otp-caret-ring"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default OtpInput;
