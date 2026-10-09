export default function Home({ onStartOrder }) {
  return (
    <div className="bg-gray-50 min-h-screen pb-12 font-sans">
      <div className="relative bg-orange-600 h-72 flex items-center justify-center text-center px-4 overflow-hidden shadow-md">
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <img 
          src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1000&q=80" 
          alt="Restaurant Ambiance" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
        />
        
        <div className="relative z-10 w-full max-w-md mx-auto">
          <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-md">The Chinu Dhaba</h1>
          <p className="text-lg text-orange-100 font-medium mb-8 drop-shadow-sm">The Nonveg King Of Multai</p>
          <button 
            onClick={onStartOrder}
            className="w-full sm:w-auto bg-white text-orange-600 font-bold py-4 px-10 rounded-full shadow-xl hover:bg-orange-50 transition-all transform hover:scale-105 active:scale-95 text-lg"
          >
            Scan QR to Order
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-6">
        
    
        <section className="relative bg-gradient-to-br from-orange-50 to-red-50 p-8 rounded-2xl shadow-sm border border-orange-100 text-center overflow-hidden">
          
          <div className="absolute -top-6 -right-4 text-8xl opacity-5 select-none pointer-events-none">
            
          </div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white text-orange-500 rounded-full mb-4 shadow-sm border border-orange-100">
              <span className="text-2xl"></span>
            </div>
            
            <h2 className="text-2xl font-extrabold text-gray-800 mb-3 tracking-tight">Welcome to the Family</h2>
            
            <p className="text-gray-700 text-sm leading-relaxed font-medium">
              Serving the most authentic and rich non-veg delicacies in Multai. Experience the perfect blend of traditional spices, premium ingredients, and a warm, inviting atmosphere.
            </p>
            
            <div className="flex justify-center items-center space-x-1 mt-5 text-orange-400 text-lg">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-gray-800 mb-3 px-1">Today's Offers</h3>
          <div className="flex flex-col space-y-4">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 relative shadow-sm">
              <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                LIMITED TIME
              </div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-2xl"></span>
                <h3 className="font-bold text-green-800">Free Cold Drink</h3>
              </div>
              <p className="text-green-700 text-sm font-medium">
                Applied automatically with every Chicken Biryani.
              </p>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 relative shadow-sm">
              <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                SPECIAL
              </div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-2xl"></span>
                <h3 className="font-bold text-orange-800">Free Dessert</h3>
              </div>
              <p className="text-orange-700 text-sm font-medium">
                Get free Gulab Jamun on orders above ₹1,000.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-4 px-1">
            <h3 className="text-xl font-bold text-gray-800">Popular Favorites</h3>
            <span className="text-xs font-bold text-orange-600 cursor-pointer" onClick={onStartOrder}>See All</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80" alt="Handi" className="h-28 w-full object-cover" />
              <div className="p-3">
                <h4 className="font-bold text-gray-800 text-sm truncate">Chicken Handi</h4>
                <p className="text-orange-600 font-extrabold text-sm mt-1">₹350</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=400&q=80" alt="Mutton" className="h-28 w-full object-cover" />
              <div className="p-3">
                <h4 className="font-bold text-gray-800 text-sm truncate">Mutton Korma</h4>
                <p className="text-orange-600 font-extrabold text-sm mt-1">₹400</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Visit Us</h3>
          <div className="text-sm text-gray-600 space-y-3">
            <div className="flex items-start space-x-3">
              <span className="text-lg">📍</span>
              <p>Multai, Madhya Pradesh<br/><span className="text-xs text-gray-400">Exact address to be confirmed</span></p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-lg">📞</span>
              <p className="font-medium">+91 98765 43210</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-lg">🕒</span>
              <p>Open Today: <span className="font-medium text-green-600">11:00 AM - 11:00 PM</span></p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}