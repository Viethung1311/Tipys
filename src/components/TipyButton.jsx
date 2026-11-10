import { Gamepad2, Hourglass, Rocket } from 'lucide-react';
import '../styles/tipy-font.css';
import '../styles/tipy-tokens.css';
import '../styles/tipy-button.css';

/** Native button semantics keep keyboard, form and disabled behavior consistent. */
export default function TipyButton({
  variant = 'learn',
  children,
  icon: ActionIcon,
  emphasis = 'primary',
  loading = false,
  loadingLabel = 'Đang mở…',
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const Icon = loading ? Hourglass : ActionIcon || (variant === 'play' ? Gamepad2 : Rocket);
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`tipy-button tipy-button--${variant} tipy-button--${emphasis} ${className}`.trim()}
    >
      <Icon className="tipy-button__icon" aria-hidden="true" focusable="false" strokeWidth={2.4} />
      <span className="tipy-button__label">{loading ? loadingLabel : children}</span>
    </button>
  );
}
