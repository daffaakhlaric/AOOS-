import type { ISpecification } from "../../contracts/i-specification.js";

/** Composite Specification satisfied when both operands are satisfied. */
export class AndSpecification<T> implements ISpecification<T> {
  readonly name: string;

  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>,
  ) {
    this.name = `(${left.name} AND ${right.name})`;
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}
