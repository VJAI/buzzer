import BufferLoader from './BufferLoader';
import MediaLoader  from './MediaLoader';
import emitter      from './Emitter';
import Queue        from './Queue';
import utility      from './Utility';
import Sound        from './Sound';

/**
 * Enum that represents the different type of errors thrown by Engine and Buzzes.
 * @enum {string}
 */
const ErrorType = {
  NoAudio: 'no-audio',
  LoadError: 'load',
  PlayError: 'play',
  EngineError: 'engine'
};

/**
 * Represents the different states of the audio engine.
 * @enum {string}
 */
const EngineState = {
  NotReady: 'notready',
  Ready: 'ready',
  Suspending: 'suspending',
  Suspended: 'suspended',
  Resuming: 'resuming',
  Destroying: 'destroying',
  Done: 'done',
  NoAudio: 'no-audio'
};

/**
 * Enum that represents the different events by engine.
 * @enum {string}
 */
const EngineEvents = {
  Volume: 'volume',
  Mute: 'mute',
  Stop: 'stop',
  Suspend: 'suspend',
  Resume: 'resume',
  Error: 'error',
  Done: 'done'
};

/**
 * Array of event names.
 * @type {string[]}
 */
const userInputEventNames = [
  'click',
  'contextmenu',
  'auxclick',
  'dblclick',
  'mousedown',
  'mouseup',
  'pointerup',
  'touchend',
  'keydown',
  'keyup'
];

/**
 * The audio engine that orchestrates all the sounds.
 * @class
 */
class Engine {

  /**
   * Unique id of the engine.
   * @type {number}
   * @private
   */
  _id = utility.id();

  /**
   * Represents whether the audio engine is currently muted or not.
   * @type {boolean}
   * @private
   */
  _muted = false;

  /**
   * Represents the global volume.
   * @type {number}
   * @private
   */
  _volume = 1.0;

  /**
   * Maximum number of HTML5 audio objects allowed for a url.
   * @type {number}
   * @private
   */
  _maxNodesPerSource = 10;

  /**
   * The inactive sounds clean-up period.
   * @type {number}
   * @private
   */
  _cleanUpInterval = 5;

  /**
   * Inactive time of sound.
   * @type {number}
   * @private
   */
  _inactiveTime = 2;

  /**
   * Auto-enables audio in first user interaction.
   * @type {boolean}
   * @private
   */
  _autoEnable = true;

  /**
   * The clean-up interval id.
   * @type {number|null}
   * @private
   */
  _intervalId = null;

  /**
   * True if Web Audio API is available.
   * @type {boolean}
   * @private
   */
  _isAudioAvailable = false;

  /**
   * Represents the current state of the engine.
   * @type {EngineState}
   * @private
   */
  _state = EngineState.NotReady;

  /**
   * The Web Audio API's audio context.
   * @type {AudioContext}
   * @private
   */
  _context = null;

  /**
   * The master gain node.
   * @type {GainNode}
   * @private
   */
  _gainNode = null;

  /**
   * The action queue.
   * @type {Queue}
   * @private
   */
  _queue = null;

  /**
   * Array of buzzes.
   * @type {Array<Buzz>}
   * @private
   */
  _buzzesArray = [];

  /**
   * Array of sounds created directly by engine.
   * @type {Array<Sound>}
   * @private
   */
  _soundsArray = [];

  /**
   * Loader - the component that loads audio buffers with audio data.
   * @type {BufferLoader}
   * @private
   */
  _bufferLoader = null;

  /**
   * MediaLoader - the component that loads HTML5 audio nodes with audio.
   * @type {MediaLoader}
   * @private
   */
  _mediaLoader = null;

  /**
   * Instantiates the action queue.
   * @constructor
   */
  constructor() {
    this._queue = new Queue();
    this._resumeAndRemoveListeners = this._resumeAndRemoveListeners.bind(this);
    this.free = this.free.bind(this);
  }

