/** How hard a buyer persona is for Jessy to handle well — drives the "business correctness" distribution checked by `RunAllScenarios` (3 EASY, 5 MEDIUM, 2 HARD, per spec §10 Buyer Personas). */
export enum PersonaDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export const ALL_PERSONA_DIFFICULTIES: ReadonlyArray<PersonaDifficulty> = [
  PersonaDifficulty.EASY,
  PersonaDifficulty.MEDIUM,
  PersonaDifficulty.HARD,
];
