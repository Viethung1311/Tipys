export const dateVN = (value) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';
export const duration = (value) => `${Math.floor(value / 60)} phút ${value % 60} giây`;
