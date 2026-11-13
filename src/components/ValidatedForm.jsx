import { useRef } from 'react';

function fieldError(field, form) {
  if (field.disabled || !field.willValidate) return '';
  field.setCustomValidity('');
  if (field.dataset.requiredText !== undefined && !field.value.trim())
    return 'Bạn nhập nội dung, không chỉ dấu cách nhé.';
  if (field.dataset.confirm !== undefined && field.value !== field.dataset.confirm)
    return `Nhập chính xác ${field.dataset.confirm} để xác nhận.`;
  if (field.dataset.after) {
    const start = form.elements.namedItem(field.dataset.after)?.value;
    if (start && field.value && Date.parse(field.value) <= Date.parse(start))
      return 'Giờ kết thúc phải sau giờ mở.';
  }
  if (field.dataset.atMost) {
    const upper = form.elements.namedItem(field.dataset.atMost)?.value;
    if (upper && Number(field.value) > Number(upper))
      return 'Mức nhanh nhất không được lớn hơn mức ban đầu.';
  }
  if (field.type === 'url' && field.value) {
    try {
      const url = new URL(field.value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
        return 'Chỉ dùng link http hoặc https, không chứa thông tin đăng nhập.';
    } catch {
      return 'Link chưa hợp lệ.';
    }
  }
  if (
    field.dataset.byteLimit &&
    new TextEncoder().encode(field.value).length > Number(field.dataset.byteLimit)
  )
    return 'Nội dung nhập quá dài.';
  if (field.type === 'file' && field.dataset.extensions) {
    const files = [...field.files];
    if (files.length > 3) return 'Mỗi bài tối đa 3 file.';
    if (
      files.some(
        (file) =>
          !field.dataset.extensions.split(',').includes(file.name.split('.').pop().toLowerCase()) ||
          file.size < 1 ||
          file.size > 5242880,
      )
    )
      return 'Chọn file hợp lệ tối đa 5 MB.';
  }
  if (field.validity.valueMissing) return 'Bạn điền mục này nhé.';
  if (field.validity.patternMismatch)
    return field.dataset.formatMessage || 'Nội dung chưa đúng định dạng.';
  if (field.validity.typeMismatch) return 'Bạn nhập đúng định dạng nhé.';
  if (field.validity.badInput || field.validity.stepMismatch)
    return 'Bạn nhập số nguyên hợp lệ nhé.';
  if (field.validity.rangeUnderflow || field.validity.rangeOverflow)
    return `Nhập số từ ${field.min} đến ${field.max || 'giới hạn cho phép'}.`;
  if (field.validity.tooLong) return `Tối đa ${field.maxLength} ký tự.`;
  return '';
}

// Keep inline messages beside existing controls without rebuilding each form's layout.
export function validateForm(form, focus = true) {
  let first;
  for (const field of Array.from(form.elements)) {
    if (!field.willValidate) continue;
    const message = fieldError(field, form);
    field.setCustomValidity(message);
    let note = field.nextElementSibling;
    if (!note?.hasAttribute('data-field-error')) {
      if (!field.hasAttribute('aria-label') && field.labels?.length)
        field.setAttribute(
          'aria-label',
          field.labels[0].textContent.replace(field.textContent, '').trim(),
        );
      note = form.ownerDocument.createElement('span');
      note.setAttribute('data-field-error', '');
      note.className = 'account-error';
      note.id = `field-error-${crypto.randomUUID()}`;
      note.setAttribute('role', 'alert');
      field.insertAdjacentElement('afterend', note);
    }
    note.textContent = message;
    note.hidden = !message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (message) {
      field.setAttribute('aria-errormessage', note.id);
      first ||= field;
    } else field.removeAttribute('aria-errormessage');
  }
  if (focus) first?.focus();
  return !first;
}

export default function ValidatedForm({ onSubmit, onInput, children, ...props }) {
  const attempted = useRef(false);
  return (
    <form
      {...props}
      noValidate
      onInput={(event) => {
        onInput?.(event);
        if (event.target.willValidate && fieldError(event.target, event.currentTarget))
          attempted.current = true;
        if (attempted.current) validateForm(event.currentTarget, false);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        attempted.current = true;
        if (validateForm(event.currentTarget)) return onSubmit?.(event);
      }}
    >
      {children}
    </form>
  );
}
