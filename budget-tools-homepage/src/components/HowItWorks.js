import React from 'react';

const HowItWorks = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          How it works
        </h2>
        <div className="flex flex-col md:flex-row justify-center items-center space-y-8 md:space-y-0 md:space-x-12">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full font-bold text-xl">
              1
            </div>
            <p className="text-lg text-gray-600">Choose a tool</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full font-bold text-xl">
              2
            </div>
            <p className="text-lg text-gray-600">Add your details</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full font-bold text-xl">
              3
            </div>
            <p className="text-lg text-gray-600">Get instant insights</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
