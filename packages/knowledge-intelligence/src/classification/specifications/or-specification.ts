import type { ISpecification } from "../../contracts/i-specification.js";

/** Composite Specification satisfied when either operand is satisfied. */
export class OrSpecification<T> implements ISpecification<T> {
  readonly name: string;

  constructor(
    private readonly left: ISpecification<T>,
    private readonly right: ISpecification<T>,
  ) {
    this.name = `(${left.name} OR ${right.name})`;
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}
