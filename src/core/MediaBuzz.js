import BaseBuzz, {BuzzState, ErrorType} from './BaseBuzz';
import codecAid from '../util/CodecAid';
import DownloadStatus from '../util/DownloadStatus';
import buzzer from './Buzzer';

/**
 * Represents a single sound.
 * @class
 */
class MediaBuzz extends BaseBuzz {

  _audio = null;

  _mediaElementAudioSourceNode = null;

  /**
   * @param {object} args
   * @param {string=} args.id An unique id for the sound.
   * @param {string=} args.src The source of the audio file.
   * @param {number} [args.volume = 1.0] The initial volume of the sound.
   * @param {boolean} [args.muted = false] Should be muted initially.
   * @param {number} [args.loop = false] Whether the sound should play repeatedly.
   * @param {boolean} [args.preload = false] Load the sound initially itself.
   * @param {boolean} [args.autoplay = false] Play automatically once the object is created.
   * @param {function=} args.onload Event-handler for the "load" event.
   * @param {function=} args.onerror Event-handler for the "error" event.
   * @param {function=} args.onplaystart Event-handler for the "playstart" event.
   * @param {function=} args.onplayend Event-handler for the "playend" event.
   * @param {function=} args.onstop Event-handler for the "stop" event.
   * @param {function=} args.onpause Event-handler for the "pause" event.
   * @param {function=} args.onmute Event-handler for the "mute" event.
   * @param {function=} args.onvolume Event-handler for the "volume" event.
   * @param {function=} args.ondestroy Event-handler for the "destroy" event.
   * @constructor
   */
  constructor(args) {
    super(args);
    this._audio = new Audio();
  }

  _validate(options) {
    if(!options.src || (Array.isArray(options.src) && options.src.length === 0)) {
      throw new Error('You should pass the source for the audio.');
    }
  }

  /**
   * Load the sound into an audio node.
   * Fires 'load' event on successful load and 'error' event on failure.
   * @returns {MediaBuzz}
   */
  load() {
    // If the buffer is already loaded return without reloading again.
    if (this._isLoaded) {
      return this;
    }

    // Set the state to "Loading" to avoid multiple times loading the buffer.
    this._state = BuzzState.Loading;

    const src = codecAid.getSupportedFile(this._src);

    if(!src) {
      this._removePlayHandler();
      this._state = BuzzState.Error;
      this._fire('error', {type: ErrorType.LoadError, error: 'None of the audio format you passed is supported'});
      return this;
    }

    this._feasibleSrc = src;

    buzzer.loadMedia(this._feasibleSrc, this._id).then(downloadResult => {
      if (downloadResult.status === DownloadStatus.Success) {
        this._audio = downloadResult.value;
        this._duration = this._audio.duration;
        this._gainNode = this._context.createGain();
        this._gainNode.gain.value = this._muted ? 0 : this._volume;
        this._isLoaded = true;
        this._state = BuzzState.Ready;
        this._fire('load', downloadResult);
        return;
      }

      this._removePlayHandler();
      this._state = BuzzState.Error;
      this._fire('error', {type: ErrorType.LoadError, error: downloadResult.error});
    });

    return this;
  }

  /**
   * Plays the sound.
   * Fires 'playstart' event before playing and 'playend' event after the sound is played.
   * @param {string=} sound
   * @returns {MediaBuzz}
   */
  play(sound) {
    // If the sound is already in "Playing" state then it's not allowed to play again.
    if (this._state === BuzzState.Playing) {
      return this;
    }

    if (!this._isLoaded) {
      this.on('load', {
        handler: this.play,
        target: this,
        args: [sound],
        once: true
      });

      this.load();

      return this;
    }

    buzzer._link(this);
    this._clearEndTimer();

    if(!this._mediaElementAudioSourceNode) {
      this._mediaElementAudioSourceNode = this._context.createMediaElementSource(this._audio);
      this._mediaElementAudioSourceNode.connect(this._gainNode);
    }

    this._audio.currentTime = this._elapsed;
    this._audio.play();
    this._startedAt = this._context.currentTime;
    this._endTimer = setTimeout(() => {
      if (this._loop) {
        this._startedAt = 0;
        this._elapsed = 0;
        this._state = BuzzState.Ready;
        this._fire('playend');
        this.play(sound);
      } else {
        this._reset();
        this._state = BuzzState.Ready;
        this._fire('playend');
      }
    }, this._duration * 1000);
    this._state = BuzzState.Playing;
    this._fire('playstart');

    return this;
  }

  _reset() {
    buzzer._unlink(this);

    if(this._audio) {
      this._audio.pause();
    }

    this._startedAt = 0;
    this._elapsed = 0;
    this._clearEndTimer();
  }

  /**
   * Pause the playing sound.
   * @returns {MediaBuzz}
   */
  pause() {
    // Remove the "play" event handler from queue if there is one.
    this._removePlayHandler();

    // We can pause the sound only if it is "playing" state.
    if (this._state !== BuzzState.Playing) {
      return this;
    }

    const startedAt = this._startedAt, elapsed = this._elapsed;
    this._reset();
    this._elapsed = elapsed + this._context.currentTime - startedAt;
    this._state = BuzzState.Paused;
    this._fire('pause');

    return this;
  }

  /**
   * Stops the sound that is playing or in paused state.
   * @returns {MediaBuzz}
   */
  stop() {
    // Remove the "play" event handler from queue if there is one.
    this._removePlayHandler();

    // We can stop the sound either if it "playing" or in "paused" state.
    if (this._state !== BuzzState.Playing && this._state !== BuzzState.Paused) {
      return this;
    }

    this._reset();
    this._state = BuzzState.Stopped;
    this._fire('stop');

    return this;
  }

  /**
   * Destroys the buzz.
   */
  destroy() {
    throw new Error('Not Implemented');
  }
}

export {MediaBuzz as default};
