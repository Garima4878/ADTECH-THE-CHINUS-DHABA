

export default function TableEntry({ tableNumber = 4, onProceed }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-orange-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full border-t-8 border-orange-600">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">The Chinu Family Restaurant & Dhaba</h1>
        <p className="text-sm text-gray-500 mb-6">The Nonveg King Of Multai</p>
        
        <div className="bg-orange-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-inner">
          <span className="text-4xl font-extrabold text-orange-600">{tableNumber}</span>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Table Detected</h2>
        <p className="text-gray-500 mb-8">Welcome to the Non-Veg Food Zone!</p>
        
        <button 
          onClick={onProceed}
          className="w-full bg-orange-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-orange-700 transition-colors shadow-md"
        >
          Browse Menu
        </button>
      </div>
    </div>
  );
}