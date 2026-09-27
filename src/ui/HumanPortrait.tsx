import { useEffect, useRef } from 'preact/hooks';
import { HUMAN_H, HUMAN_W, type HumanStyle, drawHuman } from '../render/HumanPainter';

/**
 * İnsan çizimi (16×24) canvas'ta büyütülmüş (0.24.1): karakter önizlemesi ve yuva kartı portresi. `headOnly` yalnız üst 16
 * satırı (baş ve omuzlar) gösterir. Yön 2 = sol karenin aynası (sprite şeridindeki gibi). `sig` çizimin imzasıdır: stil nesnesi
 * her çizimde yeniden kurulduğu için efekt ona bağlanır.
 */
export function HumanPortrait({
  style,
  sig,
  dir = 0,
  frame = 0,
  scale = 3,
  headOnly = false,
  class: cls = '',
}: {
  style: HumanStyle;
  sig: string;
  dir?: number;
  frame?: number;
  scale?: number;
  headOnly?: boolean;
  class?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const h = headOnly ? 16 : HUMAN_H;
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const px = dir === 2 ? drawHuman(1, frame, style).flipH() : drawHuman(dir, frame, style);
    ctx.clearRect(0, 0, c.width, c.height);
    const img = ctx.createImageData(px.w, px.h);
    img.data.set(px.data);
    ctx.putImageData(img, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, dir, frame, headOnly]);
  return <canvas ref={ref} width={HUMAN_W} height={h} class={'portrait ' + cls} style={{ width: `${HUMAN_W * scale}px`, height: `${h * scale}px` }} aria-hidden="true" />;
}
