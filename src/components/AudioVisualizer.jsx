import React, { useRef, useEffect } from 'react';
import { CALL_STATES } from '../hooks/useVoiceAgent.js';

/**
 * AudioVisualizer - Luxury Skincare Fluid Harmonic Soundwave & Botanical Aura
 * Replaces circular blob and bar visualizer with an elegant, minimalist fluid soundwave
 * and harmonic ripples styled for the Aura Skincare aesthetic.
 */
export default function AudioVisualizer({ callState, getAnalyserNode, isCallActive }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const phaseRef = useRef(0);
  const smoothVolumeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle High-DPI Retina screens
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 460;
    const displayHeight = 150;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    let dataArray = null;
    let bufferLength = 0;

    const render = () => {
      phaseRef.current += 0.035;
      const width = displayWidth;
      const height = displayHeight;
      const centerY = height / 2;
      const centerX = width / 2;

      ctx.clearRect(0, 0, width, height);

      // Check audio volume from AnalyserNode
      const analyser = getAnalyserNode ? getAnalyserNode() : null;
      let rawVolume = 0;

      if (analyser && isCallActive) {
        if (!dataArray || bufferLength !== analyser.frequencyBinCount) {
          bufferLength = analyser.frequencyBinCount;
          dataArray = new Uint8Array(bufferLength);
        }
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        // Sample mid-frequency speech range
        const range = Math.min(bufferLength, 64);
        for (let i = 0; i < range; i++) {
          sum += dataArray[i];
        }
        rawVolume = sum / (range * 255); // 0.0 to 1.0
      }

      // Smooth volume transitions with exponential lerp
      smoothVolumeRef.current += (rawVolume - smoothVolumeRef.current) * 0.18;
      const volume = smoothVolumeRef.current;

      // Palette selection matching luxury theme & call state
      let primaryColor = 'rgba(200, 109, 118, 0.85)'; // Blush Rose
      let secondaryColor = 'rgba(197, 168, 128, 0.75)'; // Champagne Gold
      let auraGlow = 'rgba(200, 109, 118, 0.12)';
      let rippleColor = 'rgba(200, 109, 118, 0.15)';

      if (callState === CALL_STATES.LISTENING) {
        primaryColor = 'rgba(22, 163, 74, 0.85)'; // Sage / Emerald
        secondaryColor = 'rgba(197, 168, 128, 0.7)';
        auraGlow = 'rgba(22, 163, 74, 0.12)';
        rippleColor = 'rgba(22, 163, 74, 0.16)';
      } else if (callState === CALL_STATES.SPEAKING) {
        primaryColor = 'rgba(200, 109, 118, 0.95)'; // Deep Blush Rose
        secondaryColor = 'rgba(197, 168, 128, 0.85)'; // Champagne
        auraGlow = 'rgba(200, 109, 118, 0.18)';
        rippleColor = 'rgba(200, 109, 118, 0.22)';
      } else if (callState === CALL_STATES.THINKING) {
        primaryColor = 'rgba(180, 83, 9, 0.85)'; // Warm Amber
        secondaryColor = 'rgba(197, 168, 128, 0.8)';
        auraGlow = 'rgba(197, 168, 128, 0.18)';
        rippleColor = 'rgba(197, 168, 128, 0.2)';
      } else if (!isCallActive) {
        primaryColor = 'rgba(180, 160, 150, 0.5)';
        secondaryColor = 'rgba(210, 195, 180, 0.4)';
        auraGlow = 'rgba(200, 185, 170, 0.08)';
        rippleColor = 'rgba(200, 185, 170, 0.1)';
      }

      // 1. Concentric Botanical Essence Ripples (Drop on water effect)
      const maxRippleRadius = 48 + volume * 42;
      for (let r = 1; r <= 3; r++) {
        const ringProgress = ((phaseRef.current * 0.4 + r * 0.33) % 1);
        const ringRadius = 14 + ringProgress * maxRippleRadius;
        const ringAlpha = (1 - ringProgress) * (isCallActive ? 0.35 : 0.12);

        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = rippleColor.replace(/[\d\.]+\)$/, `${ringAlpha})`);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 2. Central Soft Ambient Aura Glow
      const auraGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        4,
        centerX,
        centerY,
        42 + volume * 35
      );
      auraGradient.addColorStop(0, auraGlow);
      auraGradient.addColorStop(0.7, auraGlow.replace(/[\d\.]+\)$/, '0.04)'));
      auraGradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(centerX, centerY, 45 + volume * 35, 0, Math.PI * 2);
      ctx.fillStyle = auraGradient;
      ctx.fill();

      // 3. Fluid Multi-Harmonic Soundwave Ribbons
      const drawWave = ({
        amplitude,
        frequency,
        phaseOffset,
        color,
        lineWidth,
        blur = 0
      }) => {
        ctx.save();
        if (blur > 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = blur;
        }

        ctx.beginPath();
        const points = 70;
        const step = width / points;

        for (let i = 0; i <= points; i++) {
          const x = i * step;
          // Gaussian envelope tapering at both ends so the wave smoothly fades out at the edges
          const normX = (x / width) * 2 - 1; // -1 to +1
          const envelope = Math.exp(-normX * normX * 3.2);

          // Multi-sine harmonic synthesis
          const sin1 = Math.sin(normX * frequency * Math.PI + phaseRef.current + phaseOffset);
          const sin2 = Math.cos(normX * frequency * 2.2 * Math.PI - phaseRef.current * 0.8);
          const dynamicAmp = amplitude * (0.35 + volume * 2.2);

          const y = centerY + (sin1 * 0.7 + sin2 * 0.3) * dynamicAmp * envelope;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      };

      // Layer 3: Delicate background harmonic ribbon
      drawWave({
        amplitude: 10,
        frequency: 2.2,
        phaseOffset: 1.2,
        color: secondaryColor.replace(/[\d\.]+\)$/, '0.35)'),
        lineWidth: 1.2,
        blur: 0
      });

      // Layer 2: Warm champagne gold harmonic ribbon
      drawWave({
        amplitude: 16,
        frequency: 2.8,
        phaseOffset: 2.5,
        color: secondaryColor,
        lineWidth: 1.8,
        blur: 4
      });

      // Layer 1: Primary luxury blush rose ribbon
      drawWave({
        amplitude: 22,
        frequency: 3.4,
        phaseOffset: 0,
        color: primaryColor,
        lineWidth: 2.4,
        blur: 6
      });

      // 4. Center Delicate Pearl / Core Node
      const coreRadius = isCallActive ? (4 + volume * 5) : 3.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius + 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1;
      ctx.stroke();

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
    <div className="relative flex flex-col items-center justify-center py-2 px-4 w-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', maxWidth: '460px', height: '150px' }}
        className="w-full max-w-[460px] h-[150px] transition-opacity duration-500"
      />
    </div>
  );
}
