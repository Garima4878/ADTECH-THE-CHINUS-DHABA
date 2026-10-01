

export default function MenuCard({ item, onAddToCart }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mb-4">
      {/* Image Placeholder */}
      <div className="h-40 bg-gray-200 w-full relative">
        <img 
          src={item.image} 
          alt={item.name} 
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Food+Image' }}
        />
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-bold text-lg bg-red-600 px-3 py-1 rounded">Out of Stock</span>
          </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
          <span className="font-bold text-orange-600">₹{item.price}</span>
        </div>
        <p className="text-gray-500 text-sm mb-4 flex-grow">{item.description}</p>
        
        <button 
          disabled={!item.isAvailable}
          onClick={() => onAddToCart(item)}
          className={`w-full py-2 rounded-lg font-semibold transition-colors ${
            item.isAvailable 
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {item.isAvailable ? 'Add to Cart' : 'Unavailable'}
        </button>
      </div>
    </div>
  );
}