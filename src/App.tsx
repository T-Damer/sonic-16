import { PhaserGame } from '@/game/PhaserGame';

/** The shell is deliberately thin — the game owns the whole viewport. */
const App = () => (
    <div id="app">
        <PhaserGame />
    </div>
);

export default App;
