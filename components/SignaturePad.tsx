import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface SignaturePadHandle {
  clear: () => void;
  toDataURL: () => string;
}

interface SignaturePadProps {
  onChange?: (hasSignature: boolean) => void;
  disabled?: boolean;
}

const WIDTH = 500;
const HEIGHT = 150;

// Campo para desenhar a assinatura com o mouse ou o dedo.
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ onChange, disabled = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // o desenho tem tamanho fixo e a tela pode mostrá-lo menor: converte as coordenadas
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId); // continua o traço se o dedo sair do campo
    } catch {
      // alguns navegadores não permitem em certos eventos
    }
    drawing.current = true;
    context.strokeStyle = '#111111';
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 0.01, y + 0.01); // um toque sem arrastar também deixa um ponto
    context.stroke();
    if (empty) {
      setEmpty(false);
      onChange?.(true);
    }
  };

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const handleUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(false);
  };

  useImperativeHandle(ref, () => ({
    clear,
    toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
  }));

  return (
    <div>
      <div className="bg-white rounded-lg overflow-hidden border-2 border-dashed border-gray-400">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          aria-label="Campo de assinatura: desenhe com o mouse ou o dedo"
          className="w-full h-[150px] touch-none cursor-crosshair"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={handleUp}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={empty}
        className="text-xs text-sae-muted hover:text-sae-text mt-1 underline disabled:no-underline disabled:opacity-50"
      >
        Limpar assinatura
      </button>
    </div>
  );
});
SignaturePad.displayName = 'SignaturePad';
