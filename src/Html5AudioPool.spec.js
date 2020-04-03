import Html5AudioPool from './Html5AudioPool';
import Heap from './Heap';

describe('Html5AudioPool', () => {

  let html5AudioPool = null;

  const heap = new Heap(1),
    url = '/base/sounds/bg.mp3',
    groupId = 1,
    soundId = 100;

  beforeEach(() => {
    html5AudioPool = new Html5AudioPool(2, heap);
  });

  afterEach(() => {
    html5AudioPool && html5AudioPool.dispose();
  });

  describe('on allocating audio node for resource', () => {

    describe('when the total nodes are with in the limit', () => {

      beforeEach(() => {
        html5AudioPool.allocateForSource(url);
      });

      it('should allocate a new audio node for the passed resource', () => {
        const nodes = html5AudioPool._resourceNodesMap[url],
          { unallocated } = nodes;

        expect(unallocated.length).toBe(1);
      });
    });

    describe('when the total nodes reached the limit', () => {
      beforeEach(() => {
        html5AudioPool._resourceNodesMap = {
          url1: {
            unallocated: [],
            allocated: {
              1: [{
                audio: new Audio(),
                soundId: 101
              }],
              2: [{
                audio: new Audio(),
                soundId: 102
              }]
            }
          }
        };
      });

      it('should throw error', () => {
        expect(() => {
          html5AudioPool.allocateForSource('url1');
        }).toThrowError(`Maximum nodes reached for resource url1`);
      });
    });
  });

  describe('on allocating audio node for a group', () => {

    describe('with unallocated nodes available', () => {

      beforeEach(() => {
        html5AudioPool._resourceNodesMap[url] = {
          unallocated: [new Audio()],
          allocated: {}
        };
        html5AudioPool.allocateForGroup(url, groupId);
      });

      it('should take the node from the reserve', () => {
        const nodes = html5AudioPool._resourceNodesMap[url],
          { unallocated, allocated } = nodes;

        expect(unallocated.length).toBe(0);
        expect(Object.keys(allocated).length).toBe(1);
      });
    });

    describe('with no unallocated nodes', () => {

      beforeEach(() => {
        html5AudioPool.allocateForGroup(url, groupId);
      });

      it('should create a new audio node', () => {
        const nodes = html5AudioPool._resourceNodesMap[url],
          { allocated } = nodes;

        expect(Object.keys(allocated).length).toBe(1);
      });
    });
  });

  describe('on allocating audio node for a sound', () => {

    describe('with allocated nodes in group', () => {

      beforeEach(() => {
        html5AudioPool._resourceNodesMap[url] = {
          unallocated: [],
          allocated: {
            1: [{
              audio: new Audio(),
              soundId: null
            }]
          }
        };

        html5AudioPool.allocateForSound(url, groupId, soundId);
      });

      it('should assign the first allocated node to the sound', () => {
        const nodes = html5AudioPool._resourceNodesMap[url],
          { allocated } = nodes;

        const t = allocated[groupId].find(x => x.soundId === soundId);
        expect(t).not.toBeNull();
      });
    });

    describe('with no allocated nodes in group', () => {

      it('should throw error', () => {
        expect(() => {
          html5AudioPool.allocateForSound(url, groupId, soundId);
        }).toThrowError(`No free audio nodes available in the group ${groupId}`);
      });
    });
  });

  describe('on releasing audio nodes for resource', () => {

    beforeEach(() => {
      html5AudioPool._resourceNodesMap[url] = {
        unallocated: [new Audio()],
        allocated: {
          1: [{
            audio: new Audio(),
            soundId: null
          }]
        }
      };

      html5AudioPool.releaseForSource(url);
    });

    it('should remove nodes from both allocated and unallocated properties', () => {
      expect(html5AudioPool.hasOwnProperty(url)).toBe(false);
    });
  });

  describe('on releasing audio nodes for group', () => {

    beforeEach(() => {
      html5AudioPool._resourceNodesMap[url] = {
        unallocated: [new Audio()],
        allocated: {
          1: [{
            audio: new Audio(),
            soundId: soundId
          }, {
            audio: new Audio(),
            soundId: null
          }]
        }
      };
    });

    describe('for all audio nodes', () => {

      beforeEach(() => {
        html5AudioPool.releaseForGroup(url, groupId);
      });

      it('should release the audio nodes allocated for group', () => {
        const nodes = html5AudioPool._resourceNodesMap[url],
          { unallocated, allocated } = nodes;

        expect(unallocated.length).toBe(1);
        expect(allocated.hasOwnProperty(groupId)).toBe(false);
      });
    });

    describe('only free nodes', () => {
      beforeEach(() => {
        html5AudioPool.releaseForGroup(url, groupId, true);
      });

      it('should release the audio nodes allocated for group', () => {
        const nodes = html5AudioPool._resourceNodesMap[url],
          { unallocated, allocated } = nodes;

        expect(unallocated.length).toBe(1);
        expect(Object.keys(allocated).length).toBe(1);
      });
    });
  });

  describe('on releasing audio nodes for sound', () => {

    beforeEach(() => {
      html5AudioPool._resourceNodesMap[url] = {
        unallocated: [new Audio()],
        allocated: {
          1: [{
            audio: new Audio(),
            soundId: soundId
          }]
        }
      };

      html5AudioPool.releaseForSound(url, groupId, soundId);
    });

    it('should remove the soundid', () => {
      const nodes = html5AudioPool._resourceNodesMap[url],
        { allocated } = nodes;

      const t = allocated[groupId].find(x => x.soundId === soundId);
      expect(t).toBeUndefined();
    });
  });

  describe('on calling clean-up', () => {

    beforeEach(() => {
      html5AudioPool._resourceNodesMap[url] = {
        unallocated: [],
        allocated: {
          1: [{
            audio: new Audio(),
            soundId: null
          }, {
            audio: new Audio(),
            soundId: null
          }]
        }
      };

      html5AudioPool.cleanUp();
    });

    it('should remove the un-used audio nodes and store it in unallocated collection', () => {
      expect(html5AudioPool._resourceNodesMap[url].unallocated.length).toBe(2);
    });
  });

  describe('on calling dispose', () => {

    beforeEach(() => {
      html5AudioPool._resourceNodesMap = {
        url1: {
          unallocated: [new Audio()],
          allocated: {
            1: [{
              audio: new Audio(),
              soundId: 101
            }]
          }
        },
        url2: {
          unallocated: [new Audio()],
          allocated: {
            1: [{
              audio: new Audio(),
              soundId: 102
            }]
          }
        }
      };

      html5AudioPool.dispose();
    });

    it('should remove all the audio nodes', () => {
      expect(Object.keys(html5AudioPool._resourceNodesMap).length).toBe(0);
    });
  });
});