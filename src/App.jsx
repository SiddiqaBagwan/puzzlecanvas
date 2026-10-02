/**
 * App.jsx — Root component, screen router.
 */

import { GameProvider, useGame } from './context/GameContext';
import Home from './components/Home';
import LoadingScreen from './components/LoadingScreen';
import PreviewScreen from './components/PreviewScreen';
import GameBoard from './components/GameBoard';

function AppRouter() {
  const { state } = useGame();

  switch (state.screen) {
    case 'home':
      return <Home />;
    case 'loading':
      return <LoadingScreen category={state.category} />;
    case 'preview':
      return <PreviewScreen />;
    case 'playing':
    case 'complete':
      return <GameBoard />;
    default:
      return <Home />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <AppRouter />
    </GameProvider>
  );
}
