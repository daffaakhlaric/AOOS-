import type { ISpecification } from "../../contracts/i-specification.js";

/** Composite Specification satisfied when the wrapped operand is not satisfied. */
export class NotSpecification<T> implements ISpecification<T> {
  readonly name: string;

  constructor(private readonly inner: ISpecification<T>) {
    this.name = `(NOT ${inner.name})`;
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.inner.isSatisfiedBy(candidate);
  }
}
