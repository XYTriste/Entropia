import { useEffect, useRef } from 'react';

interface WaveProgressProps {
  progress: number;
  width?: number;
  height?: number;
}

export default function WaveProgress({
  progress,
  width = 360,
  height = 60,
}: WaveProgressProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const waveRef = useRef<SVGPathElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const animRef = useRef<number>(0);
  const waveSpeed = useRef(0);

  const getWavePath = (
    w: number,
    h: number,
    points: number,
    prog: number,
    offset: number
  ) => {
    const xStep = w / points;
    let path = `M0 ${h / 2}`;

    for (let i = 0; i <= points; i++) {
      const x = i * xStep;
      const baseY = h / 2;
      const wave1 = Math.sin((i + offset) * 0.5) * 8;
      const wave2 = prog > 0 ? Math.cos((i + offset) * 0.3) * 5 : 0;
      const y = baseY + wave1 + wave2;

      if (i === 0) {
        path = `M${x} ${y}`;
      } else {
        const prevX = (i - 1) * xStep;
        const cpx1 = prevX + xStep / 2;
        const cpx2 = prevX + xStep / 2;
        path += ` C${cpx1} ${y},${cpx2} ${y},${x} ${y}`;
      }
    }

    path += ` L${w} ${h} L0 ${h} Z`;
    return path;
  };

  useEffect(() => {
    const animate = () => {
      waveSpeed.current += 0.02;

      if (trackRef.current) {
        trackRef.current.setAttribute(
          'd',
          getWavePath(width, height, 20, 0, waveSpeed.current)
        );
      }

      if (waveRef.current) {
        const clipWidth = width * (progress / 100);
        waveRef.current.setAttribute(
          'd',
          getWavePath(clipWidth, height, 20, progress, waveSpeed.current)
        );
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [progress, width, height]);

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Track */}
        <defs>
          <clipPath id="waveClip">
            <rect x="0" y="0" width={width * (progress / 100)} height={height} />
          </clipPath>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A373" />
            <stop offset="100%" stopColor="#C9956B" />
          </linearGradient>
          <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="100%" stopColor="#F3F4F6" />
          </linearGradient>
        </defs>

        {/* Track background */}
        <path
          ref={trackRef}
          fill="url(#trackGradient)"
          opacity={0.5}
        />

        {/* Wave fill */}
        <path
          ref={waveRef}
          fill="url(#waveGradient)"
          clipPath="url(#waveClip)"
          style={{
            filter: 'drop-shadow(0 2px 8px rgba(212, 163, 115, 0.3))',
          }}
        />

        {/* Progress percentage text */}
        <text
          x={width / 2}
          y={height / 2 + 5}
          textAnchor="middle"
          className="font-mono text-sm font-semibold"
          fill={progress > 50 ? '#FFFFFF' : '#8C959F'}
        >
          {Math.round(progress)}%
        </text>
      </svg>

      {/* Glass overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)',
        }}
      />
    </div>
  );
}
