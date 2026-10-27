import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { NewUser } from './pages/NewUser';
import { FirstAccess } from './pages/FirstAccess';
import { Contacts, Notices } from './pages/Pages';
import { About } from './pages/About';
import { Registrations } from './pages/Registrations';
import { Memorandos } from './pages/Memorandos';
import { AssistentePessoal } from './pages/AssistentePessoal';
import { Simulador } from './pages/Simulador';
import { CoursesInfo, CoursesPresencial, Combos, CourseFilter, CourseCreation, CourseCalendar } from './pages/CoursePages';
import { Quiz, Evolution } from './pages/FeaturePages';
import { Videos } from './pages/Videos';
import { Profile } from './pages/Profile';
import { Analytics } from './pages/Analytics';

import { CourseQuiz } from './pages/CourseQuiz';

import { ProtectedRoute } from './components/ProtectedRoute';
import { TrackerProvider } from './components/TrackerProvider';

const App: React.FC = () => {
  return (
    <Router>
      <TrackerProvider />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/primeiro-acesso" element={<FirstAccess />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        
        {/* Institutional */}
        <Route path="/sobre" element={<ProtectedRoute><About /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/analises" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/usuarios/novo" element={<ProtectedRoute><NewUser /></ProtectedRoute>} />
        <Route path="/contatos" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/avisos" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
        <Route path="/cadastros" element={<ProtectedRoute><Registrations /></ProtectedRoute>} />
        <Route path="/memorandos" element={<ProtectedRoute><Memorandos /></ProtectedRoute>} />
        <Route path="/assistente" element={<ProtectedRoute><AssistentePessoal /></ProtectedRoute>} />
        <Route path="/simulador" element={<ProtectedRoute><Simulador /></ProtectedRoute>} />

        {/* Courses */}
        <Route path="/cursos/info" element={<ProtectedRoute><CoursesInfo /></ProtectedRoute>} />
        <Route path="/cursos/presenciais" element={<ProtectedRoute><CoursesPresencial /></ProtectedRoute>} />
        <Route path="/cursos/combos" element={<ProtectedRoute><Combos /></ProtectedRoute>} />
        <Route path="/cursos/filtro" element={<ProtectedRoute><CourseFilter /></ProtectedRoute>} />
        <Route path="/cursos/criacao" element={<ProtectedRoute><CourseCreation /></ProtectedRoute>} />
        <Route path="/cursos/calendario" element={<ProtectedRoute><CourseCalendar /></ProtectedRoute>} />
        
        {/* Features */}
        <Route path="/videos" element={<ProtectedRoute><Videos /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><CourseQuiz /></ProtectedRoute>} />
        <Route path="/evolucao" element={<ProtectedRoute><Evolution /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
};

export default App;