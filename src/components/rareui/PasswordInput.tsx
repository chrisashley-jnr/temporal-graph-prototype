import React, { useState, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  strength?: boolean;
  defaultVisible?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

interface StrengthScore {
  score: number; // 0 - 4
  label: string;
  color: string;
  bgClass: string;
  hint: string;
}

export function calculatePasswordStrength(pass: string): StrengthScore {
  if (!pass) {
    return { score: 0, label: '', color: '#71717a', bgClass: 'bg-zinc-500', hint: '' };
  }

  let points = 0;
  if (pass.length >= 8) points += 1;
  if (pass.length >= 12) points += 0.5;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) points += 1;
  if (/\d/.test(pass)) points += 1;
  if (/[^a-zA-Z0-9]/.test(pass)) points += 1;

  const score = Math.min(4, Math.floor(points));

  switch (score) {
    case 0:
    case 1:
      return {
        score: 1,
        label: 'Weak',
        color: '#ef4444',
        bgClass: 'bg-red-500',
        hint: 'Add uppercase, numbers, or symbols'
      };
    case 2:
      return {
        score: 2,
        label: 'Fair',
        color: '#f59e0b',
        bgClass: 'bg-amber-500',
        hint: 'Good start. Add 12+ characters or symbols'
      };
    case 3:
      return {
        score: 3,
        label: 'Good',
        color: '#3b82f6',
        bgClass: 'bg-blue-500',
        hint: 'Strong password. Mix in special characters'
      };
    case 4:
      return {
        score: 4,
        label: 'Strong',
        color: '#10b981',
        bgClass: 'bg-emerald-500',
        hint: 'Excellent password strength'
      };
    default:
      return { score: 0, label: '', color: '#71717a', bgClass: 'bg-zinc-500', hint: '' };
  }
}

/**
 * Rare UI Password Input Component
 * Inspired by rareui.com/components
 * Features animated eye toggle and dynamic 4-step strength meter bar
 */
export function PasswordInput({
  value: controlledValue,
  defaultValue = '',
  onChange,
  placeholder = 'Enter password',
  strength = true,
  defaultVisible = false,
  disabled = false,
  className = '',
  inputClassName = '',
  id,
  name = 'password',
  autoComplete = 'current-password',
  ...props
}: PasswordInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [visible, setVisible] = useState(defaultVisible);
  const [isFocused, setIsFocused] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  const strengthInfo = calculatePasswordStrength(currentValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isControlled) {
      setInternalValue(val);
    }
    onChange?.(val);
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    setVisible(prev => !prev);
  };

  return (
    <div className={`rare-password-wrapper ${className}`}>
      <div className={`rare-input-container ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          value={currentValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
          className={`rare-password-input ${inputClassName}`}
          {...props}
        />
        <motion.button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={-1}
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
          className="rare-password-toggle-btn"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {visible ? (
              <motion.span
                key="visible"
                initial={{ opacity: 0, rotate: -20, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 20, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="rare-toggle-icon"
              >
                <EyeOff size={16} />
              </motion.span>
            ) : (
              <motion.span
                key="hidden"
                initial={{ opacity: 0, rotate: 20, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: -20, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="rare-toggle-icon"
              >
                <Eye size={16} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Rare UI Animated 4-step strength meter */}
      {strength && (
        <AnimatePresence>
          {currentValue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="rare-strength-container"
            >
              <div className="rare-strength-bars">
                {[1, 2, 3, 4].map(step => {
                  const isActive = strengthInfo.score >= step;
                  return (
                    <div key={step} className="rare-strength-bar-track">
                      <motion.div
                        className="rare-strength-bar-fill"
                        initial={false}
                        animate={{
                          scaleX: isActive ? 1 : 0,
                          backgroundColor: isActive ? strengthInfo.color : 'transparent'
                        }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        style={{ originX: 0 }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="rare-strength-label-row">
                <span className="rare-strength-label" style={{ color: strengthInfo.color }}>
                  {strengthInfo.score === 4 ? (
                    <ShieldCheck size={12} className="inline-icon" />
                  ) : (
                    <AlertCircle size={12} className="inline-icon" />
                  )}
                  {strengthInfo.label}
                </span>
                <span className="rare-strength-hint">{strengthInfo.hint}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default PasswordInput;
