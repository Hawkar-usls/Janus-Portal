// JANUS PORTAL R2 — deterministic, provider-agnostic head-and-eye choreography.
// Camera coordinates: heading 0..360° (North), pitch -90..90° (up positive),
// zoom 0..100 (0 = wide). No photograph pixels are required by this module.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const wrapHeading = degrees => ((degrees % 360) + 360) % 360;
export const angularDelta = (from, to) => ((to - from + 540) % 360) - 180;
export const easeHead = t => {
  const x = clamp(t, 0, 1);
  // Smooth acceleration/deceleration instead of a robotic constant angular speed.
  return x * x * x * (x * (6 * x - 15) + 10);
};
export function normalizePose(pose = {}) {
  return {
    heading: wrapHeading(Number.isFinite(pose.heading) ? pose.heading : 0),
    pitch: clamp(Number.isFinite(pose.pitch) ? pose.pitch : 0, -48, 48),
    zoom: clamp(Number.isFinite(pose.zoom) ? pose.zoom : 0, 0, 75)
  };
}
export function interpolatePose(from, to, fraction) {
  const t = easeHead(fraction);
  return normalizePose({
    heading: from.heading + angularDelta(from.heading, to.heading) * t,
    pitch: from.pitch + (to.pitch - from.pitch) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t
  });
}
const value = (random, min, max) => min + clamp(random(), 0, .9999999999) * (max - min);

