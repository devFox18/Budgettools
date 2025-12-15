import React from 'react';

const Hero = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6 text-center">
        <h1 className="text-5xl font-bold text-gray-800">
          Smart, privacy-first money tools
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Manage budgets, run comparisons, and decide with confidence—every calculation happens locally in your browser.
        </p>
        <div className="mt-8 flex justify-center space-x-4">
          <a href="#tools" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition duration-300">
            Explore Tools
          </a>
          <a href="#how-it-works" className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-full transition duration-300">
            Learn More
          </a>
        </div>
        <div className="mt-12 w-full h-64 bg-gray-200 rounded-lg shadow-md flex items-center justify-center">
          <p className="text-gray-500">Illustration Placeholder</p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
