import { describe, expect, it } from 'vitest';
import { matchPortrait } from '../artwork';
describe('real-title artwork disambiguation', () => {
  const game = { name:'Exodus (Archetype Entertainment)',slug:'exodus-archetype-entertainment',released:'2027-04-07' };
  const correct = { name:'Exodus',slug:'exodus',year:2027,companies:['Archetype Entertainment'],aliases:[],image:'correct.jpg' };
  it('rejects the older same-name game and matches the studio', () => {
    const unrelated = { name:'Exodus',year:1997,companies:['Other Studio'],aliases:[],image:'wrong.jpg' };
    expect(matchPortrait(game,[unrelated,correct])).toBe('correct.jpg');
    expect(matchPortrait(game,[unrelated])).toBeNull();
  });
  it('rejects ambiguity rather than selecting whichever provider row was last', () => {
    expect(matchPortrait(game,[correct,{...correct,slug:'exodus-2027',image:'ambiguous.jpg'}])).toBeNull();
  });
});
