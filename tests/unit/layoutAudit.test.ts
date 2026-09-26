import { describe, expect, it } from 'vitest';
import { summarizeAudit } from '../../src/debug/layoutAudit';
import { actionLabel, buildToolHint } from '../../src/ui/store';
import { Zone } from '../../src/sim/world/tiles';

describe('Arayüz denetimi ve dokunmatik ipuçları (0.21.6)', () => {
  it('E düğmesi yalnız ipucundaki işi yazar, ayrıntıyı atar', () => {
    expect(actionLabel("E: Minnoş Karabaşım'i sev")).toBe("Minnoş Karabaşım'i sev");
    expect(actionLabel('E: telefon · yem siparişi (kilerde 42 porsiyon)')).toBe('telefon · yem siparişi');
    expect(actionLabel('🤖 Otopilot: yem kabı · E: kiler (42 porsiyon) · ↑ içeri')).toBe('kiler · ↑ içeri');
    // Dokunmatikteki genel ipucunda iş yok: düğme "Yakında iş yok" olur (eskiden "etkileşim · I: köpek…" yazıyordu).
    expect(actionLabel('Dokun: yürü · köpeğe/binaya dokun: iş yap · uzun bas: seç')).toBeNull();
    expect(actionLabel('Kestane uyuyor')).toBeNull();
  });

  it('dokunmatikte inşa ipuçları klavye/fare kısayolu yazmaz', () => {
    const tools = [
      { kind: 'building', type: 'kennelLarge' },
      { kind: 'building', type: 'kennelSmall' },
      { kind: 'tile', tool: 'fence' },
      { kind: 'demolish' },
      { kind: 'zone', zone: Zone.Play },
    ] as const;
    for (const tool of tools) {
      const touch = buildToolHint(tool, true);
      const desk = buildToolHint(tool, false);
      expect(touch).not.toMatch(/Esc|R: |sağ tık|tıkla/);
      expect(desk).toMatch(/Esc/);
      expect(touch.length).toBeLessThan(desk.length);
    }
  });

  it('özet aynı sorunu ekranlarıyla tek satırda toplar', () => {
    const issue = { kind: 'ellipsis' as const, where: 'div.nav-slot > button.nav-item > span.nav-label', text: 'Yönetim', px: 4 };
    const sum = summarizeAudit([
      { screen: 'hud:avatar', issues: [issue] },
      { screen: 'panel:finance', issues: [{ ...issue, px: 9 }, { kind: 'spill', where: 'div.row > button.btn', text: 'Göster', other: 'div.row', px: 3 }] },
    ]);
    expect(sum).toHaveLength(2);
    const e = sum.find((s) => s.kind === 'ellipsis')!;
    expect(e.px).toBe(9);
    expect(e.screens).toEqual(['hud:avatar', 'panel:finance']);
  });
});
