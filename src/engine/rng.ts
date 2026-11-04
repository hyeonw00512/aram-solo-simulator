export class Rng {
  constructor(private state: number) {}
  next() { this.state |= 0; this.state = (this.state + 0x6D2B79F5) | 0; let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  int(max: number) { return Math.floor(this.next() * max); }
  pick<T>(values: T[]) { return values[this.int(values.length)]; }
  chance(probability: number) { return this.next() < probability; }
}
