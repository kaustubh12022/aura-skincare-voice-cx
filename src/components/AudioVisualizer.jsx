import React, { useRef, useEffect } from 'react';
import { CALL_STATES } from '../hooks/useVoiceAgent.js';

export default function AudioVisualizer({ callState, getAnalyserNode, isCallActive }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let dataArray = null;
    let bufferLength = 0;

    const render = () => {
      phaseRef.current += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Check if an AnalyserNode is currently active
      const analyser = getAnalyserNode ? getAnalyserNode() : null;
      let averageVolume = 0;

      if (analyser && isCallActive) {
        if (!dataArray || bufferLength !== analyser.frequencyBinCount) {
          bufferLength = analyser.frequencyBinCount;
          dataArray = new Uint8Array(bufferLength);
        }
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        averageVolume = sum / (bufferLength * 255); // 0.0 to 1.0
      }

      // Base radius and dynamic pulse
      const baseRadius = 55;
      const pulseRadius = baseRadius + averageVolume * 45;

      // Color selection based on call state
      let primaryColor = 'rgba(244, 63, 94, 0.8)'; // default rose
      let secondaryColor = 'rgba(251, 191, 36, 0.6)';
      let glowColor = 'rgba(244, 63, 94, 0.3)';

      if (callState === CALL_STATES.LISTENING) {
        primaryColor = 'rgba(16, 185, 129, 0.9)'; // emerald
        secondaryColor = 'rgba(52, 211, 153, 0.7)';
        glowColor = 'rgba(16, 185, 129, 0.4)';
      } else if (callState === CALL_STATES.SPEAKING) {
        primaryColor = 'rgba(99, 102, 241, 0.9)'; // indigo
        secondaryColor = 'rgba(168, 85, 247, 0.7)';
        glowColor = 'rgba(99, 102, 241, 0.45)';
      } else if (callState === CALL_STATES.THINKING) {
        primaryColor = 'rgba(251, 191, 36, 0.9)'; // amber
        secondaryColor = 'rgba(245, 158, 11, 0.7)';
        glowColor = 'rgba(251, 191, 36, 0.4)';
      }

      // Outer ambient glow
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.5,
        centerX,
        centerY,
        pulseRadius + 35
      );
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(0.6, glowColor.replace(/[\d\.]+\)$/, '0.15)'));
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius + 35, 0, Math.PI * 2);
      ctx.fill();

      // Draw multi-harmonic wave orb
      const numPoints = 80;
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const wave1 = Math.sin(angle * 4 + phaseRef.current) * (8 + averageVolume * 22);
        const wave2 = Math.cos(angle * 6 - phaseRef.current * 1.5) * (4 + averageVolume * 15);
        const r = pulseRadius + wave1 + wave2;

        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner Core
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        Math.max(10, baseRadius * 0.45 + averageVolume * 15),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = secondaryColor;
      ctx.fill();

      // Waveform Equalizer Bars (below the orb)
      const barCount = 28;
      const barWidth = 3;
      const barSpacing = 4;
      const startX = centerX - ((barCount * (barWidth + barSpacing)) / 2);
      const bottomY = height - 16;

      for (let b = 0; b < barCount; b++) {
        let barHeight = 4;
        if (dataArray && isCallActive) {
          const sampleIndex = Math.floor((b / barCount) * (bufferLength / 2));
          barHeight = Math.max(4, (dataArray[sampleIndex] / 255) * 36);
        } else {
          barHeight = 4 + Math.sin(phaseRef.current * 2 + b * 0.3) * 3;
        }

        ctx.fillStyle = primaryColor;
        ctx.fillRect(
          startX + b * (barWidth + barSpacing),
          bottomY - barHeight,
          barWidth,
          barHeight
        );
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [callState, getAnalyserNode, isCallActive]);

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <canvas
        ref={canvasRef}
        width={320}
        height={220}
        className="w-full max-w-[320px] h-[220px]"
      />
    </div>
  );
}
