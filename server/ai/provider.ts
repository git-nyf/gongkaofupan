import type { NormalizeCardInput, NormalizedCard } from '../../shared/contracts';

export interface AiProvider {
  normalize(input: NormalizeCardInput): Promise<NormalizedCard>;
}
