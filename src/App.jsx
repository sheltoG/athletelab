import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { seedDatabase } from './db';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Plan from './pages/Plan';
import Trends from './pages/Trends';
import ActiveWorkout from './pages/ActiveWorkout';
import TemplateEditor from './pages/TemplateEditor';
import Exercises from './pages/Exercises';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDatabase().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000' }}>
        <div style={{ color: '#d4ff00', fontWeight: 700, fontSize: 20 }}>AthleteLab</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/workout" element={<ActiveWorkout />} />
        <Route path="/template/:id" element={<TemplateEditor />} />
        <Route path="/exercises" element={<Exercises />} />
      </Routes>
      <Routes>
        <Route path="/workout" element={null} />
        <Route path="/template/:id" element={null} />
        <Route path="*" element={<BottomNav />} />
      </Routes>
    </BrowserRouter>
  );
}