export function buildGazePlan({
  start = {heading: 0, pitch: 0, zoom: 0}, baseSeconds = 16,
  focusPoints = [], random = Math.random, gentle = false, reducedMotion = false
} = {}) {
  const points = focusPoints
    .filter(p => Number.isFinite(p.heading) && Number.isFinite(p.pitch) && Number.isFinite(p.score))
    .filter(p => p.score >= .35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  // More actual observations => longer visits. Short unremarkable views
  // finish sooner. Randomness is bounded, so sessions remain predictable.
  const attention = points.reduce((sum, p) => sum + clamp(p.score, 0, 1), 0);
  const seconds = clamp(
    baseSeconds * value(random, .77, 1.35) + attention * value(random, 3.0, 5.2),
    5, 100
  );
  const totalMs = Math.round(seconds * 1000);
  const steps = [];
  let pose = normalizePose(start);
  const put = (kind, next, weight, label) => {
    const to = normalizePose(next);
    steps.push({kind, from: {...pose}, to, weight, label});
    pose = to;
  };
  const sweep = () => {
    const direction = random() < .5 ? -1 : 1;
    const degrees = value(random, gentle ? 14 : 34, gentle ? 58 : 110);
    put('turn', {...pose, heading:pose.heading + direction * degrees,
      pitch:value(random, -11, 14), zoom:0}, value(random, 1, 2.5), 'Осматривается');
    put('hold', pose, value(random, .35, .9), 'Наблюдает');
  };
  if (!reducedMotion) {
    sweep();
    if (random() < .88) {
      // A brief check back over the shoulder / revisiting the same direction.
      put('return', {...pose, heading:pose.heading + value(random, -50, 45),
        pitch:value(random, -8, 10)}, value(random, .45, 1), 'Оглядывается');
    }
    sweep();
  } else {
    put('hold', pose, 1, 'Спокойный просмотр');
  }
  if (!reducedMotion) {
    for (const p of points) {
      const heading = wrapHeading(p.heading);
      const pitch = clamp(p.pitch, -35, 35);
      put('focus', {heading, pitch, zoom:0}, value(random, .55, 1.4), 'Замечает ' + (p.label || 'деталь'));
      put('squint', {heading, pitch, zoom: gentle ? value(random, 8, 20) : value(random, 22, 48)},
        value(random, .45, .85), 'Присматривается');
      put('hold', pose, value(random, 1.1, 2.8) * (0.6 + p.score), 'Удерживает взгляд');
      put('unzoom', {...pose, zoom:0}, value(random, .4, .9), 'Возвращает обзор');
    }
    if (points.length && random() < .76) {
      const p = points[Math.floor(random() * points.length)];
      put('return', {heading:wrapHeading(p.heading + value(random, -7, 7)),
        pitch:clamp(p.pitch, -30, 30), zoom:0}, value(random, .65, 1.3),
        'Смотрит повторно: ' + (p.label || 'деталь'));
      put('hold', pose, value(random, .5, 1.4), 'Задерживает взгляд');
    }
    sweep();
    put('unzoom', {...pose, zoom:0, pitch:clamp(pose.pitch, -16, 16)}, .5, 'Готовится к прыжку');
  }
  // Every plan consumes exactly its variable duration; avoid leaving a timer
  // running after completion. The logical timeline is easy to test with clocks.
  const sum = steps.reduce((a, s) => a + s.weight, 0);
  let elapsed = 0;
  const segments = steps.map((step, index) => {
    const end = index === steps.length - 1 ? totalMs :
      Math.round(elapsed + totalMs * step.weight / sum);
    const segment = {...step, startMs:elapsed, endMs:end, durationMs:end - elapsed};
    delete segment.weight;
    elapsed = end;
    return segment;
  });
  return {segments, totalMs, interestCount:points.length, durationSeconds:seconds,
    interestSource:points.length ? points.map(p=>p.source || 'unverified') : []};
}

export class GazeDirector {
  constructor({
    apply, onStage = () => {}, onFinish = () => {},
    requestFrame = callback => requestAnimationFrame(callback),
    cancelFrame = handle => cancelAnimationFrame(handle)
  }) {
    if (typeof apply !== 'function') throw new TypeError('apply is required');
    Object.assign(this, {apply, onStage, onFinish, requestFrame, cancelFrame});
    this.plan = null; this.frameId = null; this.timeMs = 0;
    this.lastNow = null; this.rate = 1; this.running = false; this.paused = false;
    this.stageIndex = -1; this.finished = false;
    this.tick = this.tick.bind(this);
  }
  start(plan, rate = 1) {
    this.stop();
    if (!plan?.segments?.length || !Number.isFinite(plan.totalMs) || plan.totalMs <= 0)
      throw new TypeError('Valid nonempty gaze plan required');
    this.plan = plan; this.rate = clamp(rate, .25, 5);
    this.timeMs = 0; this.lastNow = null; this.stageIndex = -1;
    this.running = true; this.paused = false; this.finished = false;
    this.frameId = this.requestFrame(this.tick);
  }
  tick(now) {
    this.frameId = null;
    if (!this.running || this.paused || !this.plan) return;
    if (this.lastNow !== null) this.timeMs = Math.min(this.plan.totalMs,
      this.timeMs + clamp(now - this.lastNow, 0, 250) * this.rate);
    this.lastNow = now;
    const segments = this.plan.segments;
    const i = segments.findIndex(s => this.timeMs < s.endMs);
    if (i < 0) {
      this.apply(segments.at(-1).to);
      this.running = false; this.finished = true;
      this.onFinish();
      return;
    }
    const s = segments[i];
    if (this.stageIndex !== i) {
      this.stageIndex = i;
      this.onStage({kind:s.kind,label:s.label,remainingMs:
        Math.ceil((this.plan.totalMs - this.timeMs) / this.rate)});
    }
    const fraction = clamp((this.timeMs - s.startMs) / Math.max(1, s.durationMs), 0, 1);
    let pose = s.kind === 'hold' ? {...s.to} : interpolatePose(s.from, s.to, fraction);
    if (s.kind === 'hold' && this.plan.interestCount) {
      // Tiny fixation drift rather than high-frequency shaking.
      pose = normalizePose({...pose, heading:pose.heading + Math.sin(this.timeMs / 340) * .18,
        pitch:pose.pitch + Math.sin(this.timeMs / 510) * .12});
    }
    this.apply(pose);
    this.frameId = this.requestFrame(this.tick);
  }
  setRate(rate) {
    if (Number.isFinite(rate)) this.rate = clamp(rate, .25, 5);
  }
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null; this.lastNow = null;
  }
  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false; this.lastNow = null;
    this.frameId = this.requestFrame(this.tick);
  }
  stop() {
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null; this.running = false; this.paused = false;
    this.lastNow = null; this.plan = null; this.stageIndex = -1;
  }
  get remainingMs() {
    return this.plan ? Math.max(0, Math.ceil((this.plan.totalMs - this.timeMs) / this.rate)) : 0;
  }
}
