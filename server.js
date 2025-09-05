require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mercadopago = require('mercadopago');
const db = require('./config/database');
const nodemailer = require('nodemailer');

// Initialize MercadoPago with your access token
mercadopago.configure({
    access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

const axios = require('axios');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

app.post('/create_preference', async (req, res) => {
    try {
        console.log('Received payment request:', JSON.stringify(req.body, null, 2));

        const { items, customer, metadata } = req.body;

        // Validate required fields
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error('Validation error: No items provided');
            return res.status(400).json({ error: 'No items provided' });
        }

        if (!customer || !customer.name || !customer.phone) {
            console.error('Validation error: Customer information incomplete');
            return res.status(400).json({ error: 'Customer name and phone are required' });
        }

        if (!metadata || !metadata.deliveryOption) {
            console.error('Validation error: Delivery option missing');
            return res.status(400).json({ error: 'Delivery option is required' });
        }

        // Validate delivery details if shipping is selected
        if (metadata.deliveryOption === 'Envío a Domicilio') {
            if (!metadata.department || !metadata.city || !metadata.address) {
                console.error('Validation error: Delivery details incomplete');
                return res.status(400).json({ error: 'Department, city, and address are required for delivery' });
            }
        }
        // For "Retiro en Local", no additional validation needed

        // Save buyer information to database
        const buyerData = {
            name: customer.name.trim(),
            phone: customer.phone.trim(),
            delivery_option: metadata.deliveryOption,
            department: metadata.department ? metadata.department.trim() : null,
            city: metadata.city ? metadata.city.trim() : null,
            address: metadata.address ? metadata.address.trim() : null
        };

        console.log('Saving buyer data:', buyerData);

        db.run(
            `INSERT INTO buyers (name, phone, delivery_option, department, city, address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [buyerData.name, buyerData.phone, buyerData.delivery_option,
             buyerData.department, buyerData.city, buyerData.address],
            function(err) {
                if (err) {
                    console.error('Database error saving buyer:', err);
                    return res.status(500).json({
                        error: 'Error saving buyer information',
                        details: err.message
                    });
                }

                const buyerId = this.lastID;
                console.log('Buyer saved with ID:', buyerId);

                // Save order items to database
                const orderPromises = items.map(item => {
                    return new Promise((resolve, reject) => {
                        // Validate item data
                        if (!item.id || !item.title || !item.quantity || !item.unit_price) {
                            reject(new Error(`Invalid item data: ${JSON.stringify(item)}`));
                            return;
                        }

                        const totalPrice = item.quantity * item.unit_price;
                        console.log('Saving order item:', {
                            buyerId,
                            productId: item.id,
                            productName: item.title,
                            quantity: item.quantity,
                            unitPrice: item.unit_price,
                            totalPrice
                        });

                        db.run(
                            `INSERT INTO orders (buyer_id, product_id, product_name, quantity, unit_price, total_price)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [buyerId, item.id, item.title, item.quantity, item.unit_price, totalPrice],
                            function(err) {
                                if (err) {
                                    console.error('Database error saving order:', err);
                                    reject(err);
                                } else {
                                    console.log('Order item saved with ID:', this.lastID);
                                    resolve();
                                }
                            }
                        );
                    });
                });

                Promise.all(orderPromises)
                    .then(() => {
                        console.log('All order items saved successfully');

                        // Send email notification
                        const mailOptions = {
                            from: process.env.SMTP_USER,
                            to: process.env.NOTIFICATION_EMAIL,
                            subject: 'Nuevo mensaje de contacto - Raucher Apicultores',
                            text: `Se ha recibido un nuevo mensaje de contacto.\n\nNombre: ${customer.name}\nEmail: ${customer.email || 'No proporcionado'}\nMensaje: ${metadata.message || 'No proporcionado'}`
                        };

                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                console.error('Error sending email:', error);
                            } else {
                                console.log('Email sent:', info.response);
                            }
                        });

                        let preference = {
                            items: items.map(item => ({
                                id: item.id,
                                title: item.title,
                                quantity: item.quantity,
                                currency_id: item.currency_id || 'ARS',
                                unit_price: item.unit_price
                            })),
                            back_urls: {
                                success: 'https://raucher-apicultores.com/success',
                                failure: 'https://raucher-apicultores.com/failure',
                                pending: 'https://raucher-apicultores.com/pending'
                            },
                            auto_return: 'approved',
                            metadata: {
                                buyer_id: buyerId,
                                ...metadata
                            },
                            external_reference: buyerId.toString()
                        };
                        if (metadata.deliveryOption !== 'Retiro en Local') {
                            const phoneNumber = parseInt(customer.phone.replace(/\D/g, ''), 10) || 0;
                            preference.payer = {
                                name: customer.name,
                                phone: {
                                    number: phoneNumber
                                }
                            };
                        } else {
                            preference.payer = {
                                name: customer.name
                            };
                        }

                        console.log('Creating MercadoPago preference:', JSON.stringify(preference, null, 2));

                        mercadopago.preferences.create(preference)
                            .then(response => {
                                console.log('MercadoPago preference created successfully:', response.body.id);
                                res.json({ init_point: response.body.init_point });
                            })
                            .catch(error => {
                                console.error('MercadoPago API error:', error);
                                res.status(500).json({
                                    error: 'Error creating MercadoPago preference',
                                    details: error.message
                                });
                            });
                    })
                    .catch(error => {
                        console.error('Error saving orders:', error);
                        res.status(500).json({
                            error: 'Error saving order items',
                            details: error.message
                        });
                    });
            }
        );
    } catch (error) {
        console.error('Unexpected error in create_preference:', error);
        res.status(500).json({
            error: 'Unexpected error processing payment',
            details: error.message
        });
    }
});

