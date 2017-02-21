import BufferLoader, {DownloadStatus} from './BufferLoader';

describe('BufferLoader', () => {

  let context, bufferLoader;

  beforeAll(() => {
    context = new (AudioContext || webkitAudioContext)();
    bufferLoader = new BufferLoader(context);
  });

  afterAll(() => {
    if (context) {
      context.close();
      context = null;
    }

    bufferLoader.dispose();
  });

  describe('when loading a single sound', () => {

    describe('from a valid source', () => {

      const url = 'base/sounds/beep.mp3';
      let downloadResult;

      beforeAll((done) => {
        bufferLoader.load(url)
          .then(result => {
            downloadResult = result;
            done();
          });
      });

      afterAll(() => {
        bufferLoader.unload();
      });

      it('should return an object with url, value, status and empty error', () => {
        expect(downloadResult.status).toBe(DownloadStatus.Success);
        expect(downloadResult.url).toBe(url);
        expect(downloadResult.value).toBeDefined();
        expect(downloadResult.error).toBeUndefined();
      });

      describe('and reloading again', () => {

        let downloadResult2;

        beforeAll((done) => {
          bufferLoader.load(url)
            .then(result => {
              downloadResult2 = result;
              done();
            });
        });

        it('should return the already cached result', () => {
          expect(downloadResult2).toBeDefined();
          expect(downloadResult2.url).toBe(url);
        });
      });
    });

    describe('from an invalid source', () => {

      const url = 'base/sounds/notexist.mp3';
      let downloadResult;

      beforeAll((done) => {
        bufferLoader.load(url)
          .then(result => {
            downloadResult = result;
            done();
          });
      });

      it('should return error', () => {
        expect(downloadResult.status).toBe(DownloadStatus.Failure);
        expect(downloadResult.error).toBeDefined();
      });
    });
  });

  describe('when downloading multiple sounds', () => {

    describe('with valid and invalid sources', () => {

      const urls = ['base/sounds/beep.mp3', 'base/sounds/notexist.mp3'];
      let downloadResults;

      beforeAll((done) => {
        bufferLoader.load(urls, context)
          .then(result => {
            downloadResults = result;
            done();
          });
      });

      afterAll(() => {
        bufferLoader.unload();
      });

      it('should return all the results with correct values', () => {
        expect(downloadResults).toBeDefined();
        expect(downloadResults.length).toBe(2);

        const successResults = downloadResults.filter(downloadResult => downloadResult.status === DownloadStatus.Success);
        expect(successResults.length).toBe(1);
        expect(successResults[0].url).toBe(urls[0]);

        const failedResults = downloadResults.filter(downloadResult => downloadResult.status === DownloadStatus.Failure);
        expect(failedResults.length).toBe(1);
        expect(failedResults[0].url).toBe(urls[1]);
      });

      describe('reloading again', () => {

        let downloadResults2;

        beforeAll((done) => {
          bufferLoader.load(urls, context)
            .then(result => {
              downloadResults2 = result;
              done();
            });
        });

        it('should return all the results with correct values', () => {
          expect(downloadResults).toBeDefined();
          expect(downloadResults.length).toBe(2);
          expect(downloadResults.filter(downloadResult => downloadResult.status === DownloadStatus.Success).length).toBe(1);
          expect(downloadResults.filter(downloadResult => downloadResult.status === DownloadStatus.Failure).length).toBe(1);
        });
      });
    });
  });
});