  /**
   * Instantiate the audio context and other dependencies.
   * @param {object} [args] Input parameters object.
   * @param {number} [args.volume = 1.0] The global volume of the sound engine.
   * @param {boolean} [args.muted = false] Stay muted initially or not.
   * @param {number} [args.maxNodesPerSource = 10] Maximum number of HTML5 audio objects allowed for a url.
   * @param {number} [args.cleanUpInterval = 5] The sounds garbage collection interval period in minutes.
   * @param {boolean} [args.autoEnable = true] Auto-enables audio in first user interaction.
   * @param {function} [args.onstop] Event-handler for the "stop" event.
   * @param {function} [args.onmute] Event-handler for the "mute" event.
   * @param {function} [args.onvolume] Event-handler for the "volume" event.
   * @param {function} [args.onsuspend] Event-handler for the "suspend" event.
   * @param {function} [args.onresume] Event-handler for the "resume" event.
   * @param {function} [args.onerror] Event-handler for the "error" event.
   * @param {function} [args.ondone] Event-handler for the "done" event.
   * @return {Engine}
   */
  setup(args) {
    // If the setup is already done return.
    if (this._state !== EngineState.NotReady) {
      return this;
    }

    this._context = utility.getContext();

    // Determine the audio stuff available in the current platform and set the flags accordingly.
    this._isAudioAvailable = Boolean(this._context);

    // If no Web Audio and HTML5 audio is available fire an error event.
    if (!this._isAudioAvailable) {
      this._state = EngineState.NoAudio;
      this._fire(EngineEvents.Error, { type: ErrorType.NoAudio, error: 'Web Audio API is not available' });
      return this;
    }

    // Read the input parameters from the options.
    const {
      volume,
      muted,
      maxNodesPerSource,
      cleanUpInterval,
      autoEnable,
      onstop,
      onmute,
      onvolume,
      onsuspend,
      onresume,
      onerror,
      ondone
    } = args || {};

    // Set the properties from the read parameters.
    typeof volume === 'number' && volume >= 0 && volume <= 1.0 && (this._volume = volume);
    typeof muted === 'boolean' && (this._muted = muted);
    typeof maxNodesPerSource === 'number' && (this._maxNodesPerSource = maxNodesPerSource);
    typeof cleanUpInterval === 'number' && (this._cleanUpInterval = cleanUpInterval);
    typeof autoEnable === 'boolean' && (this._autoEnable = autoEnable);
    typeof onstop === 'function' && this.on(EngineEvents.Stop, onstop);
    typeof onmute === 'function' && this.on(EngineEvents.Mute, onmute);
    typeof onvolume === 'function' && this.on(EngineEvents.Volume, onvolume);
    typeof onsuspend === 'function' && this.on(EngineEvents.Suspend, onsuspend);
    typeof onresume === 'function' && this.on(EngineEvents.Resume, onresume);
    typeof onerror === 'function' && this.on(EngineEvents.Error, onerror);
    typeof ondone === 'function' && this.on(EngineEvents.Done, ondone);

    // Create the buffer loader.
    this._bufferLoader = new BufferLoader(this._context);

    // Create the media loader.
    this._mediaLoader = new MediaLoader(this._maxNodesPerSource, (src) => {
      this._buzzesArray.forEach(buzz => buzz.getCompatibleSource() === src && buzz.free());
    });

    // Auto-enable audio in first user interaction.
    // https://developers.google.com/web/updates/2018/11/web-audio-autoplay#moving-forward
    if (this._autoEnable && this._context.state === 'suspended') {
      userInputEventNames.forEach(eventName => document.addEventListener(eventName, this._resumeAndRemoveListeners));
    }

    // Create the audio graph.
    this._gainNode = this._context.createGain();
    this._gainNode.gain.setValueAtTime(this._muted ? 0 : this._volume, this._context.currentTime);
    this._gainNode.connect(this._context.destination);

    this._intervalId = window.setInterval(this.free, this._cleanUpInterval * 60 * 1000);

    this._state = this._context.state !== 'suspended' ? EngineState.Ready : EngineState.Suspended;

    return this;
  }

  /**
   * Creates and returns sound based on the passed arguments.
   * @param {object} soundArgs The sound arguments.
   * @return {Sound}
   */
  create(soundArgs) {
    const sound = new Sound(soundArgs);
    this._soundsArray.push(sound);
    return sound;
  }

