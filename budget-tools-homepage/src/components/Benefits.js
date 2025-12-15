import React from 'react';

const Benefits = () => {
  const benefits = [
    {
      title: 'Fully private',
      description: 'Every calculation runs in your browser. No storage, no tracking.',
    },
    {
      title: 'No account required',
      description: 'Use the tools instantly without signing up.',
    },
    {
      title: 'Fast & simple',
      description: 'From question to answer in minutes.',
    },
    {
      title: 'Open source',
      description: 'Built on best practices and open source whenever possible.',
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          Why BudgetTools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index}>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
