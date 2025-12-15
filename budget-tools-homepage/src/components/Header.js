import React from 'react';

const Header = () => {
  return (
    <header className="sticky top-0 bg-white shadow-sm border-b border-gray-200 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-blue-600">
          BudgetTools
        </div>
        <nav className="hidden md:flex space-x-8 items-center">
          <a href="#tools" className="text-gray-600 hover:text-blue-600">Tools</a>
          <a href="#how-it-works" className="text-gray-600 hover:text-blue-600">How It Works</a>
          <a href="#benefits" className="text-gray-600 hover:text-blue-600">Benefits</a>
          <a href="#tools" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-full transition duration-300">
            Get Started
          </a>
        </nav>
        <div className="md:hidden">
          <button className="text-gray-600 hover:text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
