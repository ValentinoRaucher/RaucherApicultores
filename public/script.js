// DOM Elements
const cartIcon = document.querySelector('.cart-icon');
const cartModal = document.querySelector('.cart-modal');
const closeCart = document.querySelector('.close-cart');
const cartCount = document.querySelector('.cart-count');
const cartItems = document.querySelector('.cart-items');
const totalAmount = document.getElementById('totalAmount');
const checkoutBtn = document.getElementById('checkoutBtn');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');
const addToCartButtons = document.querySelectorAll('.btn-add-to-cart');
const messageForm = document.getElementById('messageForm');

// Cart array
let cart = [];
let shippingCost = 0;

// MercadoPago integration
const mercadopago = new MercadoPago('TEST-2c0ccdfa-7319-438e-8354-2362b4381090', {
    locale: 'es-UY'
});

// Mobile menu toggle
menuToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
});

// Cart functionality
cartIcon.addEventListener('click', () => {
    cartModal.style.display = 'block';
    updateCart();
});

closeCart.addEventListener('click', () => {
    cartModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === cartModal) {
        cartModal.style.display = 'none';
    }
});

// Add to cart functionality
addToCartButtons.forEach(button => {
    button.addEventListener('click', () => {
        const productCard = button.closest('.product-card');
        const id = productCard.dataset.id;
        const name = productCard.dataset.name;
        const price = parseFloat(productCard.dataset.price);
        const image = productCard.dataset.image;
        
        addToCart(id, name, price, image);
    });
});

function addToCart(id, name, price, image) {
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id,
            name,
            price,
            image,
            quantity: 1
        });
    }
    
    updateCartCount();
    updateCart();
    
    // Show confirmation
    alert(`${name} agregado al carrito!`);
}

function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = count;
}

function calculateTotal() {
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return total + shippingCost;
}

function updateCheckoutTotal() {
    const checkoutTotalAmount = document.getElementById('checkoutTotalAmount');
    if (checkoutTotalAmount) {
        checkoutTotalAmount.textContent = calculateTotal().toFixed(2);
    }
}

