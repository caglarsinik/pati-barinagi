import { useEffect, useRef } from 'preact/hooks';
import { drawDogPortrait } from '../render/DogPainter';
import type { GrowthStage } from '../sim/entities/Dog';
import { type DogGenome, genomeKey } from '../sim/entities/DogGenome';

/** Köpeğin sol profil duruş karesi, 2x büyütülmüş. */
export function DogPortrait({ genome, stage, scale = 2 }: { genome: DogGenome; stage: GrowthStage; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = `${genomeKey(genome)}-${stage}`;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const px = drawDogPortrait(genome, stage);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const img = ctx.createImageData(px.w, px.h);
    img.data.set(px.data);
    ctx.putImageData(img, 0, 0);
  }, [key]);
  return <canvas ref={ref} width={32} height={32} class="portrait" style={{ width: `${32 * scale}px`, height: `${32 * scale}px` }} />;
}
