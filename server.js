const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Servir arquivos estáticos da pasta public

mongoose.connect('mongodb://127.0.0.1:27017/restaurant', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const orderSchema = new mongoose.Schema({
  tableNumber: Number,
  orderItems: [{ name: String, quantity: Number, price: Number, status: { type: String, default: 'pending' } }]
});

const Order = mongoose.model('Order', orderSchema);

// Carregar itens do menu
let menuItems = [];
fs.readFile(path.join(__dirname, 'public', 'menu.json'), 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading menu file:', err);
  } else {
    menuItems = JSON.parse(data);
  }
});

app.post('/order', async (req, res) => {
  const { tableNumber, orderItems } = req.body;

  // Criar pedidos separados para cada item individualmente
  const newOrderItems = orderItems.flatMap(item => 
    Array(item.quantity).fill().map(() => ({ name: item.name, price: item.price }))
  );

  const newOrder = new Order({ tableNumber, orderItems: newOrderItems });
  await newOrder.save();
  res.status(201).send('Order received');
});

app.get('/orders', async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

app.get('/orders/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  const orders = await Order.find({ tableNumber: tableNumber });
  res.json(orders);
});

app.put('/orders/:itemId/status', async (req, res) => {
  const { itemId } = req.params;
  const { status } = req.body;
  const order = await Order.findOneAndUpdate(
    { 'orderItems._id': itemId },
    { $set: { 'orderItems.$.status': status } },
    { new: true }
  );
  res.json(order);
});

app.delete('/orders/reset/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  await Order.deleteMany({ tableNumber: tableNumber });
  res.status(200).send(`Orders for table ${tableNumber} reset`);
});

app.get('/menu', (req, res) => {
  res.json(menuItems);
});

const generateQRCode = async (tableNumber) => {
  try {
    const url = `http://localhost:${PORT}/order.html?table=${tableNumber}`;
    await QRCode.toFile(`./public/qrcodes/table-${tableNumber}.png`, url);
    console.log(`QR code for table ${tableNumber} generated.`);
  } catch (err) {
    console.error(err);
  }
};

// Gerar QR Codes para 5 mesas
for (let i = 1; i <= 5; i++) {
  generateQRCode(i);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
