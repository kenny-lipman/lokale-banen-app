/**
 * Eenvoudige FIFO-semaphore voor concurrency-control op externe service-calls.
 * Module-level instance per service om kruisende calls van N parallelle
 * orchestrators (bulk-create) onder controle te houden.
 *
 * Gebruik:
 *   const sem = new Semaphore(5)
 *   const result = await sem.run(() => apolloClient.fetch(...))
 *
 * NB: dit is een in-process semaphore. In een multi-Lambda omgeving (Vercel)
 * heeft elke instance zijn eigen semaphore - de globale concurrent-cap is dus
 * `max * #instances`. Voor de huidige bulk-flow (1 instance per POST) is dat
 * de juiste scope. Bij echte cross-instance limiting is een Redis-based
 * leaky-bucket nodig.
 */
export class Semaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(private readonly max: number) {
    if (max < 1) throw new Error('Semaphore max moet >= 1 zijn')
  }

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
    this.running++
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  get stats(): { running: number; queued: number; max: number } {
    return { running: this.running, queued: this.queue.length, max: this.max }
  }
}
