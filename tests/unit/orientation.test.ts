import { it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim';
import { OrientationPause, portraitBlocked } from '../../src/ui/OrientationPause';
it.each([0, 1, 2, 4] as const)('portrait freezes time and restores speed %s', speed => {
 const sim = Sim.create(77); sim.setSpeed(speed);
 const pause = new OrientationPause(); const before = sim.clock.totalMinutes;
 pause.update(sim, true, false); sim.update(10); pause.update(sim, true, false);
 expect(sim.clock.totalMinutes).toBe(before); expect(sim.speed).toBe(0);
 pause.update(sim, false, false); expect(sim.speed).toBe(speed);
});
it('does not resume under another modal or after bankruptcy', () => {
 const sim=Sim.create(77); const pause=new OrientationPause();
 pause.update(sim,true,false); pause.update(sim,false,true); expect(sim.speed).toBe(0);
 sim.setSpeed(4); pause.update(sim,true,false); sim.gameOver={reason:'bankrupt',week:4};
 pause.update(sim,false,false); expect(sim.speed).toBe(0);
});
it('matches the rotate overlay boundaries',()=>{
 expect(portraitBlocked(375,812)).toBe(true); expect(portraitBlocked(812,375)).toBe(false);
 expect(portraitBlocked(768,1024)).toBe(false); expect(portraitBlocked(767,768)).toBe(true);
});
