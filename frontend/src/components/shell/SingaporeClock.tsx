import { useEffect, useState } from "react";
import { formatSingaporeClock } from "../../utils/time";

/** Real-world Singapore clock; financial state still comes from confirmed blocks. */
export function SingaporeClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <time
      className="muted small hide-sm"
      dateTime={new Date(now).toISOString()}
      title="Singapore time (UTC+08:00)"
    >
      {formatSingaporeClock(now)}
    </time>
  );
}
