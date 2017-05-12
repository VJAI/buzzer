import BaseBuzz, { BuzzState } from './BaseBuzz';
import buzzer from './Buzzer';

/**
 * Employs the native HTML5 audio element for playing sounds.
 * @class
 */
class MediaBuzz extends BaseBuzz {

  /**
   * The HTML5 Audio element.
   * @type {Audio}
   * @private
   */
  _audio = null;

  /**
   * Web Audio API's MediaElementAudioSourceNode
   * @type {MediaElementAudioSourceNode}
   * @private
   */
  _mediaElementAudioSourceNode = null;

  /**
   * Loads the audio node.
   * @return {Promise<DownloadResult>}
   * @private
   */
  _load() {
    return buzzer.loadMedia(this._compatibleSrc, this._id);
  }

  /**
   * Create the gain node and set it's gain value.
   * @protected
   */
  _createGainNode() {
    if (buzzer.isMediaSourceAvailable()) {
      this._gainNode = this._context.createGain();
      this._gainNode.gain.value = this._muted ? 0 : this._volume;
    }
  }

  /**
   * Set the pre-loaded HTML5 Audio element and the duration to the properties.
   * @param {DownloadResult} downloadResult The download result returned by the loader.
   * @private
   */
  _save(downloadResult) {
    this._audio = downloadResult.value;
    this._duration = this._audio.duration;
  }

  /**
   * Creates a new MediaElementAudioSourceNode passing the audio element if the platform supports it and
   * set the properties of the audio element and play it.
   * @param {function} cb Callback that should be called after the node started playing.
   * @private
   */
  _playNode(cb) {
    if (!this._mediaElementAudioSourceNode && buzzer.isMediaSourceAvailable()) {
      this._mediaElementAudioSourceNode = this._context.createMediaElementSource(this._audio);
      this._mediaElementAudioSourceNode.connect(this._gainNode);
    }

    let [seek] = this._getTimeVars();
    this._audio.currentTime = seek;
    this._audio.muted = this._muted;
    this._audio.volume = buzzer.volume() * this._volume;
    this._audio.playbackRate = this._rate;
    this._audio.play();
    cb();
  }

  /**
   * Callback that is invoked after the playback is ended.
   * @private
   */
  _onEnded() {
    if (this._loop) {
      this._fire('playend');
      this._stop(false).play();
    } else {
      this._stop(false);
      this._state = BuzzState.Idle;
      this._fire('playend');
    }
  }

  /**
   * Pause the audio element.
   * @private
   */
  _handlePause() {
    this._audio && this._audio.pause();
  }

  /**
   * Pause the audio element and resets it's position to 0.
   * @private
   */
  _handleStop() {
    if (this._audio) {
      this._audio.pause();
      this._audio.currentTime = this._startPos || 0;
    }
  }

  /**
   * Mutes the audio element directly if Web Audio API/MediaElementAudioSourceNode is not supported.
   * @private
   */
  _muteNode() {
    if (!this._mediaElementAudioSourceNode && this._audio) {
      this._audio.muted = true;
    }
  }

  /**
   * Un-mutes the audio element directly if Web Audio API/MediaElementAudioSourceNode is not supported.
   * @private
   */
  _unMuteNode() {
    if (!this._mediaElementAudioSourceNode && this._audio) {
      this._audio.muted = buzzer.muted();
    }
  }

  /**
   * Set the volume directly to the audio element if Web Audio API/MediaElementAudioSourceNode is not supported.
   * @param {number} vol Volume
   * @private
   */
  _setVolume(vol) {
    if (!this._mediaElementAudioSourceNode && this._audio) {
      this._audio.volume = buzzer.volume() * vol;
    }
  }

  /**
   * Set the playbackrate for the audio node.
   * @param {number=} rate The playback rate
   * @private
   */
  _setRate(rate) {
    if (this._audio) {
      this._audio.playbackRate.value = rate;
    }
  }

  /**
   * Returns the current position of the playback.
   * @return {number}
   * @private
   */
  _getSeek() {
    return this._audio ? this._audio.currentTime : 0;
  }

  /**
   * Seek the playback to the passed position.
   * @param {number} seek The seek position
   * @param {function} cb The callback function
   * @protected
   */
  _setSeek(seek, cb) {
    let canPlayThroughEventHandled = false;

    const onCanPlayThrough = () => {
      if (canPlayThroughEventHandled) {
        return;
      }

      canPlayThroughEventHandled = true;
      this._audio.removeEventListener('canplaythrough');
      cb();
    };

    this._audio.addEventListener('canplaythrough', onCanPlayThrough);

    this._currentPos = seek;

    if (this._audio.readyState === 4) {
      onCanPlayThrough();
    }
  }

  /**
   * Stops the playing audio element.
   * @private
   */
  _stopNode() {
    this._audio && this._audio.pause();
  }

  /**
   * Relinquish the allocated audio node and clears other objects.
   * @private
   */
  _destroy() {
    buzzer.unloadMedia(this._compatibleSrc, this._id);
    this._audio = null;
    this._mediaElementAudioSourceNode = null;
  }
}

export { MediaBuzz as default };
