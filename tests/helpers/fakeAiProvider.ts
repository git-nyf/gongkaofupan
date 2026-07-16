import type { NormalizedCard } from '../../shared/contracts';
import type { AiProvider } from '../../server/ai/provider';

export function createFakeAiProvider(result: NormalizedCard): AiProvider {
  return {
    async normalize() {
      return result;
    },
  };
}