  /**
   * Plays the sound belongs to the passed id or creates a new sound and play it.
   * @param {number|string|object} idOrSoundArgs The sound id or sound arguments.
   */
  play(idOrSoundArgs) {
    if (typeof idOrSoundArgs === 'number') {
      const sound = this.sound(idOrSoundArgs);
      sound && sound.play();
      return this;
    }


  }

  /**
   * Pauses the sound.
   * @param {number} id The sound id.
   * @return {Engine}
   */
  pause(id) {
    const sound = this.sound(id);
    sound && sound.pause();
    return this;
  }

  /**
   * Stops all the currently playing sounds.
   * @param {number} [id] The sound id.
   * @return {Engine}
   */
  stop(id) {
    // TODO: Need to fire event?
    if (typeof id === 'number') {
      const sound = this.sound(id);
      sound && sound.stop();
      return this;
    }

    // Stop all the sounds.
    this.buzzes().forEach(buzz => buzz.stop());

    // Fire the "stop" event.
    this._fire(EngineEvents.Stop);

    return this;
  }

  /**
   * Mutes the engine.
   * @param {number} [id] The sound id.
   * @return {Engine}
   */
  mute(id) {
    // TODO: Need to fire event?
    if (typeof id === 'number') {
      const sound = this.sound(id);
      sound && sound.mute();
      return this;
    }

    // If the engine is already muted return.
    if (this._muted) {
      return this;
    }

    // Set the value of gain node to 0.
    this._gainNode.gain.setValueAtTime(0, this._context.currentTime);

    // Set the muted property true.
    this._muted = true;

    // Fire the "mute" event.
    this._fire(EngineEvents.Mute, this._muted);

    return this;
  }

  /**
   * Un-mutes the engine.
   * @param {number} [id] The sound id.
   * @return {Engine}
   */
  unmute(id) {
    // TODO: Need to fire event?
    if (typeof id === 'number') {
      const sound = this.sound(id);
      sound && sound.unmute();
      return this;
    }

    // If the engine is not muted return.
    if (!this._muted) {
      return this;
    }

    // Reset the gain node's value back to volume.
    this._gainNode.gain.setValueAtTime(this._volume, this._context.currentTime);

    // Set the muted property to false.
    this._muted = false;

    // Fire the "mute" event.
    this._fire(EngineEvents.Mute, this._muted);

    return this;
  }

  /**
   * Gets/sets the volume for the audio engine that controls global volume for all sounds.
   * @param {number} [vol] Should be within 0.0 to 1.0.
   * @param {number} [id] The sound id.
   * @return {Engine|number}
   */
  volume(vol, id) {
    // If no parameter is passed then return the current volume.
    if (vol === undefined) {
      return this._volume;
    }

    // If passed volume is not an acceptable value return.
    if (typeof vol !== 'number' || vol < 0 || vol > 1.0) {
      return this;
    }

    // Set the gain's value to the passed volume.
    this._gainNode.gain.setValueAtTime(this._muted ? 0 : vol, this._context.currentTime);

    // Set the volume to the property.
    this._volume = vol;

    // Fire the "volume" event.
    this._fire(EngineEvents.Volume, this._volume);

    return this;
  }

  /**
   * Stops all the playing sounds and suspends the audio context immediately.
   * @return {Engine}
   */
  suspend() {
    // If the context is resuming then suspend after resumed.
    if (this._state === EngineState.Resuming) {
      this._queue.add('after-resume', 'suspend', () => this.suspend());
      return this;
    }

    // If the state is not ready return.
    if (this._state !== EngineState.Ready) {
      return this;
    }

    // Stop all the playing sounds.
    this.stop();

    // Set the state to suspending.
    this._state = EngineState.Suspending;

    // Suspend the Audio Context.
    this._context.suspend().then(() => {
      this._state = EngineState.Suspended;
      this._queue.run('after-suspend');
      this._fire(EngineEvents.Suspend);
    });

    return this;
  }

  /**
   * Resumes the audio context from the suspended mode.
   * @return {Engine}
   */
  resume() {
    // If the context is suspending then resume after suspended.
    if (this._state === EngineState.Suspending) {
      this._queue.add('after-suspend', 'resume', () => this.resume());
      return this;
    }

    if (this._state !== EngineState.Suspended) {
      return this;
    }

    this._state = EngineState.Resuming;

    this._context.resume().then(() => {
      this._state = EngineState.Ready;
      this._queue.run('after-resume');
      this._fire(EngineEvents.Resume);
    });

    return this;
  }

