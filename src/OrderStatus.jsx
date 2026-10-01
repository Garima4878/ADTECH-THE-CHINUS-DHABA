import { useState, useEffect } from 'react';

export default function OrderStatus({ cartItems, tableNumber = 4, onNewOrder }) {
  const [activeStep, setActiveStep] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => setActiveStep(2), 2500); 
    return () => clearTimeout(timer);
  }, []);

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const finalPayable = subtotal + (subtotal * 0.05);

  const steps = [
    { id: 1, title: 'Order Confirmed', desc: 'Sent to the kitchen' },
    { id: 2, title: 'Preparing Food', desc: 'Your food is preparing and will arrive shortly to your table.' },
    { id: 3, title: 'Served', desc: 'Enjoy your meal!' }
  ];

  return (
    <div className="bg-gray-50 min-h-screen p-4 pb-10 max-w-md mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center mb-6 mt-4">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Payment Successful</h2>
        <p className="text-gray-500 font-medium">Table {tableNumber}</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h3 className="font-bold text-lg text-gray-800 mb-6">Track Order</h3>
        
        <div className="relative pl-2 space-y-8">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200"></div>

          {steps.map((step) => {
            const isCompleted = activeStep >= step.id;
            const isCurrent = activeStep === step.id;
            
            return (
              <div key={step.id} className="relative flex items-start z-10">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-1 border-4 ${
                  isCompleted ? 'bg-green-500 border-green-200' : 'bg-gray-300 border-white'
                } ${isCurrent ? 'animate-pulse' : ''}`}></div>
                <div className="ml-4">
                  <h4 className={`font-bold ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                    {step.title}
                  </h4>
                  <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button 
        onClick={onNewOrder}
        className="w-full bg-orange-100 text-orange-700 font-bold py-4 rounded-xl hover:bg-orange-200 transition-colors shadow-sm"
      >
        Place Another Order
      </button>
    </div>
  );
}