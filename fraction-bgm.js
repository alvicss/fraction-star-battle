(function (global) {
  function createFractionBattleBgm(options = {}) {
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    const bpm = options.bpm || 96;
    const volume = options.volume ?? 0.16;
    const beatsPerBar = 4;
    const totalBars = 16;
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * beatsPerBar;
    const loopDuration = barDuration * totalBars;

    let context = null;
    let masterGain = null;
    let musicGain = null;
    let bassGain = null;
    let beatGain = null;
    let lowpass = null;
    let compressor = null;
    let shakerBuffer = null;
    let loopTimer = null;
    let playing = false;
    let muted = false;

    function noteToFrequency(note) {
      const pitchClass = {
        C: 0,
        'C#': 1,
        Db: 1,
        D: 2,
        'D#': 3,
        Eb: 3,
        E: 4,
        F: 5,
        'F#': 6,
        Gb: 6,
        G: 7,
        'G#': 8,
        Ab: 8,
        A: 9,
        'A#': 10,
        Bb: 10,
        B: 11
      };
      const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
      if (!match) {
        throw new Error(`Invalid note: ${note}`);
      }
      const [, pitch, octaveText] = match;
      const octave = Number(octaveText);
      const midi = 12 * (octave + 1) + pitchClass[pitch];
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function createNoiseBuffer() {
      const length = context.sampleRate * 0.12;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        channel[index] = (Math.random() * 2 - 1) * (1 - index / length);
      }
      return buffer;
    }

    function ensureAudioGraph() {
      if (context) {
        return;
      }

      context = new AudioCtx();
      masterGain = context.createGain();
      musicGain = context.createGain();
      bassGain = context.createGain();
      beatGain = context.createGain();
      lowpass = context.createBiquadFilter();
      compressor = context.createDynamicsCompressor();

      lowpass.type = 'lowpass';
      lowpass.frequency.value = 5200;
      lowpass.Q.value = 0.7;

      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 2.2;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.2;

      musicGain.gain.value = 0.7;
      bassGain.gain.value = 0.55;
      beatGain.gain.value = 0.35;
      masterGain.gain.value = muted ? 0 : volume;

      musicGain.connect(lowpass);
      bassGain.connect(lowpass);
      beatGain.connect(lowpass);
      lowpass.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(context.destination);

      shakerBuffer = createNoiseBuffer();
    }

    function scheduleOscillator(bus, waveform, frequency, startTime, duration, peakGain, attack, release) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const filter = context.createBiquadFilter();

      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.max(1200, frequency * 5), startTime);
      filter.Q.value = 0.6;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(bus);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration + release + 0.02);
    }

    function scheduleMelodyNote(note, beat, durationBeats, gain = 0.08) {
      const startTime = context.currentTime + beat * beatDuration;
      const duration = durationBeats * beatDuration;
      const frequency = noteToFrequency(note);

      scheduleOscillator(musicGain, 'triangle', frequency, startTime, duration * 0.82, gain, 0.02, 0.12);
      scheduleOscillator(musicGain, 'sine', frequency * 2, startTime, duration * 0.3, gain * 0.18, 0.01, 0.06);
    }

    function scheduleBassNote(note, beat, durationBeats, gain = 0.07) {
      const startTime = context.currentTime + beat * beatDuration;
      const duration = durationBeats * beatDuration;
      const frequency = noteToFrequency(note);

      scheduleOscillator(bassGain, 'sine', frequency, startTime, duration * 0.92, gain, 0.01, 0.08);
      scheduleOscillator(bassGain, 'triangle', frequency * 0.5, startTime, duration * 0.9, gain * 0.25, 0.01, 0.08);
    }

    function schedulePad(notes, barIndex, gain = 0.026) {
      const startTime = context.currentTime + barIndex * barDuration;
      const holdDuration = barDuration * 0.96;
      notes.forEach((note) => {
        scheduleOscillator(musicGain, 'triangle', noteToFrequency(note), startTime, holdDuration, gain, 0.08, 0.16);
      });
    }

    function scheduleKick(beat, gain = 0.05) {
      const startTime = context.currentTime + beat * beatDuration;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(110, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(48, startTime + 0.08);

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);

      oscillator.connect(gainNode);
      gainNode.connect(beatGain);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.14);
    }

    function scheduleShaker(beat, gain = 0.014) {
      const startTime = context.currentTime + beat * beatDuration;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gainNode = context.createGain();

      source.buffer = shakerBuffer;

      filter.type = 'highpass';
      filter.frequency.value = 4200;
      filter.Q.value = 0.7;

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(beatGain);

      source.start(startTime);
      source.stop(startTime + 0.09);
    }

    function addBarMelody(barIndex, events) {
      const baseBeat = barIndex * beatsPerBar;
      events.forEach(([offset, note, duration, gain]) => {
        scheduleMelodyNote(note, baseBeat + offset, duration, gain);
      });
    }

    function addBarBass(barIndex, root, fifth) {
      const baseBeat = barIndex * beatsPerBar;
      scheduleBassNote(root, baseBeat, 1.75, 0.06);
      scheduleBassNote(fifth, baseBeat + 2, 1.5, 0.05);
    }

    function scheduleSection() {
      const chords = [
        ['C4', 'E4', 'G4'],
        ['G3', 'B3', 'D4'],
        ['A3', 'C4', 'E4'],
        ['E3', 'G3', 'B3'],
        ['F3', 'A3', 'C4'],
        ['C4', 'E4', 'G4'],
        ['D3', 'F3', 'A3'],
        ['G3', 'B3', 'D4'],
        ['C4', 'E4', 'G4'],
        ['A3', 'C4', 'E4'],
        ['F3', 'A3', 'C4'],
        ['G3', 'B3', 'D4'],
        ['A3', 'C4', 'E4'],
        ['G3', 'B3', 'D4'],
        ['F3', 'A3', 'C4'],
        ['G3', 'B3', 'D4']
      ];

      const bassRoots = [
        ['C3', 'G2'],
        ['G2', 'D3'],
        ['A2', 'E3'],
        ['E2', 'B2'],
        ['F2', 'C3'],
        ['C3', 'G2'],
        ['D2', 'A2'],
        ['G2', 'D3'],
        ['C3', 'G2'],
        ['A2', 'E3'],
        ['F2', 'C3'],
        ['G2', 'D3'],
        ['A2', 'E3'],
        ['G2', 'D3'],
        ['F2', 'C3'],
        ['G2', 'D3']
      ];

      const melodies = [
        [[0, 'C5', 0.5], [0.5, 'E5', 0.5], [1, 'G5', 1], [2, 'E5', 0.5], [2.5, 'D5', 0.5], [3, 'C5', 1.0]],
        [[0, 'D5', 0.5], [0.5, 'F5', 0.5], [1, 'A5', 1], [2, 'F5', 0.5], [2.5, 'E5', 0.5], [3, 'D5', 1.0]],
        [[0, 'E5', 0.5], [0.5, 'G5', 0.5], [1, 'A5', 0.5], [1.5, 'G5', 0.5], [2, 'E5', 0.5], [2.5, 'D5', 0.5], [3, 'C5', 1.0]],
        [[0, 'G4', 0.5], [0.5, 'B4', 0.5], [1, 'D5', 1], [2, 'C5', 0.5], [2.5, 'B4', 0.5], [3, 'A4', 1.0]],
        [[0, 'A4', 0.5], [0.5, 'C5', 0.5], [1, 'F5', 1], [2, 'E5', 0.5], [2.5, 'C5', 0.5], [3, 'A4', 1.0]],
        [[0, 'G4', 0.5], [0.5, 'C5', 0.5], [1, 'E5', 1], [2, 'D5', 0.5], [2.5, 'C5', 0.5], [3, 'G4', 1.0]],
        [[0, 'A4', 0.5], [0.5, 'D5', 0.5], [1, 'F5', 1], [2, 'E5', 0.5], [2.5, 'D5', 0.5], [3, 'A4', 1.0]],
        [[0, 'B4', 0.5], [0.5, 'D5', 0.5], [1, 'G5', 1], [2, 'F5', 0.5], [2.5, 'E5', 0.5], [3, 'D5', 1.0]],
        [[0, 'C5', 0.5], [0.5, 'E5', 0.5], [1, 'G5', 0.5], [1.5, 'A5', 0.5], [2, 'G5', 0.5], [2.5, 'E5', 0.5], [3, 'C5', 1.0]],
        [[0, 'A4', 0.5], [0.5, 'C5', 0.5], [1, 'E5', 1], [2, 'C5', 0.5], [2.5, 'B4', 0.5], [3, 'A4', 1.0]],
        [[0, 'F4', 0.5], [0.5, 'A4', 0.5], [1, 'C5', 1], [2, 'A4', 0.5], [2.5, 'G4', 0.5], [3, 'F4', 1.0]],
        [[0, 'G4', 0.5], [0.5, 'B4', 0.5], [1, 'D5', 1], [2, 'B4', 0.5], [2.5, 'A4', 0.5], [3, 'G4', 1.0]],
        [[0, 'A4', 0.5], [0.5, 'C5', 0.5], [1, 'E5', 0.5], [1.5, 'G5', 0.5], [2, 'E5', 0.5], [2.5, 'C5', 0.5], [3, 'A4', 1.0]],
        [[0, 'G4', 0.5], [0.5, 'B4', 0.5], [1, 'D5', 0.5], [1.5, 'G5', 0.5], [2, 'D5', 0.5], [2.5, 'B4', 0.5], [3, 'G4', 1.0]],
        [[0, 'F4', 0.5], [0.5, 'A4', 0.5], [1, 'C5', 1], [2, 'A4', 0.5], [2.5, 'G4', 0.5], [3, 'E4', 1.0]],
        [[0, 'G4', 0.5], [0.5, 'B4', 0.5], [1, 'D5', 0.75], [1.75, 'G5', 0.25], [2, 'D5', 0.5], [2.5, 'B4', 0.5], [3, 'G4', 1.0]]
      ];

      for (let barIndex = 0; barIndex < totalBars; barIndex += 1) {
        schedulePad(chords[barIndex], barIndex, barIndex >= 8 ? 0.03 : 0.024);
        addBarBass(barIndex, bassRoots[barIndex][0], bassRoots[barIndex][1]);
        addBarMelody(barIndex, melodies[barIndex]);
      }

      for (let beat = 0; beat < totalBars * beatsPerBar; beat += 1) {
        const inBarBeat = beat % 4;
        if (inBarBeat === 0 || inBarBeat === 2) {
          scheduleKick(beat, beat >= 32 ? 0.055 : 0.045);
        }
      }

      for (let beat = 0.5; beat < totalBars * beatsPerBar; beat += 0.5) {
        scheduleShaker(beat, beat >= 32 ? 0.016 : 0.012);
      }
    }

    function queueLoop() {
      if (!playing) {
        return;
      }
      scheduleSection();
      loopTimer = global.setTimeout(queueLoop, Math.max(250, (loopDuration - 0.3) * 1000));
    }

    async function start() {
      ensureAudioGraph();
      if (playing) {
        return;
      }
      if (context.state === 'suspended') {
        await context.resume();
      }
      playing = true;
      queueLoop();
    }

    async function stop() {
      playing = false;
      if (loopTimer) {
        global.clearTimeout(loopTimer);
        loopTimer = null;
      }
      if (!context) {
        return;
      }
      const activeContext = context;
      const activeMaster = masterGain;
      context = null;
      masterGain = null;
      musicGain = null;
      bassGain = null;
      beatGain = null;
      lowpass = null;
      compressor = null;
      shakerBuffer = null;
      activeMaster.gain.cancelScheduledValues(activeContext.currentTime);
      activeMaster.gain.setValueAtTime(activeMaster.gain.value, activeContext.currentTime);
      activeMaster.gain.exponentialRampToValueAtTime(0.0001, activeContext.currentTime + 0.15);
      global.setTimeout(() => {
        activeContext.close().catch(() => {});
      }, 180);
    }

    function setMuted(nextMuted) {
      muted = Boolean(nextMuted);
      if (masterGain && context) {
        const target = muted ? 0 : volume;
        masterGain.gain.cancelScheduledValues(context.currentTime);
        masterGain.gain.setTargetAtTime(target, context.currentTime, 0.05);
      }
    }

    async function toggle() {
      if (playing) {
        await stop();
        return false;
      }
      await start();
      return true;
    }

    function isPlaying() {
      return playing;
    }

    return {
      start,
      stop,
      toggle,
      setMuted,
      isPlaying,
      get bpm() {
        return bpm;
      },
      get loopDuration() {
        return loopDuration;
      }
    };
  }

  global.createFractionBattleBgm = createFractionBattleBgm;
})(window);
