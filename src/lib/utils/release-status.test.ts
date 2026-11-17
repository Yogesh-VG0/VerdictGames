import {describe,it,expect} from 'vitest';
import {hasEarlyAccessSignal,hasKnownFullRelease} from './release-status';

describe('current release status and historical tags',()=>{
  it.each(['released','full_release','Full Release'])('honors verified %s while retaining historical tags',release_status=>{
    const game={release_status,tags:['RPG','Early Access'],genres:['early-access']};
    expect(hasKnownFullRelease(game)).toBe(true);
    expect(hasEarlyAccessSignal(game)).toBe(false);
    expect(game.tags).toEqual(['RPG','Early Access']);
  });
  it('keeps unknown current status distinct from a verified full release',()=>{
    expect(hasKnownFullRelease({release_status:null,tags:['Early Access']})).toBe(false);
    expect(hasEarlyAccessSignal({release_status:null,tags:['Early Access']})).toBe(true);
    expect(hasEarlyAccessSignal({release_status:'early_access',tags:[]})).toBe(true);
    expect(hasEarlyAccessSignal({release_status:null,tags:[]})).toBe(false);
  });
});
