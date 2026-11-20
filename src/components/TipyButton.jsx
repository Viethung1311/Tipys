import {
  ArrowLeft,
  Bell,
  ClipboardList,
  Gamepad2,
  Hourglass,
  Rocket,
  Send,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';
import '../styles/tipy-font.css';
import '../styles/tipy-tokens.css';
import '../styles/tipy-button.css';
const icons = {
  learn: Rocket,
  play: Gamepad2,
  assessment: ClipboardList,
  message: Send,
  notification: Bell,
  reward: Star,
  deduct: StarOff,
  back: ArrowLeft,
  danger: Trash2,
};

/** Native button semantics keep keyboard, form and disabled behavior consistent. */
export default function TipyButton({
  variant = 'learn',
  children,
  icon: ActionIcon,
  emphasis,
  size = 'regular',
  iconOnly = false,
  loading = false,
  loadingLabel = 'Đang mở…',
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const Icon = loading ? Hourglass : ActionIcon || icons[variant] || Rocket;
  const weight =
    emphasis || (['back', 'deduct', 'danger'].includes(variant) ? 'secondary' : 'primary');
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`tipy-button tipy-button--${variant} tipy-button--${weight} tipy-button--${size}${iconOnly ? ' tipy-button--icon-only' : ''} ${className}`.trim()}
    >
      <Icon className="tipy-button__icon" aria-hidden="true" focusable="false" strokeWidth={2} />
      <span className="tipy-button__label">{loading ? loadingLabel : children}</span>
    </button>
  );
}
