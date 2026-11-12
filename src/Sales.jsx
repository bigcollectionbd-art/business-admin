import "./Sales.css";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Plus, Minus } from "lucide-react";
import { supabase } from "./supabase";

function Sales() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [variationProduct, setVariationProduct] = useState(null);
  const [variations, setVariations] = useState([]);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Warranty and replacement apply to the whole invoice.
  const [replacementDays, setReplacementDays] = useState("180");
  const [warrantyPeriod, setWarrantyPeriod] = useState("1 Year");

  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash On Delivery");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodUpdate, setPaymentMethodUpdate] = useState("cash");

  async function generateInvoiceNo() {
    const { data, error } = await supabase
      .from("sales")
      .select("invoice_no");

    if (error) {
      console.error("Invoice number error:", error);
      setInvoiceNo("BCB-10422");
      return;
    }

    let highestNumber = 10421;

    for (const sale of data || []) {
      const invoice = String(sale.invoice_no || "").trim();
      const match = invoice.match(/^BCB-(\d+)$/);

      if (match) {
        const number = Number(match[1]);

        if (number > highestNumber) {
          highestNumber = number;
        }
      }
    }

    setInvoiceNo(`BCB-${highestNumber + 1}`);
  }


  async function addPayment() {
    if (!paymentOrder) return;

    const amount = Number(paymentAmount || 0);
    const currentPaid = Number(paymentOrder.paid || 0);
    const total = Number(paymentOrder.total || 0);
    const currentDue = Math.max(total - currentPaid, 0);

    if (amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (amount > currentDue) {
      alert(`Payment cannot be more than due amount: BDT ${currentDue.toFixed(2)}`);
      return;
    }

    const newPaid = currentPaid + amount;
    const newDue = Math.max(total - newPaid, 0);

    const { data, error } = await supabase
      .from("sales")
      .update({
        paid: newPaid,
        due: newDue,
        payment_method: paymentMethodUpdate,
      })
      .eq("id", paymentOrder.id)
      .select()
      .single();

    if (error) {
      console.error("Add payment error:", error);
      alert(
        `Payment failed: ${error.message || "Unknown database error"}`
      );
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === paymentOrder.id ? data : order
      )
    );

    setPaymentOrder(null);
    setPaymentAmount("");
    alert("Payment added successfully.");
  }
  async function cancelOrder(order) {
    if (!order) return;

    const confirmed = window.confirm(
      `Cancel order ${order.invoice_no}?`
    );

    if (!confirmed) return;

    const { data, error } = await supabase
      .from("sales")
      .update({
        status: "cancelled",
      })
      .eq("id", order.id)
      .select()
      .single();

    if (error) {
      console.error("Cancel order error:", error);
      alert("Could not cancel this order.");
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map((item) =>
        item.id === order.id ? data : item
      )
    );

    alert("Order cancelled successfully.");
  }
  async function loadOrders() {
    setOrdersLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        invoice_no,
        sale_date,
        total,
        paid,
        due,
        payment_method,
        status,
        customer_id
      `)
      .order("sale_date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Orders error:", error);
      setOrders([]);
    } else {
      setOrders(data || []);
    }

    setOrdersLoading(false);
  }
  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, woo_product_id, selling_price, stock_qty, image_url")
        .order("name");

      if (error) {
        console.error("Products error:", error);
        return;
      }

      setProducts(data || []);
    }

    loadProducts();
    generateInvoiceNo();
    loadOrders();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return [];
    }

    return products
      .filter(
        (product) =>
          product.name?.toLowerCase().includes(keyword) ||
          product.sku?.toLowerCase().includes(keyword)
      )
      .slice(0, 10);
  }, [products, search]);

  async function addToCart(product) {
    if (Number(product.stock_qty || 0) <= 0) {
      alert("This product is out of stock.");
      return;
    }
    if (Number(product.selling_price || 0) === 0) {
      setLoadingVariations(true);

      try {
        const { data, error } =
          await supabase.functions.invoke(
            "get-woo-variations",
            {
              body: {
                productId: product.woo_product_id,
              },
            }
          );

        if (error) {
          console.error("Variation fetch error:", error);
          alert("Could not load product variations.");
          return;
        }

        if (!data?.variations?.length) {
          alert("No variations found for this product.");
          return;
        }

        setVariationProduct(product);
        setVariations(data.variations);
      } catch (error) {
        console.error("Variation error:", error);
        alert(`Could not load variations: ${error.message}`);
      } finally {
        setLoadingVariations(false);
      }

      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id
      );

      if (existing) {
        if (
          existing.quantity >=
          Number(product.stock_qty || 0)
        ) {
          alert("Not enough stock available.");
          return currentCart;
        }

        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          ...product,
          productId: product.id,
          quantity: 1,
        },
      ];
    });

    setSearch("");
  }

  function addVariationToCart(variation) {
    if (!variationProduct) {
      return;
    }

    const variationLabel =
      variation.attributes
        ?.map((attribute) => attribute.option)
        .filter(Boolean)
        .join(" / ") || "Default";

    const cartId =
      `${variationProduct.id}-${variation.id}`;

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === cartId
      );

      if (existing) {
        if (
          existing.quantity >=
          Number(variation.stock_quantity || 0)
        ) {
          alert("Not enough stock available.");
          return currentCart;
        }

        return currentCart.map((item) =>
          item.id === cartId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          id: cartId,
          productId: variationProduct.id,
          name: `${variationProduct.name} - ${variationLabel}`,
          sku: variationProduct.sku,
          image_url: variationProduct.image_url,
          selling_price: Number(variation.price || 0),
          stock_qty: Number(
            variation.stock_quantity || 0
          ),
          quantity: 1,
          variationId: variation.id,
          variationLabel,
        },
      ];
    });

    setVariationProduct(null);
    setVariations([]);
    setSearch("");
  }
  function increaseQuantity(id) {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (
          item.quantity >=
          Number(item.stock_qty || 0)
        ) {
          alert("Not enough stock available.");
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(id) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== id)
    );
  }

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.selling_price || 0) *
        Number(item.quantity || 0),
    0
  );

  const total = Math.max(
    subtotal - Number(discount || 0),
    0
  );

  const due = Math.max(
    total - Number(paid || 0),
    0
  );

  async function completeSale() {
    if (saving) {
      return;
    }

    if (!invoiceNo.trim()) {
      alert("Please enter invoice number.");
      return;
    }

    if (!customerName.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    if (Number(discount || 0) > subtotal) {
      alert("Discount cannot be greater than subtotal.");
      return;
    }

    if (Number(paid || 0) > total) {
      alert("Paid amount cannot be greater than total.");
      return;
    }

    setSaving(true);

    try {
      const cleanInvoiceNo = invoiceNo.trim();

      const { data: existingInvoice, error: invoiceCheckError } =
        await supabase
          .from("sales")
          .select("id")
          .eq("invoice_no", cleanInvoiceNo)
          .maybeSingle();

      if (invoiceCheckError) {
        alert(
          `Invoice check failed: ${invoiceCheckError.message}`
        );
        return;
      }

      if (existingInvoice) {
        alert(
          `Invoice ${cleanInvoiceNo} already exists. Please use another invoice number.`
        );
        return;
      }

      const { data: customer, error: customerError } =
        await supabase
          .from("customers")
          .insert({
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            address: customerAddress.trim() || null,
          })
          .select()
          .single();

      if (customerError) {
        console.error("Customer error:", customerError);

        alert(
          `Customer save failed: ${customerError.message}`
        );

        return;
      }

      const { data: sale, error: saleError } =
        await supabase
          .from("sales")
          .insert({
            invoice_no: cleanInvoiceNo,
            customer_id: customer.id,
            sale_date: new Date().toISOString(),
            subtotal,
            discount: Number(discount || 0),
            total,
            paid: Number(paid || 0),
            due,
            payment_method: paymentMethod,
            replacement_days:
              replacementDays === "none" ? null : Number(replacementDays),
            warranty_period:
              warrantyPeriod === "none" ? null : warrantyPeriod,
            status: "completed",
          })
          .select()
          .single();

      if (saleError) {
        console.error("Sale error:", saleError);

        await supabase
          .from("customers")
          .delete()
          .eq("id", customer.id);

        alert(
          `Sale save failed: ${saleError.message}`
        );

        return;
      }

      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.productId || item.id,
        product_name: item.name,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.selling_price || 0),
        total:
          Number(item.selling_price || 0) *
          Number(item.quantity || 0),
      }));

      const { error: itemError } =
        await supabase
          .from("sale_items")
          .insert(saleItems);

      if (itemError) {
        console.error("Sale items error:", itemError);

        await supabase
          .from("sales")
          .delete()
          .eq("id", sale.id);

        await supabase
          .from("customers")
          .delete()
          .eq("id", customer.id);

        alert(
          `Sale could not be completed: ${itemError.message}`
        );

        return;
      }

      for (const item of cart) {
        if (item.variationId) {
          continue;
        }
        const newStock =
          Number(item.stock_qty || 0) -
          Number(item.quantity || 0);

        const { error: stockError } =
          await supabase
            .from("products")
            .update({
              stock_qty: Math.max(newStock, 0),
            })
            .eq("id", item.id);

        if (stockError) {
          console.error(
            "Stock update error:",
            stockError
          );
        }
      }

      alert(
        `Sale completed successfully!\nInvoice No: ${cleanInvoiceNo}`
      );

      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setReplacementDays("180");
      setWarrantyPeriod("1 Year");
      setDiscount(0);
      setPaid(0);
      setPaymentMethod("Cash On Delivery");

      await generateInvoiceNo();

      const { data: updatedProducts } =
        await supabase
          .from("products")
          .select(
            "id, name, sku, woo_product_id, selling_price, stock_qty, image_url"
          )
          .order("name");

      setProducts(updatedProducts || []);
    } catch (error) {
      console.error(
        "Complete sale error:",
        error
      );

      alert(
        `Something went wrong: ${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sales-page">
      {variationProduct && (
      <div className="variation-overlay">
        <div className="variation-modal">
          <div className="variation-modal-header">
            <div>
              <h3>Select Variation</h3>
              <p>{variationProduct.name}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setVariationProduct(null);
                setVariations([]);
              }}
            >
              Ã—
            </button>
          </div>

          <div className="variation-list">
            {variations.map((variation) => {
              const variationLabel =
                variation.attributes
                  ?.map(
                    (attribute) =>
                      `${attribute.name}: ${attribute.option}`
                  )
                  .filter(Boolean)
                  .join(" â€¢ ") || "Default";

              return (
                <button
                  type="button"
                  className="variation-option"
                  key={variation.id}
                  disabled={
                    Number(
                      variation.stock_quantity || 0
                    ) <= 0
                  }
                  onClick={() =>
                    addVariationToCart(variation)
                  }
                >
                  <div>
                    <strong>{variationLabel}</strong>

                    <small>
                      Stock:{" "}
                      {Number(
                        variation.stock_quantity || 0
                      )}
                    </small>
                  </div>

                  <strong>
                    BDT{" "}
                    {Number(
                      variation.price || 0
                    ).toFixed(2)}
                  </strong>
                </button>
              );
            })}
          </div>

          {loadingVariations && (
            <p className="variation-loading">
              Loading variations...
            </p>
          )}
        </div>
      </div>
    )}
    <div className="sales-grid">

        <div className="products-section">
          <div className="sales-card">

            <div className="sales-card-header">
              <div>
                <h2>Products</h2>
                <p>
                  Select products to add to the sale
                </p>
              </div>
            </div>

            <div className="product-search">
              <Search size={18} />

              <input
                type="text"
                placeholder="Search product or SKU..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <div className="product-list">

              {filteredProducts.length === 0 ? (
                <div className="empty-products">
                  No products found.
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    className="product-item"
                    key={product.id}
                    onClick={() =>
                      addToCart(product)
                    }
                  >

                    <div className="product-image">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                        />
                      ) : (
                        <PackageIcon />
                      )}
                    </div>

                    <div className="product-details">
                      <strong>
                        {product.name}
                      </strong>

                      <span>
                        SKU:{" "}
                        {product.sku || "N/A"}
                      </span>

                      <small>
                        Stock:{" "}
                        {Number(
                          product.stock_qty || 0
                        )}
                      </small>
                    </div>

                    <div className="product-price">
                      BDT{" "}
                      {Number(
                        product.selling_price || 0
                      ).toFixed(2)}
                    </div>

                  </button>
                ))
              )}

            </div>

            <div className="cart-title">
              Cart ({cart.length})
            </div>

            <div className="cart-list">

              {cart.length === 0 ? (
                <div className="empty-cart">
                  <ShoppingCartIcon />

                  <strong>
                    Your cart is empty
                  </strong>

                  <span>
                    Select a product to start a sale.
                  </span>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    className="cart-item"
                    key={item.id}
                  >

                    <div className="cart-item-info">

                      <strong>
                        {item.name}
                      </strong>

                      <span>
                        BDT{" "}
                        {Number(
                          item.selling_price || 0
                        ).toFixed(2)}
                      </span>

                    </div>

                    <div className="quantity-control">

                      <button
                        onClick={() =>
                          decreaseQuantity(
                            item.id
                          )
                        }
                      >
                        <Minus size={15} />
                      </button>

                      <strong>
                        {item.quantity}
                      </strong>

                      <button
                        onClick={() =>
                          increaseQuantity(
                            item.id
                          )
                        }
                      >
                        <Plus size={15} />
                      </button>

                    </div>

                  
                    <button
                      className="remove-item"
                      onClick={() =>
                        removeItem(item.id)
                      }
                    >
                      <Trash2 size={17} />
                    </button>

                  </div>
                ))
              )}

            </div>
          </div>
        </div>

        <div className="cart-section">

          <div className="sales-card">

            <div className="sales-card-header">
              <div>
                <h2>New Sale</h2>
                <p>
                  Customer and order details
                </p>
              </div>
            </div>

            <div className="customer-form">

              <div className="form-title">
                Sale Information
              </div>

              <div className="form-group">
                <label>Invoice No *</label>

                <input
                  type="text"
                  placeholder="Invoice number"
                  value={invoiceNo}
                  onChange={(e) =>
                    setInvoiceNo(e.target.value)
                  }
                />
              </div>

              <div className="form-title">
                Customer Information
              </div>

              <div className="form-group">
                <label>
                  Customer Name *
                </label>

                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="form-row">

                <div className="form-group">
                  <label>Phone</label>

                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) =>
                      setCustomerPhone(
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Address</label>

                  <input
                    type="text"
                    placeholder="Customer address"
                    value={customerAddress}
                    onChange={(e) =>
                      setCustomerAddress(
                        e.target.value
                      )
                    }
                  />
                </div>

              </div>
            </div>

            <div className="customer-form warranty-selection">
  <div className="form-title">
    ওয়ারেন্টি ও রিপ্লেসমেন্ট
  </div>

  <div className="form-row">
    <div className="form-group">
      <label>রিপ্লেসমেন্ট গ্যারান্টি</label>
      <select
        value={replacementDays}
        onChange={(e) => setReplacementDays(e.target.value)}
      >
        <option value="90">৯০ দিনের রিপ্লেসমেন্ট গ্যারান্টি</option>
        <option value="180">১৮০ দিনের রিপ্লেসমেন্ট গ্যারান্টি</option>
        <option value="365">১ বছরের রিপ্লেসমেন্ট গ্যারান্টি</option>
        <option value="none">প্রযোজ্য নয়</option>
      </select>
    </div>

    <div className="form-group">
      <label>ওয়ারেন্টি</label>
      <select
        value={warrantyPeriod}
        onChange={(e) => setWarrantyPeriod(e.target.value)}
      >
        <option value="1 Year">১ বছরের ওয়ারেন্টি</option>
        <option value="2 Years">২ বছরের ওয়ারেন্টি</option>
        <option value="none">প্রযোজ্য নয়</option>
      </select>
    </div>
  </div>

  <small>
    এই শর্তগুলো সম্পূর্ণ ইনভয়েসের জন্য সংরক্ষিত থাকবে।
  </small>
</div>

            <div className="sale-summary">

              <div>
                <span>Subtotal</span>

                <strong>
                  BDT {subtotal.toFixed(2)}
                </strong>
              </div>

              <div className="discount-row">
                <span>Discount</span>

                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) =>
                    setDiscount(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="total-row">
                <span>Total</span>

                <strong>
                  BDT {total.toFixed(2)}
                </strong>
              </div>

              <div className="paid-row">
                <span>Paid</span>

                <input
                  type="number"
                  min="0"
                  value={paid}
                  onChange={(e) =>
                    setPaid(e.target.value)
                  }
                />
              </div>

              <div className="due-row">
                <span>Due</span>

                <strong>
                  BDT {due.toFixed(2)}
                </strong>
              </div>

            </div>

            <div className="payment-section">

              <label>
                Payment Method
              </label>

              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value
                  )
                }
              >
                <option value="Cash On Delivery">
                  Cash On Delivery
                </option>

                <option value="bkash">
                  bKash
                </option>

                <option value="nagad">
                  Nagad
                </option>

                <option value="bank">
                  Bank
                </option>

                <option value="cash">
                  cash
                </option>
              </select>

            </div>

            <button
              className="complete-sale-button"
              onClick={completeSale}
              disabled={saving}
            >
              {saving
                ? "Saving Sale..."
                : "Complete Sale"}
            </button>

          </div>
        </div>


        <div
          className="orders-management"
          style={{
            marginTop: "30px",
            width: "100%",
          }}
        >
          <div className="sales-card">

            <div className="sales-card-header">
              <div>
                <h2>Recent Orders</h2>
                <p>Search an invoice to manage orders</p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  flex: 1,
                }}
              >
                <Search
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    opacity: 0.5,
                  }}
                />

                <input
                  type="text"
                  placeholder="Search invoice number..."
                  value={orderSearch}
                  onChange={(e) =>
                    setOrderSearch(e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 38px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {!orderSearch.trim() ? (
              <p
                style={{
                  textAlign: "center",
                  padding: "20px",
                  opacity: 0.6,
                }}
              >
                Search an invoice number to view orders.
              </p>
            ) : ordersLoading ? (
              <p
                style={{
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Loading orders...
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {orders
                  .filter((order) =>
                    String(order.invoice_no || "")
                      .toLowerCase()
                      .includes(
                        orderSearch.trim().toLowerCase()
                      )
                  )
                  .map((order) => (
                    <div
                      key={order.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        padding: "15px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>
                            {order.invoice_no}
                          </strong>

                          <div
                            style={{
                              marginTop: "6px",
                              fontSize: "14px",
                            }}
                          >
                            Total: BDT{" "}
                            {Number(
                              order.total || 0
                            ).toFixed(2)}
                            {"  "}•{"  "}
                            Paid: BDT{" "}
                            {Number(
                              order.paid || 0
                            ).toFixed(2)}
                            {"  "}•{"  "}
                            Due: BDT{" "}
                            {Number(
                              order.due || 0
                            ).toFixed(2)}
                          </div>

                          <div
                            style={{
                              marginTop: "5px",
                              fontSize: "13px",
                              opacity: 0.7,
                            }}
                          >
                            {order.payment_method || "N/A"}
                            {" • "}
                            {order.status || "N/A"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {Number(order.due || 0) > 0 &&
                            order.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentOrder(order);
                                  setPaymentAmount("");
                                  setPaymentMethodUpdate(
                                    order.payment_method ||
                                      "cash"
                                  );
                                }}
                              >
                                Add Payment
                              </button>
                            )}

                          {order.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() =>
                                cancelOrder(order)
                              }
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                {orders.filter((order) =>
                  String(order.invoice_no || "")
                    .toLowerCase()
                    .includes(
                      orderSearch.trim().toLowerCase()
                    )
                ).length === 0 && (
                  <p
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      opacity: 0.6,
                    }}
                  >
                    No matching order found.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {paymentOrder && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "24px",
                width: "100%",
                maxWidth: "420px",
              }}
            >
              <h2>Add Payment</h2>

              <p>
                Invoice: <strong>{paymentOrder.invoice_no}</strong>
              </p>

              <p>
                Due:{" "}
                <strong>
                  BDT{" "}
                  {Number(
                    paymentOrder.due || 0
                  ).toFixed(2)}
                </strong>
              </p>

              <div className="form-group">
                <label>Payment Amount</label>

                <input
                  type="number"
                  min="0"
                  max={Number(paymentOrder.due || 0)}
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>

                <select
                  value={paymentMethodUpdate}
                  onChange={(e) =>
                    setPaymentMethodUpdate(
                      e.target.value
                    )
                  }
                >
                  <option value="cash">
                    Cash
                  </option>

                  <option value="bkash">
                    bKash
                  </option>

                  <option value="nagad">
                    Nagad
                  </option>

                  <option value="bank">
                    Bank
                  </option>

                  <option value="Cash On Delivery">
                    Cash On Delivery
                  </option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  marginTop: "20px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOrder(null);
                    setPaymentAmount("");
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={addPayment}
                >
                  Save Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PackageIcon() {
  return (
    <div
      style={{
        fontSize: "22px",
        opacity: 0.5,
      }}
    >
      ??
    </div>
  );
}

function ShoppingCartIcon() {
  return (
    <div
      style={{
        fontSize: "30px",
        marginBottom: "8px",
      }}
    >
      ??
    </div>
  );
}

export default Sales;
















