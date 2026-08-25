export const PHOTO_TIME_ZONE = "UTC";

export type PhotoDateValue = Date | string | null | undefined;

const calendarDatePattern =
  /^(\d{4})([-:])(\d{2})\2(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/;

function dateFromCalendarString(value: string) {
  const match = value.match(calendarDatePattern);

  if (!match) {
    return null;
  }

  const [, year, , month, day, hour = "0", minute = "0", second = "0", fraction] = match;
  const milliseconds = fraction ? Number(fraction.slice(0, 3).padEnd(3, "0")) : 0;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    milliseconds,
  };
  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.milliseconds,
    ),
  );

  return date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day &&
    date.getUTCHours() === parts.hour &&
    date.getUTCMinutes() === parts.minute &&
    date.getUTCSeconds() === parts.second &&
    date.getUTCMilliseconds() === parts.milliseconds
    ? date
    : null;
}

/**
 * Photo timestamps are calendar values from the camera, not moments that
 * should be converted to the server or browser timezone. We encode that
 * calendar value in a UTC Date so PostgreSQL's timestamp-without-timezone
 * column and every UI render the same clock fields.
 */
export function toPhotoDate(value: PhotoDateValue) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const calendarDate = dateFromCalendarString(normalized);

  if (calendarDate) {
    return calendarDate;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function photoDateTimeInputValue(value: PhotoDateValue) {
  const date = toPhotoDate(value);

  if (!date) {
    return "";
  }

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function photoDateFromDatetimeLocal(value: string) {
  if (!value) {
    return null;
  }

  return toPhotoDate(value);
}

export function formatPhotoDate(value: PhotoDateValue) {
  const date = toPhotoDate(value);

  if (!date) {
    return "未记录日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: PHOTO_TIME_ZONE,
  }).format(date);
}

export function formatPhotoYear(value: PhotoDateValue) {
  const date = toPhotoDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", timeZone: PHOTO_TIME_ZONE }).format(date)
    : "—";
}
