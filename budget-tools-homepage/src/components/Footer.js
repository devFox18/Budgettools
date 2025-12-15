import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center">
          <p className="text-gray-500">© 2025 BudgetTools. All rights reserved.</p>
          <div className="flex space-x-4">
            <a href="/privacy.html" className="text-gray-500 hover:text-blue-600">Privacy</a>
            <a href="/terms.html" className="text-gray-500 hover:text-blue-600">Terms</a>
            <a href="/contact.html" className="text-gray-500 hover:text-blue-600">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
