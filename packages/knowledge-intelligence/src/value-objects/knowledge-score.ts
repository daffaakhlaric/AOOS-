export interface KnowledgeScoreProps {
  readonly name: string;
  readonly value: number;
  readonly band: string;
}

/** Immutable named 0-100 score with its evaluated threshold band label. */
export class KnowledgeScore {
  readonly name: string;
  readonly value: number;
  readonly band: string;

  constructor(props: KnowledgeScoreProps) {
    if (props.name.trim().length === 0) {
      throw new RangeError("KnowledgeScore: name must not be empty");
    }
    if (props.value < 0 || props.value > 100) {
      throw new RangeError("KnowledgeScore: value must be within [0, 100]");
    }
    this.name = props.name;
    this.value = props.value;
    this.band = props.band;
    Object.freeze(this);
  }
}
