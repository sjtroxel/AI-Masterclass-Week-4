import { ThemeProvider } from './context/ThemeContext'
import { ThemeToggle } from './components/ThemeToggle'
import { GameBoard } from './components/GameBoard'

export default function App() {
  return (
    <ThemeProvider>
      <>
        {/* ThemeToggle: fixed top-right, z-[900] — renders above map, below ResultsOverlay */}
        <ThemeToggle />
        <GameBoard />
      </>
    </ThemeProvider>
  )
}
