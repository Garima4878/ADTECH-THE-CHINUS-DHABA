export default function Cart({ cartItems, onUpdateQuantity, onCheckout, onBack }) {
  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const taxes = subtotal * 0.05; 
  const finalPayable = subtotal + taxes;


  const biryaniItem = cartItems.find(item => item.name === "Chicken Biryani");
  const freeDrinksCount = biryaniItem ? biryaniItem.quantity : 0;
  
  
  const isDessertEligible = subtotal >= 1000;

  return (
    <div className="bg-gray-50 p-4 min-h-screen pb-24 max-w-md mx-auto">
      <button onClick={onBack} className="text-orange-600 font-bold mb-4 flex items-center hover:text-orange-700">
        ← Back to Menu
      </button>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Order</h2>
      
      {cartItems.length === 0 ? (
        <div className="text-center mt-10">
          <p className="text-gray-500 mb-4">Your cart is empty.</p>
          <button onClick={onBack} className="bg-orange-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm">
            Browse Food
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-8">
            {/* Standard Cart Items */}
            {cartItems.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center border border-gray-100">
                <div>
                  <h4 className="font-semibold text-gray-800">{item.name}</h4>
                  <p className="text-orange-600 font-medium">₹{item.price}</p>
                </div>
                <div className="flex items-center space-x-3 bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} 
                    className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 font-bold hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="font-semibold w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} 
                    className="w-8 h-8 flex items-center justify-center bg-orange-600 text-white rounded-md shadow-sm font-bold hover:bg-orange-700"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            {freeDrinksCount > 0 && (
              <div className="bg-green-50 p-4 rounded-lg shadow-sm flex justify-between items-center border border-green-200">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl"></span>
                  <div>
                    <h4 className="font-bold text-green-800">Cold Drink</h4>
                    <p className="text-green-600 text-xs font-medium">Included with Biryani</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 line-through text-xs mb-0.5">₹{40 * freeDrinksCount}</p>
                  <p className="text-green-700 font-bold text-sm">FREE x{freeDrinksCount}</p>
                </div>
              </div>
            )}

            {isDessertEligible && (
              <div className="bg-orange-50 p-4 rounded-lg shadow-sm flex justify-between items-center border border-orange-200">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl"></span>
                  <div>
                    <h4 className="font-bold text-orange-800">Gulab Jamun</h4>
                    <p className="text-orange-600 text-xs font-medium">Order over ₹1000</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 line-through text-xs mb-0.5">₹120</p>
                  <p className="text-orange-700 font-bold text-sm">FREE</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
            <div className="flex justify-between text-gray-600 mb-2">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600 mb-4 pb-4 border-b border-gray-200">
              <span>Taxes (5%)</span>
              <span>₹{taxes.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-xl text-gray-800 mb-6">
              <span>Total</span>
              <span>₹{finalPayable.toFixed(2)}</span>
            </div>
            <button 
              onClick={onCheckout} 
              className="w-full bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 transition-colors shadow-lg"
            >
              Proceed to Pay ₹{finalPayable.toFixed(2)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}