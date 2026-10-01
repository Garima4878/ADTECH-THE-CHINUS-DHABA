import { useState } from 'react';
import Home from './Home';
import TableEntry from './TableEntry';
import MenuCard from './MenuCard';
import Cart from './Cart';
import OrderStatus from './OrderStatus';
import { menuData } from './menuData';

export default function App() {
  const [showHome, setShowHome] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);

  const handleAddToCart = (itemToAdd) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === itemToAdd.id);
      if (existingItem) {
        return prevCart.map(item => 
          item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...itemToAdd, quantity: 1 }];
    });

    
    if (itemToAdd.name === "Chicken Biryani") {
      setToast(`Added Chicken Biryani + Free Cold Drink!`);
    } else {
      setToast(`Added ${itemToAdd.name}!`);
    }
    
    setTimeout(() => setToast(null), 2500);
  };

  const handleUpdateQuantity = (id, newQuantity) => {
    if (newQuantity < 1) {
      setCart(prevCart => prevCart.filter(item => item.id !== id));
    } else {
      setCart(prevCart => prevCart.map(item => 
        item.id === id ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const handleNewOrder = () => {
    setCart([]);
    setIsCartOpen(false);
    setIsOrderPlaced(false);
    setShowHome(true);
    setHasEntered(false);
  };

  
  if (showHome) {
    return <Home onStartOrder={() => setShowHome(false)} />;
  }

  if (!hasEntered) {
    return <TableEntry tableNumber={4} onProceed={() => setHasEntered(true)} />;
  }

  if (isOrderPlaced) {
    return <OrderStatus cartItems={cart} tableNumber={4} onNewOrder={handleNewOrder} />;
  }

  if (isCartOpen) {
    return (
      <Cart 
        cartItems={cart} 
        onUpdateQuantity={handleUpdateQuantity} 
        onCheckout={() => setIsOrderPlaced(true)} 
        onBack={() => setIsCartOpen(false)} 
      />
    );
  }

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  const currentTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-24 relative">
      <header className="bg-orange-600 text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => setShowHome(true)}>The Chinu Dhaba</h1>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="bg-white text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm relative"
        >
          Cart
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
              {totalItems}
            </span>
          )}
        </button>
      </header>
      
      <div className="p-4 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Menu</h2>
        {menuData.map((item) => (
          <MenuCard key={item.id} item={item} onAddToCart={handleAddToCart} />
        ))}
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-5 py-2 rounded-full shadow-2xl text-sm font-medium z-50 transition-opacity">
          ✅ {toast}
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-green-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center hover:bg-green-700 transition-colors"
          >
            <div className="flex flex-col text-left">
              <span className="text-xs text-green-200 font-medium uppercase tracking-wider">
                {totalItems} Item{totalItems > 1 ? 's' : ''}
              </span>
              <span className="font-bold text-lg">₹{currentTotal}</span>
            </div>
            <div className="font-bold flex items-center space-x-2 text-lg">
              <span>View Cart</span>
              <span>➔</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}