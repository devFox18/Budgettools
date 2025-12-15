import React from 'react';

const ToolsGrid = () => {
  const tools = [
    {
      title: 'Budget Calculator',
      description: 'Track income, expenses, and savings in real time.',
      link: '/tools/budget-calculator/',
    },
    {
      title: 'Savings Goal Calculator',
      description: 'Plan how long it will take to reach your savings goal.',
      link: '/tools/savings-goal-calculator/',
    },
    {
      title: 'Subscription Saver',
      description: 'Track every subscription and see your true monthly and yearly costs.',
      link: '/tools/subscription-saver/',
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          Tools for every money task
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tools.map((tool, index) => (
            <div key={index} className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">{tool.title}</h3>
              <p className="text-gray-600 mb-6">{tool.description}</p>
              <a href={tool.link} className="text-emerald-500 hover:text-emerald-600 font-bold">
                Open tool &rarr;
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ToolsGrid;
