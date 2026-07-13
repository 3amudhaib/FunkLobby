import { useRef, useEffect, useCallback, useState } from 'react';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onKeyNav?: (direction: 'up' | 'down' | 'enter' | 'escape') => void;
  placeholder?: string;
  className?: string;
  loading?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({
  value, onChange, onFocus, onKeyNav,
  placeholder: placeholderProp, className = '',
  loading, autoFocus,
}: SearchBarProps) {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t('search.placeholder');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(v);
    }, 350);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); onKeyNav?.('down'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onKeyNav?.('up'); }
    else if (e.key === 'Enter') { e.preventDefault(); onKeyNav?.('enter'); }
    else if (e.key === 'Escape') { e.preventDefault(); onKeyNav?.('escape'); }
  }, [onKeyNav]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
      {loading && (
        <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-400 animate-spin" />
      )}
      {localValue && !loading && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-700 transition-colors"
          onClick={handleClear}
          tabIndex={-1}
        >
          <X className="w-3.5 h-3.5 text-surface-400" />
        </button>
      )}
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        className="input-glass pl-9 pr-9 text-sm w-full"
        spellCheck={false}
        autoCorrect="off"
        autoComplete="off"
      />
    </div>
  );
}
