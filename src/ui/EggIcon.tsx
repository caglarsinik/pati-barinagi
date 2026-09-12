import { useEffect, useRef } from 'preact/hooks';
import { EGG_SIZE, drawEgg } from '../render/EggArt';
import { type DogGenome, genomeKey } from '../sim/entities/DogGenome';

/** Çanta ve kuluçka için yumurta ikonu. */
export function EggIcon({ genome, scale = 2 }: { genome: DogGenome; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = genomeKey(genome);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const px = drawEgg(genome);
    ctx.clearRect(0, 0, c.width, c.height);
    const img = ctx.createImageData(px.w, px.h);
    img.data.set(px.data);
    ctx.putImageData(img, 0, 0);
  }, [key]);
  return (
    <canvas
      ref={ref}
      width={EGG_SIZE}
      height={EGG_SIZE}
      class="egg-icon"
      style={{ width: `${EGG_SIZE * scale}px`, height: `${EGG_SIZE * scale}px` }}
    />
  );
}
