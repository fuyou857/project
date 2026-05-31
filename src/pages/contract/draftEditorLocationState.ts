import type { GeneratedContract } from '../../services/contractGenerationService';

export type DraftEditorLocationState = {
  documentUrl: string;
  urlHint?: string | null;
  contract?: GeneratedContract | null;
};