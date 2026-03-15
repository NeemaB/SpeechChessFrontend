import { useMemo, type ReactNode } from 'react';
import { GameController } from '../chess/game_controller';
import { AssemblyAISpeechService } from './assembly_ai_speech_service';
import { ServicesContext, type Services } from './services';

interface ServicesProviderProps {
  children: ReactNode;
  /**
   * Optional replacements for default service instances. Intended for
   * tests and Storybook; production code should omit this.
   */
  overrides?: Partial<Services>;
}

export function ServicesProvider({ children, overrides }: ServicesProviderProps) {
  const services = useMemo<Services>(
    () => ({
      gameController: overrides?.gameController ?? new GameController(),
      speechToText: overrides?.speechToText ?? new AssemblyAISpeechService(),
    }),
    // Overrides are expected to be stable across the provider's lifetime;
    // re-creating singletons mid-session would discard game state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
