/**
 * TIME FORMATTING UTILITIES
 * 
 * Handles timezone conversion between browser local time and UTC
 * All times stored in database are UTC
 */

/**
 * Convert local time to UTC time string
 */
export function convertToUTC(hour, minute) {
  const local = new Date();
  local.setHours(hour, minute, 0, 0);
  
  const utcHour = local.getUTCHours();
  const utcMinute = local.getUTCMinutes();
  
  return `${String(utcHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')}`;
}

/**
 * Convert UTC time string to local time
 */
export function convertFromUTC(utcTimeString) {
  if (!utcTimeString || !utcTimeString.includes(':')) {
    return { hour: 9, minute: 0 };
  }
  
  const [hour, minute] = utcTimeString.split(':').map(Number);
  const utc = new Date();
  utc.setUTCHours(hour, minute, 0, 0);
  
  return {
    hour: utc.getHours(),
    minute: utc.getMinutes()
  };
}

/**
 * Format time in 12-hour format with AM/PM
 */
export function formatTime12Hour(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  const displayMinute = String(minute).padStart(2, '0');
  
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Format UTC time string for display
 */
export function formatTimeDisplay(utcTimeString) {
  const { hour, minute } = convertFromUTC(utcTimeString);
  return formatTime12Hour(hour, minute);
}

/**
 * Format DateTime for display in user's timezone
 */
export function formatDateTime(dateTime) {
  if (!dateTime) return '';
  
  const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  if (!date || Number.isNaN(date.getTime())) return '';
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default {
  convertToUTC,
  convertFromUTC,
  formatTime12Hour,
  formatTimeDisplay,
  formatDateTime
};
