import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trash2, Plus, Edit2, X, Check } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function BrandCategoryAdmin() {
  const [categories, setCategories] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('categories');
  const [authUser, setAuthUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check authorization
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user);
      setIsAuthorized(user?.email === 'ericeng3000@gmail.com');
      if (user?.email === 'ericeng3000@gmail.com') {
        fetchData();
      }
    };
    checkAuth();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories
      const { data: categoriesData, error: catError } = await supabase
        .from('brand_categories')
        .select('*')
        .order('name', { ascending: true });

      if (catError) throw catError;
      setCategories(categoriesData || []);

      // Fetch brands
      const { data: brandsData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .order('name', { ascending: true });

      if (brandError) throw brandError;
      setBrands(brandsData || []);

      // Fetch mappings
      const { data: mappingsData, error: mapError } = await supabase
        .from('brand_category_mappings')
        .select('*');

      if (mapError) throw mapError;
      setMappings(mappingsData || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('brand_categories')
        .insert([{ name: newCategoryName.trim() }])
        .select();

      if (error) throw error;
      setCategories([...categories, ...data]);
      setNewCategoryName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const updateCategory = async (id, newName) => {
    if (!newName.trim()) return;

    try {
      const { error } = await supabase
        .from('brand_categories')
        .update({ name: newName.trim() })
        .eq('id', id);

      if (error) throw error;
      setCategories(categories.map(cat => 
        cat.id === id ? { ...cat, name: newName.trim() } : cat
      ));
      setEditingId(null);
      setEditValue('');
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category? This will remove all mappings.')) return;

    try {
      // Delete mappings first
      const { error: mapError } = await supabase
        .from('brand_category_mappings')
        .delete()
        .eq('category_id', id);

      if (mapError) throw mapError;

      // Then delete category
      const { error } = await supabase
        .from('brand_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCategories(categories.filter(cat => cat.id !== id));
      setMappings(mappings.filter(m => m.category_id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const addMapping = async (e) => {
    e.preventDefault();
    if (!selectedBrand || !selectedCategory) return;

    // Check if mapping already exists
    if (mappings.some(m => m.brand_id === selectedBrand && m.category_id === selectedCategory)) {
      setError('This mapping already exists');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('brand_category_mappings')
        .insert([{ brand_id: selectedBrand, category_id: selectedCategory }])
        .select();

      if (error) throw error;
      setMappings([...mappings, ...data]);
      setSelectedBrand(null);
      setSelectedCategory(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteMapping = async (brandId, categoryId) => {
    try {
      const { error } = await supabase
        .from('brand_category_mappings')
        .delete()
        .eq('brand_id', brandId)
        .eq('category_id', categoryId);

      if (error) throw error;
      setMappings(mappings.filter(m => !(m.brand_id === brandId && m.category_id === categoryId)));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400 text-lg">
            {authUser ? 'You do not have permission to access this page.' : 'Please sign in to continue.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Brand Category Manager</h1>
          <p className="text-slate-400">Manage brand categories and their mappings</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-slate-800/40 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('mappings')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'mappings'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mappings
          </button>
        </div>

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            {/* Add New Category Form */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Plus size={20} /> Add New Category
              </h2>
              <form onSubmit={addCategory} className="flex gap-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name..."
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Categories List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="text-slate-400 mt-4">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                <p className="text-slate-400">No categories yet. Create one above!</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                  >
                    {editingId === category.id ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 bg-slate-700/50 border border-slate-600 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => updateCategory(category.id, editValue)}
                          className="text-green-400 hover:text-green-300 transition-colors"
                        >
                          <Check size={20} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-400 hover:text-slate-300 transition-colors"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-white font-medium">{category.name}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(category.id);
                              setEditValue(category.name);
                            }}
                            className="text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteCategory(category.id)}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mappings Tab */}
        {activeTab === 'mappings' && (
          <div className="space-y-6">
            {/* Add New Mapping Form */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Plus size={20} /> Add Brand-Category Mapping
              </h2>
              <form onSubmit={addMapping} className="flex gap-3">
                <select
                  value={selectedBrand || ''}
                  onChange={(e) => setSelectedBrand(Number(e.target.value) || null)}
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a brand...</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(Number(e.target.value) || null)}
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a category...</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedBrand || !selectedCategory}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition-colors"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Mappings List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="text-slate-400 mt-4">Loading mappings...</p>
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                <p className="text-slate-400">No mappings yet. Create one above!</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {mappings.map((mapping) => {
                  const brand = brands.find((b) => b.id === mapping.brand_id);
                  const category = categories.find((c) => c.id === mapping.category_id);
                  return (
                    <div
                      key={`${mapping.brand_id}-${mapping.category_id}`}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="text-white">
                        <span className="font-medium">{brand?.name}</span>
                        <span className="text-slate-400 mx-3">→</span>
                        <span className="font-medium">{category?.name}</span>
                      </div>
                      <button
                        onClick={() => deleteMapping(mapping.brand_id, mapping.category_id)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
