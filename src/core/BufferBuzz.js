import BaseBuzz, { BuzzState } from './BaseBuzz';
import buzzer from './Buzzer';

/**
 * Employs Web Audio's AudioBufferSourceNode for playing sounds.
 * @class
 */
class BufferBuzz extends BaseBuzz {

  /**
   * Base64 string of an audio.
   * @type {string}
   * @private
   */
  _dataUri = '';

  /**
   * The sprite definition.
   * @type {object}
   * @private
   */
  _sprite = null;

  /**
   * Current playing sound name in a sprite.
   * @type {string|null}
   * @private
   */
  _spriteSound = null;

  /**
   * Whether to cache the buffer or not.
   * @type {boolean}
   * @protected
   */
  _cache = false;

  /**
   * The audio buffer.
   * @type {AudioBuffer}
   * @private
   */
  _buffer = null;

  /**
   * The underlying node that plays the audio.
   * @type {AudioBufferSourceNode}
   * @private
   */
  _bufferSourceNode = null;

  /**
   * Represents the timer that is used to reset the variables once the playback is ended.
   * @type {number|null}
   * @private
   */
  _endTimer = null;

  /**
   * @param {string|object} args The input parameters of the sound.
   * @param {string=} args.id The unique id of the sound.
   * @param {string=} args.src The array of audio urls.
   * @param {string=} args.dataUri The source of the audio as base64 string.
   * @param {object=} args.sprite The sprite definition.
   * @param {number} [args.volume = 1.0] The initial volume of the sound.
   * @param {boolean} [args.muted = false] True to be muted initially.
   * @param {boolean} [args.loop = false] True to play the sound repeatedly.
   * @param {boolean} [args.preload = false] True to pre-load the sound after construction.
   * @param {boolean} [args.autoplay = false] True to play automatically after construction.
   * @param {boolean} [args.cache = false] Whether to cache the buffer or not.
   * @param {function=} args.onload Event-handler for the "load" event.
   * @param {function=} args.onerror Event-handler for the "error" event.
   * @param {function=} args.onplay Event-handler for the "play" event.
   * @param {function=} args.onplayend Event-handler for the "playend" event.
   * @param {function=} args.onstop Event-handler for the "stop" event.
   * @param {function=} args.onpause Event-handler for the "pause" event.
   * @param {function=} args.onmute Event-handler for the "mute" event.
   * @param {function=} args.onvolume Event-handler for the "volume" event.
   * @param {function=} args.onrate Event-handler for the "rate" event.
   * @param {function=} args.onseek Event-handler for the "seek" event.
   * @param {function=} args.ondestroy Event-handler for the "destroy" event.
   * @constructor
   */
  constructor(args) {
    super(args);

    if (typeof args === 'object') {
      typeof args.dataUri === 'string' && (this._dataUri = args.dataUri);
      typeof args.cache === 'boolean' && (this._cache = args.cache);
    }

    this._setup();
  }

  /**
   * Validate the passed options.
   * @param {object} options The buzz options.
   * @private
   */
  _validate(options) {
    if ((!options.src || (Array.isArray(options.src) && options.src.length === 0)) && !options.dataUri) {
      throw new Error('You should pass the source for the audio.');
    }
  }

  /**
   * Download the audio file and loads into an audio buffer.
   * @return {Promise<DownloadResult>}
   * @private
   */
  _load() {
    return buzzer.load(this._compatibleSrc, this._cache);
  }

  /**
   * Store the buffer and duration from the download result.
   * @param {DownloadResult} downloadResult The download result
   * @private
   */
  _save(downloadResult) {
    this._buffer = downloadResult.value;
    this._duration = this._buffer.duration;
  }

  /**
   * Plays the sound or resume it from the paused state.
   * @return {BufferBuzz}
   */
  play() {
    return this._play();
  }

  /**
   * Plays the passed sound that is defined in the sprite.
   * @param {string=} sound The sound name
   * @returns {BufferBuzz}
   */
  playSprite(sound) {
    return this._play(sound);
  }

  /**
   * Plays the sound from start or resume it from the paused state.
   * @param {string|null=} sound The sound name
   * @param {boolean} [fireEvent = true] True to fire event
   * @return {BufferBuzz}
   * @private
   */
  _play(sound, fireEvent = true) {

    // If the sound is already playing return immediately.
    if (this.isPlaying()) {
      return this;
    }

    // If the sound is not yet loaded push an action to the queue to play the sound once it's loaded.
    if (!this.isLoaded()) {
      this._actionQueue.add('play', () => this._play(sound, fireEvent));
      this.load();
      return this;
    }

    const prevSound = this._spriteSound;
    if (sound && this._sprite && this._sprite[sound]) {
      this._spriteSound = sound;
    } else {
      this._spriteSound = null;
    }

    // If the sound is not paused and the passed sound name is different
    // from the last one then start the playback from the start position.
    if (!this.isPaused() && this._spriteSound !== prevSound) {
      this._seek = 0;
    }

    // Store the sound start and end positions.
    if (this._spriteSound) {
      const soundTimeVars = this._sprite[this._spriteSound];
      this._startPos = soundTimeVars[0];
      this._endPos = soundTimeVars[1];
    } else {
      this._startPos = 0;
      this._endPos = this._duration;
    }

    let [seek, duration, timeout] = this._getTimeVars();
    buzzer._link(this); // TODO: Need to figure out a better way for this
    this._playNode(seek, duration);
    this._startTime = this._context.currentTime;
    this._endTimer = setTimeout(this._onEnded, timeout);
    this._state = BuzzState.Playing;

    fireEvent && this._fire('play');

    return this;
  }