  /**
   * Shuts down the engine.
   * @return {Engine}
   */
  terminate() {
    if (this._state === EngineState.Done || this._state === EngineState.Destroying) {
      return this;
    }

    const cleanUp = () => {
      // Un-listen from user input events.
      userInputEventNames.forEach(eventName => document.addEventListener(eventName, this._resumeAndRemoveListeners));

      // Stop the timer.
      this._intervalId && window.clearInterval(this._intervalId);
      this._intervalId = null;

      // Destroy all the buzzes.
      this._buzzesArray.forEach(buzz => buzz.destroy());

      // Clear the cache and remove the loader.
      if (this._bufferLoader) {
        this._bufferLoader.dispose();
        this._bufferLoader = null;
      }

      // Dispose the MediaLoader.
      if (this._mediaLoader) {
        this._mediaLoader.dispose();
        this._mediaLoader = null;
      }

      this._buzzesArray = [];
      this._context = null;
      this._queue.clear();
      this._queue = null;
      this._state = EngineState.Done;

      // Fire the "done" event.
      this._fire(EngineEvents.Done);

      emitter.clear(this._id);
    };

    // Close the context.
    if (this._context) {
      if (this._state === EngineState.Suspending) {
        this._queue.remove('after-suspend');
        this._queue.add('after-suspend', 'destroy', () => this.terminate());
        return this;
      } else if (this._state === EngineState.Resuming) {
        this._queue.remove('after-resume');
        this._queue.add('after-resume', 'destroy', () => this.terminate());
        return this;
      }

      this._state = EngineState.Destroying;
      this._context && this._context.close().then(() => cleanUp());
    } else {
      this._state = EngineState.Destroying;
      cleanUp();
    }

    return this;
  }

  /**
   * Loads single or multiple audio resources into audio buffers and returns them.
   * @param {string|string[]} urls Single or array of audio urls.
   * @param {function} [progressCallback] The callback that is called to intimate the percentage downloaded.
   * @return {Promise}
   */
  load(urls, progressCallback) {
    return this._bufferLoader.load(urls, progressCallback);
  }

  /**
   * Loads HTML5 audio nodes for the passed urls.
   * @param {string|string[]} urls Single or array of audio urls.
   * @return {Promise<DownloadResult|Array<DownloadResult>>}
   */
  loadMedia(urls) {
    return this._mediaLoader.load(urls);
  }

  /**
   * Stores the buzz in the internal collection.
   * @param {Buzz} buzz The newly created buzz.
   * @return {Engine}
   */
  add(buzz) {
    if (this._buzzesArray.indexOf(buzz) > -1) {
      return this;
    }

    this._buzzesArray.push(buzz);

    return this;
  }

  /**
   * Removes the stored buzz from the internal collection.
   * @param {Buzz} buzz The buzz.
   * @return {Engine}
   */
  remove(buzz) {
    this._buzzesArray.splice(this._buzzesArray.indexOf(buzz), 1);
    return this;
  }

  /**
   * Loads audio node for group.
   * @param {string} url The audio file url.
   * @param {number} groupId The group id.
   * @return {Promise<DownloadResult>}
   */
  allocateForGroup(url, groupId) {
    return this._mediaLoader.allocateForGroup(url, groupId);
  }

  /**
   * Allocates an audio node for sound and returns it.
   * @param {string} src The audio file url.
   * @param {number} groupId The buzz id.
   * @param {number} soundId The sound id.
   * @return {Audio}
   */
  allocateForSound(src, groupId, soundId) {
    return this._mediaLoader.allocateForSound(src, groupId, soundId);
  }

  /**
   * Unloads single or multiple loaded audio buffers from cache.
   * @param {string|string[]} [urls] Single or array of audio urls.
   * @return {Engine}
   */
  unload(urls) {
    if (urls) {
      this._bufferLoader.unload(urls);
      return this;
    }

    this._bufferLoader.unload();

    return this;
  }

