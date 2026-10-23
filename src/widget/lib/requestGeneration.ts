/**
 * Tells a request's result whether it may still land. `begin` stamps a
 * request; `invalidate` retires every request stamped before it. A result
 * is applied only while `isCurrent` holds for its stamp, so a slow request
 * can't overwrite state that something newer has already set, whatever
 * order they finish in.
 */
export class RequestGeneration {
  private current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  invalidate(): void {
    this.current += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.current;
  }
}
