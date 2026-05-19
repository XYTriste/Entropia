import { useEffect, useRef, useState } from 'react';

interface RollingNumberProps {
  target: number;
  duration?: number;
  decimals?: number;
  className?: string;
}

export default function RollingNumber({
  target,
  duration = 1500,
  decimals = 0,
  className = '',
}: RollingNumberProps) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    startValue.current = display;
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue.current + (target - startValue.current) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration]);

  return (
    <span className={className}>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}
    </span>
  );
}
