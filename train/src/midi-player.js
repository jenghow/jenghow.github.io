function parseMidi(data, bpm) {
  const u = new Uint8Array(data);
  let pos = 0;
  const read = (n) => { const v = u.slice(pos, pos + n); pos += n; return v; };
  const read32 = () => (u[pos++] << 24) | (u[pos++] << 16) | (u[pos++] << 8) | u[pos++];
  const read16 = () => (u[pos++] << 8) | u[pos++];
  const readVLQ = () => { let v = 0, b; do { b = u[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  if (String.fromCharCode(...read(4)) !== 'MThd') throw new Error('Not a MIDI file');
  const hdrLen = read32();
  if (hdrLen < 6) throw new Error('Bad header');
  const fmt = read16(), nTracks = read16(), division = read16();
  if (hdrLen > 6) pos += hdrLen - 6;

  let tempo = 500000;
  const ticksPerBeat = division & 0x8000 ? ((division & 0x7f00) >> 8) * (division & 0xff) : division;
  const trackEvents = [];

  for (let t = 0; t < nTracks; t++) {
    if (String.fromCharCode(...read(4)) !== 'MTrk') break;
    const trackLen = read32();
    const end = pos + trackLen;
    let absTicks = 0;
    let lastStatus = 0;

    while (pos < end) {
      absTicks += readVLQ();
      let status = u[pos];
      if (status >= 0x80) { lastStatus = status; pos++; }
      else status = lastStatus;

      const type = status >> 4;
      const chan = status & 0x0f;

      if (type === 0x8 || (type === 0x9 && u[pos + 1] === 0)) {
        const note = u[pos]; const vel = u[pos + 1];
        pos += 2;
        trackEvents.push({ tick: absTicks, type: 'off', note, chan });
      } else if (type === 0x9) {
        const note = u[pos]; const vel = u[pos + 1];
        pos += 2;
        trackEvents.push({ tick: absTicks, type: 'on', note, vel, chan });
      } else if (status === 0xff) {
        const metaType = u[pos++]; const len = readVLQ();
        if (metaType === 0x51 && len >= 3) tempo = (u[pos] << 16) | (u[pos + 1] << 8) | u[pos + 2];
        pos += len;
      } else if (status === 0xf0 || status === 0xf7) {
        pos += readVLQ();
      } else {
        if (type === 0xa || type === 0xb || type === 0xe) pos += 2;
        else if (type === 0xc || type === 0xd) pos += 1;
        else pos += 1;
      }
    }
  }

  if (bpm > 0) tempo = 60000000 / bpm;
  const tickToSec = tempo / (ticksPerBeat * 1e6);
  const notes = [];
  const active = {};

  for (const e of trackEvents) {
    const t = e.tick * tickToSec;
    if (e.type === 'on') {
      if (!active[e.note]) active[e.note] = [];
      active[e.note].push({ start: t, vel: e.vel });
    } else {
      const stack = active[e.note];
      if (stack && stack.length) {
        const n = stack.pop();
        n.end = t;
        notes.push({ note: e.note, vel: n.vel, start: n.start, end: t });
      }
    }
  }

  for (const k in active) {
    for (const n of active[k]) {
      n.end = n.start + 0.4;
      notes.push({ note: +k, vel: n.vel, start: n.start, end: n.end });
    }
  }

  notes.sort((a, b) => a.start - b.start);
  return notes;
}

export class MidiPlayer {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.looping = false;
    this.notes = [];
    this.duration = 0;
    this.position = 0;
    this.nextIdx = 0;
    this._timer = null;
    this._playStart = 0;
    this.onPlayChange = null;
  }

  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const buf = await res.arrayBuffer();
    this.notes = parseMidi(buf, 60);
    this.duration = this.notes.reduce((m, n) => Math.max(m, n.end), 0);
  }

  play() {
    if (this.playing) return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.playing = true;
    this._playStart = this.ctx.currentTime;
    this.nextIdx = this.notes.findIndex(n => n.start >= this.position);
    if (this.nextIdx === -1) this.nextIdx = this.notes.length;
    this._tick();
    if (this.onPlayChange) this.onPlayChange(true);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this._timer);
    this.position += this.ctx.currentTime - this._playStart;
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
    if (this.onPlayChange) this.onPlayChange(false);
  }

  toggleLoop() {
    this.looping = !this.looping;
    return this.looping;
  }

  get elapsed() {
    return this.playing
      ? this.position + this.ctx.currentTime - this._playStart
      : this.position;
  }

  _tick() {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    const elapsed = this.position + now - this._playStart;

    while (this.nextIdx < this.notes.length) {
      const n = this.notes[this.nextIdx];
      if (n.start > elapsed) break;
      this._playNote(n, now - elapsed + n.start);
      this.nextIdx++;
    }

    if (this.nextIdx >= this.notes.length) {
      const wait = Math.max(0, (this.duration - (this.position + now - this._playStart) + 0.5) * 1000);
      this._timer = setTimeout(() => {
        this.playing = false;
        if (this.looping) {
          this.position = 0;
          this.play();
        } else {
          this.position = 0;
          if (this.onPlayChange) this.onPlayChange(false);
        }
      }, wait);
      return;
    }

    this._timer = setTimeout(() => this._tick(), 40);
  }

  _playNote(n, delay) {
    const t = this.ctx.currentTime + Math.max(0, delay);
    const freq = 440 * Math.pow(2, (n.note - 69) / 12);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const vel = Math.min(n.vel / 127 * 0.22, 0.22);
    const dur = n.end - n.start;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vel, t + 0.006);
    gain.gain.setValueAtTime(vel, t + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }
}