  /**
   * Returns the seek, duration and timeout for the playback.
   * @return {[number, number, number]}
   * @private
   */
  _getTimeVars() {
    let seek = Math.max(0, this._seek > 0 ? this._seek : this._startPos),
      duration = this._endPos - this._startPos,
      timeout = (duration * 1000) / this._rate;

    return [seek, duration, timeout];
  }

  /**
   * Creates a new AudioBufferSourceNode, set it's properties and play it.
   * @param {number} offset The time offset
   * @param {number} duration The duration to play
   * @private
   */
  _playNode(offset, duration) {

    // Create a new node
    this._bufferSourceNode = this._context.createBufferSource();

    // Set the buffer, playback rate and loop parameters
    this._bufferSourceNode.buffer = this._buffer;
    this._bufferSourceNode.playbackRate.value = this._rate;
    this._bufferSourceNode.loop = this._loop;
    this._bufferSourceNode.loopStart = this._startPos;
    this._bufferSourceNode.loopEnd = this._endPos;

    // Connect the node to the audio graph.
    this._bufferSourceNode.connect(this._gainNode);

    // Call the supported method to play the sound
    if (typeof this._bufferSourceNode.start !== 'undefined') {
      this._bufferSourceNode.start(this._context.currentTime, offset, duration);
    }
    else {
      this._bufferSourceNode.noteGrainOn(this._context.currentTime, offset, duration);
    }
  }

  /**
   * Called after the playback ends.
   * @private
   */
  _onEnded() {
    if (this._loop) {
      this._fire('playend');

      // Reset the seek positions
      this._seek = this._startPos;
      this._rateSeek = 0;

      // Reset the play start time
      this._startTime = this._context.currentTime;

      // Create a new timer
      let [, duration] = this._getTimeVars();
      this._endTimer = setTimeout(this._onEnded, duration);

      this._fire('playstart');
    } else {
      this._seek = 0;
      this._rateSeek = 0;
      this._clearEndTimer();
      this._cleanNode();
      this._state = BuzzState.Idle;
      this._fire('playend');
    }
  }

  /**
   * Resets the timer. Destroy the buffer source node.
   * @private
   */
  _reset() {
    this._clearEndTimer();
    this._stopNode();
    this._cleanNode();
  }

  /**
   * Clears the play end timer.
   * @private
   */
  _clearEndTimer() {
    if (this._endTimer) {
      clearTimeout(this._endTimer);
      this._endTimer = null;
    }
  }

  /**
   * Get/set the playback rate.
   * @param {number=} rate The playback rate
   * @return {BufferBuzz|number}
   */
  rate(rate) {
    if (typeof rate === 'undefined') {
      return this._rate;
    }

    if (typeof rate !== 'number' || rate < 0 || rate > 5) {
      return this;
    }

    this._rateSeek = this.seek();
    this._startTime = this._context.currentTime;
    this._rate = rate;

    if (this.isPlaying()) {
      this._bufferSourceNode.playbackRate.value = this._rate;
      this._clearEndTimer();
      let [, duration] = this._getTimeVars();
      this._endTimer = setTimeout(this._onEnded, (duration * 1000) / Math.abs(this._rate));
    }

    this._fire('rate', this._rate);
    return this;
  }

  /**
   * Get/set the seek position.
   * @param {number=} seek The seek position
   * @return {BufferBuzz|number}
   */
  seek(seek) {
    if (typeof seek === 'undefined') {
      const realTime = this.isPlaying() ? this._context.currentTime - this._startTime : 0;
      const rateElapsed = this._rateSeek ? this._rateSeek - this._elapsed : 0;

      return this._elapsed + (rateElapsed + realTime * this._rate);
    }

    if (typeof seek !== 'number' || seek < 0) {
      return this;
    }

    if (!this.isLoaded()) {
      this._actionQueue.add('seek', () => this.seek(seek));
      this._load();
      return this;
    }

    if (seek > this._duration) {
      return this;
    }

    const isPlaying = this.isPlaying();
    if (isPlaying) {
      this._pause(false);
    }

    this._elapsed = seek;
    this._fire('seek', seek);

    if (isPlaying) {
      this._play(null, false);
    }

    return this;
  }

  /**
   * Returns the total duration of the sound or the piece of sound in sprite.
   * @param {string=} sound The sound name in the sprite.
   * @return {number}
   */
  spriteDuration(sound) {
    if (typeof sound === 'undefined') {
      return this.duration();
    }

    const times = this._sprite[sound];

    if (!times) {
      return 0;
    }

    return times[1] - times[0];
  }

  /**
   * Stops the playing buffer source node and destroys it.
   * @private
   */
  _stopNode() {
    if (this._bufferSourceNode) {
      if (typeof this._bufferSourceNode.stop !== 'undefined') {
        this._bufferSourceNode.stop();
      }
      else {
        this._bufferSourceNode.noteGrainOff();
      }

      this._cleanNode();
    }
  }

  /**
   * Destroys the buffer source node.
   * @private
   */
  _cleanNode() {
    if (!this._bufferSourceNode) {
      return;
    }

    this._bufferSourceNode.disconnect();
    this._bufferSourceNode.onended = null;

    try {
      this._bufferSourceNode.buffer = buzzer.scratchBuffer();
    }
    catch (e) {
    }

    this._bufferSourceNode = null;
  }

  /**
   * Null the buffer.
   * @private
   */
  _destroy() {
    this._buffer = null;
  }
}

export { BufferBuzz as default };
