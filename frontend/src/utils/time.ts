// Singapore time requirement §§1–2: display/input timezone only; chain values stay Unix time.
export const SINGAPORE_ZONE = "Asia/Singapore";
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: SINGAPORE_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: SINGAPORE_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export const formatSingaporeTime = (seconds: number) =>
  `${dateTime.format(new Date(seconds * 1000))} SGT`;
export const formatSingaporeClock = (milliseconds: number) =>
  `${clock.format(new Date(milliseconds))} SGT`;

/** datetime-local carries no offset. Always interpret it in Singapore, never the host timezone. */
export function parseSingaporeDateTime(value: string): number {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      value,
    );
  if (!match) return NaN;
  const [, year, month, day, hour, minute, second = "00", fraction = "", zone] =
    match;
  const calendar = `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}`;
  const local = new Date(`${calendar}Z`);
  // Date.parse normalizes invalid days such as February 30; do not silently schedule them.
  if (
    !Number.isFinite(local.getTime()) ||
    local.getUTCFullYear() !== Number(year) ||
    local.getUTCMonth() + 1 !== Number(month) ||
    local.getUTCDate() !== Number(day) ||
    local.getUTCHours() !== Number(hour) ||
    local.getUTCMinutes() !== Number(minute) ||
    local.getUTCSeconds() !== Number(second)
  )
    return NaN;
  return zone
    ? Date.parse(`${calendar}${zone}`)
    : local.getTime() - SINGAPORE_OFFSET_MS;
}

/** Preserve seconds when loading an existing credential; forms use step=1. */
export function singaporeDateTimeInput(
  milliseconds: number,
  seconds = false,
): string {
  return new Date(milliseconds + SINGAPORE_OFFSET_MS)
    .toISOString()
    .slice(0, seconds ? 19 : 16);
}
export function futureSingaporeInput(
  minutes: number,
  now = Date.now(),
): string {
  return singaporeDateTimeInput(now + minutes * 60000);
}
