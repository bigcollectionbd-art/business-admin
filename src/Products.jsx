import { useEffect, useState } from "react";
import { Search, Package } from "lucide-react";
import { supabase } from "./supabase";
import "./Products.css";

function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingProduct, setEditingProduct] = useState(null);
  const [newStock, setNewStock] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, selling_price, purchase_price, stock_qty, image_url"
      )
      .order("name");

    if (error) {
      console.error(error);
      alert("Products load failed.");
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return true;
    }

    return (
      product.name?.toLowerCase().includes(keyword) ||
      product.sku?.toLowerCase().includes(keyword)
    );
  });

  function openEdit(product) {
    setEditingProduct(product);
    setNewStock(String(product.stock_qty || 0));
  }

  function closeEdit() {
    if (saving) {
      return;
    }

    setEditingProduct(null);
    setNewStock("");
  }

  async function saveStock() {
    if (!editingProduct || saving) {
      return;
    }

    const stock = Number(newStock);

    if (!Number.isInteger(stock) || stock < 0) {
      alert("Please enter a valid stock quantity.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("products")
      .update({
        stock_qty: stock,
      })
      .eq("id", editingProduct.id);

    if (error) {
      console.error(error);
      alert(`Stock update failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === editingProduct.id
          ? {
              ...product,
              stock_qty: stock,
            }
          : product
      )
    );

    setSaving(false);
    closeEdit();
  }

  return (
    <div className="products-page">

      <div className="products-top">
        <div>
          <h2>Products</h2>
          <p>Manage your product stock</p>
        </div>

        <div className="products-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search product or SKU..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>
      </div>

      {loading ? (
        <div className="products-message">
          Loading products...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="products-message">
          No products found.
        </div>
      ) : (
        <div className="products-table">

          <div className="products-row products-header-row">
            <div>Product</div>
            <div>SKU</div>
            <div>Purchase Price</div>
            <div>Selling Price</div>
            <div>Stock</div>
            <div>Action</div>
          </div>

          {filteredProducts.map((product) => (
            <div
              className="products-row"
              key={product.id}
            >
              <div className="product-cell">

                <div className="product-image">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                    />
                  ) : (
                    <Package size={20} />
                  )}
                </div>

                <strong>{product.name}</strong>

              </div>

              <div>
                {product.sku || "-"}
              </div>

              <div>
                BDT{" "}
                {Number(
                  product.purchase_price || 0
                ).toFixed(2)}
              </div>

              <div>
                BDT{" "}
                {Number(
                  product.selling_price || 0
                ).toFixed(2)}
              </div>

              <div className="stock-value">
                {Number(product.stock_qty || 0)}
              </div>

              <div>
                <button
                  className="edit-stock-button"
                  onClick={() =>
                    openEdit(product)
                  }
                >
                  Edit
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {editingProduct && (
        <div className="stock-modal-overlay">

          <div className="stock-modal">

            <h3>Edit Stock</h3>

            <p>
              {editingProduct.name}
            </p>

            <label>
              Stock Quantity
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={newStock}
              onChange={(event) =>
                setNewStock(event.target.value)
              }
              autoFocus
            />

            <div className="stock-modal-buttons">

              <button
                className="cancel-button"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="save-button"
                onClick={saveStock}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Products;