// Add endpoint to get buyer information (for admin purposes)
app.get('/api/buyers', (req, res) => {
    try {
        db.all(`
            SELECT b.*,
                   json_group_array(
                       json_object(
                           'id', o.id,
                           'product_id', o.product_id,
                           'product_name', o.product_name,
                           'quantity', o.quantity,
                           'unit_price', o.unit_price,
                           'total_price', o.total_price,
                           'payment_status', o.payment_status,
                           'created_at', o.created_at
                       )
                   ) as orders
            FROM buyers b
            LEFT JOIN orders o ON b.id = o.buyer_id
            GROUP BY b.id
            ORDER BY b.created_at DESC
        `, (err, rows) => {
            if (err) {
                console.error('Error fetching buyers:', err);
                return res.status(500).json({ error: 'Error fetching buyers', message: err.message });
            }

            const buyersWithOrders = rows.map(row => ({
                ...row,
                orders: row.orders ? JSON.parse(row.orders) : []
            }));

            res.json(buyersWithOrders);
        });
    } catch (error) {
        console.error('Error fetching buyers:', error);
        res.status(500).json({ error: 'Error fetching buyers', message: error.message });
    }
});

// Contact form endpoint
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send email
    const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.NOTIFICATION_EMAIL,
        subject: 'Nuevo mensaje de contacto - Raucher Apicultores',
        text: `Se ha recibido un nuevo mensaje de contacto.\n\nNombre: ${name}\nEmail: ${email}\nMensaje: ${message}`,
        html: `
            <h2>Nuevo mensaje de contacto</h2>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Mensaje:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending contact email:', error);
            return res.status(500).json({ error: 'Error sending email' });
        } else {
            console.log('Contact email sent:', info.response);
            res.json({ success: true, message: 'Mensaje enviado correctamente' });
        }
    });
});

// Webhook endpoint for MercadoPago notifications
app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;

    if (action === 'payment.updated') {
        const paymentId = data.id;

        try {
            // Get payment details from MercadoPago
            const payment = await mercadopago.payment.get(paymentId);
            const paymentData = payment.body;

            if (paymentData.status === 'approved') {
                const externalReference = paymentData.external_reference;
                const buyerId = parseInt(externalReference);

                // Fetch buyer and orders from database
                db.get(`
                    SELECT b.name, b.phone, b.delivery_option, b.department, b.city, b.address
                    FROM buyers b
                    WHERE b.id = ?
                `, [buyerId], (err, buyer) => {
                    if (err) {
                        console.error('Error fetching buyer:', err);
                        return res.status(500).send('Error');
                    }

                    if (!buyer) {
                        console.error('Buyer not found');
                        return res.status(404).send('Buyer not found');
                    }

                    // Fetch orders
                    db.all(`
                        SELECT product_name, quantity
                        FROM orders
                        WHERE buyer_id = ?
                    `, [buyerId], (err, orders) => {
                        if (err) {
                            console.error('Error fetching orders:', err);
                            return res.status(500).send('Error');
                        }

                        // Build message
                        let message = 'Vendiste!!\n\nProductos:\n';
                        orders.forEach(order => {
                            message += `- ${order.product_name} (Cantidad: ${order.quantity})\n`;
                        });

                        message += `\nDatos del comprador:\n`;
                        message += `Nombre: ${buyer.name}\n`;
                        message += `Celular: ${buyer.phone}\n`;
                        if (buyer.delivery_option === 'Envío a Domicilio') {
                            message += `Departamento: ${buyer.department || 'N/A'}\n`;
                            message += `Ciudad: ${buyer.city || 'N/A'}\n`;
                            message += `Calle: ${buyer.address || 'N/A'}\n`;
                        }

                        // Send WhatsApp message via CallMeBot
                        const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=${process.env.CALLMEBOT_PHONE}&text=${encodeURIComponent(message)}&apikey=${process.env.CALLMEBOT_APIKEY}`;

                        axios.get(callMeBotUrl)
                            .then(() => {
                                console.log('WhatsApp message sent successfully');
                            })
                            .catch(error => {
                                console.error('Error sending WhatsApp message:', error);
                            });

                        // Update payment status in database
                        db.run(
                            `UPDATE orders SET payment_status = 'approved' WHERE buyer_id = ?`,
                            [buyerId],
                            function(err) {
                                if (err) {
                                    console.error('Error updating payment status:', err);
                                }
                            }
                        );

                        res.status(200).send('OK');
                    });
                });
            } else {
                res.status(200).send('Payment not approved');
            }
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.status(500).send('Error');
        }
    } else {
        res.status(200).send('Not a payment update');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
