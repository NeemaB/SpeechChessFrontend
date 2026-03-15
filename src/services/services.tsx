import { createContext, useContext } from 'react';
import { GameController } from '../chess/game_controller';
import type { SpeechToTextService } from './speech_to_text_service';

/**
 * Container for every application-scoped singleton. Components consume
 * these via `useServices()` rather than constructing them locally.
 */
export interface Services {
  gameController: GameController;
  speechToText: SpeechToTextService;
}

export const ServicesContext = createContext<Services | null>(null);

/**
 * Access the application's service singletons.
 * Throws if called outside of a `<ServicesProvider>`.
 */
export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === null) {
    throw new Error('useServices must be called within a <ServicesProvider>');
  }
  return services;
}