  /**
   * Releases audio nodes allocated for the passed urls.
   * @param {string|string[]} [urls] Single or array of audio urls.
   * @return {Engine}
   */
  unloadMedia(urls) {
    if (urls) {
      this._mediaLoader.unload(urls);
      return this;
    }

    this._mediaLoader.unload();

    return this;
  }

  /**
   * Releases the allocated audio nodes for the group.
   * @param {string} url The audio file url.
   * @param {number} groupId The group id.
   * @return {Engine}
   */
  releaseForGroup(url, groupId) {
    this._mediaLoader.releaseForGroup(url, groupId);
    return this;
  }

  /**
   * Returns if there are free audio nodes available for a group.
   * @param {string} src The audio file url.
   * @param {number} groupId The group id.
   * @return {boolean}
   */
  hasFreeNodes(src, groupId) {
    return this._mediaLoader.hasFreeNodes(src, groupId);
  }

  /**
   * Subscribes to an event.
   * @param {string} eventName Name of the event.
   * @param {function} handler The event-handler function.
   * @param {boolean} [once = false] Is it one-time subscription or not.
   * @return {Engine}
   */
  on(eventName, handler, once = false) {
    emitter.on(this._id, eventName, handler, once);
    return this;
  }

  /**
   * Un-subscribes from an event.
   * @param {string} eventName The event name.
   * @param {function} [handler] The handler function.
   * @return {Engine}
   */
  off(eventName, handler) {
    emitter.off(this._id, eventName, handler);
    return this;
  }

  /**
   * Removes the inactive sounds.
   * @return {Engine}
   */
  free() {
    this._buzzesArray.forEach(buzz => buzz.free());
    this._mediaLoader.cleanUp();
    return this;
  }

  /**
   * Returns whether the engine is currently muted or not.
   * @return {boolean}
   */
  muted() {
    return this._muted;
  }

  /**
   * Returns the state of the engine.
   * @return {EngineState}
   */
  state() {
    return this._state;
  }

  /**
   * Returns the created audio context.
   * @return {AudioContext}
   */
  context() {
    return this._context;
  }

  /**
   * Returns the master gain node.
   * @return {GainNode}
   */
  masterGain() {
    return this._gainNode;
  }

  /**
   * Returns true if Web Audio API is available.
   * @return {boolean}
   */
  isAudioAvailable() {
    return this._isAudioAvailable;
  }

  /**
   * Returns the buffer loader.
   * @return {BufferLoader}
   */
  bufferLoader() {
    return this._bufferLoader;
  }

  /**
   * Returns the HTML5 media loader.
   * @return {MediaLoader}
   */
  mediaLoader() {
    return this._mediaLoader;
  }

  /**
   * Returns the buzz for the passed id.
   * @param {number} id The buzz id.
   * @return {Buzz}
   */
  buzz(id) {
    return this._buzzesArray.find(x => x.id() === id);
  }

  /**
   * Returns all the buzzes.
   * @return {Array<Buzz>}
   */
  buzzes() {
    return this._buzzesArray;
  }

  /**
   * Returns the sound for the passed id.
   * @param {number} id The sound id.
   * @return {Sound}
   */
  sound(id) {
    return this._soundsArray.find(x => x.id() === id);
  }

  /**
   * Returns all the sounds.
   * @return {Array<Sound>}
   */
  sounds() {
    return this._soundsArray;
  }

  /**
   * Returns in active time.
   * @return {number}
   */
  inactiveTime() {
    return this._inactiveTime;
  }

  /**
   * Fires an event of engine.
   * @param {string} eventName The event name.
   * @param {...*} args The arguments that to be passed to handler.
   * @return {Engine}
   * @private
   */
  _fire(eventName, ...args) {
    emitter.fire(this._id, eventName, ...args, this);
    return this;
  }

  /**
   * Resume the context and un-listen from user input events.
   * @private
   */
  _resumeAndRemoveListeners() {
    this.resume();
    userInputEventNames.forEach(eventName => document.addEventListener(eventName, this._resumeAndRemoveListeners));
  }
}

const engine = new Engine();
export { engine as default, EngineState, EngineEvents, ErrorType };
