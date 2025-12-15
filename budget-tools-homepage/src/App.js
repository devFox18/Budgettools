import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ToolsGrid from './components/ToolsGrid';
import HowItWorks from './components/HowItWorks';
import Benefits from './components/Benefits';
import Footer from './components/Footer';

function App() {
  return (
    <div className="bg-white">
      <Header />
      <main>
        <Hero />
        <ToolsGrid id="tools" />
        <HowItWorks id="how-it-works" />
        <Benefits id="benefits" />
      </main>
      <Footer />
    </div>
  );
}

export default App;