function updateCart() {
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart-message">Tu carrito está vacío</p>';
        totalAmount.textContent = '0';
        return;
    }
    
    cartItems.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <div class="cart-item-price">$${item.price} x ${item.quantity} = $${itemTotal}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn minus" data-id="${item.id}">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn plus" data-id="${item.id}">+</button>
            </div>
            <button class="remove-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
        `;
        
        cartItems.appendChild(cartItem);
    });
    
    totalAmount.textContent = total.toFixed(2);
    
    // Add event listeners to new buttons
    document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            changeQuantity(id, -1);
        });
    });
    
    document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            changeQuantity(id, 1);
        });
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            removeItem(id);
        });
    });
}

function changeQuantity(id, change) {
    const item = cart.find(item => item.id === id);
    
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            removeItem(id);
        } else {
            updateCartCount();
            updateCart();
        }
    }
}

function removeItem(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartCount();
    updateCart();
}

const customerInfoModal = document.querySelector('.customer-info-modal');
const closeCustomerInfo = document.querySelector('.close-customer-info');
const customerInfoForm = document.getElementById('customerInfoForm');

// Checkout with MercadoPago
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }
    
    // Show customer info modal
    customerInfoModal.style.display = 'block';
    updateCheckoutTotal();
});

// Close customer info modal
closeCustomerInfo.addEventListener('click', () => {
    customerInfoModal.style.display = 'none';
});

const deliveryOptions = document.querySelectorAll('input[name="deliveryOption"]');
const deliveryDetails = document.getElementById('deliveryDetails');
const cityDetails = document.getElementById('cityDetails');
const addressDetails = document.getElementById('addressDetails');

// Show/hide delivery fields based on selection
deliveryOptions.forEach(option => {
    option.addEventListener('change', () => {
        if (option.value === "Envío a Domicilio") {
            shippingCost = 200;
            deliveryDetails.style.display = 'block';
            cityDetails.style.display = 'block';
            addressDetails.style.display = 'block';
        } else {
            shippingCost = 0;
            deliveryDetails.style.display = 'none';
            cityDetails.style.display = 'none';
            addressDetails.style.display = 'none';
        }
        updateCheckoutTotal();
    });
});

// Handle customer info form submission
customerInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const deliveryOption = document.querySelector('input[name="deliveryOption"]:checked').value;
    
    // Validate delivery fields if "Envío a Domicilio" is selected
    if (deliveryOption === "Envío a Domicilio") {
        const department = document.getElementById('department').value;
        const city = document.getElementById('customerCity').value;
        const address = document.getElementById('customerAddress').value;
        
        if (!department || !city || !address) {
            alert('Por favor, completa todos los campos de envío.');
            return;
        }
    }

    try {
        // Create preference data
        let items = cart.map(item => ({
            id: item.id,
            title: item.name,
            quantity: item.quantity,
            currency_id: 'ARS',
            unit_price: item.price
        }));

        // Add shipping cost if "Envío a Domicilio" is selected
        if (deliveryOption === "Envío a Domicilio") {
            items.push({
                id: 'shipping',
                title: 'Costo de Envío',
                quantity: 1,
                currency_id: 'ARS',
                unit_price: 200
            });
        }

        const preference = {
            items,
            back_urls: {
                success: 'https://raucher-apicultores.com/success',
                failure: 'https://raucher-apicultores.com/failure',
                pending: 'https://raucher-apicultores.com/pending'
            },
            auto_return: 'approved',
            customer: {
                name: customerName,
                phone: customerPhone
            },
            metadata: {
                deliveryOption: deliveryOption
            }
        };
        
        // Add delivery details to metadata if "Envío a Domicilio" is selected
        if (deliveryOption === "Envío a Domicilio") {
            preference.metadata.department = document.getElementById('department').value;
            preference.metadata.city = document.getElementById('customerCity').value;
            preference.metadata.address = document.getElementById('customerAddress').value;
        }
        
        // Send to backend to create preference
        const response = await fetch('/create_preference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(preference)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.init_point) {
            // Redirect to MercadoPago
            window.location.href = data.init_point;
        } else {
            alert('Error al procesar el pago: No se pudo obtener el punto de inicio');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el pago: ' + error.message);
    }
    
    // Close the modal after submission
    customerInfoModal.style.display = 'none';
});

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = messageForm.querySelector('input[type="text"]').value.trim();
    const email = messageForm.querySelector('input[type="email"]').value.trim();
    const message = messageForm.querySelector('textarea').value.trim();

    if (!name || !email || !message) {
        alert('Por favor, completa todos los campos del formulario.');
        return;
    }

    try {
        const response = await fetch('/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, message })
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert('Error al enviar el mensaje: ' + (errorData.error || 'Error desconocido'));
            return;
        }

        const data = await response.json();
        if (data.success) {
            alert('Mensaje enviado correctamente. Nos pondremos en contacto a la brevedad.');
            messageForm.reset();
        } else {
            alert('Error al enviar el mensaje.');
        }
    } catch (error) {
        console.error('Error enviando mensaje de contacto:', error);
        alert('Error al enviar el mensaje. Intenta nuevamente más tarde.');
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
            
            // Close mobile menu if open
            nav.classList.remove('active');
        }
    });
});

// Initialize cart count
updateCartCount();

// WhatsApp Float Button Dynamic Behavior with smooth fade
window.addEventListener('scroll', function() {
    const whatsappFloat = document.querySelector('.whatsapp-float');
    if (!whatsappFloat) return;

    if (window.scrollY > 100) {
        whatsappFloat.style.opacity = '1';
        whatsappFloat.style.pointerEvents = 'auto';
    } else {
        whatsappFloat.style.opacity = '0';
        whatsappFloat.style.pointerEvents = 'none';
    }
});

// Initialize WhatsApp button hidden with opacity 0
document.addEventListener('DOMContentLoaded', function() {
    const whatsappFloat = document.querySelector('.whatsapp-float');
    if (whatsappFloat) {
        whatsappFloat.style.opacity = '0';
        whatsappFloat.style.pointerEvents = 'none';
        whatsappFloat.style.transition = 'opacity 0.5s ease';
    }
});

// Keyboard accessibility for WhatsApp float button
document.addEventListener('DOMContentLoaded', function() {
    const whatsappFloat = document.querySelector('.whatsapp-float');
    if (whatsappFloat) {
        whatsappFloat.setAttribute('tabindex', '0');
        whatsappFloat.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                whatsappFloat.click();
            }
        });
    }
});

// Initially hide the WhatsApp button (opacity handled in CSS and scroll event)

