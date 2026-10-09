import { callerFile, HealerCore, type HealRecord, type Probe } from '../core.js';

/** Healer for the no-code mode: the preload hooks call these instead of the test calling the healer. */
export class AutoHealer extends HealerCore {
  setTest(name: string) {
    this.beginTest(name);
  }
  get testName(): string {
    return this.test;
  }
  /** Remember the element a working selector found. */
  remember(probe: Probe, selector: string) {
    return this.learn(probe, selector);
  }
  /** A selector that finds nothing: returns a healed one, or the original when no confident match exists. */
  heal(probe: Probe, selector: string, file: string | undefined) {
    return this.resolve(probe, selector, file);
  }
  /** The step that used the healed selector has finished. */
  done(oldSelector: string, passed: boolean) {
    this.settle(oldSelector, passed);
  }

  /** The record the last `heal` call for this selector made, if any. */
  recordFor(selector: string): HealRecord | undefined {
    return [...this.records].reverse().find((r) => r.oldSelector === selector);
  }

  /** Adds a record for an element that was recovered some other way (here: by its name), and saves it. */
  note(record: HealRecord): void {
    this.records.push(record);
    this.save();
  }

  /** Removes the "refused" record made when fingerprint matching gave up on a locator that was then recovered by name. */
  dropRefused(selector: string): void {
    const keep = this.records.filter((r) => !(r.oldSelector === selector && r.status === 'refused'));
    this.records.length = 0;
    this.records.push(...keep);
    this.save();
  }
}

export { callerFile };
