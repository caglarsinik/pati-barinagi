import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { pickTapDog } from '../../src/scenes/tapTarget';

const dog = { id: 1, x: 10.5, y: 10.7 };
/** Köpeğin gövde merkezi (dokunma ölçümü y - 0.2 üzerinden). */
const body = { x: dog.x, y: dog.y - 0.2 };
const adjacent = { x: dog.x + 1, y: dog.y };
const far = { x: dog.x + 6, y: dog.y };

describe('Dokunma hedefi (pickTapDog)', () => {
  it('köpeğin üstüne dokunuş oyuncu dibindeyken de köpeğe gider', () => {
    expect(pickTapDog([dog], adjacent, body.x + 0.2, body.y)).toEqual({ dog, interact: true });
  });

  it('oyuncu köpeğin dibindeyken çevresine dokunuş yürüyüş sayılır', () => {
    const pick = pickTapDog([dog], adjacent, body.x - 0.9, body.y);
    expect(pick?.dog).toBe(dog);
    expect(pick?.interact).toBe(false);
  });

  it('oyuncu uzaktayken çevresine dokunuş köpeğe kilitlenir', () => {
    expect(pickTapDog([dog], far, body.x - 0.9, body.y)?.interact).toBe(true);
  });

  it('kilitlenme yarıçapının dışı köpek seçmez; en yakın köpek seçilir', () => {
    expect(pickTapDog([dog], far, body.x + BALANCE.touch.dogSnapTiles + 0.1, body.y)).toBeNull();
    const other = { id: 2, x: dog.x + 0.8, y: dog.y };
    expect(pickTapDog([dog, other], far, other.x + 0.1, other.y - 0.2)?.dog).toBe(other);
  });
});
